import "server-only";
import ExcelJS from "exceljs";
import type { Bundle } from "../pipeline/bundle";
import { initialsOf } from "../pipeline/bundle";
import { BS_GROUPS, PL_GROUPS, GROUP_NORMAL_SIGN, TICKMARKS, WP_INDEX, indexTitle, type FsGroup } from "../audit/catalog";
import { fromCents, toCents, sum } from "../audit/money";
import { FIRM_BANDS } from "../audit/materiality";
import type { EtbRow } from "../audit/etb";
import { dmy, periodLabel } from "./format";

/* ------------------------------------------------------------------ styling */
const FONT = "Arial";
const NUM = '#,##0.00;(#,##0.00);"-"';
const PCT = '0.0%;(0.0%);"-"';
const thin: Partial<ExcelJS.Border> = { style: "thin" };
const dbl: Partial<ExcelJS.Border> = { style: "double" };

type Ws = ExcelJS.Worksheet;
type Val = number | string | null | { formula: string; result?: number | string };

function set(ws: Ws, addr: string, v: Val, style: { bold?: boolean; num?: boolean; pct?: boolean; italic?: boolean; color?: string; wrap?: boolean; align?: "left" | "right" | "center"; size?: number } = {}) {
  const c = ws.getCell(addr);
  c.value = v as ExcelJS.CellValue;
  c.font = { name: FONT, size: style.size ?? 10, bold: style.bold, italic: style.italic, color: style.color ? { argb: style.color } : undefined };
  if (style.num) c.numFmt = NUM;
  if (style.pct) c.numFmt = PCT;
  if (style.wrap || style.align) c.alignment = { wrapText: style.wrap, vertical: "top", horizontal: style.align };
  return c;
}
function money(ws: Ws, addr: string, cents: number | null, bold = false) {
  return set(ws, addr, cents === null ? null : fromCents(cents), { num: true, bold });
}
function fmla(ws: Ws, addr: string, formula: string, resultCents: number | null, bold = false) {
  return set(ws, addr, { formula, result: resultCents === null ? undefined : fromCents(resultCents) }, { num: true, bold });
}
function topBorder(ws: Ws, addr: string) {
  ws.getCell(addr).border = { top: thin };
}
function totalBorder(ws: Ws, addr: string, double = false) {
  ws.getCell(addr).border = { top: thin, bottom: double ? dbl : thin };
}
function tick(ws: Ws, addr: string, mark: string) {
  set(ws, addr, mark, { color: "FFC00000", align: "center", size: 9 });
}
function widths(ws: Ws, w: number[]) {
  w.forEach((x, i) => (ws.getColumn(i + 1).width = x));
}

/* ------------------------------------------------------------------ context */
interface Ctx {
  b: Bundle;
  wb: ExcelJS.Workbook;
  company: string;
  yearEnd: string;
  period: string;
  preparer: { initials: string; date: string };
  reviewer: { initials: string; date: string };
  partner: { initials: string; date: string };
  draft: boolean;
  reg: Map<string, string>; // named anchors, e.g. "DB2.pbt.client" -> "'DB-2'!G20"
}

function header(ctx: Ctx, ws: Ws, ref: string, subject: string, who?: { prepared?: string; preparedAt?: string; reviewed?: string; reviewedAt?: string }) {
  set(ws, "A1", "Company Name", { bold: true });
  set(ws, "C1", ":");
  set(ws, "D1", ctx.company, { bold: true });
  set(ws, "A2", "Year Ended", { bold: true });
  set(ws, "C2", ":");
  set(ws, "D2", ctx.yearEnd);
  set(ws, "A3", "Subject", { bold: true });
  set(ws, "C3", ":");
  set(ws, "D3", subject, { bold: true });
  const col = Math.max(ws.columnCount, 9);
  const L = (n: number) => ws.getColumn(n).letter;
  set(ws, `${L(col - 2)}1`, "Reference");
  set(ws, `${L(col - 1)}1`, ":");
  set(ws, `${L(col)}1`, `< ${ref} >`, { bold: true });
  set(ws, `${L(col - 2)}2`, "Prepared by");
  set(ws, `${L(col - 1)}2`, ":");
  set(ws, `${L(col)}2`, `${who?.prepared ?? ctx.preparer.initials}  ${who?.preparedAt ?? ctx.preparer.date}`.trim());
  set(ws, `${L(col - 2)}3`, "Reviewed by");
  set(ws, `${L(col - 1)}3`, ":");
  set(ws, `${L(col)}3`, `${who?.reviewed ?? ctx.reviewer.initials}  ${who?.reviewedAt ?? ctx.reviewer.date}`.trim());
  if (ctx.draft) set(ws, "D4", "DRAFT - not yet signed off by the engagement partner", { italic: true, color: "FFC00000", size: 9 });
  ws.views = [{ state: "frozen", ySplit: 5, showGridLines: false }];
  ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } };
  ws.headerFooter = { oddFooter: `&L${ctx.company} - ${ref}&RPage &P of &N` };
}

function paperWho(ctx: Ctx, ref: string) {
  const p = ctx.b.papers.find((x) => x.ref === ref);
  if (!p) return undefined;
  return {
    prepared: initialsOf(ctx.b, p.prepared_by) || "",
    preparedAt: dmy(p.prepared_at),
    reviewed: initialsOf(ctx.b, p.reviewed_by) || "",
    reviewedAt: dmy(p.reviewed_at),
  };
}

function workdone(ws: Ws, row: number, marks: string[]) {
  set(ws, `B${row}`, "< Audit Workdone >", { bold: true });
  let r = row + 1;
  for (const m of TICKMARKS.filter((t) => marks.includes(t.mark))) {
    tick(ws, `A${r}`, m.mark);
    set(ws, `B${r}`, m.meaning);
    r++;
  }
  return r;
}

function textBlock(ws: Ws, row: number, label: string, lines: string[] | string, colTo = "L") {
  const arr = Array.isArray(lines) ? lines : [lines];
  set(ws, `A${row}`, `${label} :`, { bold: true });
  let r = row;
  for (const line of arr.length ? arr : [""]) {
    ws.mergeCells(`C${r}:${colTo}${r}`);
    set(ws, `C${r}`, line, { wrap: true });
    ws.getRow(r).height = Math.max(15, Math.ceil(line.length / 110) * 13);
    r++;
  }
  return r + 1;
}

/* displayed amount for a group: normal balances positive */
const disp = (g: FsGroup, cents: number) => GROUP_NORMAL_SIGN[g] * cents;

/* ------------------------------------------------------------------ INDEX */
function sheetIndex(ctx: Ctx, ws: Ws) {
  widths(ws, [8, 50, 12, 14, 12, 14, 12, 16]);
  set(ws, "A1", ctx.company.toUpperCase(), { bold: true, size: 12 });
  set(ws, "A2", `AUDIT FOR THE YEAR ENDED ${ctx.yearEnd}`.toUpperCase(), { bold: true });
  set(ws, "A4", "INDEX - CURRENT AUDIT FILE", { bold: true, size: 11 });
  const hdr = ["REF", "DESCRIPTIONS", "STATUS", "PREPARED", "DATE", "REVIEWED", "DATE", "SOURCE"];
  hdr.forEach((h, i) => set(ws, `${String.fromCharCode(65 + i)}6`, h, { bold: true }));
  ws.getRow(6).eachCell((c) => (c.border = { bottom: thin }));
  const present = new Set<string>(["AB", "DA3", "DB", "DC", "DD", "BB", ...ctx.b.papers.map((p) => p.ref), ...(ctx.b.etb?.rows.map((r) => r.wp_ref) ?? [])]);
  let r = 7;
  for (const e of WP_INDEX.filter((x) => present.has(x.ref) || x.ref === "AA")) {
    const p = ctx.b.papers.find((x) => x.ref === e.ref);
    set(ws, `A${r}`, e.ref, { bold: true });
    set(ws, `B${r}`, e.title.toUpperCase());
    set(ws, `C${r}`, p ? p.status : "generated");
    set(ws, `D${r}`, p ? initialsOf(ctx.b, p.prepared_by) : ctx.preparer.initials);
    set(ws, `E${r}`, p ? dmy(p.prepared_at) : ctx.preparer.date);
    set(ws, `F${r}`, p ? initialsOf(ctx.b, p.reviewed_by) : ctx.reviewer.initials);
    set(ws, `G${r}`, p ? dmy(p.reviewed_at) : ctx.reviewer.date);
    set(ws, `H${r}`, e.firm ? "Firm index" : "Enhanced", { italic: !e.firm, color: e.firm ? undefined : "FF1F4E79" });
    r++;
  }
  r += 2;
  set(ws, `A${r}`, "ENGAGEMENT SIGN-OFF", { bold: true });
  r++;
  for (const stage of ["preparer", "reviewer", "partner"] as const) {
    const s = ctx.b.signoffs.find((x) => x.stage === stage);
    set(ws, `A${r}`, stage === "preparer" ? "Prepared by" : stage === "reviewer" ? "Reviewed by (Manager)" : "Approved by (Partner)");
    set(ws, `C${r}`, s ? `${s.signed_name} (${s.initials})` : "Not yet signed");
    set(ws, `E${r}`, s ? new Date(s.signed_at).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "");
    set(ws, `G${r}`, s ? `hash ${s.snapshot_hash.slice(0, 16)}...` : "", { size: 8, color: "FF666666" });
    r++;
  }
}

/* ------------------------------------------------------------------ DB-1 / DB-2 */
function captionRows(etb: EtbRow[], groups: FsGroup[]) {
  return groups.map((g) => ({ group: g, rows: etb.filter((r) => r.fs_group === g) })).filter((x) => x.rows.length);
}

function sheetDB(ctx: Ctx, ws: Ws, kind: "BS" | "PL") {
  const etb = ctx.b.etb!;
  widths(ws, [3, 44, 4, 4, 16, 2, 16, 16, 12, 16, 2, 10]);
  header(ctx, ws, kind === "BS" ? "DB-1" : "DB-2", kind === "BS" ? "Working Balance Sheet" : "Working Profit & Loss");
  const fy = new Date(ctx.b.engagement.fy_end).getUTCFullYear();
  set(ws, "E6", "Balance As Per", { bold: true, align: "center" });
  set(ws, "G6", "Balance As Per", { bold: true, align: "center" });
  set(ws, "H6", "Current Year Adjustment", { bold: true, align: "center", wrap: true });
  set(ws, "J6", "Audited", { bold: true, align: "center" });
  set(ws, "E7", "Last Year", { align: "center" });
  set(ws, "G7", "Client", { align: "center" });
  set(ws, "I7", "AJE/RJE", { align: "center" });
  set(ws, "J7", "Balance", { align: "center" });
  set(ws, "E8", fy - 1, { align: "center" });
  set(ws, "G8", fy, { align: "center" });
  set(ws, "J8", fy, { align: "center" });
  ["E", "G", "H", "J"].forEach((c) => set(ws, `${c}9`, "RM", { bold: true, align: "center" }));
  set(ws, "L9", "Ref", { bold: true });

  let r = 11;
  const groupTotals: { group: FsGroup; row: number; py: number | null; cy: number; adj: number; aud: number }[] = [];
  const pyPat = -sum(etb.rows.filter((x) => PL_GROUPS.includes(x.fs_group)).map((x) => x.py ?? 0));
  const cyPatClient = -sum(etb.rows.filter((x) => PL_GROUPS.includes(x.fs_group)).map((x) => x.cy_client));
  const cyPatAud = -sum(etb.rows.filter((x) => PL_GROUPS.includes(x.fs_group)).map((x) => x.cy_audited));
  const hasPy = etb.rows.some((x) => x.py !== null);

  for (const { group, rows } of captionRows(etb.rows, kind === "BS" ? BS_GROUPS : PL_GROUPS)) {
    set(ws, `A${r}`, group.toUpperCase(), { bold: true });
    r++;
    const first = r;
    let gPy = 0, gCy = 0, gAdj = 0, gAud = 0;
    for (const row of rows) {
      const isRE = group === "Equity" && /retained/i.test(row.fs_caption);
      set(ws, `B${r}`, isRE ? `${row.fs_caption} brought forward` : row.fs_caption);
      // Prior-year retained earnings is shown as its opening balance (closing less prior-year profit)
      // so that the "Profit for the year" row below reproduces the firm's DB-1 layout.
      const pyVal = row.py === null ? null : isRE ? disp(group, row.py) - pyPat : disp(group, row.py);
      money(ws, `E${r}`, pyVal);
      money(ws, `G${r}`, disp(group, row.cy_client));
      const adj = disp(group, row.adj_dr - row.adj_cr);
      money(ws, `H${r}`, adj === 0 ? null : adj);
      set(ws, `I${r}`, row.adj_refs.join(", "), { size: 9 });
      fmla(ws, `J${r}`, `G${r}+H${r}`, disp(group, row.cy_audited));
      set(ws, `L${r}`, `<${row.wp_ref}>`, { color: "FF1F4E79" });
      ctx.reg.set(`${kind}:${row.fs_caption}`, `'${ws.name}'!J${r}`);
      gPy += pyVal ?? 0; gCy += disp(group, row.cy_client); gAdj += adj; gAud += disp(group, row.cy_audited);
      r++;
      if (isRE) {
        set(ws, `B${r}`, "Profit for the year");
        money(ws, `E${r}`, hasPy ? pyPat : null);
        fmla(ws, `G${r}`, `'DB-2'!G${"{PAT}"}`, cyPatClient);
        fmla(ws, `H${r}`, `J${r}-G${r}`, cyPatAud - cyPatClient);
        fmla(ws, `J${r}`, `'DB-2'!J${"{PAT}"}`, cyPatAud);
        set(ws, `L${r}`, "<DB-2>", { color: "FF1F4E79" });
        gPy += hasPy ? pyPat : 0; gCy += cyPatClient; gAdj += cyPatAud - cyPatClient; gAud += cyPatAud;
        r++;
      }
    }
    const last = r - 1;
    fmla(ws, `E${r}`, `SUM(E${first}:E${last})`, hasPy ? gPy : null, true);
    fmla(ws, `G${r}`, `SUM(G${first}:G${last})`, gCy, true);
    fmla(ws, `H${r}`, `SUM(H${first}:H${last})`, gAdj, true);
    fmla(ws, `J${r}`, `SUM(J${first}:J${last})`, gAud, true);
    ["E", "G", "H", "J"].forEach((c) => topBorder(ws, `${c}${r}`));
    groupTotals.push({ group, row: r, py: hasPy ? gPy : null, cy: gCy, adj: gAdj, aud: gAud });
    r += 2;
  }

  const refOf = (g: FsGroup) => groupTotals.find((x) => x.group === g);
  const expr = (col: string, plus: FsGroup[], minus: FsGroup[]) =>
    [...plus.filter(refOf).map((g) => `+${col}${refOf(g)!.row}`), ...minus.filter(refOf).map((g) => `-${col}${refOf(g)!.row}`)].join("").replace(/^\+/, "") || "0";
  const val = (k: "py" | "cy" | "adj" | "aud", plus: FsGroup[], minus: FsGroup[]) =>
    sum(plus.map((g) => (refOf(g)?.[k] as number) ?? 0)) - sum(minus.map((g) => (refOf(g)?.[k] as number) ?? 0));

  if (kind === "BS") {
    const assets: FsGroup[] = ["Non-current assets", "Current assets"];
    const liabEq: FsGroup[] = ["Equity", "Non-current liabilities", "Current liabilities"];
    set(ws, `A${r}`, "TOTAL ASSETS", { bold: true });
    for (const c of ["E", "G", "H", "J"] as const) fmla(ws, `${c}${r}`, expr(c, assets, []), val(c === "E" ? "py" : c === "G" ? "cy" : c === "H" ? "adj" : "aud", assets, []), true);
    ctx.reg.set("BS:total_assets:client", `'DB-1'!G${r}`);
    ctx.reg.set("BS:total_assets:audited", `'DB-1'!J${r}`);
    const ta = r;
    r += 2;
    set(ws, `A${r}`, "TOTAL EQUITY AND LIABILITIES", { bold: true });
    for (const c of ["E", "G", "H", "J"] as const) fmla(ws, `${c}${r}`, expr(c, liabEq, []), val(c === "E" ? "py" : c === "G" ? "cy" : c === "H" ? "adj" : "aud", liabEq, []), true);
    ["E", "G", "H", "J"].forEach((c) => totalBorder(ws, `${c}${r}`, true));
    const tl = r;
    r += 2;
    set(ws, `A${r}`, "Check: assets less equity and liabilities (must be nil)", { italic: true, size: 9 });
    for (const c of ["E", "G", "J"]) fmla(ws, `${c}${r}`, `ROUND(${c}${ta}-${c}${tl},2)`, 0);
    r += 1;
    tick(ws, `E${r}`, "f,#");
    tick(ws, `G${r}`, "f,b");
    tick(ws, `J${r}`, "f");
  } else {
    const income: FsGroup[] = ["Revenue", "Other income"];
    const costs: FsGroup[] = ["Cost of sales", "Operating expenses", "Finance costs"];
    set(ws, `A${r}`, "PROFIT BEFORE TAXATION", { bold: true });
    for (const c of ["E", "G", "H", "J"] as const) fmla(ws, `${c}${r}`, expr(c, income, costs), val(c === "E" ? "py" : c === "G" ? "cy" : c === "H" ? "adj" : "aud", income, costs), true);
    ctx.reg.set("PL:pbt:client", `'DB-2'!G${r}`);
    ctx.reg.set("PL:pbt:audited", `'DB-2'!J${r}`);
    ctx.reg.set("PL:revenue:client", refOf("Revenue") ? `'DB-2'!G${refOf("Revenue")!.row}` : "0");
    ctx.reg.set("PL:revenue:audited", refOf("Revenue") ? `'DB-2'!J${refOf("Revenue")!.row}` : "0");
    ["E", "G", "H", "J"].forEach((c) => topBorder(ws, `${c}${r}`));
    const pbt = r;
    r += 2;
    set(ws, `A${r}`, "PROFIT AFTER TAXATION", { bold: true });
    const taxRow = refOf("Taxation")?.row;
    for (const c of ["E", "G", "H", "J"] as const) {
      const k = c === "E" ? "py" : c === "G" ? "cy" : c === "H" ? "adj" : "aud";
      fmla(ws, `${c}${r}`, taxRow ? `${c}${pbt}-${c}${taxRow}` : `${c}${pbt}`, val(k, income, costs) - ((refOf("Taxation")?.[k] as number) ?? 0), true);
      totalBorder(ws, `${c}${r}`, true);
    }
    ctx.reg.set("PL:pat_row", String(r));
    r += 1;
    tick(ws, `E${r}`, "f,#");
    tick(ws, `G${r}`, "f,b");
    tick(ws, `J${r}`, "f");
  }
  r += 3;
  workdone(ws, r, ["f", "b", "#"]);
}

/* resolve the {PAT} placeholder in DB-1 once DB-2 is built */
function patchPat(ctx: Ctx, ws: Ws) {
  const pat = ctx.reg.get("PL:pat_row");
  if (!pat) return;
  ws.eachRow((row) =>
    row.eachCell((cell) => {
      const v = cell.value as { formula?: string; result?: number } | null;
      if (v && typeof v === "object" && v.formula?.includes("{PAT}")) cell.value = { formula: v.formula.replace(/\{PAT\}/g, pat), result: v.result };
    }),
  );
}

/* ------------------------------------------------------------------ AB2 materiality */
function sheetAB2(ctx: Ctx, ws: Ws) {
  const m = ctx.b.materiality!;
  widths(ws, [3, 34, 4, 16, 16, 16, 10, 8, 16, 10]);
  header(ctx, ws, "AB2", "Planning materiality");
  const block = (start: number, label: string, f: typeof m.draft, src: "client" | "audited") => {
    set(ws, `B${start}`, label, { bold: true });
    ["Per Draft Accounts", "Adjustments", "Adjusted Balance", "% (Note 1)", "Weight"].forEach((h, i) => set(ws, `${"DEFGH"[i]}${start}`, h, { bold: true, wrap: true, align: "center" }));
    set(ws, `I${start}`, "RM", { bold: true, align: "center" });
    const refs = [ctx.reg.get(`PL:revenue:${src}`), ctx.reg.get(`PL:pbt:${src}`), ctx.reg.get(`BS:total_assets:${src}`)];
    const draftVals = [m.draft.basis[0].amount, m.draft.basis[1].amount, m.draft.basis[2].amount];
    f.basis.forEach((bs, i) => {
      const r = start + 1 + i;
      set(ws, `B${r}`, bs.name);
      money(ws, `D${r}`, draftVals[i]);
      fmla(ws, `F${r}`, refs[i] ?? "0", bs.amount);
      fmla(ws, `E${r}`, `F${r}-D${r}`, bs.amount - draftVals[i]);
      set(ws, `G${r}`, bs.rate, { pct: true });
      set(ws, `H${r}`, bs.result ? 1 : 0, { align: "center" });
      fmla(ws, `I${r}`, `IF(F${r}>0,ROUND(F${r}*G${r},2),0)`, bs.result ?? 0);
    });
    const r0 = start + 5;
    set(ws, `B${r0}`, "MATERIALITY LEVEL (highest)", { bold: true });
    fmla(ws, `I${r0}`, `MAX(I${start + 1}:I${start + 3})`, f.highest, true);
    fmla(ws, `I${r0 + 1}`, `ROUNDUP(I${r0},-2)`, f.materiality, true);
    set(ws, `J${r0 + 1}`, "Rounded", { italic: true });
    set(ws, `B${r0 + 3}`, "Materiality");
    fmla(ws, `I${r0 + 3}`, `I${r0 + 1}`, f.materiality);
    set(ws, `B${r0 + 4}`, "Value of anticipated uncorrected misstatements");
    fmla(ws, `I${r0 + 4}`, `-0.1*I${r0 + 3}`, f.anticipatedMisstatements);
    set(ws, `B${r0 + 5}`, "Performance materiality", { bold: true });
    fmla(ws, `I${r0 + 5}`, `SUM(I${r0 + 3}:I${r0 + 4})`, f.performance, true);
    set(ws, `B${r0 + 6}`, 'Summary of Audit Differences ("SAD") threshold', { bold: true });
    fmla(ws, `I${r0 + 6}`, `I${r0 + 3}*0.05`, f.sad, true);
    return r0 + 8;
  };
  let r = block(7, "DRAFT", m.draft, "client");
  if (m.final) r = block(r + 1, "FINAL (reconsidered on audited figures)", m.final, "audited");
  r += 1;
  set(ws, `B${r}`, "Note 1: Turnover / gross assets bands", { bold: true });
  r++;
  for (const band of FIRM_BANDS) {
    set(ws, `C${r}`, band.label);
    set(ws, `E${r}`, band.rate, { pct: true });
    r++;
  }
  set(ws, `C${r}`, "Result before tax");
  set(ws, `E${r}`, 0.1, { pct: true });
  r += 2;
  set(ws, `B${r}`, "ISA 320 BENCHMARK VIEW (enhanced)", { bold: true, color: "FF1F4E79" });
  r++;
  const isa = m.isa;
  const rows: [string, Val, boolean?][] = [
    ["Entity profile", isa.profile.replace(/_/g, " ")],
    ["Benchmark", isa.benchmark],
    ["Benchmark amount", fromCents(isa.benchmarkAmount), true],
    ["Percentage applied", isa.rate],
    ["Overall materiality (rounded down)", fromCents(isa.materiality), true],
    [`Performance materiality (${Math.round(isa.performanceRate * 100)}% for ${m.riskLevel} risk)`, fromCents(isa.performance), true],
    ["Clearly trivial threshold (5%)", fromCents(isa.clearlyTrivial), true],
  ];
  for (const [k, v, isNum] of rows) {
    set(ws, `B${r}`, k);
    const c = set(ws, `I${r}`, v, { num: Boolean(isNum) });
    if (k === "Percentage applied") c.numFmt = PCT;
    r++;
  }
  set(ws, `B${r}`, "Rationale");
  ws.mergeCells(`D${r}:J${r}`);
  set(ws, `D${r}`, isa.rationale, { wrap: true });
  ws.getRow(r).height = 40;
  r += 2;
  set(ws, `B${r}`, "Method adopted for this engagement", { bold: true });
  set(ws, `D${r}`, m.selected === "firm" ? "Firm method (highest of three benchmarks)" : "ISA 320 single benchmark");
  r++;
  if (m.selectedReason) {
    ws.mergeCells(`D${r}:J${r}`);
    set(ws, `D${r}`, m.selectedReason, { wrap: true });
    r++;
  }
  const firmM = (m.final ?? m.draft).materiality;
  if (m.selected === "firm" && firmM > isa.materiality * 1.5) {
    ws.mergeCells(`B${r}:J${r}`);
    set(ws, `B${r}`, `Reviewer note: firm-method materiality (RM${fromCents(firmM).toLocaleString("en-MY")}) exceeds the ISA 320 benchmark view by more than 50%. Document why the higher level is appropriate, or adopt the ISA 320 figure.`, { wrap: true, color: "FFC00000" });
    ws.getRow(r).height = 30;
  }
}

/* ------------------------------------------------------------------ DA3 */
function sheetDA3(ctx: Ctx, ws: Ws) {
  widths(ws, [14, 4, 20, 14, 14, 16, 4, 16, 4, 16, 4, 12]);
  header(ctx, ws, "DA3", "Test of opening balance");
  let r = 7;
  r = textBlock(ws, r, "OBJECTIVE", "To ensure that opening balances of the client's books agree with last year's statutory financial statements.");
  r = textBlock(ws, r, "SOURCE", "Cash book; general ledger; prior-year audited financial statements.");
  r = textBlock(ws, r, "SCOPE", "All material balance sheet items.");
  r = textBlock(ws, r, "PROCEDURES", "Agreed opening balances per client's ledger with the statutory accounts. Investigated any differences and considered whether adjustment is required. Ensured that all prior year's audit adjustments were taken up in the books.");
  const ob = ctx.b.settings.opening_balance_test;
  set(ws, `F${r}`, "(Per GL)", { align: "center" });
  set(ws, `H${r}`, "(Per audited report)", { align: "center" });
  set(ws, `J${r}`, "Differences", { align: "center" });
  r++;
  ["F", "H", "J"].forEach((c) => set(ws, `${c}${r}`, "RM", { bold: true, align: "center" }));
  r++;
  set(ws, `C${r}`, "Retained profits");
  money(ws, `F${r}`, ob?.tb_re_bf == null ? null : toCents(ob.tb_re_bf));
  money(ws, `H${r}`, ob?.py_re_cf == null ? null : toCents(ob.py_re_cf));
  fmla(ws, `J${r}`, `F${r}-H${r}`, ob?.difference == null ? null : toCents(ob.difference));
  r++;
  // Balance-sheet captions: CY opening per client comparatives vs PY audited
  set(ws, `C${r + 1}`, "Balance sheet captions: client comparative vs prior-year audited", { bold: true });
  r += 2;
  for (const row of (ctx.b.etb?.rows ?? []).filter((x) => BS_GROUPS.includes(x.fs_group) && !/retained/i.test(x.fs_caption))) {
    const clientPy = sum(row.accounts.map((a) => a.py_client ?? 0));
    set(ws, `C${r}`, row.fs_caption);
    money(ws, `F${r}`, disp(row.fs_group, clientPy));
    money(ws, `H${r}`, row.py === null ? null : disp(row.fs_group, row.py));
    fmla(ws, `J${r}`, `F${r}-H${r}`, row.py === null ? null : disp(row.fs_group, clientPy - row.py));
    r++;
  }
  r++;
  const diff = ob?.difference ?? null;
  r = textBlock(ws, r, "OBSERVATIONS", diff === null ? "Prior-year audited source not yet provided; opening balances not agreed." : diff === 0 ? "Opening retained profits agree to the prior-year audited financial statements. No difference noted." : `Difference of RM${diff.toFixed(2)} noted in opening retained profits. Investigate and adjust.`);
  textBlock(ws, r, "CONCLUSION", diff === 0 ? "Objective met." : "Pending: opening balances to be agreed.");
}

/* ------------------------------------------------------------------ DC1 / DC2 */
function sheetDC(ctx: Ctx, ws: Ws, kind: "AJE" | "RJE") {
  widths(ws, [9, 3, 34, 20, 4, 4, 10, 15, 15, 15, 15]);
  header(ctx, ws, kind === "AJE" ? "DC1" : "DC2", kind === "AJE" ? "Adjusting Journal Entries (AJE)" : "Reclassification Journal Entries (RJE)");
  set(ws, "A6", "No", { bold: true });
  set(ws, "C6", "Particulars", { bold: true });
  set(ws, "G6", "Audit", { bold: true, align: "center" });
  set(ws, "H6", "Income Statement", { bold: true, align: "center" });
  set(ws, "J6", "Balance Sheet", { bold: true, align: "center" });
  set(ws, "G7", "Ref.", { align: "center" });
  ["H", "I", "J", "K"].forEach((c, i) => set(ws, `${c}7`, i % 2 ? "Cr" : "Dr", { align: "center", bold: true }));
  let r = 9;
  const first = r;
  const entries = ctx.b.adjustments.filter((a) => a.kind === kind && a.status === "accepted");
  const tot = { h: 0, i: 0, j: 0, k: 0 };
  for (const a of entries) {
    set(ws, `A${r}`, a.ref, { bold: true });
    const lines = [...a.lines.filter((l) => l.dr > 0), ...a.lines.filter((l) => l.cr > 0)];
    for (const l of lines) {
      const isPL = PL_GROUPS.includes(l.fs_group);
      set(ws, l.dr > 0 ? `C${r}` : `D${r}`, l.account);
      set(ws, `G${r}`, `<${l.wp_ref}>`, { align: "center", color: "FF1F4E79" });
      const col = isPL ? (l.dr > 0 ? "H" : "I") : l.dr > 0 ? "J" : "K";
      const cents = toCents(l.dr > 0 ? l.dr : l.cr);
      money(ws, `${col}${r}`, cents);
      tot[col.toLowerCase() as "h"] += cents;
      r++;
    }
    set(ws, `C${r}`, `(${a.description.replace(/^\(|\)$/g, "")})`, { italic: true });
    r += 2;
  }
  if (!entries.length) {
    set(ws, `C${r}`, `No ${kind === "AJE" ? "adjusting" : "reclassification"} entries accepted.`, { italic: true });
    r += 2;
  }
  set(ws, `C${r}`, "TOTAL", { bold: true });
  (["H", "I", "J", "K"] as const).forEach((c) => {
    fmla(ws, `${c}${r}`, `SUM(${c}${first}:${c}${r - 1})`, tot[c.toLowerCase() as "h"], true);
    totalBorder(ws, `${c}${r}`, true);
  });
  r++;
  set(ws, `C${r}`, "Check: total debits less total credits (must be nil)", { italic: true, size: 9 });
  fmla(ws, `K${r}`, `ROUND(H${r - 1}+J${r - 1}-I${r - 1}-K${r - 1},2)`, 0);
  r += 4;
  const dirs = ctx.b.client.directors.length ? ctx.b.client.directors : ["Director", "Director"];
  set(ws, `C${r}`, "Approved by,");
  if (dirs[1]) set(ws, `I${r}`, "Approved by,");
  r += 6;
  set(ws, `C${r}`, "..............................");
  if (dirs[1]) set(ws, `I${r}`, "..............................");
  r++;
  set(ws, `C${r}`, "Director");
  if (dirs[1]) set(ws, `I${r}`, "Director");
  r++;
  set(ws, `C${r}`, `(${dirs[0].toUpperCase()})`);
  if (dirs[1]) set(ws, `I${r}`, `(${dirs[1].toUpperCase()})`);
}

/* ------------------------------------------------------------------ DD ETB */
function sheetETB(ctx: Ctx, ws: Ws) {
  const etb = ctx.b.etb!;
  widths(ws, [7, 40, 30, 16, 16, 14, 14, 12, 16, 16, 9, 8]);
  header(ctx, ws, "DD", "Extended Trial Balance");
  const h = ["Ref", "Account per client", "FS caption", "PY audited", "CY per client", "Adj Dr", "Adj Cr", "Adj ref", "CY audited", "Movement", "%", "Flag"];
  h.forEach((x, i) => set(ws, `${String.fromCharCode(65 + i)}6`, x, { bold: true, wrap: true, align: i > 2 ? "center" : undefined }));
  set(ws, "D7", "Debit positive / (credit)", { italic: true, size: 8 });
  let r = 8;
  const groupRows: number[] = [];
  const all = [...BS_GROUPS, ...PL_GROUPS];
  for (const g of all) {
    const rows = etb.rows.filter((x) => x.fs_group === g);
    if (!rows.length) continue;
    set(ws, `A${r}`, g.toUpperCase(), { bold: true });
    r++;
    const gFirst = r;
    for (const row of rows) {
      const capFirst = r;
      for (const a of row.accounts) {
        set(ws, `A${r}`, row.wp_ref, { color: "FF1F4E79" });
        set(ws, `B${r}`, a.account_name);
        set(ws, `C${r}`, row.fs_caption);
        money(ws, `E${r}`, a.cy);
        fmla(ws, `I${r}`, `E${r}+F${r}-G${r}`, a.cy);
        r++;
      }
      for (const adj of ctx.b.adjustments.filter((x) => x.status === "accepted")) {
        for (const l of adj.lines.filter((l) => l.fs_caption.trim().toLowerCase() === row.fs_caption.toLowerCase() && l.fs_group === row.fs_group)) {
          set(ws, `A${r}`, row.wp_ref, { color: "FF1F4E79" });
          set(ws, `B${r}`, `${adj.ref}: ${l.account}`, { italic: true });
          set(ws, `C${r}`, row.fs_caption);
          money(ws, `F${r}`, toCents(l.dr) || null);
          money(ws, `G${r}`, toCents(l.cr) || null);
          set(ws, `H${r}`, adj.ref, { size: 9 });
          fmla(ws, `I${r}`, `E${r}+F${r}-G${r}`, toCents(l.dr) - toCents(l.cr));
          r++;
        }
      }
      if (r === capFirst) {
        // Prior-year-only caption: keep a nil detail line so the subtotal formula has a range
        set(ws, `A${r}`, row.wp_ref, { color: "FF1F4E79" });
        set(ws, `B${r}`, "No current-year balance", { italic: true, color: "FF666666" });
        set(ws, `C${r}`, row.fs_caption);
        money(ws, `E${r}`, 0);
        fmla(ws, `I${r}`, `E${r}+F${r}-G${r}`, 0);
        r++;
      }
      // caption subtotal line
      set(ws, `C${r}`, `Total ${row.fs_caption}`, { bold: true });
      money(ws, `D${r}`, row.py);
      fmla(ws, `E${r}`, `SUM(E${capFirst}:E${r - 1})`, row.cy_client, true);
      fmla(ws, `F${r}`, `SUM(F${capFirst}:F${r - 1})`, row.adj_dr, true);
      fmla(ws, `G${r}`, `SUM(G${capFirst}:G${r - 1})`, row.adj_cr, true);
      fmla(ws, `I${r}`, `SUM(I${capFirst}:I${r - 1})`, row.cy_audited, true);
      if (row.py !== null) {
        fmla(ws, `J${r}`, `I${r}-D${r}`, row.movement);
        set(ws, `K${r}`, { formula: `IF(D${r}=0,"",J${r}/ABS(D${r}))`, result: row.movement_pct ?? "" }, { pct: true });
      }
      if (row.flagged) set(ws, `L${r}`, "Explain <DE>", { color: "FFC00000", size: 9 });
      ["D", "E", "F", "G", "I"].forEach((c) => topBorder(ws, `${c}${r}`));
      ws.getRow(r).eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F1EA" } }));
      groupRows.push(r);
      r += 2;
    }
    void gFirst;
  }
  set(ws, `B${r}`, "TOTAL (must be nil)", { bold: true });
  const list = (c: string) => groupRows.map((x) => `${c}${x}`).join(",");
  fmla(ws, `D${r}`, `SUM(${list("D")})`, etb.rows.every((x) => x.py === null) ? null : sum(etb.rows.map((x) => x.py ?? 0)), true);
  fmla(ws, `E${r}`, `SUM(${list("E")})`, etb.totals.cy_client, true);
  fmla(ws, `F${r}`, `SUM(${list("F")})`, etb.totals.adj_dr, true);
  fmla(ws, `G${r}`, `SUM(${list("G")})`, etb.totals.adj_cr, true);
  fmla(ws, `I${r}`, `SUM(${list("I")})`, etb.totals.cy_audited, true);
  ["D", "E", "F", "G", "I"].forEach((c) => totalBorder(ws, `${c}${r}`, true));
  r++;
  tick(ws, `E${r}`, "f,b");
  tick(ws, `I${r}`, "f");
  r += 2;
  workdone(ws, r, ["f", "b", "#"]);
}

/* ------------------------------------------------------------------ DE analytical review */
function sheetDE(ctx: Ctx, ws: Ws) {
  const etb = ctx.b.etb!;
  const de = (ctx.b.papers.find((p) => p.ref === "DE")?.content ?? {}) as { movements?: { fs_caption: string; explanation: string; evidence: string; further_work: string | null }[]; overall_conclusion?: string };
  widths(ws, [6, 34, 15, 15, 15, 9, 60, 30]);
  header(ctx, ws, "DE", "Analytical review", paperWho(ctx, "DE"));
  ["Ref", "Caption", "PY audited", "CY audited", "Movement", "%", "Explanation", "Evidence / further work"].forEach((x, i) => set(ws, `${String.fromCharCode(65 + i)}6`, x, { bold: true }));
  let r = 7;
  for (const row of etb.rows) {
    const e = de.movements?.find((m) => m.fs_caption.toLowerCase() === row.fs_caption.toLowerCase());
    set(ws, `A${r}`, row.wp_ref, { color: "FF1F4E79" });
    set(ws, `B${r}`, row.fs_caption, { bold: row.flagged });
    money(ws, `C${r}`, row.py === null ? null : disp(row.fs_group, row.py));
    money(ws, `D${r}`, disp(row.fs_group, row.cy_audited));
    fmla(ws, `E${r}`, `D${r}-C${r}`, row.py === null ? null : disp(row.fs_group, row.cy_audited - row.py));
    const pyD = row.py === null ? null : disp(row.fs_group, row.py);
    const pctD = pyD ? (disp(row.fs_group, row.cy_audited) - pyD) / Math.abs(pyD) : "";
    set(ws, `F${r}`, { formula: `IF(C${r}=0,"",E${r}/ABS(C${r}))`, result: pctD }, { pct: true });
    set(ws, `G${r}`, e?.explanation ?? (row.flagged ? "Explanation required." : ""), { wrap: true, color: row.flagged && !e ? "FFC00000" : undefined });
    set(ws, `H${r}`, e ? [e.evidence, e.further_work].filter(Boolean).join(" / ") : "", { wrap: true, size: 9 });
    if (e) ws.getRow(r).height = Math.max(15, Math.ceil(e.explanation.length / 80) * 13);
    r++;
  }
  r++;
  textBlock(ws, r, "CONCLUSION", de.overall_conclusion ?? "Pending analytical review.", "H");
}

/* ------------------------------------------------------------------ BB SAD */
function sheetBB(ctx: Ctx, ws: Ws) {
  widths(ws, [9, 50, 16, 16, 30]);
  header(ctx, ws, "BB", "Summary of audit differences");
  const th = ctx.b.materiality;
  const f = th ? (th.selected === "isa320" ? { m: th.isa.materiality, sad: th.isa.clearlyTrivial } : { m: (th.final ?? th.draft).materiality, sad: (th.final ?? th.draft).sad }) : { m: 0, sad: 0 };
  ["Ref", "Description", "Effect on PBT", "Effect on net assets", "Management's reason for not adjusting"].forEach((x, i) => set(ws, `${String.fromCharCode(65 + i)}6`, x, { bold: true, wrap: true }));
  let r = 7;
  const first = r;
  const un = ctx.b.adjustments.filter((a) => a.status === "uncorrected");
  for (const a of un) {
    const pl = sum(a.lines.filter((l) => PL_GROUPS.includes(l.fs_group)).map((l) => toCents(l.cr) - toCents(l.dr)));
    set(ws, `A${r}`, a.ref);
    set(ws, `B${r}`, a.description, { wrap: true });
    money(ws, `C${r}`, pl);
    money(ws, `D${r}`, pl);
    set(ws, `E${r}`, a.decision_note ?? "", { wrap: true });
    r++;
  }
  if (!un.length) {
    set(ws, `B${r}`, "No uncorrected misstatements above the SAD threshold.", { italic: true });
    r++;
  }
  const totalPl = sum(un.map((a) => sum(a.lines.filter((l) => PL_GROUPS.includes(l.fs_group)).map((l) => toCents(l.cr) - toCents(l.dr)))));
  set(ws, `B${r}`, "Total uncorrected misstatements", { bold: true });
  fmla(ws, `C${r}`, `SUM(C${first}:C${Math.max(first, r - 1)})`, totalPl, true);
  fmla(ws, `D${r}`, `SUM(D${first}:D${Math.max(first, r - 1)})`, totalPl, true);
  const tr = r;
  r += 2;
  set(ws, `B${r}`, "SAD threshold");
  money(ws, `C${r}`, f.sad);
  r++;
  set(ws, `B${r}`, "Overall materiality");
  money(ws, `C${r}`, f.m);
  r++;
  set(ws, `B${r}`, "Conclusion", { bold: true });
  set(ws, `C${r}`, { formula: `IF(ABS(C${tr})<C${r - 1},"Uncorrected misstatements are below materiality; no modification required.","Aggregate exceeds materiality: consider the effect on the audit opinion (ISA 450 / ISA 705).")`, result: Math.abs(totalPl) < f.m ? "Uncorrected misstatements are below materiality; no modification required." : "Aggregate exceeds materiality: consider the effect on the audit opinion (ISA 450 / ISA 705)." });
}

/* ------------------------------------------------------------------ narrative sheets */
function sheetNarrative(ctx: Ctx, ws: Ws, ref: string, blocks: { label: string; lines: string[] | string }[]) {
  widths(ws, [16, 2, 16, 16, 16, 16, 16, 16, 16, 16, 12, 12]);
  header(ctx, ws, ref, indexTitle(ref), paperWho(ctx, ref));
  let r = 7;
  for (const bl of blocks) r = textBlock(ws, r, bl.label.toUpperCase(), bl.lines);
}

function sheetAC(ctx: Ctx, ws: Ws) {
  const c = (ctx.b.papers.find((p) => p.ref === "AC")?.content ?? {}) as { risks?: { risk: string; assertions: string[]; inherent_risk: string; significant: boolean; response: string; wp_ref: string }[] };
  widths(ws, [6, 46, 20, 10, 11, 52, 8]);
  header(ctx, ws, "AC", "Risk assessment and response", paperWho(ctx, "AC"));
  ["No", "Risk of material misstatement", "Assertions", "Inherent", "Significant", "Planned response", "WP"].forEach((x, i) => set(ws, `${String.fromCharCode(65 + i)}6`, x, { bold: true }));
  let r = 7;
  (c.risks ?? []).forEach((k, i) => {
    set(ws, `A${r}`, i + 1);
    set(ws, `B${r}`, k.risk, { wrap: true });
    set(ws, `C${r}`, k.assertions.join(", "), { wrap: true });
    set(ws, `D${r}`, k.inherent_risk);
    set(ws, `E${r}`, k.significant ? "Yes" : "No", { bold: k.significant, color: k.significant ? "FFC00000" : undefined });
    set(ws, `F${r}`, k.response, { wrap: true });
    set(ws, `G${r}`, `<${k.wp_ref}>`, { color: "FF1F4E79" });
    ws.getRow(r).height = Math.max(15, Math.ceil(Math.max(k.risk.length, k.response.length) / 55) * 13);
    r++;
  });
  if (!c.risks?.length) set(ws, "B7", "Risk assessment not yet drafted (run step 5).", { italic: true });
}

/* ------------------------------------------------------------------ lead schedules */
function sheetLead(ctx: Ctx, ws: Ws, ref: string) {
  const etb = ctx.b.etb!;
  const rows = etb.rows.filter((r) => r.wp_ref === ref);
  const c = (ctx.b.papers.find((p) => p.ref === ref)?.content ?? {}) as {
    objective?: string[]; source?: string; scope?: string; procedures?: string[]; observations?: string[]; conclusion?: string; tickmarks_supported?: string[]; outstanding?: string[];
  };
  widths(ws, [16, 2, 30, 14, 9, 16, 16, 16, 16, 12, 12, 10]);
  header(ctx, ws, ref, indexTitle(ref), paperWho(ctx, ref));
  let r = 7;
  r = textBlock(ws, r, "OBJECTIVE", c.objective ?? ["To be drafted."]);
  r = textBlock(ws, r, "SOURCE", c.source ?? "");
  r = textBlock(ws, r, "SCOPE", c.scope ?? "");
  const fy = new Date(ctx.b.engagement.fy_end).getUTCFullYear();
  set(ws, `C${r}`, "Particulars", { bold: true });
  set(ws, `E${r}`, "Tick", { bold: true, align: "center" });
  set(ws, `F${r}`, `Per client ${fy}`, { bold: true, align: "center", wrap: true });
  set(ws, `G${r}`, "Adjustment", { bold: true, align: "center" });
  set(ws, `H${r}`, `Audited ${fy}`, { bold: true, align: "center" });
  set(ws, `I${r}`, `Audited ${fy - 1}`, { bold: true, align: "center" });
  set(ws, `J${r}`, "AJE ref", { bold: true, align: "center" });
  r++;
  ["F", "G", "H", "I"].forEach((col) => set(ws, `${col}${r}`, "RM", { bold: true, align: "center" }));
  r++;
  const first = r;
  let tCy = 0, tAdj = 0, tAud = 0, tPy = 0;
  const hasPy = rows.some((x) => x.py !== null);
  for (const row of rows) {
    set(ws, `C${r}`, row.fs_caption, { bold: true });
    r++;
    for (const a of row.accounts) {
      set(ws, `C${r}`, `  ${a.account_name}`);
      tick(ws, `E${r}`, "b");
      money(ws, `F${r}`, disp(row.fs_group, a.cy));
      fmla(ws, `H${r}`, `F${r}+G${r}`, disp(row.fs_group, a.cy));
      r++;
    }
    if (row.adj_dr || row.adj_cr) {
      set(ws, `C${r}`, `  Audit adjustment`, { italic: true });
      const adj = disp(row.fs_group, row.adj_dr - row.adj_cr);
      money(ws, `G${r}`, adj);
      fmla(ws, `H${r}`, `F${r}+G${r}`, adj);
      set(ws, `J${r}`, row.adj_refs.join(", "), { size: 9 });
      r++;
    }
    money(ws, `I${r - 1}`, row.py === null ? null : disp(row.fs_group, row.py));
    tCy += disp(row.fs_group, row.cy_client);
    tAdj += disp(row.fs_group, row.adj_dr - row.adj_cr);
    tAud += disp(row.fs_group, row.cy_audited);
    tPy += row.py === null ? 0 : disp(row.fs_group, row.py);
  }
  set(ws, `C${r}`, "TOTAL", { bold: true });
  fmla(ws, `F${r}`, `SUM(F${first}:F${r - 1})`, tCy, true);
  fmla(ws, `G${r}`, `SUM(G${first}:G${r - 1})`, tAdj, true);
  fmla(ws, `H${r}`, `SUM(H${first}:H${r - 1})`, tAud, true);
  fmla(ws, `I${r}`, `SUM(I${first}:I${r - 1})`, hasPy ? tPy : null, true);
  ["F", "G", "H", "I"].forEach((col) => totalBorder(ws, `${col}${r}`, true));
  r++;
  tick(ws, `F${r}`, "f,b");
  tick(ws, `H${r}`, "f");
  if (hasPy) tick(ws, `I${r}`, "f,#");
  set(ws, `H${r + 1}`, PL_GROUPS.includes(rows[0]?.fs_group) ? "<DB-2>" : "<DB-1>", { color: "FF1F4E79", align: "center" });
  r += 3;
  r = textBlock(ws, r, "PROCEDURES", c.procedures ?? ["To be drafted."]);
  r = textBlock(ws, r, "OBSERVATIONS", c.observations ?? [""]);
  if (c.outstanding?.length) r = textBlock(ws, r, "OUTSTANDING", c.outstanding);
  r = textBlock(ws, r, "CONCLUSION", c.conclusion ?? "Pending.");
  workdone(ws, r, ["f", "b", "#", ...(c.tickmarks_supported ?? [])]);
}

/* ------------------------------------------------------------------ M4 tax computation */
function sheetM4(ctx: Ctx, ws: Ws) {
  const t = ctx.b.engagement.tax_computation as null | {
    year_of_assessment: number; rate_basis: string; rate_basis_reason: string; chargeable_income: number; instalments_paid: number | null;
    lines: { label: string; kind: string; amount: number; basis: string }[]; bands?: { amount: number; rate: number; tax: number }[]; computed_tax?: number; open_points: string[];
  };
  widths(ws, [5, 44, 16, 16, 50, 4, 4, 4, 4]);
  header(ctx, ws, "M4", "Current year tax computation");
  if (!t) {
    set(ws, "B7", "Tax computation not yet drafted (run step 3).", { italic: true });
    return;
  }
  set(ws, "A6", `PROPOSED INCOME TAX COMPUTATION FOR Y/A ${t.year_of_assessment}`, { bold: true });
  set(ws, "D7", "RM", { bold: true, align: "center" });
  let r = 8;
  const first = r;
  for (const l of t.lines) {
    set(ws, `B${r}`, l.label);
    money(ws, `D${r}`, toCents(l.amount));
    set(ws, `E${r}`, l.basis, { wrap: true, size: 9 });
    r++;
  }
  set(ws, `B${r}`, "CHARGEABLE INCOME", { bold: true });
  fmla(ws, `D${r}`, `SUM(D${first}:D${r - 1})`, toCents(t.chargeable_income), true);
  totalBorder(ws, `D${r}`);
  const ci = r;
  if (Math.abs(sum(t.lines.map((l) => toCents(l.amount))) - toCents(t.chargeable_income)) > 100) {
    set(ws, `E${r}`, "Components do not sum to the stated chargeable income: reviewer to resolve.", { color: "FFC00000" });
  }
  r += 2;
  set(ws, `B${r}`, `TAX PAYABLE (${t.rate_basis === "sme" ? "SME scale" : "standard rate"})`, { bold: true });
  r++;
  const bandStart = r;
  for (const band of t.bands ?? []) {
    set(ws, `B${r}`, `Tax RM${band.amount.toLocaleString("en-MY", { minimumFractionDigits: 2 })} @ ${(band.rate * 100).toFixed(0)}%`);
    fmla(ws, `D${r}`, `ROUND(${band.amount}*${band.rate},2)`, toCents(band.tax));
    r++;
  }
  fmla(ws, `D${r}`, `SUM(D${bandStart}:D${Math.max(bandStart, r - 1)})`, toCents(t.computed_tax ?? 0), true);
  totalBorder(ws, `D${r}`);
  const tp = r;
  r++;
  set(ws, `B${r}`, "Less: tax instalments paid (CP204)");
  money(ws, `D${r}`, t.instalments_paid === null ? null : -toCents(t.instalments_paid));
  r++;
  set(ws, `B${r}`, "BALANCE OF TAX PAYABLE / (RECOVERABLE)", { bold: true });
  fmla(ws, `D${r}`, `D${tp}+D${r - 1}`, toCents(t.computed_tax ?? 0) - toCents(t.instalments_paid ?? 0), true);
  totalBorder(ws, `D${r}`, true);
  r += 2;
  set(ws, `B${r}`, "Rate basis", { bold: true });
  ws.mergeCells(`C${r}:E${r}`);
  set(ws, `C${r}`, t.rate_basis_reason, { wrap: true });
  ws.getRow(r).height = 40;
  r += 2;
  if (t.open_points.length) textBlock(ws, r, "OPEN POINTS", t.open_points, "E");
  void ci;
}

/* ------------------------------------------------------------------ review points & trail */
function sheetRP(ctx: Ctx, ws: Ws) {
  widths(ws, [5, 8, 60, 10, 12, 50, 12]);
  header(ctx, ws, "RP", "Review points");
  ["No", "WP", "Point raised", "By", "Status", "Response", "Cleared by"].forEach((x, i) => set(ws, `${String.fromCharCode(65 + i)}6`, x, { bold: true }));
  let r = 7;
  ctx.b.reviewPoints.forEach((p, i) => {
    set(ws, `A${r}`, i + 1);
    set(ws, `B${r}`, p.wp_ref ?? "");
    set(ws, `C${r}`, p.body, { wrap: true });
    set(ws, `D${r}`, initialsOf(ctx.b, p.raised_by));
    set(ws, `E${r}`, p.status, { color: p.status === "cleared" ? "FF0F5E4A" : "FFC00000" });
    set(ws, `F${r}`, p.response ?? "", { wrap: true });
    set(ws, `G${r}`, p.cleared_by ? `${initialsOf(ctx.b, p.cleared_by)} ${dmy(p.cleared_at)}` : "");
    ws.getRow(r).height = Math.max(15, Math.ceil(Math.max(p.body.length, (p.response ?? "").length) / 60) * 13);
    r++;
  });
}

function sheetTrail(ctx: Ctx, ws: Ws) {
  widths(ws, [34, 26, 18, 20, 18, 20, 16, 66]);
  header(ctx, ws, "TR", "Evidence register and processing trail");
  ["File", "Type", "Uploaded by", "Uploaded at (UTC)", "Signed by", "Signed at (UTC)", "Signed from IP", "SHA-256"].forEach((x, i) => set(ws, `${String.fromCharCode(65 + i)}6`, x, { bold: true }));
  let r = 7;
  const iso = (s: string | null) => (s ? new Date(s).toISOString().replace("T", " ").slice(0, 19) : "");
  for (const d of ctx.b.documents) {
    set(ws, `A${r}`, d.filename);
    set(ws, `B${r}`, d.kind);
    set(ws, `C${r}`, ctx.b.people.get(d.uploaded_by)?.full_name ?? "");
    set(ws, `D${r}`, iso(d.uploaded_at));
    set(ws, `E${r}`, d.signed_name ?? "NOT SIGNED", { color: d.signed_name ? undefined : "FFC00000" });
    set(ws, `F${r}`, iso(d.signed_at));
    set(ws, `G${r}`, d.signed_ip ?? "");
    set(ws, `H${r}`, d.sha256, { size: 8 });
    r++;
  }
  r += 2;
  ["AI step", "Status", "Run by", "Started (UTC)", "Model", "Tokens in / out", "", "Summary"].forEach((x, i) => set(ws, `${String.fromCharCode(65 + i)}${r}`, x, { bold: true }));
  r++;
  for (const run of [...ctx.b.runs].reverse()) {
    set(ws, `A${r}`, run.step);
    set(ws, `B${r}`, run.status);
    set(ws, `C${r}`, ctx.b.people.get(run.started_by ?? "")?.full_name ?? "");
    set(ws, `D${r}`, iso(run.started_at));
    set(ws, `E${r}`, run.model ?? "");
    set(ws, `F${r}`, `${run.input_tokens ?? 0} / ${run.output_tokens ?? 0}`);
    set(ws, `H${r}`, run.summary ?? run.error ?? "", { wrap: true, size: 9 });
    r++;
  }
}

/* ------------------------------------------------------------------ build */
export async function buildAwpWorkbook(b: Bundle, firmName: string): Promise<Buffer> {
  if (!b.etb || !b.materiality) throw new Error("The trial balance must be mapped before working papers can be generated.");
  const wb = new ExcelJS.Workbook();
  wb.creator = firmName;
  wb.company = firmName;
  wb.title = `${b.client.name} - Audit working papers - YE ${dmy(b.engagement.fy_end)}`;
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const so = (stage: "preparer" | "reviewer" | "partner") => {
    const s = b.signoffs.find((x) => x.stage === stage);
    return { initials: s?.initials ?? "", date: s ? dmy(s.signed_at) : "" };
  };
  const ctx: Ctx = {
    b, wb,
    company: b.client.name.toUpperCase(),
    yearEnd: dmy(b.engagement.fy_end),
    period: periodLabel(b.engagement.fy_start, b.engagement.fy_end),
    preparer: so("preparer").initials ? so("preparer") : { initials: initialsOf(b, b.engagement.preparer_id), date: "" },
    reviewer: so("reviewer"),
    partner: so("partner"),
    draft: b.engagement.status !== "locked",
    reg: new Map(),
  };

  // Create sheets in index order; fill in dependency order
  const leadRefs = WP_INDEX.filter((e) => (e.section === "Balance sheet" || e.section === "Income statement") && b.etb!.rows.some((r) => r.wp_ref === e.ref)).map((e) => e.ref);
  const order = ["INDEX", "AB2", "AC", "BA", "BB", "BD", "DA3", "DB-1", "DB-2", "DC1", "DC2", "DD", "DE", ...leadRefs.flatMap((r) => (r === "M" ? ["M", "M4"] : [r])), "RP", "TRAIL"];
  if (!leadRefs.includes("M")) order.splice(order.indexOf("RP"), 0, "M4");
  const sheets = new Map(order.map((n) => [n, wb.addWorksheet(n, { properties: { tabColor: { argb: WP_INDEX.find((e) => e.ref === n)?.firm === false ? "FF1F4E79" : "FF0F5E4A" } } })]));
  const S = (n: string) => sheets.get(n)!;

  sheetDB(ctx, S("DB-2"), "PL");
  sheetDB(ctx, S("DB-1"), "BS");
  patchPat(ctx, S("DB-1"));
  sheetAB2(ctx, S("AB2"));
  sheetIndex(ctx, S("INDEX"));
  sheetAC(ctx, S("AC"));
  const ba = (b.papers.find((p) => p.ref === "BA")?.content ?? {}) as { summary?: string; uncorrected_misstatements?: string; outstanding_matters?: string[]; representation_points?: string[] };
  sheetNarrative(ctx, S("BA"), "BA", [
    { label: "Summary of work", lines: ba.summary ?? "Pending." },
    { label: "Uncorrected misstatements", lines: ba.uncorrected_misstatements ?? "See <BB>." },
    { label: "Outstanding matters", lines: ba.outstanding_matters ?? [] },
    { label: "Points for representation letter <BC>", lines: ba.representation_points ?? [] },
  ]);
  sheetBB(ctx, S("BB"));
  const bd = (b.papers.find((p) => p.ref === "BD")?.content ?? {}) as { going_concern?: { indicators: string[]; assessment: string; material_uncertainty: string; evidence_needed: string[] }; subsequent_events?: string[]; related_parties?: { party: string; relationship: string; balance_or_transaction: string; disclosure: string }[] };
  sheetNarrative(ctx, S("BD"), "BD", [
    { label: "Going concern indicators", lines: bd.going_concern?.indicators ?? ["Pending."] },
    { label: "Going concern assessment", lines: bd.going_concern ? `${bd.going_concern.assessment} Material uncertainty: ${bd.going_concern.material_uncertainty}.` : "Pending." },
    { label: "Evidence required", lines: bd.going_concern?.evidence_needed ?? [] },
    { label: "Subsequent events", lines: bd.subsequent_events ?? [] },
    { label: "Related parties", lines: (bd.related_parties ?? []).map((p) => `${p.party} (${p.relationship}): ${p.balance_or_transaction}. Disclosure: ${p.disclosure}`) },
  ]);
  sheetDA3(ctx, S("DA3"));
  sheetDC(ctx, S("DC1"), "AJE");
  sheetDC(ctx, S("DC2"), "RJE");
  sheetETB(ctx, S("DD"));
  sheetDE(ctx, S("DE"));
  for (const ref of leadRefs) sheetLead(ctx, S(ref), ref);
  sheetM4(ctx, S("M4"));
  sheetRP(ctx, S("RP"));
  sheetTrail(ctx, S("TRAIL"));

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
