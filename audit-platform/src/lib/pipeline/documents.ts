import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import WordExtractor from "word-extractor";
import type { DocumentRow } from "../db-types";
import type { ContentBlock } from "../ai/claude";
import { documentKindLabel } from "../audit/catalog";

export const BUCKET = "engagement-files";
const MAX_TEXT_CHARS = 350_000;

export class IntegrityError extends Error {}

export async function downloadVerified(supabase: SupabaseClient, doc: DocumentRow): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(doc.storage_path);
  if (error || !data) throw new Error(`Could not read ${doc.filename} from storage: ${error?.message ?? "no data"}`);
  const buf = Buffer.from(await data.arrayBuffer());
  const hash = createHash("sha256").update(buf).digest("hex");
  if (hash !== doc.sha256) {
    throw new IntegrityError(
      `Integrity check failed for ${doc.filename}: the stored file's SHA-256 (${hash.slice(0, 12)}...) does not match the hash signed at upload (${doc.sha256.slice(0, 12)}...). Processing stopped.`,
    );
  }
  return buf;
}

function ext(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

function spreadsheetToText(buf: Buffer): string {
  const wb = XLSX.read(buf, { type: "buffer", cellFormula: true, cellDates: true });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws["!ref"]) continue;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    const rows: string[] = [];
    for (let r = range.s.r; r <= Math.min(range.e.r, 2000); r++) {
      const cells: string[] = [];
      for (let c = range.s.c; c <= Math.min(range.e.c, 40); c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell) continue;
        const shown = cell.w ?? String(cell.v ?? "");
        if (shown.trim() === "" && !cell.f) continue;
        cells.push(cell.f ? `${addr}=${shown} [=${cell.f}]` : `${addr}=${shown}`);
      }
      if (cells.length) rows.push(cells.join(" | "));
    }
    parts.push(`### Sheet: ${name}\n${rows.join("\n")}`);
  }
  return parts.join("\n\n");
}

async function wordToText(buf: Buffer): Promise<string> {
  const ex = new WordExtractor();
  const d = await ex.extract(buf);
  return [d.getHeaders(), d.getBody(), d.getFooters()].filter(Boolean).join("\n");
}

/** Turn a verified document into Claude content blocks, wrapped with its provenance. */
export async function toContentBlocks(doc: DocumentRow, buf: Buffer): Promise<ContentBlock[]> {
  const header = `<document id="${doc.id}" kind="${doc.kind}" type="${documentKindLabel(doc.kind)}" filename="${doc.filename}" sha256="${doc.sha256}" signed_by="${doc.signed_name ?? ""}">`;
  const e = ext(doc.filename);
  if (e === "pdf") {
    return [
      { type: "text", text: header },
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") }, title: doc.filename },
      { type: "text", text: "</document>" },
    ];
  }
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(e)) {
    const media = e === "jpg" ? "image/jpeg" : (`image/${e}` as "image/png" | "image/jpeg" | "image/webp" | "image/gif");
    return [
      { type: "text", text: header },
      { type: "image", source: { type: "base64", media_type: media as "image/png", data: buf.toString("base64") } },
      { type: "text", text: "</document>" },
    ];
  }
  let text: string;
  if (["xls", "xlsx", "xlsm", "csv"].includes(e)) text = spreadsheetToText(buf);
  else if (["doc", "docx"].includes(e)) text = await wordToText(buf);
  else text = buf.toString("utf8");
  if (text.length > MAX_TEXT_CHARS) {
    throw new Error(`${doc.filename} is too large to process in one pass (${text.length.toLocaleString()} characters). Upload the relevant sheets or pages only.`);
  }
  return [{ type: "text", text: `${header}\n${text}\n</document>` }];
}

export async function loadDocs(supabase: SupabaseClient, docs: DocumentRow[]): Promise<ContentBlock[]> {
  const blocks: ContentBlock[] = [];
  for (const d of docs) blocks.push(...(await toContentBlocks(d, await downloadVerified(supabase, d))));
  return blocks;
}
