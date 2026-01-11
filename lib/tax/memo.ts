import type { Intake } from "@/lib/tax/rules";

export type EvidenceStatus = {
  evidence_key: string;
  title: string;
  required: boolean;
  status: "missing" | "in_progress" | "complete";
  done_definition: string;
  review_cadence: string;
};

export type DecisionTopic = {
  key: string;
  title: string;
  decision_question: string;
  options: Array<{ value: string; label: string; outcomes?: string[] }>;
  rationale: string;
  tradeoffs: any;
  audit_narrative: string;
};

export function buildTaxPositionMemoMarkdown(args: {
  topic: DecisionTopic;
  version: number;
  decisionValue: string;
  decisionLabel: string;
  confidence: number;
  intake: Intake;
  evidence: EvidenceStatus[];
  assumptions?: string[];
  risksAndMits?: Array<{ risk: string; mitigation: string }>;
  cpaQuestions?: string[];
}): string {
  const {
    topic,
    version,
    decisionValue,
    decisionLabel,
    confidence,
    intake,
    evidence,
    assumptions = [
      "Books are reasonably complete for the period covered by this memo.",
      "This memo reflects current facts; changes in workers, states, inventory, or entity status can change the answer.",
    ],
    risksAndMits = [],
    cpaQuestions = [],
  } = args;

  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString();

  const facts = [
    `Entity: ${intake.entity_legal_form || "(blank)"} / ${intake.entity_tax_classification || "(blank)"}`,
    `States: ${(intake.state_codes || []).join(", ") || "(blank)"}`,
    `Industry: ${intake.industry || "(blank)"}`,
    `Revenue range: ${intake.revenue_range || "(blank)"}`,
    `Payroll headcount (W-2): ${intake.payroll_w2_bracket || "(blank)"}`,
    `Inventory: ${intake.inventory ? "yes" : "no"}`,
    `Multi-state: ${intake.multi_state ? "yes" : "no"}`,
    `International: ${intake.international ? "yes" : "no"}`,
  ];

  const complete = evidence.filter((e) => e.status === "complete");
  const missing = evidence.filter((e) => e.status !== "complete");

  const lines: string[] = [];

  lines.push(`# Tax Position Memo — ${topic.title}`);
  lines.push(`Date: ${dateStr} ${timeStr}`);
  lines.push(`Version: v${version}`);
  lines.push("");

  lines.push("## Facts (from intake)");
  for (const f of facts) lines.push(`- ${f}`);
  lines.push("");

  lines.push("## Assumptions (explicit)");
  for (const a of assumptions) lines.push(`- ${a}`);
  lines.push("");

  lines.push("## Decision selected + date");
  lines.push(`- Decision: ${decisionLabel} (${decisionValue || "n/a"})`);
  lines.push(`- Confidence: ${confidence}/100`);
  lines.push(`- Date decided: ${dateStr}`);
  lines.push("");

  lines.push("## Rationale");
  lines.push(topic.rationale || "(blank)");
  lines.push("");
  lines.push("## If asked, say this (audit narrative draft)");
  lines.push(topic.audit_narrative || "(blank)");
  lines.push("");

  lines.push("## Risks and mitigations");
  if (!risksAndMits.length) {
    lines.push("- Risk: Missing documentation can weaken the position.");
    lines.push("  - Mitigation: Complete the Proof Pack and keep the review cadence.");
  } else {
    for (const rm of risksAndMits) {
      lines.push(`- Risk: ${rm.risk}`);
      lines.push(`  - Mitigation: ${rm.mitigation}`);
    }
  }
  lines.push("");

  lines.push("## Documents attached / missing");
  lines.push("### Attached / complete");
  if (!complete.length) lines.push("- (none yet)");
  for (const e of complete) lines.push(`- ${e.title}`);
  lines.push("");
  lines.push("### Missing / incomplete");
  if (!missing.length) lines.push("- (none)");
  for (const e of missing) {
    lines.push(`- ${e.title}`);
    lines.push(`  - Done definition: ${e.done_definition}`);
    lines.push(`  - Review cadence: ${e.review_cadence}`);
  }
  lines.push("");

  lines.push("## CPA questions (copy/paste)");
  if (!cpaQuestions.length) {
    lines.push("1. Are there any fact patterns here that change the recommended treatment?");
    lines.push("2. What documentation would you want to see to be comfortable signing a return?");
    lines.push("3. What deadlines should be added to the calendar for this topic?");
  } else {
    cpaQuestions.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
  }
  lines.push("");

  return lines.join("\n");
}
