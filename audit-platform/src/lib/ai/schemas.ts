import { z } from "zod";
import { ALL_GROUPS } from "../audit/catalog";

const FsGroupEnum = z.enum(ALL_GROUPS as [string, ...string[]]);

export const MappingResult = z.object({
  mappings: z.array(
    z.object({
      line_no: z.number(),
      fs_caption: z.string(),
      fs_group: FsGroupEnum,
      wp_ref: z.string(),
      confidence: z.number(),
      rationale: z.string(),
      mapping_flags: z.array(z.string()),
    }),
  ),
  py_balances: z.array(
    z.object({
      fs_caption: z.string(),
      fs_group: FsGroupEnum,
      wp_ref: z.string(),
      amount: z.number(),
      source: z.string(),
    }),
  ),
  opening_balance_test: z.object({
    py_retained_earnings_cf: z.number().nullable(),
    source: z.string().nullable(),
  }),
  notes: z.array(z.string()),
});
export type MappingResult = z.infer<typeof MappingResult>;

export const AdjustLine = z.object({
  account: z.string(),
  fs_caption: z.string(),
  fs_group: FsGroupEnum,
  wp_ref: z.string(),
  dr: z.number(),
  cr: z.number(),
});

export const AdjustResult = z.object({
  entries: z.array(
    z.object({
      ref: z.string(),
      kind: z.enum(["AJE", "RJE"]),
      description: z.string(),
      rationale: z.string(),
      evidence: z.string(),
      pbt_effect: z.number(),
      lines: z.array(AdjustLine),
    }),
  ),
  tax_computation: z.object({
    year_of_assessment: z.number(),
    rate_basis: z.enum(["sme", "standard"]),
    rate_basis_reason: z.string(),
    lines: z.array(
      z.object({
        label: z.string(),
        kind: z.enum(["profit_before_tax", "add_back", "deduct", "capital_allowance", "section_60f", "other"]),
        amount: z.number(),
        basis: z.string(),
      }),
    ),
    chargeable_income: z.number(),
    instalments_paid: z.number().nullable(),
    open_points: z.array(z.string()),
  }),
  audit_matters: z.array(z.object({ wp_ref: z.string(), matter: z.string(), evidence_needed: z.string() })),
});
export type AdjustResult = z.infer<typeof AdjustResult>;

export const AnalyseResult = z.object({
  movements: z.array(
    z.object({
      fs_caption: z.string(),
      explanation: z.string(),
      evidence: z.string(),
      further_work: z.string().nullable(),
    }),
  ),
  going_concern: z.object({
    indicators: z.array(z.string()),
    assessment: z.string(),
    material_uncertainty: z.enum(["no", "possible", "yes"]),
    evidence_needed: z.array(z.string()),
  }),
  subsequent_events: z.array(z.string()),
  related_parties: z.array(z.object({ party: z.string(), relationship: z.string(), balance_or_transaction: z.string(), disclosure: z.string() })),
  overall_conclusion: z.string(),
});
export type AnalyseResult = z.infer<typeof AnalyseResult>;

const Section = z.object({ heading: z.string(), body: z.string() });

export const PapersResult = z.object({
  planning: z.array(Section),
  risk_assessment: z.array(
    z.object({
      risk: z.string(),
      assertions: z.array(z.string()),
      inherent_risk: z.enum(["low", "moderate", "high"]),
      significant: z.boolean(),
      response: z.string(),
      wp_ref: z.string(),
    }),
  ),
  lead_schedules: z.array(
    z.object({
      wp_ref: z.string(),
      objective: z.array(z.string()),
      source: z.string(),
      scope: z.string(),
      procedures: z.array(z.string()),
      observations: z.array(z.string()),
      conclusion: z.string(),
      tickmarks_supported: z.array(z.string()),
      outstanding: z.array(z.string()),
    }),
  ),
  completion: z.object({
    summary: z.string(),
    uncorrected_misstatements: z.string(),
    outstanding_matters: z.array(z.string()),
    representation_points: z.array(z.string()),
  }),
});
export type PapersResult = z.infer<typeof PapersResult>;
