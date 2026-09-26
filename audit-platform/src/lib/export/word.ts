import "server-only";
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, Packer, PageNumber, Paragraph,
  Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import type { Bundle } from "../pipeline/bundle";
import { initialsOf } from "../pipeline/bundle";
import { WP_INDEX } from "../audit/catalog";
import { formatRM } from "../audit/money";
import { dmy, longDate } from "./format";

const FONT = "Arial";
const run = (text: string, o: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}) =>
  new TextRun({ text, font: FONT, size: o.size ?? 20, bold: o.bold, italics: o.italics, color: o.color });
const para = (children: TextRun[], o: { spacingAfter?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
  new Paragraph({ children, spacing: { after: o.spacingAfter ?? 120 }, alignment: o.align });

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function signatureTable(b: Bundle) {
  const stage = (s: "reviewer" | "partner") => b.signoffs.find((x) => x.stage === s);
  const cell = (label: string, s?: { signed_name: string; signed_at: string }) =>
    new TableCell({
      borders: noBorders,
      width: { size: 50, type: WidthType.PERCENTAGE },
      children: [
        para([run(label)]),
        para([run(s ? `Signed electronically ${new Date(s.signed_at).toISOString().slice(0, 16).replace("T", " ")} UTC` : "")], { spacingAfter: 360 }),
        para([run("..........................................")]),
        para([run(`Name: ${s?.signed_name ?? ""}`)]),
      ],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [cell("Reviewed by Assistant Audit Manager,", stage("reviewer")), cell("Reviewed by Audit Partner,", stage("partner"))] })],
  });
}

function docHeader(b: Bundle) {
  return new Header({
    children: [
      para([run(b.client.name.toUpperCase(), { bold: true })], { spacingAfter: 0 }),
      para([run(`AUDIT FOR THE YEAR ENDED ${longDate(b.engagement.fy_end).toUpperCase()}`, { bold: true })]),
    ],
  });
}
function docFooter(b: Bundle, label: string) {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          run(`${label}${b.engagement.status === "locked" ? "" : "  |  DRAFT"}  |  Page `, { size: 16, color: "666666" }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: "666666" }),
        ],
      }),
    ],
  });
}

/** AA2: Index - Current Audit File, in the firm's layout, with enhanced sections marked. */
export async function buildIndexDocx(b: Bundle): Promise<Buffer> {
  const present = new Set<string>(["AA", "AB", "DA3", "DB", "DC", "DD", "BB", ...b.papers.map((p) => p.ref), ...(b.etb?.rows.map((r) => r.wp_ref) ?? [])]);
  const entries = WP_INDEX.filter((e) => present.has(e.ref));
  const cell = (t: string, bold = false, w = 15) =>
    new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, children: [para([run(t, { bold })], { spacingAfter: 40 })] });
  const rows = [
    new TableRow({ tableHeader: true, children: [cell("REF", true, 10), cell("DESCRIPTIONS", true, 60), cell("TICK", true, 10), cell("BY / DATE", true, 20)] }),
    ...entries.map((e) => {
      const p = b.papers.find((x) => x.ref === e.ref);
      const done = p ? p.status !== "draft" : b.mapped;
      return new TableRow({
        children: [
          cell(e.ref, true, 10),
          cell(`${e.title.toUpperCase()}${e.firm ? "" : "  (enhanced)"}`, false, 60),
          cell(done ? "/" : "", false, 10),
          cell(p?.prepared_by ? `${initialsOf(b, p.prepared_by)} ${dmy(p.prepared_at)}` : "", false, 20),
        ],
      });
    }),
  ];
  const doc = new Document({
    creator: "AuditFlow",
    title: `Index - ${b.client.name}`,
    sections: [
      {
        headers: { default: docHeader(b) },
        footers: { default: docFooter(b, "AA2") },
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [run("INDEX - CURRENT AUDIT FILE", { bold: true, size: 24 })], spacing: { after: 240 } }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
          para([run("")], { spacingAfter: 480 }),
          signatureTable(b),
        ],
      },
    ],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

/** AA: Audit planning memo in the firm's headings, followed by the enhanced sections. */
export async function buildPlanningDocx(b: Bundle): Promise<Buffer> {
  const aa = (b.papers.find((p) => p.ref === "AA")?.content ?? {}) as { sections?: { heading: string; body: string }[] };
  const ac = (b.papers.find((p) => p.ref === "AC")?.content ?? {}) as { risks?: { risk: string; assertions: string[]; inherent_risk: string; significant: boolean; response: string; wp_ref: string }[] };
  const p = b.papers.find((x) => x.ref === "AA");
  const m = b.materiality;
  const mf = m ? (m.selected === "isa320" ? { mat: m.isa.materiality, pm: m.isa.performance, sad: m.isa.clearlyTrivial } : { mat: (m.final ?? m.draft).materiality, pm: (m.final ?? m.draft).performance, sad: (m.final ?? m.draft).sad }) : null;

  const topTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ borders: noBorders, children: [para([run("Company   : ", { bold: true }), run(b.client.name)], { spacingAfter: 40 }), para([run("Year Ended: ", { bold: true }), run(longDate(b.engagement.fy_end))])] }),
          new TableCell({
            borders: noBorders,
            children: [
              para([run("Prepared by : ", { bold: true }), run(`${initialsOf(b, p?.prepared_by) || initialsOf(b, b.engagement.preparer_id)} ${dmy(p?.prepared_at)}`)], { spacingAfter: 40 }),
              para([run("Reviewed by : ", { bold: true }), run(`${initialsOf(b, p?.reviewed_by) || initialsOf(b, b.engagement.reviewer_id)} ${dmy(p?.reviewed_at)}`)]),
            ],
          }),
        ],
      }),
    ],
  });

  const body: (Paragraph | Table)[] = [topTable, new Paragraph({ children: [run("AUDIT PLANNING", { bold: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 } })];
  const sections = aa.sections?.length ? aa.sections : [{ heading: "Planning memo", body: "Not yet drafted. Run step 5 (Draft working papers)." }];
  for (const s of sections) {
    body.push(para([run(s.heading, { bold: true, color: "0F5E4A" })], { spacingAfter: 60 }));
    let text = s.body;
    if (/^materiality$/i.test(s.heading.trim()) && mf) {
      text += `\nOverall materiality RM${formatRM(mf.mat)}; performance materiality RM${formatRM(mf.pm)}; summary of audit differences threshold RM${formatRM(mf.sad)} (see AB2).`;
    }
    for (const line of text.split(/\n+/)) body.push(para([run(line)]));
  }
  if (ac.risks?.length) {
    body.push(para([run("Risk assessment summary (see AC)", { bold: true, color: "0F5E4A" })], { spacingAfter: 60 }));
    const c = (t: string, bold = false) => new TableCell({ children: [para([run(t, { bold, size: 18 })], { spacingAfter: 20 })] });
    body.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ tableHeader: true, children: ["Risk", "Assertions", "Level", "Significant", "Response", "WP"].map((h) => c(h, true)) }),
          ...ac.risks.map((k) => new TableRow({ children: [c(k.risk), c(k.assertions.join(", ")), c(k.inherent_risk), c(k.significant ? "Yes" : "No"), c(k.response), c(k.wp_ref)] })),
        ],
      }),
    );
  }
  body.push(para([run("")], { spacingAfter: 480 }), signatureTable(b));

  const doc = new Document({
    creator: "AuditFlow",
    title: `Audit planning - ${b.client.name}`,
    sections: [{ headers: { default: docHeader(b) }, footers: { default: docFooter(b, "AA") }, children: body }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
