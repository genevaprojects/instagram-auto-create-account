import { type Cents, sum } from "./money";
import { type FsGroup, BS_GROUPS, PL_GROUPS, statementOf } from "./catalog";

export interface TbLineInput {
  id: string;
  line_no: number;
  account_name: string;
  cy: Cents; // Dr +, Cr -
  py_client: Cents | null;
  fs_caption: string;
  fs_group: FsGroup;
  wp_ref: string;
}

export interface AdjustmentLine {
  account: string;
  fs_caption: string;
  fs_group: FsGroup;
  wp_ref: string;
  dr: Cents;
  cr: Cents;
}

export interface AdjustmentInput {
  ref: string;
  kind: "AJE" | "RJE";
  description: string;
  status: "proposed" | "accepted" | "rejected" | "uncorrected";
  lines: AdjustmentLine[];
}

export interface PyBalance {
  fs_caption: string;
  fs_group: FsGroup;
  wp_ref: string;
  amount: Cents; // Dr +, Cr -
}

export interface EtbRow {
  fs_group: FsGroup;
  fs_caption: string;
  wp_ref: string;
  accounts: { account_name: string; cy: Cents; py_client: Cents | null }[];
  py: Cents | null;
  cy_client: Cents;
  adj_dr: Cents;
  adj_cr: Cents;
  adj_refs: string[];
  cy_audited: Cents;
  movement: Cents | null;
  movement_pct: number | null;
  flagged: boolean;
}

export interface EtbTotals {
  cy_client: Cents;
  cy_audited: Cents;
  adj_dr: Cents;
  adj_cr: Cents;
  total_assets_client: Cents;
  total_assets_audited: Cents;
  revenue_client: Cents;
  revenue_audited: Cents;
  pbt_client: Cents;
  pbt_audited: Cents;
  tax_audited: Cents;
  pat_audited: Cents;
  py_revenue: Cents | null;
  py_pbt: Cents | null;
  py_total_assets: Cents | null;
}

export interface Etb {
  rows: EtbRow[];
  totals: EtbTotals;
  balanced: boolean;
  adjustmentsBalanced: boolean;
  unbalancedAdjustments: string[];
}

export function adjustmentBalances(a: AdjustmentInput): boolean {
  const dr = sum(a.lines.map((l) => l.dr));
  const cr = sum(a.lines.map((l) => l.cr));
  return dr === cr && dr > 0 && a.lines.every((l) => l.dr >= 0 && l.cr >= 0 && !(l.dr > 0 && l.cr > 0));
}

const GROUP_ORDER = [...BS_GROUPS, ...PL_GROUPS];

/**
 * Build the extended trial balance by FS caption.
 * Only accepted adjustments are posted. Movement is flagged when it is at least the
 * SAD threshold and either >= 10% of prior year, new, or >= performance materiality.
 */
export function buildEtb(
  lines: TbLineInput[],
  adjustments: AdjustmentInput[],
  pyBalances: PyBalance[],
  thresholds: { sad: Cents; pm: Cents } | null,
): Etb {
  const rows = new Map<string, EtbRow>();
  const key = (g: FsGroup, c: string) => `${g}::${c.trim().toLowerCase()}`;
  const ensure = (g: FsGroup, c: string, ref: string) => {
    const k = key(g, c);
    let r = rows.get(k);
    if (!r) {
      r = { fs_group: g, fs_caption: c.trim(), wp_ref: ref, accounts: [], py: null, cy_client: 0, adj_dr: 0, adj_cr: 0, adj_refs: [], cy_audited: 0, movement: null, movement_pct: null, flagged: false };
      rows.set(k, r);
    }
    return r;
  };

  for (const l of [...lines].sort((a, b) => a.line_no - b.line_no)) {
    const r = ensure(l.fs_group, l.fs_caption, l.wp_ref);
    r.accounts.push({ account_name: l.account_name, cy: l.cy, py_client: l.py_client });
    r.cy_client += l.cy;
  }

  const unbalanced: string[] = [];
  for (const a of adjustments.filter((x) => x.status === "accepted")) {
    if (!adjustmentBalances(a)) {
      unbalanced.push(a.ref);
      continue;
    }
    for (const al of a.lines) {
      const r = ensure(al.fs_group, al.fs_caption, al.wp_ref);
      r.adj_dr += al.dr;
      r.adj_cr += al.cr;
      if (!r.adj_refs.includes(a.ref)) r.adj_refs.push(a.ref);
    }
  }

  // Prior-year captions with no current-year balance still belong on the ETB (comparatives)
  for (const p of pyBalances) {
    if (![...rows.values()].some((r) => r.fs_caption.toLowerCase() === p.fs_caption.trim().toLowerCase())) {
      ensure(p.fs_group, p.fs_caption, p.wp_ref);
    }
  }

  const pyMap = new Map(pyBalances.map((p) => [p.fs_caption.trim().toLowerCase(), p.amount]));
  for (const r of rows.values()) {
    r.cy_audited = r.cy_client + r.adj_dr - r.adj_cr;
    const py = pyMap.get(r.fs_caption.toLowerCase());
    r.py = py ?? null;
    if (r.py !== null) {
      r.movement = r.cy_audited - r.py;
      r.movement_pct = r.py === 0 ? null : r.movement / Math.abs(r.py);
    } else {
      r.movement = null;
    }
    if (thresholds && r.movement !== null) {
      const m = Math.abs(r.movement);
      r.flagged = m >= thresholds.sad && (r.py === 0 || m >= thresholds.pm || Math.abs(r.movement_pct ?? 1) >= 0.1);
    }
  }
  const ordered = [...rows.values()].sort((a, b) => GROUP_ORDER.indexOf(a.fs_group) - GROUP_ORDER.indexOf(b.fs_group));
  const all = ordered;
  const by = (pred: (r: EtbRow) => boolean, f: (r: EtbRow) => Cents) => sum(all.filter(pred).map(f));
  const isAsset = (r: EtbRow) => r.fs_group === "Non-current assets" || r.fs_group === "Current assets";
  const isPL = (r: EtbRow) => statementOf(r.fs_group) === "PL";
  const isRev = (r: EtbRow) => r.fs_group === "Revenue";
  const isTax = (r: EtbRow) => r.fs_group === "Taxation";
  const pyAll = all.every((r) => r.py === null) ? null : 0;

  const totals: EtbTotals = {
    cy_client: by(() => true, (r) => r.cy_client),
    cy_audited: by(() => true, (r) => r.cy_audited),
    adj_dr: by(() => true, (r) => r.adj_dr),
    adj_cr: by(() => true, (r) => r.adj_cr),
    total_assets_client: by(isAsset, (r) => r.cy_client),
    total_assets_audited: by(isAsset, (r) => r.cy_audited),
    revenue_client: -by(isRev, (r) => r.cy_client),
    revenue_audited: -by(isRev, (r) => r.cy_audited),
    pbt_client: -by((r) => isPL(r) && !isTax(r), (r) => r.cy_client),
    pbt_audited: -by((r) => isPL(r) && !isTax(r), (r) => r.cy_audited),
    tax_audited: by(isTax, (r) => r.cy_audited),
    pat_audited: -by(isPL, (r) => r.cy_audited),
    py_revenue: pyAll === null ? null : -by(isRev, (r) => r.py ?? 0),
    py_pbt: pyAll === null ? null : -by((r) => isPL(r) && !isTax(r), (r) => r.py ?? 0),
    py_total_assets: pyAll === null ? null : by(isAsset, (r) => r.py ?? 0),
  };

  return {
    rows: ordered,
    totals,
    balanced: totals.cy_client === 0 && totals.cy_audited === 0,
    adjustmentsBalanced: totals.adj_dr === totals.adj_cr && unbalanced.length === 0,
    unbalancedAdjustments: unbalanced,
  };
}
