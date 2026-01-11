"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { Info, Download, Save, ArrowRight } from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";

type Opt = {
  set_key: string;
  value: string;
  label: string;
  sort: number;
  group_label: string | null;
  help: string | null;
};

type Intake = {
  entity_type: string | null;
  states: string[];
  industry: string | null;
  revenue_range: string | null;

  payroll_w2: string | null;

  inventory_presence: string | null;

  multistate_presence: string | null;

  international_presence: string | null;
};

type MemoJson = {
  facts: Record<string, any>;
  assumptions: string[];
  decision: { topic: string; selected: string | null; dateISO: string };
  risks_and_mitigations: string[];
  documents: { attached: string[]; missing: string[] };
  cpa_questions: string[];
};

const BRAND = {
  teal: "#1C6F66",
  brown: "#6B4A2E",
  sand: "#E8B765"
};

function FieldLabel({
  title,
  help
}: {
  title: string;
  help?: string;
}) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <div className="text-sm font-medium text-[#6B4A2E]">{title}</div>
      {help ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border bg-white text-gray-700"
              aria-label={`${title} help`}
            >
              <Info size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-sm">{help}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function buildICS(events: { title: string; dateISO: string }[]) {
  const dtStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BTBB//Tax Planning//EN",
    "CALSCALE:GREGORIAN"
  ];

  for (const ev of events) {
    const dt = ev.dateISO.replace(/-/g, "");
    lines.push("BEGIN:VEVENT");
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dt}`);
    lines.push(`SUMMARY:${ev.title}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function buildCSV(rows: { topic: string; question: string; priority: string }[]) {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const header = ["topic", "priority", "question"].map(esc).join(",");
  const body = rows.map((r) => [r.topic, r.priority, r.question].map(esc).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

function buildProfileSummary(intake: Intake) {
  const states = intake.states?.length ? intake.states.join(", ") : "None selected";
  const lines = [
    `Entity type: ${intake.entity_type ?? "Not selected"}`,
    `State(s): ${states}`,
    `Industry: ${intake.industry ?? "Not selected"}`,
    `Revenue range: ${intake.revenue_range ?? "Not selected"}`,
    `W-2 headcount: ${intake.payroll_w2 ?? "Not selected"}`,
    `Inventory: ${intake.inventory_presence ?? "Not selected"}`,
    `Multi-state: ${intake.multistate_presence ?? "Not selected"}`,
    `International: ${intake.international_presence ?? "Not selected"}`
  ];
  return lines;
}

function buildQuarterCalendar() {
  // Standard quarterly estimated tax checkpoints (weekends/holidays shift in real life).
  // This is a planning calendar, not filing advice.
  const y = new Date().getFullYear();
  const events = [
    { title: "Estimated tax checkpoint (Q1)", dateISO: `${y}-04-15` },
    { title: "Estimated tax checkpoint (Q2)", dateISO: `${y}-06-15` },
    { title: "Estimated tax checkpoint (Q3)", dateISO: `${y}-09-15` },
    { title: "Estimated tax checkpoint (Q4)", dateISO: `${y + 1}-01-15` }
  ];
  return events;
}

function buildQuestionSet(intake: Intake) {
  const rows: { topic: string; question: string; priority: string }[] = [];

  rows.push({
    topic: "Baseline setup",
    priority: "High",
    question: "What bookkeeping system will be the source of truth (and how often will it be reconciled)?"
  });

  if (intake.payroll_w2 && intake.payroll_w2 !== "0") {
    rows.push({
      topic: "Payroll",
      priority: "High",
      question: "Who runs payroll, and where is the quarterly + year-end payroll filing checklist stored?"
    });
  }

  if (intake.inventory_presence === "yes") {
    rows.push({
      topic: "Inventory + COGS",
      priority: "High",
      question: "What is the inventory count cadence, and where are purchase supports stored by month?"
    });
  }

  if (intake.multistate_presence === "yes") {
    rows.push({
      topic: "Multi-state",
      priority: "High",
      question: "Which states need sales tax tracking now, and what is the nexus watch process?"
    });
  }

  if (intake.entity_type === "s_corp") {
    rows.push({
      topic: "S-corp owner comp",
      priority: "High",
      question: "How will you document wage reasonableness (role, hours, comps, distributions pattern)?"
    });
  }

  rows.push({
    topic: "Documentation",
    priority: "Medium",
    question: "Where is the audit-ready binder stored, and who reviews it each quarter?"
  });

  return rows;
}

function buildWorkerSetupMemo(intake: Intake, decision: string | null): { confidence: number; memo: MemoJson } {
  const facts = {
    intake,
    generated_on: todayISO()
  };

  const assumptions = [
    "Tax law deadlines can shift for weekends/holidays.",
    "This memo is an internal planning record based on current inputs."
  ];

  const risks_and_mitigations: string[] = [];

  if (decision === "no_workers") {
    risks_and_mitigations.push("Risk: hiring without setup. Mitigation: keep payroll/contractor checklist ready before first hire.");
  }
  if (decision === "all_w2") {
    risks_and_mitigations.push("Risk: payroll filing misses. Mitigation: quarterly cadence + year-end forms runbook.");
  }
  if (decision === "all_1099") {
    risks_and_mitigations.push("Risk: worker classification disputes. Mitigation: contracts, W-9s, scope control, proof pack.");
  }
  if (decision === "mixed") {
    risks_and_mitigations.push("Risk: controls split across payroll and contractors. Mitigation: separate checklists with shared review cadence.");
  }

  const documents = {
    attached: [],
    missing: [
      "Worker setup decision record",
      "Contracts / offer letters (as applicable)",
      "W-9s (if 1099 contractors exist)",
      "Payroll provider setup notes (if W-2 exists)"
    ]
  };

  const cpa_questions = [
    "Do any current contractors look like employees based on how the work is controlled?",
    "Do we need state payroll registrations based on where work is performed?",
    "What is the cleanest cadence for quarterly compliance reviews?"
  ];

  // Simple confidence: starts at 50, rises with intake completeness
  const filled = [
    intake.entity_type,
    intake.industry,
    intake.revenue_range,
    intake.payroll_w2,
    intake.inventory_presence,
    intake.multistate_presence,
    intake.international_presence
  ].filter(Boolean).length;

  const confidence = Math.min(95, 40 + filled * 8 + (decision ? 10 : 0));

  const memo: MemoJson = {
    facts,
    assumptions,
    decision: { topic: "Worker setup (W-2 vs 1099)", selected: decision, dateISO: todayISO() },
    risks_and_mitigations,
    documents,
    cpa_questions
  };

  return { confidence, memo };
}

function memoToPdfBytes(title: string, lines: string[], memo: MemoJson) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 56, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const writeBlock = (label: string, textLines: string[]) => {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text(label, 56, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    for (const l of textLines) {
      const wrapped = doc.splitTextToSize(l, 500);
      for (const w of wrapped) {
        if (y > 740) {
          doc.addPage();
          y = 56;
        }
        doc.text(w, 56, y);
        y += 14;
      }
    }
  };

  writeBlock("Your Tax Planning Profile", lines);

  writeBlock("Decision selected + date", [
    `${memo.decision.topic}: ${memo.decision.selected ?? "Not selected"}`,
    `Date: ${memo.decision.dateISO}`
  ]);

  writeBlock("Assumptions", memo.assumptions);

  writeBlock("Risks and mitigations", memo.risks_and_mitigations.length ? memo.risks_and_mitigations : ["None listed yet."]);

  writeBlock("Documents attached / missing", [
    `Attached: ${memo.documents.attached.length ? memo.documents.attached.join(", ") : "None"}`,
    `Missing: ${memo.documents.missing.length ? memo.documents.missing.join(", ") : "None"}`
  ]);

  writeBlock("CPA questions (copy/paste)", memo.cpa_questions);

  return doc.output("arraybuffer");
}

export default function TaxPlanningPhase3Page() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  const [opts, setOpts] = useState<Record<string, Opt[]>>({});
  const [intake, setIntake] = useState<Intake>({
    entity_type: null,
    states: [],
    industry: null,
    revenue_range: null,
    payroll_w2: null,
    inventory_presence: null,
    multistate_presence: null,
    international_presence: null
  });

  const [stateToAdd, setStateToAdd] = useState<string>("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [decisionWorkerSetup, setDecisionWorkerSetup] = useState<string | null>(null);
  const workerMemo = useMemo(() => buildWorkerSetupMemo(intake, decisionWorkerSetup), [intake, decisionWorkerSetup]);

  const [savedMemos, setSavedMemos] = useState<{ version: number; created_at: string }[]>([]);
  const [view, setView] = useState<"profile" | "questions" | "calendar">("profile");

  const profileLines = useMemo(() => buildProfileSummary(intake), [intake]);
  const questionSet = useMemo(() => buildQuestionSet(intake), [intake]);
  const calendarEvents = useMemo(() => buildQuarterCalendar(), []);

  async function loadOptions() {
    const { data, error } = await supabase
      .from("btbb_tax_options")
      .select("set_key,value,label,sort,group_label,help")
      .order("set_key", { ascending: true })
      .order("sort", { ascending: true });

    if (error || !data) return;

    const grouped: Record<string, Opt[]> = {};
    for (const row of data as Opt[]) {
      grouped[row.set_key] = grouped[row.set_key] ?? [];
      grouped[row.set_key].push(row);
    }
    setOpts(grouped);
  }

  async function loadIntake(userId: string) {
    const { data } = await supabase
      .from("btbb_tax_intakes")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return;

    setIntake({
      entity_type: data.entity_type ?? null,
      states: (data.states ?? []) as string[],
      industry: data.industry ?? null,
      revenue_range: data.revenue_range ?? null,
      payroll_w2: data.payroll_w2 ?? null,
      inventory_presence: data.inventory_presence ?? null,
      multistate_presence: data.multistate_presence ?? null,
      international_presence: data.international_presence ?? null
    });
  }

  async function saveIntake() {
    if (!sessionUserId) return;

    const payload = {
      user_id: sessionUserId,
      ...intake
    };

    const { error } = await supabase
      .from("btbb_tax_intakes")
      .upsert(payload, { onConflict: "user_id" });

    if (!error) setSavedAt(new Date().toLocaleString());
  }

  async function saveWorkerMemo() {
    if (!sessionUserId) return;

    // Find next version
    const { data: last } = await supabase
      .from("btbb_tax_memos")
      .select("version")
      .eq("user_id", sessionUserId)
      .eq("topic", "worker_setup")
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = (last?.[0]?.version ?? 0) + 1;

    const { error } = await supabase
      .from("btbb_tax_memos")
      .insert({
        user_id: sessionUserId,
        topic: "worker_setup",
        decision_value: decisionWorkerSetup,
        confidence: workerMemo.confidence,
        memo: workerMemo.memo,
        version: nextVersion
      });

    if (!error) {
      await loadSavedMemos();
    }
  }

  async function loadSavedMemos() {
    if (!sessionUserId) return;

    const { data } = await supabase
      .from("btbb_tax_memos")
      .select("version,created_at")
      .eq("user_id", sessionUserId)
      .eq("topic", "worker_setup")
      .order("version", { ascending: false })
      .limit(10);

    setSavedMemos((data ?? []) as any);
  }

  async function downloadBundleZip() {
    const zip = new JSZip();

    // profile JSON
    zip.file("intake.json", JSON.stringify(intake, null, 2));

    // question set CSV
    zip.file("question-set.csv", buildCSV(questionSet));

    // calendar ICS
    zip.file("quarterly-decision-calendar.ics", buildICS(calendarEvents));

    // memo PDF
    const pdfBytes = memoToPdfBytes("Tax Position Memo — Worker setup", profileLines, workerMemo.memo);
    zip.file("tax-position-memo-worker-setup.pdf", pdfBytes);

    const out = await zip.generateAsync({ type: "blob" });
    downloadBlob("btbb-tax-planning-bundle.zip", out);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const s = data.session;

      if (!s?.user?.id) {
        router.push("/auth");
        return;
      }

      setSessionUserId(s.user.id);
      await loadOptions();
      await loadIntake(s.user.id);
      await loadSavedMemos();
      setLoading(false);
    })();
  }, [router]);

  const stateOptions = opts["us_states"] ?? [];
  const entityOptions = opts["entity_type"] ?? [];
  const industryOptions = opts["industry"] ?? [];
  const revenueOptions = opts["revenue_range"] ?? [];
  const payrollOptions = opts["payroll_w2"] ?? [];
  const inventoryOptions = opts["inventory_presence"] ?? [];
  const multistateOptions = opts["multistate_presence"] ?? [];
  const intlOptions = opts["international_presence"] ?? [];

  const industriesByGroup = useMemo(() => {
    const map = new Map<string, Opt[]>();
    for (const o of industryOptions) {
      const g = o.group_label ?? "Other";
      map.set(g, [...(map.get(g) ?? []), o]);
    }
    return Array.from(map.entries());
  }, [industryOptions]);

  const watchlist = useMemo(() => {
    const items: { title: string; tags: string[]; consequence: string; prompt: string }[] = [];

    if (intake.payroll_w2 && intake.payroll_w2 !== "0") {
      items.push({
        title: "Payroll present → payroll compliance cadence + year-end forms readiness",
        tags: ["payroll", "cadence", "forms"],
        consequence: "Late or missed payroll filings can trigger penalties and cleanup work.",
        prompt: "Decision prompt: Who owns payroll run + quarterly review, and where is the checklist stored?"
      });
    }

    if (intake.inventory_presence === "yes") {
      items.push({
        title: "Inventory present → accounting method prompts + COGS substantiation pack",
        tags: ["inventory", "cogs", "documentation"],
        consequence:
          "Weak inventory records can inflate taxable income, create audit friction, and cause mis-stated margins.",
        prompt: "Decision prompt: Pick a count cadence (monthly/quarterly) and name the storage location for supports."
      });
    }

    if (intake.multistate_presence === "yes") {
      items.push({
        title: "Multi-state yes → sales-tax tracking + nexus watch",
        tags: ["sales tax", "nexus", "tracking"],
        consequence: "Missing a registration threshold can create back tax exposure and filing catch-up work.",
        prompt: "Decision prompt: Which states need tracking now, and what is the watch cadence?"
      });
    }

    if (intake.entity_type === "s_corp") {
      items.push({
        title: "S-corp selection → owner comp planning prompts + wage reasonableness evidence pack",
        tags: ["s-corp", "wages", "evidence"],
        consequence: "Weak wage documentation can raise audit risk and reclass issues.",
        prompt: "Decision prompt: Define role/hours and collect pay comps for wage support."
      });
    }

    return items;
  }, [intake]);

  if (loading) {
    return (
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="rounded-xl border bg-white p-4 text-sm text-gray-700">Loading…</div>
      </main>
    );
  }

  return (
    <TooltipProvider>
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-[#6B4A2E]">BTBB Tax Planning — Phase 3</div>
            <div className="mt-1 text-sm text-gray-600">
              Turn your answers into documentation, decision prompts, and a quarterly action calendar.
            </div>
          </div>
          <Badge className="border" style={{ backgroundColor: BRAND.sand, color: BRAND.brown }}>
            Phase 3
          </Badge>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-[#6B4A2E]">Start here</CardTitle>
            <CardDescription>
              Save your intake once. Phase 3 uses it to build your memo + watchlist.
              {savedAt ? <span className="block mt-1">Last saved: {savedAt}</span> : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-white p-3">
              <div className="text-sm font-semibold text-[#6B4A2E]">Intake (inputs 1–8)</div>
              <div className="mt-1 text-xs text-gray-600">
                These inputs drive the memo generator and the watchlist triggers.
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <FieldLabel
                    title="1) Entity type"
                    help="Pick the closest legal form + tax treatment. If you elected S-corp, choose S corporation."
                  />
                  <select
                    className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                    value={intake.entity_type ?? ""}
                    onChange={(e) => setIntake((p) => ({ ...p, entity_type: e.target.value || null }))}
                  >
                    <option value="">Select…</option>
                    {entityOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel
                    title="2) State(s)"
                    help="Add every state that touches operations: formation/registration, people, sales, inventory, events."
                  />

                  <div className="flex gap-2">
                    <select
                      className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                      value={stateToAdd}
                      onChange={(e) => setStateToAdd(e.target.value)}
                    >
                      <option value="">Select a state…</option>
                      {stateOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label} ({o.value})
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (!stateToAdd) return;
                        setIntake((p) => ({
                          ...p,
                          states: p.states.includes(stateToAdd) ? p.states : [...p.states, stateToAdd]
                        }));
                        setStateToAdd("");
                      }}
                    >
                      Add
                    </Button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {intake.states.length ? (
                      intake.states.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs text-gray-800"
                        >
                          {s}
                          <button
                            type="button"
                            className="text-gray-500 hover:text-gray-900"
                            onClick={() =>
                              setIntake((p) => ({ ...p, states: p.states.filter((x) => x !== s) }))
                            }
                            aria-label={`Remove ${s}`}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-500">None selected</span>
                    )}
                  </div>
                </div>

                <div>
                  <FieldLabel
                    title="3) Industry"
                    help="Pick the closest match to your core revenue engine."
                  />
                  <select
                    className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                    value={intake.industry ?? ""}
                    onChange={(e) => setIntake((p) => ({ ...p, industry: e.target.value || null }))}
                  >
                    <option value="">Select…</option>
                    {industriesByGroup.map(([group, items]) => (
                      <optgroup key={group} label={group}>
                        {items.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel
                    title="4) Revenue range"
                    help="Use annual top-line. If you track cash collected, choose the bracket that matches your records."
                  />
                  <select
                    className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                    value={intake.revenue_range ?? ""}
                    onChange={(e) => setIntake((p) => ({ ...p, revenue_range: e.target.value || null }))}
                  >
                    <option value="">Select…</option>
                    {revenueOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel
                    title="5) Payroll headcount — W-2 employees"
                    help="Pick one bracket. This drives payroll watchlist prompts."
                  />
                  <select
                    className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                    value={intake.payroll_w2 ?? ""}
                    onChange={(e) => setIntake((p) => ({ ...p, payroll_w2: e.target.value || null }))}
                  >
                    <option value="">Select…</option>
                    {payrollOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel
                    title="6) Inventory"
                    help="If you sell physical goods or hold supplies tied to sellable units, pick Yes."
                  />
                  <select
                    className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                    value={intake.inventory_presence ?? ""}
                    onChange={(e) => setIntake((p) => ({ ...p, inventory_presence: e.target.value || null }))}
                  >
                    <option value="">Select…</option>
                    {inventoryOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel
                    title="7) Multi-state"
                    help="Pick Yes if you sell, work, store inventory, or register outside your main state."
                  />
                  <select
                    className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                    value={intake.multistate_presence ?? ""}
                    onChange={(e) => setIntake((p) => ({ ...p, multistate_presence: e.target.value || null }))}
                  >
                    <option value="">Select…</option>
                    {multistateOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel
                    title="8) International"
                    help="Pick Yes if you have foreign customers, foreign vendors/labor, imports/exports, or foreign accounts."
                  />
                  <select
                    className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                    value={intake.international_presence ?? ""}
                    onChange={(e) =>
                      setIntake((p) => ({ ...p, international_presence: e.target.value || null }))
                    }
                  >
                    <option value="">Select…</option>
                    {intlOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={saveIntake}
                    style={{ backgroundColor: BRAND.teal }}
                    className="text-white"
                  >
                    Save intake
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setSavedAt(null)}>
                    Reset save stamp
                  </Button>
                </div>
              </div>
            </div>

            <Card className="border">
              <CardHeader>
                <CardTitle className="text-[#6B4A2E]">
                  Recommendation 4 — Decision Memo + Audit Binder (auto-created, versioned, exportable)
                </CardTitle>
                <CardDescription>
                  What the user sees: Every “next step” is not just a task. It produces a short Tax Position Memo the user
                  can save, re-open, and export. This is how advisory firms document judgment calls.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-sm font-semibold text-[#6B4A2E]">Decision Workspace</div>
                  <div className="mt-1 text-xs text-gray-600">
                    Each major planning topic gets 4 tabs: Decision • Rationale • Proof Pack • Memo
                  </div>

                  <div className="mt-3 rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#6B4A2E]">Planning topic</div>
                        <div className="text-sm text-gray-700">Worker setup (W-2 vs 1099)</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-600">Confidence</div>
                        <div className="text-sm font-semibold text-[#1C6F66]">{workerMemo.confidence}/100</div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2">
                      <div className="text-sm font-medium text-[#6B4A2E]">Decision</div>

                      {[
                        {
                          value: "no_workers",
                          label: "No workers yet",
                          help: "No payroll/1099 setup yet. Keep the proof pack ready for when you hire."
                        },
                        {
                          value: "all_w2",
                          label: "All W-2 employees",
                          help: "Payroll compliance cadence becomes a core system."
                        },
                        {
                          value: "all_1099",
                          label: "All 1099 contractors",
                          help: "Classification proof matters; collect W-9s and contracts."
                        },
                        {
                          value: "mixed",
                          label: "Mixed (W-2 + 1099)",
                          help: "Run payroll controls and contractor controls side-by-side."
                        }
                      ].map((o) => (
                        <label key={o.value} className="flex items-start gap-3 rounded-lg border bg-white p-3">
                          <input
                            type="radio"
                            name="worker_setup"
                            className="mt-1"
                            checked={decisionWorkerSetup === o.value}
                            onChange={() => setDecisionWorkerSetup(o.value)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold text-[#6B4A2E]">{o.label}</div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border bg-white text-gray-700"
                                    aria-label={`${o.label} help`}
                                  >
                                    <Info size={14} />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-sm">{o.help}</TooltipContent>
                              </Tooltip>
                            </div>
                            <div className="mt-1 text-xs text-gray-600">
                              “If you pick this” outcomes (1–2 lines) live inside the Memo tab export.
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        onClick={saveWorkerMemo}
                        className="text-white"
                        style={{ backgroundColor: BRAND.teal }}
                      >
                        <Save size={16} className="mr-2" />
                        Save memo version
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const pdfBytes = memoToPdfBytes("Tax Position Memo — Worker setup", profileLines, workerMemo.memo);
                          downloadBlob("tax-position-memo-worker-setup.pdf", new Blob([pdfBytes], { type: "application/pdf" }));
                        }}
                      >
                        <Download size={16} className="mr-2" />
                        Download memo PDF
                      </Button>

                      <div className="ml-auto text-xs text-gray-600">
                        Saved memo versions:{" "}
                        <span className="font-medium text-gray-900">
                          {savedMemos.length ? savedMemos.map((m) => `v${m.version}`).join(", ") : "None yet"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <Card className="border">
                  <CardHeader>
                    <CardTitle className="text-[#6B4A2E]">
                      Recommendation 6 — Elections + Threshold Radar (deadlines, consequences, readiness)
                    </CardTitle>
                    <CardDescription>
                      What the user sees: A guided “Elections & Thresholds” board that says: “These are the decisions and deadlines that can cost money if missed.”
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-xl border bg-white p-3">
                      <div className="text-sm font-semibold text-[#6B4A2E]">Watchlist</div>
                      <div className="mt-1 text-xs text-gray-600">
                        Elections to consider • Thresholds to watch • Deadlines coming up (calendar-linked)
                      </div>

                      <div className="mt-3 space-y-3">
                        {watchlist.length ? (
                          watchlist.map((w) => (
                            <div key={w.title} className="rounded-lg border bg-white p-3">
                              <div className="text-sm font-semibold text-[#6B4A2E]">{w.title}</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {w.tags.map((t) => (
                                  <span
                                    key={t}
                                    className="rounded-full border px-2 py-0.5 text-xs"
                                    style={{ borderColor: BRAND.teal, color: BRAND.teal }}
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                              <div className="mt-2 text-sm text-gray-700">
                                <span className="font-medium">What happens if missed:</span> {w.consequence}
                              </div>
                              <div className="mt-2 text-sm text-gray-700">{w.prompt}</div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-700">
                            No watchlist items yet. Save intake, then pick Yes/No items that match your situation.
                          </div>
                        )}
                      </div>

                      <div className="mt-4 rounded-lg border p-3">
                        <div className="text-sm font-semibold text-[#6B4A2E]">Deadlines coming up</div>
                        <div className="mt-2 space-y-2 text-sm text-gray-700">
                          {calendarEvents.map((e) => (
                            <div key={e.dateISO} className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-medium">{e.title}</div>
                                <div className="text-xs text-gray-600">{e.dateISO}</div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  const ics = buildICS([e]);
                                  downloadBlob(
                                    `${e.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`,
                                    new Blob([ics], { type: "text/calendar;charset=utf-8" })
                                  );
                                }}
                              >
                                Add to calendar
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="rounded-xl border bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-[#6B4A2E]">Results</div>
                      <div className="text-xs text-gray-600">
                        This flow produces: “Your Tax Planning Profile” → “Your Question Set” → “Quarterly Decision Calendar” → downloads.
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant={view === "profile" ? "default" : "outline"} onClick={() => setView("profile")}
                        style={view === "profile" ? { backgroundColor: BRAND.teal, color: "white" } : {}}
                      >
                        Profile
                      </Button>
                      <Button type="button" variant={view === "questions" ? "default" : "outline"} onClick={() => setView("questions")}
                        style={view === "questions" ? { backgroundColor: BRAND.teal, color: "white" } : {}}
                      >
                        Questions
                      </Button>
                      <Button type="button" variant={view === "calendar" ? "default" : "outline"} onClick={() => setView("calendar")}
                        style={view === "calendar" ? { backgroundColor: BRAND.teal, color: "white" } : {}}
                      >
                        Calendar
                      </Button>
                    </div>
                  </div>

                  {view === "profile" ? (
                    <div className="mt-3 space-y-2 text-sm text-gray-700">
                      <div className="text-sm font-semibold text-[#6B4A2E]">Your Tax Planning Profile</div>
                      <ul className="list-disc pl-5">
                        {profileLines.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                      <Button
                        type="button"
                        className="mt-2 text-white"
                        style={{ backgroundColor: BRAND.teal }}
                        onClick={() => setView("questions")}
                      >
                        Next: Your Question Set <ArrowRight size={16} className="ml-2" />
                      </Button>
                    </div>
                  ) : null}

                  {view === "questions" ? (
                    <div className="mt-3 space-y-2 text-sm text-gray-700">
                      <div className="text-sm font-semibold text-[#6B4A2E]">Your Question Set</div>
                      <div className="text-xs text-gray-600">
                        Prioritized checklist, grouped by topics chosen.
                      </div>
                      <div className="mt-2 space-y-2">
                        {questionSet.map((q, idx) => (
                          <div key={idx} className="rounded-lg border bg-white p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-[#6B4A2E]">{q.topic}</div>
                              <span className="rounded-full border px-2 py-0.5 text-xs text-gray-700">
                                {q.priority}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-gray-700">{q.question}</div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            downloadBlob("question-set.csv", new Blob([buildCSV(questionSet)], { type: "text/csv;charset=utf-8" }));
                          }}
                        >
                          Download CSV checklist
                        </Button>

                        <Button
                          type="button"
                          className="text-white"
                          style={{ backgroundColor: BRAND.teal }}
                          onClick={() => setView("calendar")}
                        >
                          Next: Quarterly Decision Calendar <ArrowRight size={16} className="ml-2" />
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {view === "calendar" ? (
                    <div className="mt-3 space-y-2 text-sm text-gray-700">
                      <div className="text-sm font-semibold text-[#6B4A2E]">Quarterly Decision Calendar</div>
                      <div className="text-xs text-gray-600">
                        Actions + key federal estimated tax dates.
                      </div>

                      <div className="mt-2 space-y-2">
                        {calendarEvents.map((e) => (
                          <div key={e.dateISO} className="rounded-lg border bg-white p-3">
                            <div className="text-sm font-semibold text-[#6B4A2E]">{e.title}</div>
                            <div className="text-xs text-gray-600">{e.dateISO}</div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            downloadBlob(
                              "quarterly-decision-calendar.ics",
                              new Blob([buildICS(calendarEvents)], { type: "text/calendar;charset=utf-8" })
                            );
                          }}
                        >
                          Download ICS calendar
                        </Button>

                        <Button
                          type="button"
                          className="text-white"
                          style={{ backgroundColor: BRAND.teal }}
                          onClick={downloadBundleZip}
                        >
                          Download ZIP bundle
                        </Button>
                      </div>

                      <div className="mt-2 text-xs text-gray-500">
                        ZIP includes: PDF + ICS + CSV + intake JSON.
                      </div>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </main>
    </TooltipProvider>
  );
}
