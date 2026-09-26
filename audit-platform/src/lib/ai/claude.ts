import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { FIRM_CONSTITUTION } from "./prompts";

/** Model is configurable; defaults to Claude Opus 5. */
export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";
export const AI_EFFORT = (process.env.ANTHROPIC_EFFORT as "low" | "medium" | "high" | "xhigh" | "max" | undefined) || "high";

export class AiError extends Error {
  constructor(message: string, public readonly detail?: unknown) {
    super(message);
  }
}

export type ContentBlock = Anthropic.Beta.Messages.BetaContentBlockParam;

export interface AiUsage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
}

/** Convert a zod schema to the JSON-schema subset accepted by structured outputs. */
export function toOutputSchema(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: "draft-2020-12", io: "output" }) as Record<string, unknown>;
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        if (k === "$schema" || k === "minimum" || k === "maximum" || k === "exclusiveMinimum" || k === "exclusiveMaximum") continue;
        o[k] = walk(v);
      }
      if (o.type === "object" && o.properties && typeof o.properties === "object") {
        o.additionalProperties = false;
        o.required = Object.keys(o.properties as object);
      }
      return o;
    }
    return node;
  };
  return walk(raw) as Record<string, unknown>;
}

let client: Anthropic | null = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiError("ANTHROPIC_API_KEY is not configured on the server. Add it in the Vercel project settings.");
  }
  client ??= new Anthropic({ maxRetries: 3, timeout: 280_000 });
  return client;
}

/**
 * One structured call. The firm constitution is cached; the step prompt follows it.
 * Refusals are routed to Anthropic's recommended fallback model server-side.
 */
export async function callStructured<S extends z.ZodType>(opts: {
  step: string;
  stepPrompt: string;
  content: ContentBlock[];
  schema: S;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
}): Promise<{ data: z.infer<S>; usage: AiUsage }> {
  const anthropic = getClient();
  const stream = anthropic.beta.messages.stream({
    model: AI_MODEL,
    max_tokens: opts.maxTokens ?? 64_000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: FIRM_CONSTITUTION, cache_control: { type: "ephemeral" } },
      { type: "text", text: opts.stepPrompt },
    ],
    messages: [{ role: "user", content: opts.content }],
    output_config: {
      effort: opts.effort ?? AI_EFFORT,
      format: { type: "json_schema", schema: toOutputSchema(opts.schema) },
    },
  });
  let message: Anthropic.Beta.Messages.BetaMessage;
  try {
    message = await stream.finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new AiError("The AI service is rate-limited. Wait a minute and run the step again.", e.message);
    if (e instanceof Anthropic.AuthenticationError) throw new AiError("The ANTHROPIC_API_KEY on the server was rejected.", e.message);
    if (e instanceof Anthropic.APIError) throw new AiError(`AI service error (${e.status ?? "network"}): ${e.message}`);
    throw e;
  }

  if (message.stop_reason === "refusal") {
    throw new AiError("The AI declined this request. Review the uploaded documents and try again.", message.stop_details);
  }
  if (message.stop_reason === "max_tokens") {
    throw new AiError(`The ${opts.step} output was longer than the allowed length. Split the documents and try again.`);
  }
  const text = message.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AiError(`The ${opts.step} output was not valid JSON.`, text.slice(0, 500));
  }
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) {
    throw new AiError(`The ${opts.step} output did not match the required structure.`, parsed.error.issues.slice(0, 5));
  }
  return {
    data: parsed.data,
    usage: {
      model: message.model,
      input_tokens: message.usage.input_tokens + (message.usage.cache_creation_input_tokens ?? 0) + (message.usage.cache_read_input_tokens ?? 0),
      output_tokens: message.usage.output_tokens,
      cache_read_input_tokens: message.usage.cache_read_input_tokens ?? 0,
    },
  };
}
