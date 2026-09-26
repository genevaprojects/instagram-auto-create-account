import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import ExcelJS from "exceljs";
import { HyperFormula } from "hyperformula";
import { buildAwpWorkbook } from "../src/lib/export/awp";
import { buildPlanningDocx, buildIndexDocx } from "../src/lib/export/word";
import { formatRM } from "../src/lib/audit/money";
import { sampleBundle } from "./fixtures/sample-bundle";

const b = sampleBundle();
const etb = b.etb!;
console.log("ETB balanced:", etb.balanced, "| adjustments balanced:", etb.adjustmentsBalanced);
assert.ok(etb.balanced && etb.adjustmentsBalanced);
console.log("Revenue", formatRM(etb.totals.revenue_audited), "| PBT client", formatRM(etb.totals.pbt_client), "| PBT audited", formatRM(etb.totals.pbt_audited), "| PAT audited", formatRM(etb.totals.pat_audited));
assert.equal(formatRM(etb.totals.pbt_audited), "100,823.18");
const m = b.materiality!;
console.log("Materiality draft", formatRM(m.draft.materiality), "PM", formatRM(m.draft.performance), "SAD", formatRM(m.draft.sad), "| final", formatRM(m.final!.materiality));
assert.equal(formatRM(m.draft.materiality), "40,700.00"); // gross assets include tax recoverable after reclassification, as in the firm AB2 (DB-1 G26)
const re = etb.rows.find((r) => r.fs_caption === "Retained earnings")!;
assert.equal(re.movement, 0, "opening retained earnings should equal PY closing");
const rm = etb.rows.find((r) => r.fs_caption === "Repair and maintenance");
assert.ok(rm && rm.cy_audited === 0 && rm.py === 648000, "PY-only caption carried as comparative");
console.log("Flagged movements:", etb.rows.filter((r) => r.flagged).map((r) => r.fs_caption).join(", "));

(async () => {
  const buf = await buildAwpWorkbook(b, "Sample Chartered Accountants");
  mkdirSync("tests/out", { recursive: true });
  writeFileSync("tests/out/Sample_AWP_2026.xlsx", buf);
  writeFileSync("tests/out/Sample_Planning_2026.docx", await buildPlanningDocx(b));
  writeFileSync("tests/out/Sample_Index_2026.docx", await buildIndexDocx(b));

  // Independently recalculate every formula and compare with the engine's cached result
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const sheets: Record<string, (string | number | null)[][]> = {};
  const cached: { sheet: string; r: number; c: number; result: unknown; formula: string }[] = [];
  wb.eachSheet((ws) => {
    const grid: (string | number | null)[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, r) => {
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        grid[r - 1] ??= [];
        const v = cell.value as unknown;
        if (v && typeof v === "object" && "formula" in (v as object)) {
          const f = v as { formula: string; result?: unknown };
          grid[r - 1][c - 1] = `=${f.formula}`;
          cached.push({ sheet: ws.name, r: r - 1, c: c - 1, result: f.result, formula: f.formula });
        } else if (typeof v === "number" || typeof v === "string") grid[r - 1][c - 1] = v;
        else grid[r - 1][c - 1] = null;
      });
    });
    for (let i = 0; i < grid.length; i++) grid[i] ??= [];
    sheets[ws.name] = grid;
  });
  const hf = HyperFormula.buildFromSheets(sheets, { licenseKey: "gpl-v3" });
  let checked = 0;
  const bad: string[] = [];
  for (const c of cached) {
    if (typeof c.result !== "number") continue;
    const id = hf.getSheetId(c.sheet)!;
    const v = hf.getCellValue({ sheet: id, row: c.r, col: c.c });
    checked++;
    if (typeof v !== "number" || Math.abs(v - c.result) > 0.005) bad.push(`${c.sheet}!R${c.r + 1}C${c.c + 1} =${c.formula}: excel ${JSON.stringify(v)} vs engine ${c.result}`);
  }
  console.log(`Recalculated ${checked} formulas across ${Object.keys(sheets).length} sheets; mismatches: ${bad.length}`);
  if (bad.length) console.log(bad.slice(0, 15).join("\n"));
  assert.equal(bad.length, 0);
  console.log("Sheets:", Object.keys(sheets).join(", "));
})();
