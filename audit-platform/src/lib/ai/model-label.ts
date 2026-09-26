const id = process.env.ANTHROPIC_MODEL || "claude-opus-5";
const NAMES: Record<string, string> = {
  "claude-opus-5": "Claude Opus 5",
  "claude-opus-5-5": "Claude Opus 5.5",
  "claude-sonnet-5": "Claude Sonnet 5",
  "claude-fable-5-1": "Claude Fable 5.1",
};
export const AI_MODEL_LABEL = NAMES[id] ?? id;
