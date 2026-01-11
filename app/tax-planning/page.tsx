"use client";

import * as React from "react";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { Info } from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const BRAND = {
  teal: "#1C6F66",
  brown: "#6B4A2E",
  gold: "#E8B765",
};

type DbOptionRow = {
  set_key: string;
  value: string;
  label: string;
  sort: number | null;
  group_label: string | null;
  help: string | null;
  meta: any;
};

type Opt = {
  value: string;
  label: string;
  sort: number;
  group: string | null;
  help: string | null;
};

type OptionsBySet = Record<string, Opt[]>;

type Intake = {
  entity_type: string;
  states: string[];
  industry: string;
  revenue_range: string;
  payroll_w2: string;
  inventory_presence: "yes" | "no";
  multistate_presence: "yes" | "no";
  international_presence: "yes" | "no";
};

type Stage = "intake" | "profile" | "questions" | "calendar" | "exports";

function HelpIcon({ text }: { text: string }) {
  return (
    <span
      className="ml-2 inline-flex cursor-help items-center align-middle text-muted-foreground"
      title={text}
      aria-label={text}
    >
      <Info size={14} />
    </span>
  );
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function downloadText(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildCSV(rows: Array<Record<string, string>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: string) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const lines = [headers.map(esc).join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h] ?? "")).join(","));
  return lines.join("\n");
}

function dateOnly(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function icsEvent(uid: string, title: string, date: Date, description: string) {
  // All-day event (DATE)
  const dt = dateOnly(date).replaceAll("-", "");
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dt}T000000Z`,
    `DTSTART;VALUE=DATE:${dt}`,
    `SUMMARY:${title.replaceAll("\n", " ")}`,
    `DESCRIPTION:${description.replaceAll("\n", "\\n")}`,
    "END:VEVENT",
  ].join("\n");
}

function buildQuarterlyEstimatedTaxICS() {
  // Typical due dates: Apr 15, Jun 15, Sep 15, Jan 15.
  // Weekend/holiday shifts happen; this calendar is a planning anchor.
  const now = new Date();
  const y = now.getFullYear();

  const dates = [
    new Date(y, 3, 15), // Apr 15
    new Date(y, 5, 15), // Jun 15
    new Date(y, 8, 15), // Sep 15
    new Date(y + 1, 0, 15), // Jan 15 next year
  ];

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BTBB//Tax Planning//EN",
    ...dates.map((d, i) =>
      icsEvent(
        `btbb-est-${y}-${i}@btbb`,
        "Estimated tax payment due (typical)",
        d,
        "Planning reminder. If a due date lands on a weekend or federal holiday, the deadline moves to the next business day."
      )
    ),
    "END:VCALENDAR",
  ].join("\n");

  return body;
}

function groupForSelect(options: Opt[]) {
  // Stable group ordering without Set iteration (avoids TS2802 issues).
  const order: string[] = [];
  const seen: Record<string, boolean> = {};
  for (const o of options) {
    const g = o.group ?? "Other";
    if (!seen[g]) {
      seen[g] = true;
      order.push(g);
    }
  }

  const groups: Record<string, Opt[]> = {};
  for (const g of order) groups[g] = [];
  for (const o of options) {
    const g = o.group ?? "Other";
    if (!groups[g]) groups[g] = [];
    groups[g].push(o);
  }

  return { order, groups };
}

export default function TaxPlanningPhase3Page() {
  const [stage, setStage] = React.useState<Stage>("intake");

  const [opts, setOpts] = React.useState<OptionsBySet>({});
  const [loadingOpts, setLoadingOpts] = React.useState(true);
  const [optsError, setOptsError] = React.useState<string | null>(null);

  const [intake, setIntake] = React.useState<Intake>({
    entity_type: "",
    states: [],
    industry: "",
    revenue_range: "",
    payroll_w2: "",
    inventory_presence: "no",
    multistate_presence: "no",
    international_presence: "no",
  });

  const [statePick, setStatePick] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);

  const [workerDecision, setWorkerDecision] = React.useState<
    "no_workers" | "all_w2" | "all_1099" | "mixed" | ""
  >("");
  const [decisionTab, setDecisionTab] = React.useState<"decision" | "rationale" | "proof" | "memo">("decision");

  const [busyExport, setBusyExport] = React.useState(false);

  const requiredMissing = React.useMemo(() => {
    const missing: string[] = [];
    if (!intake.entity_type) missing.push("Entity type");
    if (!intake.states.length) missing.push("State(s)");
    if (!intake.industry) missing.push("Industry");
    if (!intake.revenue_range) missing.push("Revenue range");
    if (!intake.payroll_w2) missing.push("W-2 employees (on payroll)");
    return missing;
  }, [intake]);

  async function loadOptions() {
    setLoadingOpts(true);
    setOptsError(null);

    // Sets used by the page
    const needed = [
      "entity_type",
      "us_states",
      "industry",
      "revenue_range",
      "payroll_w2",
      "inventory_presence",
      "multistate_presence",
      "international_presence",
    ];

    const { data, error } = await supabase
      .from("btbb_tax_options")
      .select("set_key,value,label,sort,group_label,help,meta")
      .in("set_key", needed)
      .order("set_key", { ascending: true })
      .order("sort", { ascending: true })
      .order("label", { ascending: true });

    if (error) {
      setOptsError(error.message ?? "Failed to load dropdown options.");
      setLoadingOpts(false);
      return;
    }

    const rows = (data ?? []) as DbOptionRow[];

    const mapped: OptionsBySet = {};
    for (const r of rows) {
      const o: Opt = {
        value: r.value,
        label: r.label,
        sort: typeof r.sort === "number" ? r.sort : 999999,
        group: r.group_label,
        help: r.help,
      };
      if (!mapped[r.set_key]) mapped[r.set_key] = [];
      mapped[r.set_key].push(o);
    }

    // Light fallback so the UI stays usable even if a set is empty
    if (!mapped.inventory_presence?.length) {
      mapped.inventory_presence = [
        { value: "no", label: "No inventory", sort: 10, group: null, help: "Services or digital-only. No stock held." },
        { value: "yes", label: "Yes — inventory exists", sort: 20, group: null, help: "You stock goods, inputs, packaging, or held-for-sale items." },
      ];
    }
    if (!mapped.multistate_presence?.length) {
      mapped.multistate_presence = [
        { value: "no", label: "No multi-state exposure", sort: 10, group: null, help: "Work, people, and inventory stay in one state." },
        { value: "yes", label: "Yes — multi-state exposure", sort: 20, group: null, help: "Sales, people, or inventory cross state lines." },
      ];
    }
    if (!mapped.international_presence?.length) {
      mapped.international_presence = [
        { value: "no", label: "No international touchpoints", sort: 10, group: null, help: "No foreign customers, vendors, labor, or shipping." },
        { value: "yes", label: "Yes — international touchpoints", sort: 20, group: null, help: "Foreign customers, vendors, labor, shipping, or accounts." },
      ];
    }

    setOpts(mapped);
    setLoadingOpts(false);
  }

  React.useEffect(() => {
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entityTypeOpts = opts["entity_type"] ?? [];
  const stateOpts = opts["us_states"] ?? [];
  const industryOpts = opts["industry"] ?? [];
  const revenueOpts = opts["revenue_range"] ?? [];
  const payrollW2Opts = opts["payroll_w2"] ?? [];
  const invPresenceOpts = opts["inventory_presence"] ?? [];
  const multistateOpts = opts["multistate_presence"] ?? [];
  const intlOpts = opts["international_presence"] ?? [];

  const industryGrouped = React.useMemo(() => groupForSelect(industryOpts), [industryOpts]);

  const bestWorkerFit = React.useMemo(() => {
    if (!intake.payroll_w2) return "none";
    if (intake.payroll_w2 === "0") return "no_workers";
    return "all_w2";
  }, [intake.payroll_w2]);

  const confidenceScore = React.useMemo(() => {
    let score = 0;
    // Intake completeness (0–60)
    score += 10; // base
    score += intake.entity_type ? 10 : 0;
    score += intake.states.length ? 10 : 0;
    score += intake.industry ? 10 : 0;
    score += intake.revenue_range ? 10 : 0;
    score += intake.payroll_w2 ? 10 : 0;

    // Decision chosen (0–20)
    score += workerDecision ? 20 : 0;

    // Proof pack (0–20) - simple starter logic
    // In this version: if payroll is not 0, we nudge proof readiness.
    if (intake.payroll_w2 && intake.payroll_w2 !== "0") score += 10;
    if (intake.multistate_presence === "yes") score += 5;
    if (intake.inventory_presence === "yes") score += 5;

    if (score > 100) score = 100;
    return score;
  }, [intake, workerDecision]);

  function addState() {
    if (!statePick) return;
    if (intake.states.includes(statePick)) return;
    setIntake((p) => ({ ...p, states: [...p.states, statePick] }));
    setStatePick("");
  }

  function removeState(code: string) {
    setIntake((p) => ({ ...p, states: p.states.filter((s) => s !== code) }));
  }

  function validateAndBuild() {
    setFormError(null);
    if (requiredMissing.length) {
      setFormError(`Missing: ${requiredMissing.join(", ")}`);
      return;
    }
    setStage("profile");
  }

  function taxProfileSummary() {
    return {
      entity_type: intake.entity_type,
      states: intake.states.join(", "),
      industry: intake.industry,
      revenue_range: intake.revenue_range,
      payroll_w2: intake.payroll_w2,
      inventory_presence: intake.inventory_presence,
      multistate_presence: intake.multistate_presence,
      international_presence: intake.international_presence,
    };
  }

  function buildQuestionSet() {
    const qs: Array<{ topic: string; question: string; priority: "High" | "Medium" | "Low" }> = [];

    // Workers
    qs.push({
      topic: "Workers",
      question: "Do you have any workers this year (W-2 or 1099)? If yes, what role and start date?",
      priority: "High",
    });

    if (intake.payroll_w2 !== "0") {
      qs.push({
        topic: "Workers",
        question: "What payroll system is used, and who owns filings (941/NC withholding/unemployment)?",
        priority: "High",
      });
    }

    // Inventory
    if (intake.inventory_presence === "yes") {
      qs.push({
        topic: "Inventory",
        question: "What is your inventory count cadence (monthly/quarterly/year-end) and where is it documented?",
        priority: "High",
      });
      qs.push({
        topic: "Inventory",
        question: "How are purchase documents stored (by month) and tied to SKU or category?",
        priority: "High",
      });
    }

    // Multi-state
    if (intake.multistate_presence === "yes") {
      qs.push({
        topic: "Multi-state",
        question: "Which states do you ship to or work in, and do any cross sales-tax thresholds?",
        priority: "High",
      });
      qs.push({
        topic: "Multi-state",
        question: "Do you store inventory in any out-of-state warehouse/3PL?",
        priority: "High",
      });
    }

    // S-corp triggers
    if (intake.entity_type === "s_corp") {
      qs.push({
        topic: "Owner comp (S-corp)",
        question: "Are owners taking W-2 wages? If yes, what process supports wage reasonableness?",
        priority: "High",
      });
    }

    // Revenue
    qs.push({
      topic: "Revenue",
      question: "Is your revenue tracked on cash collected or invoices issued (cash vs accrual behavior)?",
      priority: "Medium",
    });

    // States baseline
    qs.push({
      topic: "States",
      question: "Do you have sales tax registration in every state you are collecting in?",
      priority: "Medium",
    });

    return qs;
  }

  function buildWatchlist() {
    const items: Array<{
      title: string;
      tags: string[];
      trigger: string;
      readiness: string[];
      consequence: string;
      decisionPrompt: string;
    }> = [];

    if (intake.payroll_w2 !== "0") {
      items.push({
        title: "Payroll compliance cadence + year-end forms readiness",
        tags: ["payroll", "controls", "deadlines"],
        trigger: "Payroll present",
        readiness: [
          "Payroll processor selected and configured",
          "Owner for filings is documented",
          "Quarterly payroll checks scheduled",
          "Year-end W-2/940/941 workflow documented",
        ],
        consequence:
          "Missed filings can create penalties, notices, and messy cleanup. Clean cadence reduces noise and risk.",
        decisionPrompt: "Who owns payroll filings, and what day each month is your payroll review?",
      });
    }

    if (intake.inventory_presence === "yes") {
      items.push({
        title: "Inventory method prompts + COGS substantiation pack",
        tags: ["inventory", "cogs", "documentation"],
        trigger: "Inventory present",
        readiness: [
          "Purchases are stored by month with vendor support",
          "Count cadence chosen (monthly/quarterly) and documented",
          "COGS method note exists (incl. shrink/adjustments)",
          "If using 3PL, storage locations are known and tracked",
        ],
        consequence:
          "Weak inventory records can inflate taxable income, create audit friction, and cause mis-stated margins.",
        decisionPrompt: "What is your count cadence, and where is the count log stored?",
      });
    }

    if (intake.multistate_presence === "yes") {
      items.push({
        title: "Sales-tax tracking + nexus watch",
        tags: ["sales_tax", "nexus", "thresholds"],
        trigger: "Multi-state exposure",
        readiness: [
          "Shipping states list is current",
          "Marketplace vs direct sales are separated",
          "Registration status by state is tracked",
          "Monthly threshold review is scheduled",
        ],
        consequence:
          "Crossing thresholds without tracking can create back taxes, penalties, and fast cleanup work.",
        decisionPrompt: "Which states are you shipping to this month, and where is the threshold log?",
      });
    }

    if (intake.entity_type === "s_corp") {
      items.push({
        title: "Owner comp prompts + wage reasonableness evidence pack",
        tags: ["s_corp", "owner_comp", "evidence"],
        trigger: "S-corp selection",
        readiness: [
          "Role and duties are documented",
          "Comparable pay evidence is saved (notes + sources)",
          "Payroll schedule is set",
          "Distribution policy is documented",
        ],
        consequence:
          "Owner comp issues can trigger questions. Evidence up front keeps the story clean and consistent.",
        decisionPrompt: "Do you have a saved wage note that explains how salary was picked?",
      });
    }

    return items;
  }

  function buildMemoText() {
    const facts = [
      `Entity type: ${intake.entity_type || "—"}`,
      `States: ${intake.states.join(", ") || "—"}`,
      `Industry: ${intake.industry || "—"}`,
      `Revenue range: ${intake.revenue_range || "—"}`,
      `W-2 employees (on payroll): ${intake.payroll_w2 || "—"}`,
      `Inventory present: ${intake.inventory_presence}`,
      `Multi-state: ${intake.multistate_presence}`,
      `International: ${intake.international_presence}`,
    ];

    const assumptions = [
      "Planning memo is based on the intake answers selected on this page.",
      "If facts change (new state, new worker type, inventory added), the memo should be refreshed.",
    ];

    const decision = workerDecision || "(not selected)";

    const risks: string[] = [];
    if (!workerDecision) risks.push("No worker setup decision selected yet.");
    if (intake.multistate_presence === "yes") risks.push("Multi-state exposure requires threshold tracking and registration hygiene.");
    if (intake.inventory_presence === "yes") risks.push("Inventory and COGS support should be organized by month with a written cadence.");

    const mitigations: string[] = [];
    if (intake.inventory_presence === "yes") mitigations.push("Pick a count cadence and store count logs with purchase support by month.");
    if (intake.multistate_presence === "yes") mitigations.push("Track states shipped to and review thresholds monthly.");
    if (workerDecision) mitigations.push("Keep contracts, W-9s, job descriptions, and payroll reports tied to the decision.");

    const cpaQuestions = [
      "Are there state registrations or local filings we should add based on the selected states and sales footprint?",
      "Do you have a preferred policy for worker classification documentation (contracts + role notes + payment trail)?",
      "Any changes needed to the tax payment cadence based on current revenue and margin patterns?",
    ];

    const lines: string[] = [];
    lines.push("Tax Position Memo (Phase 3)");
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push("");
    lines.push("Facts (from intake)");
    for (const f of facts) lines.push(`- ${f}`);
    lines.push("");
    lines.push("Assumptions");
    for (const a of assumptions) lines.push(`- ${a}`);
    lines.push("");
    lines.push("Decision selected + date");
    lines.push(`- Worker setup decision: ${decision}`);
    lines.push(`- Decision date: ${new Date().toLocaleDateString()}`);
    lines.push("");
    lines.push("Risks and mitigations");
    if (!risks.length) lines.push("- None flagged by current inputs.");
    for (const r of risks) lines.push(`- Risk: ${r}`);
    for (const m of mitigations) lines.push(`- Mitigation: ${m}`);
    lines.push("");
    lines.push("Documents attached / missing (starter list)");
    lines.push("- Worker setup: contracts, W-9s, payroll reports (as applicable)");
    lines.push("- States: registration confirmations (if applicable)");
    lines.push("- Inventory: count logs + purchase support (if applicable)");
    lines.push("");
    lines.push("CPA questions (copy/paste)");
    for (const q of cpaQuestions) lines.push(`- ${q}`);

    return lines.join("\n");
  }

  async function exportZipBundle() {
    setBusyExport(true);
    try {
      const memo = buildMemoText();
      const watchlist = buildWatchlist();
      const questions = buildQuestionSet();

      // PDF (simple, clean)
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      doc.setFont("times", "normal");
      doc.setFontSize(12);

      const margin = 48;
      const maxWidth = 516;
      let y = 64;

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.text("Your Tax Planning Profile — Phase 3", margin, y);
      y += 22;

      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);

      const summary = taxProfileSummary();
      const summaryLines = Object.entries(summary).map(([k, v]) => `${k}: ${v || "—"}`);
      const wrappedSummary = doc.splitTextToSize(summaryLines.join("\n"), maxWidth);
      doc.text(wrappedSummary, margin, y);
      y += wrappedSummary.length * 14 + 10;

      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      doc.text("Tax Position Memo", margin, y);
      y += 18;

      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      const memoLines = doc.splitTextToSize(memo, maxWidth);
      for (const line of memoLines) {
        if (y > 740) {
          doc.addPage();
          y = 64;
        }
        doc.text(line, margin, y);
        y += 12;
      }

      // Add watchlist page
      doc.addPage();
      y = 64;
      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      doc.text("Elections + Threshold Radar — Watchlist", margin, y);
      y += 18;

      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      const wlText = watchlist
        .map(
          (w) =>
            `${w.title}\nTrigger: ${w.trigger}\nWhat happens if missed: ${w.consequence}\nReadiness:\n- ${w.readiness.join(
              "\n- "
            )}\nDecision prompt: ${w.decisionPrompt}\n`
        )
        .join("\n");

      const wlLines = doc.splitTextToSize(wlText, maxWidth);
      for (const line of wlLines) {
        if (y > 740) {
          doc.addPage();
          y = 64;
        }
        doc.text(line, margin, y);
        y += 12;
      }

      const pdfBytes = doc.output("arraybuffer");

      // CSV checklist (questions)
      const csv = buildCSV(
        questions.map((q) => ({
          priority: q.priority,
          topic: q.topic,
          question: q.question,
        }))
      );

      // ICS calendar
      const ics = buildQuarterlyEstimatedTaxICS();

      // ZIP bundle
      const zip = new JSZip();
      zip.file("Your Tax Planning Profile (Phase 3).pdf", pdfBytes);
      zip.file("Quarterly Decision Calendar (Estimated Tax Dates - Typical).ics", ics);
      zip.file("Your Question Set (Checklist).csv", csv);

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "BTBB_Tax_Planning_Phase3_Bundle.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setStage("exports");
    } finally {
      setBusyExport(false);
    }
  }

  const cardBase = "rounded-2xl border bg-white/90 shadow-sm";
  const selectBase =
    "w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-offset-1";
  const helpText = "text-xs text-muted-foreground";

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className={cn(cardBase, "p-6")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
              BTBB Tax Planning — Phase 3
            </div>
            <div className="mt-1 text-base text-gray-700">
              Turn your answers into documentation, decision prompts, and a quarterly action calendar.
            </div>
          </div>
          <Badge style={{ backgroundColor: BRAND.teal, color: "white" }}>Phase 3</Badge>
        </div>

        <div className="mt-4 rounded-xl border bg-white p-4">
          <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
            Start here
          </div>
          <div className="mt-1 text-sm text-gray-700">
            Save your intake once. Phase 3 uses it to build your memo + watchlist.
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
              Intake (inputs 1–8)
            </div>
            <div className={cn("mt-1", helpText)}>
              These inputs drive the memo generator and the watchlist triggers.
            </div>

            {loadingOpts ? (
              <div className="mt-4 text-sm text-gray-700">Loading dropdown options…</div>
            ) : optsError ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                Dropdowns did not load: {optsError}
                <div className="mt-2">
                  <Button variant="outline" onClick={loadOptions}>
                    Retry
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-4">
                {/* 1) Entity type */}
                <div>
                  <label className="text-sm font-medium text-gray-800">
                    1) Entity type
                    <HelpIcon text="Your legal/tax setup drives what decisions and deadlines show up." />
                  </label>
                  <select
                    className={cn(selectBase, "mt-1")}
                    value={intake.entity_type}
                    onChange={(e) => setIntake((p) => ({ ...p, entity_type: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {entityTypeOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2) States */}
                <div>
                  <label className="text-sm font-medium text-gray-800">
                    2) State(s)
                    <HelpIcon text="Pick every state that can touch taxes or filings (home base, sales, workers, inventory)." />
                  </label>

                  <div className="mt-1 flex gap-2">
                    <select className={cn(selectBase)} value={statePick} onChange={(e) => setStatePick(e.target.value)}>
                      <option value="">Select a state…</option>
                      {stateOpts.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label} ({o.value})
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      style={{ backgroundColor: BRAND.teal, color: "white" }}
                      onClick={addState}
                      disabled={!statePick}
                    >
                      Add
                    </Button>
                  </div>

                  <div className="mt-2 text-xs text-gray-600">Picked: {intake.states.length ? intake.states.join(", ") : "None"}</div>

                  {intake.states.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {intake.states.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="rounded-full border bg-white px-3 py-1 text-xs text-gray-800"
                          onClick={() => removeState(s)}
                          title="Click to remove"
                        >
                          {s} ✕
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* 3) Industry */}
                <div>
                  <label className="text-sm font-medium text-gray-800">
                    3) Industry
                    <HelpIcon text="Pick your closest match. This affects your watchlist and proof pack prompts." />
                  </label>

                  <select
                    className={cn(selectBase, "mt-1")}
                    value={intake.industry}
                    onChange={(e) => setIntake((p) => ({ ...p, industry: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {industryGrouped.order.map((g) => (
                      <optgroup key={g} label={g}>
                        {(industryGrouped.groups[g] ?? []).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* 4) Revenue range */}
                <div>
                  <label className="text-sm font-medium text-gray-800">
                    4) Revenue range
                    <HelpIcon text="This helps size the cadence: what to track weekly vs monthly vs quarterly." />
                  </label>
                  <select
                    className={cn(selectBase, "mt-1")}
                    value={intake.revenue_range}
                    onChange={(e) => setIntake((p) => ({ ...p, revenue_range: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {revenueOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5) Payroll headcount */}
                <div>
                  <label className="text-sm font-medium text-gray-800">
                    5) W-2 employees (on payroll)
                    <HelpIcon text="This is W-2 payroll headcount only (not 1099 contractors)." />
                  </label>
                  <select
                    className={cn(selectBase, "mt-1")}
                    value={intake.payroll_w2}
                    onChange={(e) => setIntake((p) => ({ ...p, payroll_w2: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {payrollW2Opts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 6) Inventory */}
                <div>
                  <label className="text-sm font-medium text-gray-800">
                    6) Inventory present
                    <HelpIcon text="Inventory means goods/inputs/packaging held for sale or used to produce sold items." />
                  </label>
                  <select
                    className={cn(selectBase, "mt-1")}
                    value={intake.inventory_presence}
                    onChange={(e) =>
                      setIntake((p) => ({ ...p, inventory_presence: e.target.value as "yes" | "no" }))
                    }
                  >
                    {invPresenceOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 7) Multi-state */}
                <div>
                  <label className="text-sm font-medium text-gray-800">
                    7) Multi-state
                    <HelpIcon text="Yes if sales, workers, inventory, or job sites cross state lines." />
                  </label>
                  <select
                    className={cn(selectBase, "mt-1")}
                    value={intake.multistate_presence}
                    onChange={(e) =>
                      setIntake((p) => ({ ...p, multistate_presence: e.target.value as "yes" | "no" }))
                    }
                  >
                    {multistateOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 8) International */}
                <div>
                  <label className="text-sm font-medium text-gray-800">
                    8) International
                    <HelpIcon text="Yes if foreign customers, vendors, labor, shipping, or foreign accounts exist." />
                  </label>
                  <select
                    className={cn(selectBase, "mt-1")}
                    value={intake.international_presence}
                    onChange={(e) =>
                      setIntake((p) => ({ ...p, international_presence: e.target.value as "yes" | "no" }))
                    }
                  >
                    {intlOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {formError ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{formError}</div>
                ) : null}

                <Button
                  type="button"
                  className="w-full"
                  style={{ backgroundColor: BRAND.teal, color: "white" }}
                  onClick={validateAndBuild}
                >
                  Build profile
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Profile + Phase 3 blocks */}
        {stage !== "intake" ? (
          <div className="mt-6 grid gap-4">
            <Card className={cardBase}>
              <CardHeader>
                <CardTitle style={{ color: BRAND.brown }}>Results</CardTitle>
                <CardDescription>“Your Tax Planning Profile” (one-page summary)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 text-sm">
                  {Object.entries(taxProfileSummary()).map(([k, v]) => (
                    <div key={k} className="flex flex-wrap justify-between gap-2 border-b py-2">
                      <span className="font-medium text-gray-800">{k}</span>
                      <span className="text-gray-700">{String(v || "—")}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setStage("questions")}>
                    Next steps → Your Question Set
                  </Button>
                  <Button variant="outline" onClick={() => setStage("calendar")}>
                    Quarterly Decision Calendar
                  </Button>
                  <Button
                    style={{ backgroundColor: BRAND.teal, color: "white" }}
                    onClick={exportZipBundle}
                    disabled={busyExport}
                  >
                    {busyExport ? "Building bundle…" : "Download ZIP (PDF + ICS + CSV)"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className={cardBase}>
              <CardHeader>
                <CardTitle style={{ color: BRAND.brown }}>
                  Decision Memo + Audit Binder
                </CardTitle>
                <CardDescription>
                  Every “next step” produces a short Tax Position Memo you can re-open and export.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">Planning topic</div>
                      <div className="text-sm text-gray-700">Worker setup (W-2 vs 1099)</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-600">Confidence</div>
                      <div className="text-sm font-semibold">{confidenceScore}/100</div>
                      <div className="text-xs text-gray-600">Based on intake + decision + starter proof checks.</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant={decisionTab === "decision" ? "default" : "outline"}
                      style={decisionTab === "decision" ? { backgroundColor: BRAND.teal, color: "white" } : undefined}
                      onClick={() => setDecisionTab("decision")}
                    >
                      Decision
                    </Button>
                    <Button
                      variant={decisionTab === "rationale" ? "default" : "outline"}
                      style={decisionTab === "rationale" ? { backgroundColor: BRAND.teal, color: "white" } : undefined}
                      onClick={() => setDecisionTab("rationale")}
                    >
                      Rationale
                    </Button>
                    <Button
                      variant={decisionTab === "proof" ? "default" : "outline"}
                      style={decisionTab === "proof" ? { backgroundColor: BRAND.teal, color: "white" } : undefined}
                      onClick={() => setDecisionTab("proof")}
                    >
                      Proof Pack
                    </Button>
                    <Button
                      variant={decisionTab === "memo" ? "default" : "outline"}
                      style={decisionTab === "memo" ? { backgroundColor: BRAND.teal, color: "white" } : undefined}
                      onClick={() => setDecisionTab("memo")}
                    >
                      Memo
                    </Button>
                  </div>

                  {decisionTab === "decision" ? (
                    <div className="mt-4 grid gap-3">
                      <div className="rounded-md border bg-gray-50 p-3 text-sm text-gray-800">
                        <div className="font-semibold">Best fit suggestion</div>
                        <div className="mt-1">
                          {bestWorkerFit === "no_workers"
                            ? "No workers yet"
                            : bestWorkerFit === "all_w2"
                            ? "All W-2 employees"
                            : "None"}
                        </div>
                      </div>

                      <div className="text-sm font-semibold text-gray-800">Which worker setup applies right now?</div>

                      <label className="flex items-start gap-2 text-sm text-gray-800">
                        <input
                          type="radio"
                          name="workerDecision"
                          value="no_workers"
                          checked={workerDecision === "no_workers"}
                          onChange={() => setWorkerDecision("no_workers")}
                        />
                        <span>
                          <span className="font-medium">No workers yet</span>
                          <div className="text-xs text-gray-600">No payroll/1099 setup yet. Keep the proof pack ready for when you hire.</div>
                        </span>
                      </label>

                      <label className="flex items-start gap-2 text-sm text-gray-800">
                        <input
                          type="radio"
                          name="workerDecision"
                          value="all_w2"
                          checked={workerDecision === "all_w2"}
                          onChange={() => setWorkerDecision("all_w2")}
                        />
                        <span>
                          <span className="font-medium">All W-2 employees</span>
                          <div className="text-xs text-gray-600">Payroll compliance cadence becomes a core system.</div>
                        </span>
                      </label>

                      <label className="flex items-start gap-2 text-sm text-gray-800">
                        <input
                          type="radio"
                          name="workerDecision"
                          value="all_1099"
                          checked={workerDecision === "all_1099"}
                          onChange={() => setWorkerDecision("all_1099")}
                        />
                        <span>
                          <span className="font-medium">All 1099 contractors</span>
                          <div className="text-xs text-gray-600">Classification proof matters; collect W-9s and contracts.</div>
                        </span>
                      </label>

                      <label className="flex items-start gap-2 text-sm text-gray-800">
                        <input
                          type="radio"
                          name="workerDecision"
                          value="mixed"
                          checked={workerDecision === "mixed"}
                          onChange={() => setWorkerDecision("mixed")}
                        />
                        <span>
                          <span className="font-medium">Mixed (W-2 + 1099)</span>
                          <div className="text-xs text-gray-600">Run payroll controls and contractor controls side-by-side.</div>
                        </span>
                      </label>
                    </div>
                  ) : null}

                  {decisionTab === "rationale" ? (
                    <div className="mt-4 grid gap-3 text-sm text-gray-800">
                      <div className="font-semibold">Plain-English reason</div>
                      <div className="text-gray-700">
                        Worker setup drives filing cadence, documentation burden, and how clean your story stays if questions show up.
                      </div>
                      <div className="font-semibold">Tradeoffs</div>
                      <ul className="list-disc pl-5 text-gray-700">
                        <li>W-2: more compliance cadence, cleaner control.</li>
                        <li>1099: lower admin, higher classification proof needs.</li>
                        <li>Mixed: both systems at once, needs tidy documentation.</li>
                      </ul>
                      <div className="font-semibold">If asked, say this</div>
                      <div className="rounded-md border bg-gray-50 p-3 text-xs text-gray-700">
                        “We classify workers based on control, role scope, contract terms, and payment trail. Documentation is stored by worker and refreshed when roles change.”
                      </div>
                    </div>
                  ) : null}

                  {decisionTab === "proof" ? (
                    <div className="mt-4 grid gap-3 text-sm text-gray-800">
                      <div className="font-semibold">Proof Pack (starter checklist)</div>
                      <div className="rounded-md border bg-gray-50 p-3 text-xs text-gray-700">
                        Required items keep your decision defensible. Optional items make the story stronger.
                      </div>
                      <ul className="grid gap-2 text-sm text-gray-700">
                        <li>
                          <span className="font-medium">Required:</span> W-9s (for contractors), signed contracts, payment trail
                        </li>
                        <li>
                          <span className="font-medium">Required:</span> Job scope notes (what they do, who directs work, tools used)
                        </li>
                        <li>
                          <span className="font-medium">Optional:</span> Role change log, proof refresh cadence (quarterly)
                        </li>
                        <li>
                          <span className="font-medium">Optional:</span> Payroll reports (if W-2), invoices (if 1099)
                        </li>
                      </ul>
                    </div>
                  ) : null}

                  {decisionTab === "memo" ? (
                    <div className="mt-4 grid gap-3">
                      <div className="text-sm font-semibold text-gray-800">Tax Position Memo (auto-generated)</div>
                      <textarea
                        className="h-64 w-full rounded-md border bg-white p-3 text-xs text-gray-800"
                        value={buildMemoText()}
                        readOnly
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => downloadText("Tax_Position_Memo.txt", buildMemoText())}>
                          Download TXT
                        </Button>
                        <Button
                          style={{ backgroundColor: BRAND.teal, color: "white" }}
                          onClick={exportZipBundle}
                          disabled={busyExport}
                        >
                          {busyExport ? "Building bundle…" : "Download ZIP bundle"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className={cardBase}>
              <CardHeader>
                <CardTitle style={{ color: BRAND.brown }}>Elections + Threshold Radar</CardTitle>
                <CardDescription>
                  A guided watchlist: decisions and deadlines that can cost money if missed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border bg-white p-4">
                  <div className="text-sm font-semibold text-gray-800">Watchlist</div>
                  <div className="mt-1 text-xs text-gray-600">
                    Elections to consider • Thresholds to watch • Deadlines coming up (calendar-linked)
                  </div>

                  <div className="mt-4 grid gap-3">
                    {buildWatchlist().map((w) => (
                      <div key={w.title} className="rounded-xl border bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-gray-800">{w.title}</div>
                            <div className="mt-1 text-xs text-gray-600">Trigger: {w.trigger}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {w.tags.map((t) => (
                              <Badge key={t} variant="secondary">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="mt-3 text-sm text-gray-700">
                          <span className="font-semibold">What happens if missed:</span> {w.consequence}
                        </div>

                        <div className="mt-3 text-sm text-gray-800 font-semibold">Readiness checklist</div>
                        <ul className="mt-1 list-disc pl-5 text-sm text-gray-700">
                          {w.readiness.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>

                        <div className="mt-3 text-sm text-gray-800 font-semibold">Decision prompt</div>
                        <div className="mt-1 text-sm text-gray-700">{w.decisionPrompt}</div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button variant="outline" onClick={() => downloadText("Quarterly_Decision_Calendar.ics", buildQuarterlyEstimatedTaxICS(), "text/calendar")}>
                            Add to calendar (ICS)
                          </Button>
                          <Button variant="outline" onClick={() => setStage("questions")}>
                            Add questions to my list
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {stage === "questions" ? (
              <Card className={cardBase}>
                <CardHeader>
                  <CardTitle style={{ color: BRAND.brown }}>Your Question Set</CardTitle>
                  <CardDescription>Prioritized checklist, grouped by what you selected</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {buildQuestionSet().map((q, idx) => (
                      <div key={idx} className="rounded-xl border bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-gray-800">{q.topic}</div>
                          <Badge
                            style={{
                              backgroundColor: q.priority === "High" ? BRAND.teal : q.priority === "Medium" ? BRAND.gold : "#e5e7eb",
                              color: q.priority === "Low" ? "#111827" : "white",
                            }}
                          >
                            {q.priority}
                          </Badge>
                        </div>
                        <div className="mt-2 text-sm text-gray-700">{q.question}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        downloadText(
                          "Your_Question_Set.csv",
                          buildCSV(buildQuestionSet().map((q) => ({ priority: q.priority, topic: q.topic, question: q.question }))),
                          "text/csv"
                        )
                      }
                    >
                      Download CSV
                    </Button>
                    <Button variant="outline" onClick={() => setStage("calendar")}>
                      Go to calendar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {stage === "calendar" ? (
              <Card className={cardBase}>
                <CardHeader>
                  <CardTitle style={{ color: BRAND.brown }}>Quarterly Decision Calendar</CardTitle>
                  <CardDescription>Actions + key estimated tax anchors (typical schedule)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border bg-white p-4 text-sm text-gray-700">
                    <div className="font-semibold text-gray-800">What this calendar is for</div>
                    <div className="mt-1">
                      This is a planning anchor. If a due date lands on a weekend or federal holiday, the deadline moves to the next business day.
                    </div>

                    <div className="mt-3 font-semibold text-gray-800">Download</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        style={{ backgroundColor: BRAND.teal, color: "white" }}
                        onClick={() => downloadText("Quarterly_Decision_Calendar.ics", buildQuarterlyEstimatedTaxICS(), "text/calendar")}
                      >
                        Download ICS
                      </Button>
                      <Button variant="outline" onClick={() => setStage("exports")}>
                        Go to exports
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}

        {/* Small diagnostics */}
        <div className="mt-6 text-xs text-gray-500">
          Options loaded:
          <span className="ml-2">
            entity_type {entityTypeOpts.length} • state {stateOpts.length} • industry {industryOpts.length} • revenue {revenueOpts.length} • payroll_w2 {payrollW2Opts.length}
          </span>
        </div>
      </div>
    </main>
  );
}
