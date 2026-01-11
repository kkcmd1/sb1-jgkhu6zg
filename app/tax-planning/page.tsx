"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase/client";
import { Info } from "lucide-react";

type OptionRow = {
  set_key: string;
  value: string;
  label: string;
  sort: number;
  group_label: string | null;
  help: string | null;
};

type Option = {
  value: string;
  label: string;
  help?: string;
  group?: string;
};

type Intake = {
  entity_type: string | null;
  states: string[];
  industry: string | null;
  revenue_range: string | null;

  payroll_w2: string | null;
  payroll_tags: string[];

  inventory_presence: "yes" | "no" | null;
  inventory_type: string | null;
  inventory_tracking: string | null;

  multistate_presence: "yes" | "no" | null;
  multistate_exposure: string | null;
  multistate_intensity: string | null;

  international_presence: "yes" | "no" | null;
  international_exposure: string | null;
  international_scope: string | null;
};

type MemoRecord = {
  id: string;
  topic: string;
  decision_value: string | null;
  confidence: number;
  version: number;
  memo: any;
  created_at: string;
};

type WatchItem = {
  key: string;
  title: string;
  tags: string[];
  trigger: string;
  consequence: string;
  readiness: string[];
  decisionPrompt: string;
  actions: { key: string; label: string }[];
};

const BRAND = {
  teal: "#1C6F66",
  brown: "#6B4A2E",
  gold: "#E8B765",
};

const FALLBACK_US_STATES: Option[] = [
  { value: "AL", label: "Alabama (AL)" },
  { value: "AK", label: "Alaska (AK)" },
  { value: "AZ", label: "Arizona (AZ)" },
  { value: "AR", label: "Arkansas (AR)" },
  { value: "CA", label: "California (CA)" },
  { value: "CO", label: "Colorado (CO)" },
  { value: "CT", label: "Connecticut (CT)" },
  { value: "DE", label: "Delaware (DE)" },
  { value: "FL", label: "Florida (FL)" },
  { value: "GA", label: "Georgia (GA)" },
  { value: "HI", label: "Hawaii (HI)" },
  { value: "ID", label: "Idaho (ID)" },
  { value: "IL", label: "Illinois (IL)" },
  { value: "IN", label: "Indiana (IN)" },
  { value: "IA", label: "Iowa (IA)" },
  { value: "KS", label: "Kansas (KS)" },
  { value: "KY", label: "Kentucky (KY)" },
  { value: "LA", label: "Louisiana (LA)" },
  { value: "ME", label: "Maine (ME)" },
  { value: "MD", label: "Maryland (MD)" },
  { value: "MA", label: "Massachusetts (MA)" },
  { value: "MI", label: "Michigan (MI)" },
  { value: "MN", label: "Minnesota (MN)" },
  { value: "MS", label: "Mississippi (MS)" },
  { value: "MO", label: "Missouri (MO)" },
  { value: "MT", label: "Montana (MT)" },
  { value: "NE", label: "Nebraska (NE)" },
  { value: "NV", label: "Nevada (NV)" },
  { value: "NH", label: "New Hampshire (NH)" },
  { value: "NJ", label: "New Jersey (NJ)" },
  { value: "NM", label: "New Mexico (NM)" },
  { value: "NY", label: "New York (NY)" },
  { value: "NC", label: "North Carolina (NC)" },
  { value: "ND", label: "North Dakota (ND)" },
  { value: "OH", label: "Ohio (OH)" },
  { value: "OK", label: "Oklahoma (OK)" },
  { value: "OR", label: "Oregon (OR)" },
  { value: "PA", label: "Pennsylvania (PA)" },
  { value: "RI", label: "Rhode Island (RI)" },
  { value: "SC", label: "South Carolina (SC)" },
  { value: "SD", label: "South Dakota (SD)" },
  { value: "TN", label: "Tennessee (TN)" },
  { value: "TX", label: "Texas (TX)" },
  { value: "UT", label: "Utah (UT)" },
  { value: "VT", label: "Vermont (VT)" },
  { value: "VA", label: "Virginia (VA)" },
  { value: "WA", label: "Washington (WA)" },
  { value: "WV", label: "West Virginia (WV)" },
  { value: "WI", label: "Wisconsin (WI)" },
  { value: "WY", label: "Wyoming (WY)" },
  { value: "DC", label: "District of Columbia (DC)" },
  { value: "PR", label: "Puerto Rico (PR)" },
  { value: "VI", label: "US Virgin Islands (VI)" },
  { value: "GU", label: "Guam (GU)" },
  { value: "AS", label: "American Samoa (AS)" },
  { value: "MP", label: "Northern Mariana Islands (MP)" },
];

const FALLBACK_INDUSTRY: Option[] = [
  { value: "pro_services", label: "Professional services", group: "Core" },
  { value: "skilled_trades", label: "Skilled trades + field services", group: "Core" },
  { value: "health_wellness", label: "Healthcare + wellness", group: "Core" },
  { value: "retail_in_person", label: "Retail (in-person)", group: "Core" },
  { value: "ecom", label: "E-commerce / online sales", group: "Core" },
  { value: "food_bev", label: "Food and beverage", group: "Core" },
  { value: "manufacturing", label: "Manufacturing / production", group: "Core" },
  { value: "transport_logistics", label: "Transportation + logistics", group: "Core" },
  { value: "real_estate", label: "Real estate", group: "Core" },
  { value: "ag_animals", label: "Agriculture + animals", group: "Core" },
  { value: "media_entertainment", label: "Media + entertainment", group: "Core" },
  { value: "education", label: "Education", group: "Core" },
  { value: "finance_insurance", label: "Finance/insurance", group: "Core" },
  { value: "gov_contracting", label: "Government contracting", group: "Core" },
  { value: "regulated_special", label: "Highly regulated / special tax regimes", group: "Core" },
  { value: "rev_one_time", label: "Revenue model: One-time projects", group: "Revenue model" },
  { value: "rev_retainer", label: "Revenue model: Monthly retainer", group: "Revenue model" },
  { value: "rev_subscription", label: "Revenue model: Subscription", group: "Revenue model" },
  { value: "rev_usage", label: "Revenue model: Usage-based billing", group: "Revenue model" },
  { value: "rev_product", label: "Revenue model: Product sales per order", group: "Revenue model" },
  { value: "rev_commission", label: "Revenue model: Commission-based", group: "Revenue model" },
  { value: "rev_royalty", label: "Revenue model: Licensing/royalties", group: "Revenue model" },
  { value: "rev_ads", label: "Revenue model: Ads/sponsorship", group: "Revenue model" },
];

function cx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function HelpIcon({ text }: { text: string }) {
  return (
    <span
      className="ml-2 inline-flex items-center align-middle"
      title={text}
      role="img"
      aria-label={text}
    >
      <Info size={14} className="opacity-70 hover:opacity-100" aria-hidden="true" />
    </span>
  );
}

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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

function toCsv(rows: Record<string, any>[]) {
  if (!rows.length) return "col\n";

  const colsSet = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) colsSet.add(k);
  }
  const cols = [...colsSet];

  const esc = (x: any) => {
    const s = String(x ?? "");
    if (/[,"\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };

  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
}

function buildIcsCalendar(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  const dtstamp = `${ymd(new Date())}T000000Z`;

  const year = now.getUTCFullYear();
  const dates = [
    new Date(Date.UTC(year, 3, 15)),
    new Date(Date.UTC(year, 5, 15)),
    new Date(Date.UTC(year, 8, 15)),
    new Date(Date.UTC(year + 1, 0, 15)),
  ];

  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//BTBB//Tax Planning//EN");
  lines.push("CALSCALE:GREGORIAN");

  dates.forEach((d, i) => {
    const uid = `btbb-est-${year}-${i}@btbb`;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${ymd(d)}`);
    lines.push("SUMMARY:Estimated tax checkpoint");
    lines.push("DESCRIPTION:Typical federal checkpoint (holiday rules can shift dates).");
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function computeCompletenessScore(intake: Intake) {
  const fields: Array<boolean> = [
    !!intake.entity_type,
    intake.states.length > 0,
    !!intake.industry,
    !!intake.revenue_range,
    !!intake.payroll_w2,
    !!intake.inventory_presence,
    !!intake.multistate_presence,
    !!intake.international_presence,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

export default function TaxPlanningPhase3Page() {
  const [userId, setUserId] = React.useState<string | null>(null);

  const [opts, setOpts] = React.useState<Record<string, Option[]>>({});
  const [optsLoading, setOptsLoading] = React.useState(false);

  const [intake, setIntake] = React.useState<Intake>({
    entity_type: null,
    states: [],
    industry: null,
    revenue_range: null,

    payroll_w2: null,
    payroll_tags: [],

    inventory_presence: null,
    inventory_type: null,
    inventory_tracking: null,

    multistate_presence: null,
    multistate_exposure: null,
    multistate_intensity: null,

    international_presence: null,
    international_exposure: null,
    international_scope: null,
  });

  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  const [statePick, setStatePick] = React.useState<string>("");

  const [workerDecision, setWorkerDecision] = React.useState<string>("");
  const [proofDone, setProofDone] = React.useState<Record<string, boolean>>({});
  const [memos, setMemos] = React.useState<MemoRecord[]>([]);
  const [memoBusy, setMemoBusy] = React.useState(false);

  const [activeWorkspaceTab, setActiveWorkspaceTab] = React.useState<
    "decision" | "rationale" | "proof" | "memo"
  >("decision");
  const [showQuestionSet, setShowQuestionSet] = React.useState(false);

  const completeness = computeCompletenessScore(intake);

  async function getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("auth.getUser error:", error);
      return null;
    }
    return data.user ?? null;
  }

  async function loadOptions() {
    setOptsLoading(true);

    const { data, error } = await supabase
      .from("btbb_tax_options")
      .select("set_key,value,label,sort,group_label,help")
      .order("set_key", { ascending: true })
      .order("sort", { ascending: true });

    if (error) {
      console.error("loadOptions error:", error);
      alert(`Tax dropdown load failed: ${error.message}`);
      setOptsLoading(false);
      return;
    }

    const grouped: Record<string, Option[]> = {};
    for (const row of (data as OptionRow[]) ?? []) {
      grouped[row.set_key] = grouped[row.set_key] ?? [];
      grouped[row.set_key].push({
        value: row.value,
        label: row.label,
        help: row.help ?? undefined,
        group: row.group_label ?? undefined,
      });
    }

    if (!grouped["us_states"]?.length) grouped["us_states"] = FALLBACK_US_STATES;
    if (!grouped["industry"]?.length) grouped["industry"] = FALLBACK_INDUSTRY;

    setOpts(grouped);
    setOptsLoading(false);
  }

  async function loadIntake(uid: string) {
    const { data, error } = await supabase
      .from("btbb_tax_intakes")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) {
      console.error("loadIntake error:", error);
      return;
    }

    if (data) {
      setIntake((prev) => ({
        ...prev,
        entity_type: data.entity_type ?? null,
        states: (data.states as string[]) ?? [],
        industry: data.industry ?? null,
        revenue_range: data.revenue_range ?? null,

        payroll_w2: data.payroll_w2 ?? null,
        payroll_tags: (data.payroll_tags as string[]) ?? [],

        inventory_presence: data.inventory_presence ?? null,
        inventory_type: data.inventory_type ?? null,
        inventory_tracking: data.inventory_tracking ?? null,

        multistate_presence: data.multistate_presence ?? null,
        multistate_exposure: data.multistate_exposure ?? null,
        multistate_intensity: data.multistate_intensity ?? null,

        international_presence: data.international_presence ?? null,
        international_exposure: data.international_exposure ?? null,
        international_scope: data.international_scope ?? null,
      }));
    }
  }

  async function loadMemos(uid: string) {
    const { data, error } = await supabase
      .from("btbb_tax_memos")
      .select("id,topic,decision_value,confidence,version,memo,created_at")
      .eq("user_id", uid)
      .eq("topic", "worker_setup")
      .order("version", { ascending: false });

    if (error) {
      console.error("loadMemos error:", error);
      return;
    }
    setMemos((data as any) ?? []);
  }

  React.useEffect(() => {
    (async () => {
      const user = await getUser();
      if (!user) return;

      setUserId(user.id);
      await Promise.all([loadOptions(), loadIntake(user.id), loadMemos(user.id)]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveIntake() {
    if (!userId) {
      alert("Sign in first, then save your intake.");
      return;
    }
    setSaving(true);

    const payload = {
      user_id: userId,
      entity_type: intake.entity_type,
      states: intake.states,
      industry: intake.industry,
      revenue_range: intake.revenue_range,

      payroll_w2: intake.payroll_w2,
      payroll_tags: intake.payroll_tags,

      inventory_presence: intake.inventory_presence,
      inventory_type: intake.inventory_type,
      inventory_tracking: intake.inventory_tracking,

      multistate_presence: intake.multistate_presence,
      multistate_exposure: intake.multistate_exposure,
      multistate_intensity: intake.multistate_intensity,

      international_presence: intake.international_presence,
      international_exposure: intake.international_exposure,
      international_scope: intake.international_scope,
    };

    const { error } = await supabase.from("btbb_tax_intakes").upsert(payload, { onConflict: "user_id" });

    if (error) {
      console.error("saveIntake error:", error);
      alert(`Save failed: ${error.message}`);
      setSaving(false);
      return;
    }

    setSavedAt(new Date().toLocaleString());
    setSaving(false);
  }

  function addState(code: string) {
    const c = code.trim().toUpperCase();
    if (!c) return;
    if (intake.states.includes(c)) return;
    setIntake((p) => ({ ...p, states: [...p.states, c] }));
  }

  function removeState(code: string) {
    setIntake((p) => ({ ...p, states: p.states.filter((s) => s !== code) }));
  }

  function bestFitWorkerSuggestion() {
    const w2 = intake.payroll_w2;
    if (!w2) return "none";
    if (w2 === "0") return "no_workers_yet";
    return "all_w2";
  }

  function confidenceScore() {
    const proofKeys = ["w9_or_w4", "contracts_or_offer_letters", "payroll_reports", "vendor_1099_list"];
    const done = proofKeys.filter((k) => !!proofDone[k]).length;
    const proof = Math.round((done / proofKeys.length) * 100);

    const decisionBonus = workerDecision ? 10 : 0;
    const blended = Math.round(completeness * 0.6 + proof * 0.4) + decisionBonus;
    return Math.max(0, Math.min(100, blended));
  }

  function buildMemoJson() {
    const now = new Date().toISOString();

    const decisionLabelMap: Record<string, string> = {
      no_workers_yet: "No workers yet",
      all_w2: "All W-2 employees",
      all_1099: "All 1099 contractors",
      mixed: "Mixed (W-2 + 1099)",
    };

    const decisionSelected = workerDecision || "unselected";

    const facts = {
      entity_type: intake.entity_type,
      states: intake.states,
      industry: intake.industry,
      revenue_range: intake.revenue_range,
      payroll_w2: intake.payroll_w2,
      inventory_presence: intake.inventory_presence,
      multistate_presence: intake.multistate_presence,
      international_presence: intake.international_presence,
    };

    const assumptions = [
      "User-provided intake is complete and accurate for the current period.",
      "This memo is operational planning documentation, not legal advice.",
    ];

    const risksAndMitigations =
      decisionSelected === "all_1099" || decisionSelected === "mixed"
        ? [
            {
              risk: "Worker classification risk if facts support employee status.",
              mitigation:
                "Keep signed contracts, scopes, invoices, and role-based proof. Revisit classification before expanding hours or control.",
            },
          ]
        : [
            {
              risk: "Payroll compliance gaps (filings, deposits, year-end forms).",
              mitigation:
                "Use a payroll calendar, reconcile each pay run, keep quarterly and year-end reports in one binder.",
            },
          ];

    const docsAttached = Object.entries(proofDone)
      .filter(([, v]) => v)
      .map(([k]) => k);

    const docsMissing = ["w9_or_w4", "contracts_or_offer_letters", "payroll_reports", "vendor_1099_list"].filter(
      (k) => !proofDone[k]
    );

    const cpaQuestions = [
      "Do any roles look like employees under your state and federal factors (control, schedule, tools, exclusivity)?",
      "Do you have a clean cadence for payroll deposits and quarterly filings if W-2 is selected?",
      "If 1099 is selected: do contractor contracts match real working behavior?",
    ];

    return {
      memo_type: "Tax Position Memo",
      topic: "Worker setup (W-2 vs 1099)",
      generated_at: now,
      decision_selected: {
        value: decisionSelected,
        label: decisionLabelMap[decisionSelected] ?? decisionSelected,
        date: now,
      },
      facts,
      assumptions,
      risks_and_mitigations: risksAndMitigations,
      documents: {
        attached: docsAttached,
        missing: docsMissing,
      },
      cpa_questions: cpaQuestions,
    };
  }

  async function saveMemoVersion() {
    if (!userId) {
      alert("Sign in first, then save a memo.");
      return;
    }
    setMemoBusy(true);

    const memoJson = buildMemoJson();
    const conf = confidenceScore();
    const nextVersion = (memos?.[0]?.version ?? 0) + 1;

    const { error } = await supabase.from("btbb_tax_memos").insert({
      user_id: userId,
      topic: "worker_setup",
      decision_value: workerDecision || null,
      confidence: conf,
      memo: memoJson,
      version: nextVersion,
    });

    if (error) {
      console.error("saveMemoVersion error:", error);
      alert(`Memo save failed: ${error.message}`);
      setMemoBusy(false);
      return;
    }

    await loadMemos(userId);
    setMemoBusy(false);
  }

  function buildWatchlist(): WatchItem[] {
    const items: WatchItem[] = [];

    const payrollW2 = intake.payroll_w2;
    const payrollPresent = payrollW2 && payrollW2 !== "0";

    if (payrollPresent) {
      items.push({
        key: "payroll_cadence",
        title: "Payroll cadence + year-end readiness",
        tags: ["payroll", "forms", "controls"],
        trigger: "W-2 headcount is above zero.",
        consequence: "Missed deposits or filing gaps can create penalties and make tax prep slower and riskier.",
        readiness: [
          "Payroll provider selected and configured",
          "Deposit schedule known (monthly/semiweekly) and documented",
          "Quarterly filings stored per quarter",
          "Year-end forms plan (W-2/W-3) documented",
        ],
        decisionPrompt: "Do you want a monthly payroll close checklist added to your calendar?",
        actions: [
          { key: "add_calendar", label: "Add to calendar" },
          { key: "add_questions", label: "Add questions to my list" },
        ],
      });
    }

    if (intake.inventory_presence === "yes") {
      items.push({
        key: "inventory_cogs_pack",
        title: "Inventory records + COGS substantiation pack",
        tags: ["inventory", "cogs", "documentation"],
        trigger: "Inventory is marked as present.",
        consequence: "Weak inventory records can inflate taxable income, create audit friction, and distort margins.",
        readiness: [
          "Purchases and support stored by month",
          "Count cadence chosen (monthly or quarterly)",
          "COGS method note exists (including shrink/adjustments)",
          "If using 3PL, storage locations are known and tracked",
        ],
        decisionPrompt: "What count cadence fits your operation right now: monthly or quarterly?",
        actions: [
          { key: "add_calendar", label: "Add to calendar" },
          { key: "add_questions", label: "Add questions to my list" },
        ],
      });
    }

    if (intake.multistate_presence === "yes") {
      items.push({
        key: "nexus_watch",
        title: "Sales-tax tracking + nexus watch",
        tags: ["multi-state", "sales tax", "thresholds"],
        trigger: "Multi-state exposure is marked as yes.",
        consequence: "Untracked thresholds can trigger late registrations, back tax, penalties, and messy clean-up work.",
        readiness: [
          "Sales channels listed (direct site, marketplaces, wholesale)",
          "Ship-to states known and tracked",
          "Inventory/storage states known (3PL/marketplaces)",
          "A monthly threshold review is scheduled",
        ],
        decisionPrompt: "Which states should you watch first based on where sales are landing?",
        actions: [
          { key: "add_calendar", label: "Add to calendar" },
          { key: "add_questions", label: "Add questions to my list" },
        ],
      });
    }

    if (intake.entity_type === "s_corp") {
      items.push({
        key: "owner_comp_pack",
        title: "S-corp owner comp planning + evidence pack",
        tags: ["s-corp", "owner comp", "wages"],
        trigger: "Entity type indicates S-corp taxation.",
        consequence: "Wage reasonableness gaps can create audit exposure and reclassification risk.",
        readiness: [
          "Role description and duties documented",
          "Comparable wage support collected",
          "Payroll set up for owner wages",
          "Quarterly review scheduled (wages vs distributions)",
        ],
        decisionPrompt: "Do you want a quarterly owner-comp review added to your calendar?",
        actions: [
          { key: "add_calendar", label: "Add to calendar" },
          { key: "add_questions", label: "Add questions to my list" },
        ],
      });
    }

    return items;
  }

  function buildQuestionSet(watchlist: WatchItem[]) {
    return watchlist.map((w) => ({
      topic: w.title,
      questions: [
        w.decisionPrompt,
        ...w.readiness.map((r) => `Is this true right now? ${r}`),
        "What would make this a “no” this month?",
      ],
    }));
  }

  async function exportZipBundle() {
    const watchlist = buildWatchlist();
    const questionSet = buildQuestionSet(watchlist);
    const memoJson = buildMemoJson();

    const jsonPayload = {
      exported_at: new Date().toISOString(),
      intake,
      memo: memoJson,
      watchlist,
      question_set: questionSet,
    };

    const ics = buildIcsCalendar();
    const csv = toCsv(
      watchlist.map((w) => ({
        title: w.title,
        trigger: w.trigger,
        consequence: w.consequence,
        tags: w.tags.join(" | "),
      }))
    );

    try {
      const JSZipMod: any = await import("jszip");
      const JSZip = JSZipMod.default ?? JSZipMod;
      const zip = new JSZip();

      zip.file("btbb-tax-profile.json", JSON.stringify(jsonPayload, null, 2));
      zip.file("btbb-watchlist.csv", csv);
      zip.file("btbb-quarterly-calendar.ics", ics);

      // Optional PDF add-on: if pdf-lib is available at runtime, add it.
      // If it isn't, the ZIP still downloads without a PDF.
      try {
        const PdfLib: any = await import("pdf-lib");
        const { PDFDocument, StandardFonts } = PdfLib;

        const doc = await PDFDocument.create();
        const page = doc.addPage([612, 792]);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

        const draw = (t: string, x: number, y: number, size = 11, bold = false) => {
          page.drawText(t, { x, y, size, font: bold ? fontBold : font });
        };

        let y = 760;
        draw("Your Tax Planning Profile (Phase 3 export)", 48, y, 14, true);
        y -= 24;

        draw(`Exported: ${new Date().toLocaleString()}`, 48, y);
        y -= 18;

        draw("Intake snapshot", 48, y, 12, true);
        y -= 16;

        const lines = [
          `Entity type: ${intake.entity_type ?? "—"}`,
          `State(s): ${intake.states.length ? intake.states.join(", ") : "—"}`,
          `Industry: ${intake.industry ?? "—"}`,
          `Revenue range: ${intake.revenue_range ?? "—"}`,
          `Payroll (W-2): ${intake.payroll_w2 ?? "—"}`,
          `Inventory: ${intake.inventory_presence ?? "—"}`,
          `Multi-state: ${intake.multistate_presence ?? "—"}`,
          `International: ${intake.international_presence ?? "—"}`,
        ];

        for (const l of lines) {
          draw(l, 56, y);
          y -= 14;
        }

        y -= 10;
        draw("Watchlist", 48, y, 12, true);
        y -= 16;

        const wl = buildWatchlist();
        if (!wl.length) {
          draw("No watchlist items triggered by current intake.", 56, y);
        } else {
          for (const item of wl.slice(0, 6)) {
            draw(`• ${item.title}`, 56, y);
            y -= 14;
            if (y < 80) break;
          }
        }

        const pdfBytes = await doc.save();
        zip.file("btbb-tax-profile.pdf", pdfBytes);
      } catch (e) {
        console.warn("PDF add-on skipped:", e);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob("btbb-tax-bundle.zip", blob);
    } catch (e: any) {
      console.error("ZIP export failed:", e);
      alert(`ZIP export failed: ${e?.message ?? "Unknown error"}`);
    }
  }

  const watchlist = buildWatchlist();
  const questionSet = buildQuestionSet(watchlist);
  const bestFit = bestFitWorkerSuggestion();
  const conf = confidenceScore();

  const entityOpts = opts["entity_type"] ?? [];
  const stateOpts = opts["us_states"] ?? FALLBACK_US_STATES;
  const industryOpts = opts["industry"] ?? FALLBACK_INDUSTRY;
  const revenueOpts = opts["revenue_range"] ?? [];
  const payrollW2Opts = opts["payroll_w2"] ?? [];
  const invPresenceOpts = opts["inventory_presence"] ?? [];
  const multistateOpts = opts["multistate_presence"] ?? [];
  const intlOpts = opts["international_presence"] ?? [];

  const selectBase =
    "w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/20";
  const cardBase = "rounded-2xl border border-black/10 bg-white/90 shadow-sm";

  const industryGroups = [...new Set(industryOpts.map((o) => o.group ?? "Other"))];

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className={cx(cardBase, "p-5")}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
              BTBB Tax Planning — Phase 3
            </div>
            <div className="mt-1 text-sm text-black/70">
              Turn your answers into documentation, decision prompts, and a quarterly action calendar.
            </div>
          </div>
          <div className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: BRAND.teal }}>
            Phase 3
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-black/10 bg-white/70 p-4">
          <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
            Start here
          </div>
          <div className="mt-1 text-sm text-black/70">
            Save your intake once. Phase 3 uses it to build your memo + watchlist.
          </div>
        </div>
      </div>

      <div className={cx(cardBase, "mt-5 p-5")}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
              Intake (inputs 1–8)
            </div>
            <div className="mt-1 text-sm text-black/70">
              These inputs drive the memo generator and the watchlist triggers.
            </div>
          </div>
          <div className="text-xs text-black/60">
            Completeness: <span className="font-semibold">{completeness}/100</span>
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          <div>
            <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
              1) Entity type <HelpIcon text="Pick the closest match. This drives planning triggers." />
            </div>
            <select
              className={selectBase}
              value={intake.entity_type ?? ""}
              onChange={(e) => setIntake((p) => ({ ...p, entity_type: e.target.value || null }))}
            >
              <option value="">Select…</option>
              {entityOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
              2) State(s) <HelpIcon text="Add every state that can touch tax, filings, payroll, or sales." />
            </div>
            <div className="mt-2 flex gap-2">
              <select className={selectBase} value={statePick} onChange={(e) => setStatePick(e.target.value)}>
                <option value="">Select a state…</option>
                {stateOpts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-md px-3 py-2 text-sm font-semibold text-white"
                style={{ background: BRAND.teal }}
                onClick={() => {
                  addState(statePick);
                  setStatePick("");
                }}
              >
                Add
              </button>
            </div>

            {intake.states.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {intake.states.map((s) => (
                  <button
                    type="button"
                    key={s}
                    className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs"
                    title="Click to remove"
                    onClick={() => removeState(s)}
                  >
                    {s} ✕
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-xs text-black/60">No states added yet.</div>
            )}
          </div>

          <div>
            <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
              3) Industry <HelpIcon text="Pick the closest revenue engine. Add nuance later in notes." />
            </div>
            <select
              className={selectBase}
              value={intake.industry ?? ""}
              onChange={(e) => setIntake((p) => ({ ...p, industry: e.target.value || null }))}
            >
              <option value="">Select…</option>
              {industryGroups.map((g) => (
                <optgroup key={g} label={g}>
                  {industryOpts
                    .filter((o) => (o.group ?? "Other") === g)
                    .map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
              4) Revenue range <HelpIcon text="Pick the closest annual bracket for planning triggers." />
            </div>
            <select
              className={selectBase}
              value={intake.revenue_range ?? ""}
              onChange={(e) => setIntake((p) => ({ ...p, revenue_range: e.target.value || null }))}
            >
              <option value="">Select…</option>
              {revenueOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {!revenueOpts.length ? (
              <div className="mt-2 text-xs text-black/60">
                Revenue options are not seeded yet in btbb_tax_options (set_key = revenue_range).
              </div>
            ) : null}
          </div>

          <div>
            <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
              5) Payroll headcount (W-2) <HelpIcon text="Pick one bracket for W-2 employees on payroll." />
            </div>
            <select
              className={selectBase}
              value={intake.payroll_w2 ?? ""}
              onChange={(e) => setIntake((p) => ({ ...p, payroll_w2: e.target.value || null }))}
            >
              <option value="">Select…</option>
              {payrollW2Opts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
              6) Inventory <HelpIcon text="Inventory changes method choices and documentation standards." />
            </div>
            <select
              className={selectBase}
              value={intake.inventory_presence ?? ""}
              onChange={(e) =>
                setIntake((p) => ({ ...p, inventory_presence: (e.target.value || null) as any }))
              }
            >
              <option value="">Select…</option>
              {invPresenceOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
              7) Multi-state <HelpIcon text="Tracks cross-state risk: sales tax, payroll, registrations, filings." />
            </div>
            <select
              className={selectBase}
              value={intake.multistate_presence ?? ""}
              onChange={(e) =>
                setIntake((p) => ({ ...p, multistate_presence: (e.target.value || null) as any }))
              }
            >
              <option value="">Select…</option>
              {multistateOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
              8) International <HelpIcon text="Foreign touchpoints can trigger reporting and withholding complexity." />
            </div>
            <select
              className={selectBase}
              value={intake.international_presence ?? ""}
              onChange={(e) =>
                setIntake((p) => ({ ...p, international_presence: (e.target.value || null) as any }))
              }
            >
              <option value="">Select…</option>
              {intlOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: BRAND.teal }}
              disabled={saving}
              onClick={saveIntake}
            >
              {saving ? "Saving…" : "Save intake"}
            </button>

            <button
              type="button"
              className="rounded-md border border-black/10 bg-white px-4 py-2 text-sm font-semibold"
              onClick={() => loadOptions()}
              title="Reload dropdown options from Supabase"
            >
              {optsLoading ? "Reloading…" : "Reload dropdowns"}
            </button>

            <div className="text-xs text-black/60">
              {savedAt ? `Last saved: ${savedAt}` : userId ? "Not saved yet." : "Sign in to save."}
            </div>
          </div>
        </div>
      </div>

      <div className={cx(cardBase, "mt-5 p-5")}>
        <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
          Decision Memo + Audit Binder
        </div>
        <div className="mt-1 text-sm text-black/70">
          Each “next step” becomes a saved Tax Position Memo you can re-open and export. This is how advisory firms
          document judgment calls.
        </div>

        <div className="mt-4 rounded-xl border border-black/10 bg-white/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
              Planning topic: Worker setup (W-2 vs 1099)
            </div>
            <div className="text-xs text-black/60">
              Confidence: <span className="font-semibold">{conf}/100</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(["decision", "rationale", "proof", "memo"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={cx(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  activeWorkspaceTab === t ? "text-white" : "border border-black/10 bg-white text-black/70"
                )}
                style={activeWorkspaceTab === t ? { background: BRAND.teal } : undefined}
                onClick={() => setActiveWorkspaceTab(t)}
              >
                {t === "decision" ? "Decision" : t === "rationale" ? "Rationale" : t === "proof" ? "Proof Pack" : "Memo"}
              </button>
            ))}
          </div>

          {activeWorkspaceTab === "decision" ? (
            <div className="mt-4">
              <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                Which worker setup applies right now? <HelpIcon text="Pick what matches how you actually operate today." />
              </div>

              <div className="mt-2 rounded-lg border border-black/10 bg-white p-3 text-sm">
                <div className="text-xs text-black/60">Best fit for you (auto-suggestion)</div>
                <div className="mt-1 font-semibold" style={{ color: BRAND.brown }}>
                  {bestFit === "no_workers_yet"
                    ? "No workers yet"
                    : bestFit === "all_w2"
                    ? "All W-2 employees (likely present)"
                    : "None yet"}
                </div>
              </div>

              <div className="mt-3 grid gap-2">
                {[
                  {
                    v: "no_workers_yet",
                    label: "No workers yet",
                    help: "No payroll/1099 setup yet. Keep the proof pack ready for when you hire.",
                  },
                  { v: "all_w2", label: "All W-2 employees", help: "Payroll compliance cadence becomes a core system." },
                  { v: "all_1099", label: "All 1099 contractors", help: "Classification proof matters; collect W-9s and contracts." },
                  { v: "mixed", label: "Mixed (W-2 + 1099)", help: "Run payroll controls and contractor controls side-by-side." },
                ].map((x) => (
                  <label key={x.v} className="flex cursor-pointer items-start gap-3 rounded-lg border border-black/10 bg-white p-3">
                    <input
                      type="radio"
                      name="workerDecision"
                      value={x.v}
                      checked={workerDecision === x.v}
                      onChange={() => setWorkerDecision(x.v)}
                      className="mt-1"
                    />
                    <div>
                      <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                        {x.label} <HelpIcon text={x.help} />
                      </div>
                      <div className="text-xs text-black/60">{x.help}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {activeWorkspaceTab === "rationale" ? (
            <div className="mt-4 grid gap-3">
              <div className="rounded-lg border border-black/10 bg-white p-3">
                <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                  Plain-English reason
                </div>
                <div className="mt-1 text-sm text-black/70">
                  Your worker setup changes filing rules, documentation standards, and audit risk. The goal is alignment:
                  what you select should match real control, schedule, tools, and working behavior.
                </div>
              </div>

              <div className="rounded-lg border border-black/10 bg-white p-3">
                <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                  Tradeoffs (pros/cons)
                </div>
                <ul className="mt-2 list-disc pl-5 text-sm text-black/70">
                  <li>W-2: cleaner compliance structure, higher admin load.</li>
                  <li>1099: flexible staffing, higher classification proof burden.</li>
                  <li>Mixed: common in growth phases, needs two control systems.</li>
                </ul>
              </div>

              <div className="rounded-lg border border-black/10 bg-white p-3">
                <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                  “If asked, say this” (audit narrative draft)
                </div>
                <div className="mt-1 text-sm text-black/70">
                  “Our worker setup matches how work is performed in practice. We document roles, agreements, and proof
                  monthly, and we review the setup any time scope, hours, or control changes.”
                </div>
              </div>
            </div>
          ) : null}

          {activeWorkspaceTab === "proof" ? (
            <div className="mt-4">
              <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                Proof Pack (what counts as proof) <HelpIcon text="Check off what you already have. This raises confidence." />
              </div>

              <div className="mt-3 grid gap-2">
                {[
                  {
                    key: "w9_or_w4",
                    title: "Worker forms on file",
                    req: true,
                    files: "PDF, image",
                    done: "Stored in binder by worker",
                    cadence: "When hiring + annual refresh",
                  },
                  {
                    key: "contracts_or_offer_letters",
                    title: "Contracts (1099) or offer letters (W-2)",
                    req: true,
                    files: "PDF",
                    done: "Signed and dated",
                    cadence: "Per worker + update on scope change",
                  },
                  {
                    key: "payroll_reports",
                    title: "Payroll reports / pay run support",
                    req: false,
                    files: "PDF, CSV",
                    done: "Quarterly folder complete",
                    cadence: "Each pay run + quarter close",
                  },
                  {
                    key: "vendor_1099_list",
                    title: "1099 vendor list (who, what, totals)",
                    req: false,
                    files: "CSV, sheet export",
                    done: "Totals match books",
                    cadence: "Monthly refresh + year-end final",
                  },
                ].map((i) => (
                  <label key={i.key} className="flex items-start gap-3 rounded-lg border border-black/10 bg-white p-3">
                    <input
                      type="checkbox"
                      checked={!!proofDone[i.key]}
                      onChange={(e) => setProofDone((p) => ({ ...p, [i.key]: e.target.checked }))}
                      className="mt-1"
                    />
                    <div className="w-full">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                          {i.title}{" "}
                          <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold text-black/70">
                            {i.req ? "Required" : "Optional"}
                          </span>
                          <HelpIcon text={`Accepted: ${i.files}. Done: ${i.done}. Review: ${i.cadence}.`} />
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-black/60">
                        Accepted: {i.files} • Done means: {i.done} • Review: {i.cadence}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {activeWorkspaceTab === "memo" ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                    Memo (auto-generated)
                  </div>
                  <div className="mt-1 text-sm text-black/70">
                    Generates a Tax Position Memo with facts, assumptions, decision, risks, mitigations, documents, and
                    CPA questions.
                  </div>
                </div>

                <button
                  type="button"
                  className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: BRAND.teal }}
                  disabled={memoBusy}
                  onClick={saveMemoVersion}
                >
                  {memoBusy ? "Saving memo…" : "Save memo version"}
                </button>
              </div>

              <div className="mt-3 rounded-lg border border-black/10 bg-white p-3">
                <div className="text-xs text-black/60">Preview</div>
                <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-black/5 p-3 text-xs">
                  {JSON.stringify(buildMemoJson(), null, 2)}
                </pre>
              </div>

              <div className="mt-3 rounded-lg border border-black/10 bg-white p-3">
                <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                  Saved memo versions (newest first)
                </div>

                {memos.length ? (
                  <div className="mt-2 grid gap-2">
                    {memos.map((m) => (
                      <div key={m.id} className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold" style={{ color: BRAND.brown }}>
                            Version {m.version}
                          </div>
                          <div className="text-xs text-black/60">{new Date(m.created_at).toLocaleString()}</div>
                        </div>
                        <div className="mt-1 text-xs text-black/60">
                          Decision: {m.decision_value ?? "—"} • Confidence: {m.confidence}/100
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-black/60">No saved memos yet.</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className={cx(cardBase, "mt-5 p-5")}>
        <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
          Elections + Threshold Radar
        </div>
        <div className="mt-1 text-sm text-black/70">
          A guided board of decisions and deadlines that can cost money if missed.
        </div>

        <div className="mt-4 rounded-xl border border-black/10 bg-white/80 p-4">
          <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
            Watchlist
          </div>
          <div className="mt-1 text-sm text-black/70">
            Elections to consider • Thresholds to watch • Deadlines coming up (calendar-linked)
          </div>

          {watchlist.length ? (
            <div className="mt-3 grid gap-3">
              {watchlist.map((w) => (
                <div key={w.key} className="rounded-lg border border-black/10 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                        {w.title}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {w.tags.map((t) => (
                          <span key={t} className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold text-black/70">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                      onClick={() => {
                        const ics = buildIcsCalendar();
                        downloadText("btbb-quarterly-calendar.ics", ics, "text/calendar");
                      }}
                    >
                      Add to calendar
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="rounded-md bg-black/5 p-2">
                      <span className="font-semibold" style={{ color: BRAND.brown }}>
                        Trigger:
                      </span>{" "}
                      {w.trigger}
                    </div>

                    <div className="rounded-md bg-black/5 p-2">
                      <span className="font-semibold" style={{ color: BRAND.brown }}>
                        What happens if missed:
                      </span>{" "}
                      {w.consequence}
                    </div>

                    <div className="rounded-md bg-black/5 p-2">
                      <div className="font-semibold" style={{ color: BRAND.brown }}>
                        Readiness checklist
                      </div>
                      <ul className="mt-1 list-disc pl-5 text-black/70">
                        {w.readiness.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-md bg-black/5 p-2">
                      <span className="font-semibold" style={{ color: BRAND.brown }}>
                        Decision prompt:
                      </span>{" "}
                      {w.decisionPrompt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-sm text-black/60">
              No watchlist items triggered yet. Save intake and select more details to unlock triggers.
            </div>
          )}
        </div>
      </div>

      <div className={cx(cardBase, "mt-5 p-5")}>
        <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
          Results
        </div>
        <div className="mt-1 text-sm text-black/70">
          Move through the outputs in order: Profile → Question Set → Calendar → Downloads.
        </div>

        <div className="mt-4 grid gap-3">
          <div className="rounded-xl border border-black/10 bg-white/80 p-4">
            <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
              Your Tax Planning Profile
            </div>
            <div className="mt-2 rounded-lg bg-black/5 p-3 text-sm text-black/70">
              <div>Entity type: {intake.entity_type ?? "—"}</div>
              <div>State(s): {intake.states.length ? intake.states.join(", ") : "—"}</div>
              <div>Industry: {intake.industry ?? "—"}</div>
              <div>Revenue: {intake.revenue_range ?? "—"}</div>
              <div>Payroll (W-2): {intake.payroll_w2 ?? "—"}</div>
              <div>Inventory: {intake.inventory_presence ?? "—"}</div>
              <div>Multi-state: {intake.multistate_presence ?? "—"}</div>
              <div>International: {intake.international_presence ?? "—"}</div>
            </div>

            <button
              type="button"
              className="mt-3 rounded-md px-4 py-2 text-sm font-semibold text-white"
              style={{ background: BRAND.teal }}
              onClick={() => setShowQuestionSet(true)}
            >
              Next steps → Your Question Set
            </button>
          </div>

          {showQuestionSet ? (
            <div className="rounded-xl border border-black/10 bg-white/80 p-4">
              <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                Your Question Set
              </div>
              <div className="mt-1 text-sm text-black/70">
                Prioritized checklist grouped by what your intake triggers.
              </div>

              {questionSet.length ? (
                <div className="mt-3 grid gap-3">
                  {questionSet.map((q) => (
                    <div key={q.topic} className="rounded-lg border border-black/10 bg-white p-3">
                      <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                        {q.topic}
                      </div>
                      <ul className="mt-2 list-disc pl-5 text-sm text-black/70">
                        {q.questions.map((x: string, idx: number) => (
                          <li key={`${idx}-${x}`}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm text-black/60">No questions yet.</div>
              )}

              <div className="mt-4 rounded-lg border border-black/10 bg-white p-3">
                <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                  Quarterly Decision Calendar
                </div>
                <div className="mt-1 text-sm text-black/70">
                  Download an ICS with typical quarterly checkpoints (holiday shifts can change exact due dates).
                </div>
                <button
                  type="button"
                  className="mt-3 rounded-md border border-black/10 bg-white px-4 py-2 text-sm font-semibold"
                  onClick={() => {
                    const ics = buildIcsCalendar();
                    downloadText("btbb-quarterly-calendar.ics", ics, "text/calendar");
                  }}
                >
                  Download ICS calendar
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-md border border-black/10 bg-white px-4 py-2 text-sm font-semibold"
                  onClick={() =>
                    downloadText(
                      "btbb-tax-profile.json",
                      JSON.stringify({ intake, memo: buildMemoJson(), watchlist }, null, 2),
                      "application/json"
                    )
                  }
                >
                  Download JSON
                </button>

                <button
                  type="button"
                  className="rounded-md border border-black/10 bg-white px-4 py-2 text-sm font-semibold"
                  onClick={() => {
                    const csv = toCsv(
                      watchlist.map((w) => ({
                        title: w.title,
                        trigger: w.trigger,
                        consequence: w.consequence,
                        tags: w.tags.join(" | "),
                      }))
                    );
                    downloadText("btbb-watchlist.csv", csv, "text/csv");
                  }}
                >
                  Download CSV checklist
                </button>

                <button
                  type="button"
                  className="rounded-md px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: BRAND.teal }}
                  onClick={exportZipBundle}
                >
                  Download bundle (ZIP)
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 text-xs text-black/50">{optsLoading ? "Loading dropdowns…" : ""}</div>
    </main>
  );
}
