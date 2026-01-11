"use client";

import * as React from "react";
import JSZip from "jszip";
import jsPDF from "jspdf";
import { Info } from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type OptionRow = {
  set_key: string;
  value: string;
  label: string;
  sort: number | null;
  group_label: string | null;
  help: string | null;
  meta: any;
};

type OptionsByKey = Record<string, OptionRow[]>;

type Intake = {
  entity_type: string;
  states: string[];
  industry: string;
  revenue_range: string;
  payroll_w2: string;
  inventory_presence: "yes" | "no" | "";
  multistate_presence: "yes" | "no" | "";
  international_presence: "yes" | "no" | "";
};

type QuestionItem = {
  id: string;
  priority: "High" | "Medium" | "Low";
  question: string;
  why_it_matters: string;
  what_to_gather: string[];
  red_flags: string[];
  next_action: string;
  topic: string;
};

type QuestionGroup = {
  title: string;
  subtitle: string;
  items: QuestionItem[];
};

type CalendarItem = {
  dateISO: string; // YYYY-MM-DD
  title: string;
  notes: string;
  tags: string[];
};

type WatchItem = {
  id: string;
  title: string;
  trigger: string;
  consequence: string;
  readiness: string[];
  decision_prompt: string;
  recommended_questions: QuestionItem[];
  recommended_calendar: CalendarItem[];
  tags: string[];
};

type WorkerDecision =
  | "none"
  | "no_workers"
  | "all_w2"
  | "all_1099"
  | "mixed";

type ProofItem = {
  id: string;
  label: string;
  required: boolean;
  accept: string[];
  done_definition: string;
  review_cadence: string;
};

type MemoVersion = {
  id: string;
  createdAtISO: string;
  topicId: string;
  topicTitle: string;
  decision: WorkerDecision;
  memoText: string;
};

const BRAND = {
  teal: "#1C6F66",
  brown: "#6B4A2E",
  gold: "#E8B765",
  bg: "#F8F9FA",
};

const OPTION_KEYS = [
  "entity_type",
  "us_states",
  "industry",
  "revenue_range",
  "payroll_w2",
  "inventory_presence",
  "multistate_presence",
  "international_presence",
];

function uid(prefix = "id") {
  const r =
    (globalThis as any).crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${r}`;
}

function uniq(arr: string[]) {
  const out: string[] = [];
  for (const v of arr) if (v && !out.includes(v)) out.push(v);
  return out;
}

function safeLabel(opt?: OptionRow) {
  return opt?.label ?? opt?.value ?? "";
}

function findOption(opts: OptionsByKey, key: string, value: string) {
  const list = opts[key] ?? [];
  return list.find((o) => o.value === value);
}

function toCsv(rows: Record<string, string>[]) {
  const headers = Object.keys(rows[0] ?? {});
  const escape = (s: string) => {
    const t = (s ?? "").replaceAll('"', '""');
    return `"${t}"`;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(",")),
  ];
  return lines.join("\n");
}

function fmtISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return fmtISODate(dt);
}

function icsEscape(s: string) {
  return (s ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

// all-day event: DTSTART;VALUE=DATE:YYYYMMDD
function isoToIcsDate(iso: string) {
  return iso.replaceAll("-", "");
}

function buildIcs(events: CalendarItem[]) {
  const now = new Date();
  const dtstamp =
    `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(
      now.getUTCDate()
    ).padStart(2, "0")}T${String(now.getUTCHours()).padStart(2, "0")}${String(
      now.getUTCMinutes()
    ).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}Z`;

  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//BTBB//Tax Planning//EN");
  lines.push("CALSCALE:GREGORIAN");

  for (const e of events) {
    const uidv = uid("btbb");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${icsEscape(uidv)}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${isoToIcsDate(e.dateISO)}`);
    lines.push(`SUMMARY:${icsEscape(e.title)}`);
    const desc = [e.notes, e.tags?.length ? `Tags: ${e.tags.join(", ")}` : ""]
      .filter(Boolean)
      .join("\n");
    if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function scoreFromProfile(p: Intake) {
  // simple v1 score: higher = more exposure
  let score = 18;

  if (p.revenue_range && !["pre_revenue", "1_10k"].includes(p.revenue_range)) score += 8;
  if (["500_1m", "1m_2_5m", "2_5m_5m", "5m_10m", "10m_25m"].includes(p.revenue_range)) score += 8;

  if (p.payroll_w2 && p.payroll_w2 !== "0") score += 14;
  if (p.inventory_presence === "yes") score += 10;
  if (p.multistate_presence === "yes") score += 14;
  if (p.international_presence === "yes") score += 10;

  // digital sales tend to create sales-tax complexity across states
  if (p.industry === "ecom_digital_downloads" || p.industry === "saas") score += 10;

  // states count
  if ((p.states?.length ?? 0) >= 2) score += 6;
  if ((p.states?.length ?? 0) >= 5) score += 6;

  if (!p.entity_type) score += 6;
  if (!p.industry) score += 6;

  if (score > 100) score = 100;

  const drivers: string[] = [];
  if (p.payroll_w2 && p.payroll_w2 !== "0") drivers.push("Payroll present");
  if (p.inventory_presence === "yes") drivers.push("Inventory present");
  if (p.multistate_presence === "yes") drivers.push("Multi-state exposure");
  if (p.international_presence === "yes") drivers.push("International touchpoints");
  if (p.industry === "ecom_digital_downloads") drivers.push("Digital downloads sales tax exposure");
  if ((p.states?.length ?? 0) >= 2) drivers.push("Multiple states selected");

  const whatToDoNext: string[] = [];
  if (p.payroll_w2 && p.payroll_w2 !== "0")
    whatToDoNext.push("Lock payroll cadence: filings, approvals, and year-end readiness.");
  if (p.inventory_presence === "yes")
    whatToDoNext.push("Define inventory count cadence and COGS support pack.");
  if (p.multistate_presence === "yes")
    whatToDoNext.push("Track nexus signals and confirm sales tax registration states.");
  if (!p.industry) whatToDoNext.push("Pick an industry so the plan can target the right risks.");

  const docGaps: string[] = [];
  if (p.payroll_w2 && p.payroll_w2 !== "0")
    docGaps.push("Payroll folder set: 941/940/W-2/W-3 state filings, approvals, and support.");
  if (p.inventory_presence === "yes")
    docGaps.push("Inventory support: purchases by month, counts, shrink notes, and COGS method note.");
  if (p.multistate_presence === "yes")
    docGaps.push("State footprint log: where you sell, where you work, where inventory sits.");

  return { score, drivers, whatToDoNext, docGaps };
}

function buildQuestionSet(p: Intake): QuestionGroup[] {
  const groups: QuestionGroup[] = [];

  const foundations: QuestionItem[] = [
    {
      id: "books_method",
      priority: "High",
      topic: "Foundations",
      question: "What bookkeeping method are you using right now (cash, accrual, mixed)?",
      why_it_matters:
        "Your tax results and your audit trail depend on consistent books. Cash vs accrual changes timing and documentation expectations.",
      what_to_gather: ["Your bookkeeping system name (Excel, Wave, QuickBooks, etc.)", "Last 3 months bank statements"],
      red_flags: ["Personal and business transactions mixed", "No monthly reconciliation"],
      next_action: "Pick a method for now and reconcile the last full month end-to-end.",
    },
    {
      id: "est_tax_plan",
      priority: "High",
      topic: "Foundations",
      question: "Do you have an estimated tax habit (set-aside % + payment cadence)?",
      why_it_matters:
        "Quarterly estimated tax is where small businesses get surprised. A steady habit reduces cash shocks.",
      what_to_gather: ["Last year tax return (if any)", "This year YTD profit estimate"],
      red_flags: ["No set-aside at all", "Paying late because cash is tight"],
      next_action: "Set a default set-aside % and schedule quarterly check-ins in your calendar.",
    },
  ];

  groups.push({
    title: "Foundations",
    subtitle: "These questions stabilize cash flow and reduce avoidable surprises.",
    items: foundations,
  });

  // Entity + elections
  const entityItems: QuestionItem[] = [];
  if (p.entity_type === "s_corp") {
    entityItems.push({
      id: "scorp_owner_comp",
      priority: "High",
      topic: "Entity + Elections",
      question: "How are you setting owner pay (wages vs distributions), and what supports wage reasonableness?",
      why_it_matters:
        "S-corp planning lives or dies on owner compensation support. Weak support raises audit risk and can create tax reclassification.",
      what_to_gather: ["Payroll reports", "Role description + hours", "Comparable wage data notes"],
      red_flags: ["0 wages while taking distributions", "No payroll filings support"],
      next_action: "Create an owner comp note: role, hours, market range, and review cadence.",
    });
  } else if (p.entity_type) {
    entityItems.push({
      id: "entity_tax_status",
      priority: "Medium",
      topic: "Entity + Elections",
      question: "Is your tax treatment aligned with the entity you formed (and is an election in play)?",
      why_it_matters:
        "Many owners form an LLC and assume the tax result. Elections change filings, payroll, and recordkeeping.",
      what_to_gather: ["Entity documents", "Any IRS election confirmations", "Prior return (if filed)"],
      red_flags: ["Not sure how the entity is taxed", "Missing election confirmation"],
      next_action: "Write a 5-line entity snapshot: legal form, tax status, filing form, owner setup, and next review date.",
    });
  }

  if (entityItems.length) {
    groups.push({
      title: "Entity + Elections",
      subtitle: "High-impact decisions that can change filings, payroll, and documentation.",
      items: entityItems,
    });
  }

  // Workers + payroll
  const workerItems: QuestionItem[] = [];
  if (p.payroll_w2 && p.payroll_w2 !== "0") {
    workerItems.push({
      id: "payroll_cadence",
      priority: "High",
      topic: "Workers + Payroll",
      question: "What is your payroll compliance cadence (approvals, filings, year-end forms readiness)?",
      why_it_matters:
        "Payroll is deadline-heavy. A written cadence reduces penalties and protects cash flow.",
      what_to_gather: ["Payroll provider details", "Last quarter filings", "Year-end checklist"],
      red_flags: ["Late filings", "No documented approval flow", "Missing W-2/W-3 plan"],
      next_action: "Create a payroll calendar: pay dates + filing deadlines + owner approval steps.",
    });
  }

  workerItems.push({
    id: "worker_setup",
    priority: "High",
    topic: "Workers + Payroll",
    question: "Are your workers W-2, 1099, mixed, or none yet—and what proof supports the classification?",
    why_it_matters:
      "Worker classification is a top audit and penalty zone. Your contracts and onboarding paperwork are your first line of defense.",
    what_to_gather: ["W-9s", "Contracts", "Invoices/time logs", "Scope-of-work documentation"],
    red_flags: ["Treating full-time staff as contractors", "No contracts or W-9s"],
    next_action: "Build a worker folder standard: onboarding docs + contract + proof items by worker type.",
  });

  groups.push({
    title: "Workers + Payroll",
    subtitle: "Reduce misclassification risk and lock your payroll system early.",
    items: workerItems,
  });

  // Sales tax + states
  const stateItems: QuestionItem[] = [];
  if ((p.states?.length ?? 0) >= 1) {
    stateItems.push({
      id: "state_footprint",
      priority: "High",
      topic: "Sales tax + States",
      question: "Which states touch your business (formation, people, property/inventory, sales)?",
      why_it_matters:
        "State footprint drives registration, filing obligations, and sales tax exposure. Missing a state can mean penalties later.",
      what_to_gather: ["Where you ship to", "Where you work/perform services", "Inventory/warehouse locations"],
      red_flags: ["Selling nationwide with no footprint tracking", "Remote work in another state not tracked"],
      next_action: "Start a footprint log by category (sales, people, inventory, entity registrations).",
    });
  }

  if (p.industry === "ecom_digital_downloads" || p.industry === "saas") {
    stateItems.push({
      id: "digital_sales_tax",
      priority: "High",
      topic: "Sales tax + States",
      question: "For digital products, which states require sales tax and how are you tracking it?",
      why_it_matters:
        "Digital goods rules vary by state. A simple tracking system prevents under-collection and reduces customer friction.",
      what_to_gather: ["Where customers are located", "Your checkout tax settings", "Sales by state report"],
      red_flags: ["No state-by-state view", "Assuming digital is always non-taxable"],
      next_action: "Track sales by state monthly and keep a list of states where you collect tax.",
    });
  }

  if (p.multistate_presence === "yes") {
    stateItems.push({
      id: "nexus_watch",
      priority: "High",
      topic: "Sales tax + States",
      question: "What is your nexus watch process (sales thresholds, inventory location, remote workers)?",
      why_it_matters:
        "Nexus can appear without a storefront. A watch process helps you register and file before penalties build.",
      what_to_gather: ["Sales by state", "Inventory locations", "Worker locations"],
      red_flags: ["Inventory stored out of state without tracking", "Remote workers not tracked"],
      next_action: "Define a monthly nexus check and add it to your quarterly calendar.",
    });
  }

  groups.push({
    title: "Sales tax + States",
    subtitle: "Keep a clean footprint story across where you sell, work, and store inventory.",
    items: stateItems,
  });

  // Inventory
  if (p.inventory_presence === "yes") {
    groups.push({
      title: "Inventory + COGS",
      subtitle: "If inventory exists, documentation becomes part of your tax result.",
      items: [
        {
          id: "inventory_cadence",
          priority: "High",
          topic: "Inventory + COGS",
          question: "What is your inventory count cadence (monthly/quarterly) and where is it documented?",
          why_it_matters:
            "Weak counts inflate taxable income, create audit friction, and misstate margins.",
          what_to_gather: ["Purchase support by month", "Counts", "Shrink/adjustment notes"],
          red_flags: ["No counts", "No purchase support by month"],
          next_action: "Pick a cadence and create a one-page COGS method note.",
        },
      ],
    });
  }

  // International
  if (p.international_presence === "yes") {
    groups.push({
      title: "International touchpoints",
      subtitle: "Cross-border sales, vendors, or accounts can add reporting obligations.",
      items: [
        {
          id: "foreign_vendors",
          priority: "High",
          topic: "International touchpoints",
          question: "Do you pay foreign contractors or vendors, and do you have proper onboarding docs?",
          why_it_matters:
            "Cross-border payments can create withholding and reporting issues. Documentation supports your position.",
          what_to_gather: ["Vendor list", "Contracts", "Payment records", "Tax forms (as applicable)"],
          red_flags: ["No vendor onboarding docs", "Payments sent with no contract trail"],
          next_action: "Create a foreign vendor packet standard and store contracts centrally.",
        },
      ],
    });
  }

  // Documentation
  groups.push({
    title: "Documentation + Audit readiness",
    subtitle: "Build proof as you go so you don’t have to rebuild it later.",
    items: [
      {
        id: "doc_standard",
        priority: "High",
        topic: "Documentation + Audit readiness",
        question: "Do you have a standard for receipts, contracts, and decision notes (what, where, how often)?",
        why_it_matters:
          "Audit readiness is routine, not panic. A standard reduces stress and makes your story consistent.",
        what_to_gather: ["Folder structure", "Receipt capture method", "Contract storage location"],
        red_flags: ["Receipts in email only", "No contract storage"],
        next_action: "Pick a single storage standard and add a monthly review checkpoint.",
      },
    ],
  });

  return groups;
}

function buildQuarterlyCalendar(p: Intake): CalendarItem[] {
  const today = new Date();
  const year = today.getFullYear();

  const estDates = [
    { iso: `${year}-04-15`, title: "Federal estimated tax payment (Q1 target date)" },
    { iso: `${year}-06-15`, title: "Federal estimated tax payment (Q2 target date)" },
    { iso: `${year}-09-15`, title: "Federal estimated tax payment (Q3 target date)" },
    { iso: `${year + 1}-01-15`, title: "Federal estimated tax payment (Q4 target date)" },
  ];

  const items: CalendarItem[] = estDates.map((d) => ({
    dateISO: d.iso,
    title: d.title,
    notes:
      "Target date. If it lands on a weekend/holiday, the practical due date moves. Use this as your planning checkpoint.",
    tags: ["estimated_tax", "federal"],
  }));

  // Quarterly close checkpoints (tailored)
  const qClose = [
    { iso: `${year}-03-31`, label: "Q1 close: reconcile + profit check + tax set-aside true-up" },
    { iso: `${year}-06-30`, label: "Q2 close: reconcile + profit check + tax set-aside true-up" },
    { iso: `${year}-09-30`, label: "Q3 close: reconcile + profit check + tax set-aside true-up" },
    { iso: `${year}-12-31`, label: "Q4 close: year-end prep + documentation sweep" },
  ];

  for (const q of qClose) {
    const tags = ["quarter_close"];
    const notes: string[] = [
      "Reconcile accounts.",
      "Confirm receipts saved.",
      "Update profit estimate and set-aside plan.",
    ];
    if (p.payroll_w2 && p.payroll_w2 !== "0") {
      notes.push("Confirm payroll filings are complete for the quarter.");
      tags.push("payroll");
    }
    if (p.inventory_presence === "yes") {
      notes.push("Run an inventory checkpoint count and store support.");
      tags.push("inventory");
    }
    if (p.multistate_presence === "yes") {
      notes.push("Run nexus watch: sales by state, inventory locations, worker locations.");
      tags.push("multistate");
    }

    items.push({
      dateISO: q.iso,
      title: q.label,
      notes: notes.join(" "),
      tags,
    });
  }

  // Year-end actions
  if (p.inventory_presence === "yes") {
    items.push({
      dateISO: `${year}-12-27`,
      title: "Year-end inventory count window (plan + execute)",
      notes:
        "Pick the exact date/time for the count, document the method, store photos/count sheets, and record adjustments with notes.",
      tags: ["inventory", "year_end"],
    });
  }

  if (p.payroll_w2 && p.payroll_w2 !== "0") {
    items.push({
      dateISO: `${year + 1}-01-15`,
      title: "Year-end payroll forms readiness checkpoint",
      notes:
        "Confirm W-2/W-3 and state equivalents workflow. Verify addresses, wages, withholding, and any benefits reporting.",
      tags: ["payroll", "year_end"],
    });
  }

  return items.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

function buildWatchlist(p: Intake): WatchItem[] {
  const watch: WatchItem[] = [];

  // Payroll present
  if (p.payroll_w2 && p.payroll_w2 !== "0") {
    watch.push({
      id: "watch_payroll_cadence",
      title: "Payroll compliance cadence + year-end readiness",
      trigger: "Payroll present (W-2 headcount selected).",
      consequence:
        "Late filings and weak approvals can cause penalties, cash surprises, and audit friction.",
      readiness: [
        "Payroll provider selected (or manual process documented).",
        "Approval flow defined (who approves, when, what evidence).",
        "Quarterly filing checklist is stored.",
        "Year-end forms workflow is written.",
      ],
      decision_prompt:
        "Are you ready to run payroll on a written cadence with a quarterly close checklist?",
      recommended_questions: [
        {
          id: "payroll_cadence_q",
          priority: "High",
          topic: "Watchlist",
          question: "What payroll deadlines apply to you, and who owns each deadline?",
          why_it_matters: "Ownership prevents missed filings.",
          what_to_gather: ["Payroll provider calendar", "Internal approver list"],
          red_flags: ["No assigned owner", "No documented deadlines"],
          next_action: "Assign owners and add deadlines to the quarterly calendar.",
        },
      ],
      recommended_calendar: [
        {
          dateISO: addDaysISO(fmtISODate(new Date()), 7),
          title: "Payroll system checkpoint: approvals + filing calendar",
          notes: "Write the cadence and assign owners. Store it where the business runs.",
          tags: ["payroll", "watchlist"],
        },
      ],
      tags: ["payroll", "deadlines", "documentation"],
    });
  }

  // Inventory present
  if (p.inventory_presence === "yes") {
    watch.push({
      id: "watch_inventory_cogs",
      title: "Inventory + COGS substantiation pack",
      trigger: "Inventory present = documentation and counts affect taxable income.",
      consequence:
        "Weak inventory records can inflate taxable income, create audit friction, and cause mis-stated margins.",
      readiness: [
        "Inventory purchase support is stored by month.",
        "Count cadence chosen (monthly/quarterly) and documented.",
        "COGS method note exists (including shrink/adjustments).",
        "If using 3PL, storage locations are known and tracked.",
      ],
      decision_prompt:
        "Which cadence fits your reality right now: monthly counts or quarterly counts?",
      recommended_questions: [
        {
          id: "inventory_method_q",
          priority: "High",
          topic: "Watchlist",
          question: "Where is your inventory method documented (counts, adjustments, shrink, COGS note)?",
          why_it_matters: "A written method is your audit story.",
          what_to_gather: ["Count sheets", "Purchase logs", "Adjustment notes"],
          red_flags: ["No adjustments notes", "No cadence"],
          next_action: "Write a one-page method note and store it with monthly support.",
        },
      ],
      recommended_calendar: [
        {
          dateISO: addDaysISO(fmtISODate(new Date()), 14),
          title: "Inventory documentation checkpoint (cadence + method note)",
          notes: "Pick cadence, document method, store purchase support by month.",
          tags: ["inventory", "watchlist"],
        },
      ],
      tags: ["inventory", "cogs", "documentation"],
    });
  }

  // Multi-state
  if (p.multistate_presence === "yes") {
    watch.push({
      id: "watch_multistate_nexus",
      title: "Sales tax tracking + nexus watch",
      trigger: "Multi-state exposure selected.",
      consequence:
        "If you cross thresholds or create nexus, delayed registration and filing can create penalties and back-tax exposure.",
      readiness: [
        "Monthly sales-by-state report exists.",
        "Inventory/warehouse locations are known.",
        "Remote worker locations are tracked.",
        "Registration status list exists (where you’re registered vs not).",
      ],
      decision_prompt:
        "Do you have a monthly nexus check that is written and repeatable?",
      recommended_questions: [
        {
          id: "nexus_monthly_q",
          priority: "High",
          topic: "Watchlist",
          question: "Which signals create nexus for you (sales thresholds, inventory, people footprint)?",
          why_it_matters: "You can’t manage what you don’t track.",
          what_to_gather: ["Sales by state report", "Worker location list", "Inventory location list"],
          red_flags: ["No state reporting", "Inventory locations unknown"],
          next_action: "Build a monthly nexus watch worksheet and store it with quarterly close.",
        },
      ],
      recommended_calendar: [
        {
          dateISO: addDaysISO(fmtISODate(new Date()), 10),
          title: "Nexus watch setup: sales-by-state + footprint log",
          notes: "Create a monthly process and store registration status notes.",
          tags: ["multistate", "watchlist"],
        },
      ],
      tags: ["multistate", "sales_tax", "deadlines"],
    });
  }

  // S-corp
  if (p.entity_type === "s_corp") {
    watch.push({
      id: "watch_scorp_owner_comp",
      title: "S-corp owner comp planning + evidence pack",
      trigger: "Entity type is S corporation (election).",
      consequence:
        "Weak wage support can lead to reclassification, penalties, and audit exposure.",
      readiness: [
        "Owner role and hours documented.",
        "Comparable wage notes exist.",
        "Payroll filings are complete and stored.",
        "Quarterly review checkpoint exists.",
      ],
      decision_prompt:
        "Is your owner wage documented with a written rationale you can repeat quarterly?",
      recommended_questions: [
        {
          id: "owner_comp_support_q",
          priority: "High",
          topic: "Watchlist",
          question: "What supports your owner wage decision (role, hours, market range, review cadence)?",
          why_it_matters: "This is your audit narrative and your internal control.",
          what_to_gather: ["Role statement", "Hours estimate", "Comparable wage notes", "Payroll reports"],
          red_flags: ["No wage support note", "Distributions with minimal wages"],
          next_action: "Write a one-page owner comp memo and set a quarterly review date.",
        },
      ],
      recommended_calendar: [
        {
          dateISO: addDaysISO(fmtISODate(new Date()), 21),
          title: "Owner comp support memo checkpoint",
          notes: "Write the rationale, store evidence, set quarterly review cadence.",
          tags: ["s_corp", "watchlist"],
        },
      ],
      tags: ["s_corp", "owner_comp", "documentation"],
    });
  }

  // Digital downloads / SaaS
  if (p.industry === "ecom_digital_downloads" || p.industry === "saas") {
    watch.push({
      id: "watch_digital_sales_tax",
      title: "Digital sales tax exposure watch",
      trigger: "Industry is digital downloads or SaaS.",
      consequence:
        "Digital taxability varies. Under-collection can create back-tax exposure. Over-collection can create customer friction.",
      readiness: [
        "Sales-by-state report exists.",
        "Checkout settings reviewed.",
        "List of states where you collect tax is saved.",
        "Refund/chargeback tracking exists.",
      ],
      decision_prompt:
        "Do you have a monthly state review for digital tax settings and threshold signals?",
      recommended_questions: [
        {
          id: "digital_tax_settings_q",
          priority: "High",
          topic: "Watchlist",
          question: "Where do you review digital product tax settings and keep evidence of the setting choice?",
          why_it_matters: "Your settings are part of your compliance trail.",
          what_to_gather: ["Checkout settings screenshots", "Sales by state report", "Tax collection report"],
          red_flags: ["No settings review record", "No state reporting"],
          next_action: "Save a monthly settings snapshot and store it with your quarter close support.",
        },
      ],
      recommended_calendar: [
        {
          dateISO: addDaysISO(fmtISODate(new Date()), 12),
          title: "Digital sales tax checkpoint: settings + state thresholds",
          notes: "Review state exposure and save a settings snapshot.",
          tags: ["digital", "sales_tax", "watchlist"],
        },
      ],
      tags: ["digital", "sales_tax", "documentation"],
    });
  }

  return watch;
}

function buildProofPackWorkerSetup(): ProofItem[] {
  return [
    {
      id: "w9",
      label: "W-9s for every contractor (1099 path)",
      required: true,
      accept: ["PDF", "image"],
      done_definition: "A W-9 is stored for each contractor with matching legal name/TIN.",
      review_cadence: "At onboarding; review annually",
    },
    {
      id: "contract",
      label: "Signed contract or scope-of-work for each worker",
      required: true,
      accept: ["PDF", "DOCX", "image"],
      done_definition: "Signed agreement stored; scope matches invoices/time logs.",
      review_cadence: "At onboarding; review on renewal",
    },
    {
      id: "invoices",
      label: "Invoices/time logs (proof of independent work for 1099)",
      required: false,
      accept: ["PDF", "CSV", "image"],
      done_definition: "Invoices/logs match payments and project work.",
      review_cadence: "Monthly",
    },
    {
      id: "onboarding",
      label: "Onboarding checklist (W-2 path: I-9/W-4 + state)",
      required: false,
      accept: ["PDF", "image"],
      done_definition: "Onboarding forms stored and completed for employees.",
      review_cadence: "At onboarding",
    },
  ];
}

function memoTextWorkerSetup(p: Intake, decision: WorkerDecision, proofDone: Record<string, boolean>) {
  const now = fmtISODate(new Date());

  const facts = [
    `Entity type: ${p.entity_type || "Unknown"}`,
    `States selected: ${(p.states ?? []).join(", ") || "None selected"}`,
    `Industry: ${p.industry || "Unknown"}`,
    `Revenue range: ${p.revenue_range || "Unknown"}`,
    `W-2 headcount: ${p.payroll_w2 || "Unknown"}`,
    `Inventory present: ${p.inventory_presence || "Unknown"}`,
    `Multi-state: ${p.multistate_presence || "Unknown"}`,
    `International: ${p.international_presence || "Unknown"}`,
  ];

  const assumptions = [
    "This memo is based on the intake selections above.",
    "Deadlines vary by facts and may shift for weekends/holidays.",
    "This memo documents operational decisions and required proof items.",
  ];

  const decisionLine =
    decision === "no_workers"
      ? "Decision: No workers yet."
      : decision === "all_w2"
      ? "Decision: All workers are W-2 employees."
      : decision === "all_1099"
      ? "Decision: All workers are 1099 contractors."
      : decision === "mixed"
      ? "Decision: Mixed model (W-2 + 1099)."
      : "Decision: Not selected yet.";

  const risks: string[] = [];
  const mitigations: string[] = [];

  if (decision === "all_1099" || decision === "mixed") {
    risks.push("Worker misclassification risk if contractors look like employees in practice.");
    mitigations.push("Use contracts + W-9s + invoices/logs + clear scope-of-work per contractor.");
  }
  if (decision === "all_w2" || decision === "mixed") {
    risks.push("Payroll filing and payment cadence risk if deadlines/approvals are not documented.");
    mitigations.push("Write payroll cadence, assign owners, and store quarterly filing support.");
  }
  if (decision === "no_workers") {
    risks.push("Hiring later without a standard can create missing documentation.");
    mitigations.push("Prepare a worker onboarding standard and proof pack now.");
  }

  const done = Object.entries(proofDone)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const missing = Object.entries(proofDone)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  const cpaQs = [
    "Which worker setup is best for the next 90 days, and what evidence standard should we enforce?",
    "If contractors are used, do any roles look like employee roles in practice?",
    "What payroll cadence and filing calendar should we adopt immediately?",
  ];

  const lines: string[] = [];
  lines.push("BTBB Tax Position Memo (Worker setup: W-2 vs 1099)");
  lines.push(`Date: ${now}`);
  lines.push("");
  lines.push("Facts (from intake)");
  for (const f of facts) lines.push(`- ${f}`);
  lines.push("");
  lines.push("Assumptions");
  for (const a of assumptions) lines.push(`- ${a}`);
  lines.push("");
  lines.push(decisionLine);
  lines.push("");
  lines.push("Risks and mitigations");
  if (!risks.length) {
    lines.push("- Risks: Not enough info yet. Select a decision to generate a risk view.");
  } else {
    for (let i = 0; i < risks.length; i++) {
      lines.push(`- Risk: ${risks[i]}`);
      lines.push(`  Mitigation: ${mitigations[i] ?? "Add a mitigation."}`);
    }
  }
  lines.push("");
  lines.push("Documents attached / missing");
  lines.push(`- Attached/done: ${done.length ? done.join(", ") : "None yet"}`);
  lines.push(`- Missing: ${missing.length ? missing.join(", ") : "None"}`);
  lines.push("");
  lines.push("CPA questions (copy/paste)");
  for (const q of cpaQs) lines.push(`- ${q}`);

  return lines.join("\n");
}

function pdfWrapText(doc: any, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

async function saveBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function titleCaseLabel(s: string) {
  return (s ?? "").replaceAll("_", " ");
}

export default function TaxPlanningPage() {
  const [opts, setOpts] = React.useState<OptionsByKey>({});
  const [optsLoading, setOptsLoading] = React.useState(true);
  const [optsError, setOptsError] = React.useState<string | null>(null);

  const [userKey, setUserKey] = React.useState<string>("anon");
  const storageKey = React.useMemo(() => `btbb_tax_intake:${userKey}`, [userKey]);

  const [intake, setIntake] = React.useState<Intake>({
    entity_type: "",
    states: [],
    industry: "",
    revenue_range: "",
    payroll_w2: "0",
    inventory_presence: "no",
    multistate_presence: "no",
    international_presence: "no",
  });

  const [selectedState, setSelectedState] = React.useState<string>("");
  const [buildError, setBuildError] = React.useState<string | null>(null);

  const [activePanel, setActivePanel] = React.useState<"results" | "questions" | "calendar">("results");

  const [workerDecision, setWorkerDecision] = React.useState<WorkerDecision>("none");
  const proofPack = React.useMemo(() => buildProofPackWorkerSetup(), []);
  const [proofDone, setProofDone] = React.useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    for (const p of proofPack) out[p.id] = false;
    return out;
  });

  const [memoVersions, setMemoVersions] = React.useState<MemoVersion[]>([]);
  const [memoTab, setMemoTab] = React.useState<"decision" | "rationale" | "proof" | "memo">("decision");

  const [zipBusy, setZipBusy] = React.useState(false);

  const profileReady = React.useMemo(() => {
    // minimal: require entity_type + industry + revenue_range
    return Boolean(intake.entity_type && intake.industry && intake.revenue_range);
  }, [intake.entity_type, intake.industry, intake.revenue_range]);

  const risk = React.useMemo(() => scoreFromProfile(intake), [intake]);

  const questions = React.useMemo(() => {
    const base = buildQuestionSet(intake);
    const watch = buildWatchlist(intake);

    // Merge watchlist questions into a dedicated group at top
    const watchQs: QuestionItem[] = [];
    for (const w of watch) watchQs.push(...w.recommended_questions);

    const merged: QuestionGroup[] = [];
    if (watchQs.length) {
      merged.push({
        title: "Watchlist-driven questions",
        subtitle: "These appear because your intake triggers specific risk zones.",
        items: watchQs,
      });
    }
    merged.push(...base);
    return merged;
  }, [intake]);

  const calendar = React.useMemo(() => {
    const base = buildQuarterlyCalendar(intake);
    const watch = buildWatchlist(intake);
    const addl: CalendarItem[] = [];
    for (const w of watch) addl.push(...w.recommended_calendar);
    return [...base, ...addl].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  }, [intake]);

  const watchlist = React.useMemo(() => buildWatchlist(intake), [intake]);

  const currentMemoText = React.useMemo(() => {
    return memoTextWorkerSetup(intake, workerDecision, proofDone);
  }, [intake, workerDecision, proofDone]);

  // Load user + local intake
  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const id = data?.user?.id;
        setUserKey(id ? `user_${id}` : "anon");
      } catch {
        setUserKey("anon");
      }
    })();
  }, []);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setIntake((prev) => ({
          ...prev,
          ...parsed,
          states: Array.isArray(parsed?.states) ? parsed.states : prev.states,
        }));
      }
    } catch {
      // ignore
    }

    try {
      const raw = localStorage.getItem(`${storageKey}:memoVersions`);
      if (raw) setMemoVersions(JSON.parse(raw) ?? []);
    } catch {
      // ignore
    }
  }, [storageKey]);

  // Load dropdown options from Supabase
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setOptsLoading(true);
      setOptsError(null);

      try {
        const { data, error } = await supabase
          .from("btbb_tax_options")
          .select("set_key,value,label,sort,group_label,help,meta")
          .in("set_key", OPTION_KEYS)
          .order("sort", { ascending: true });

        if (error) throw error;

        const grouped: OptionsByKey = {};
        for (const k of OPTION_KEYS) grouped[k] = [];

        for (const row of (data ?? []) as OptionRow[]) {
          const key = row.set_key;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(row);
        }

        if (!cancelled) setOpts(grouped);
      } catch (e: any) {
        if (!cancelled) {
          setOptsError(e?.message ?? "Failed to load options.");
          setOpts({});
        }
      } finally {
        if (!cancelled) setOptsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function setField<K extends keyof Intake>(key: K, value: Intake[K]) {
    setIntake((prev) => ({ ...prev, [key]: value }));
  }

  async function persistIntake(next: Intake) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore
    }

    // Optional DB save (best-effort). Tries common table names.
    const payload = {
      id: uid("intake"),
      created_at: new Date().toISOString(),
      user_key: userKey,
      ...next,
    };

    const tryTables = ["btbb_tax_intakes", "btbb_tax_intake"];
    for (const t of tryTables) {
      try {
        const { error } = await supabase.from(t as any).insert(payload as any);
        if (!error) break;
      } catch {
        // ignore
      }
    }
  }

  function scrollToId(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function onBuildProfile() {
    setBuildError(null);

    if (!intake.entity_type) return setBuildError("Pick an entity type to build your profile.");
    if (!intake.industry) return setBuildError("Pick an industry to build your profile.");
    if (!intake.revenue_range) return setBuildError("Pick a revenue range to build your profile.");

    await persistIntake(intake);

    setActivePanel("results");
    scrollToId("results");
  }

  function onGoQuestions() {
    setActivePanel("questions");
    scrollToId("questions");
  }

  function onGoCalendar() {
    setActivePanel("calendar");
    scrollToId("calendar");
  }

  function addState() {
    const v = selectedState;
    if (!v) return;
    const next = { ...intake, states: uniq([...(intake.states ?? []), v]) };
    setIntake(next);
    setSelectedState("");
  }

  function removeState(code: string) {
    const next = { ...intake, states: (intake.states ?? []).filter((s) => s !== code) };
    setIntake(next);
  }

  function toggleProof(id: string) {
    setProofDone((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function saveMemoVersion() {
    const v: MemoVersion = {
      id: uid("memo"),
      createdAtISO: new Date().toISOString(),
      topicId: "worker_setup",
      topicTitle: "Worker setup (W-2 vs 1099)",
      decision: workerDecision,
      memoText: currentMemoText,
    };

    const next = [v, ...memoVersions].slice(0, 25);
    setMemoVersions(next);
    try {
      localStorage.setItem(`${storageKey}:memoVersions`, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  async function downloadZip() {
    setZipBusy(true);
    try {
      // Build CSV questions (flatten)
      const csvRows: Record<string, string>[] = [];
      for (const g of questions) {
        for (const q of g.items) {
          csvRows.push({
            group: g.title,
            topic: q.topic,
            priority: q.priority,
            question: q.question,
            why: q.why_it_matters,
            next_action: q.next_action,
            gather: q.what_to_gather.join(" | "),
            red_flags: q.red_flags.join(" | "),
          });
        }
      }
      const csv = toCsv(csvRows);

      // ICS calendar
      const ics = buildIcs(calendar);

      // PDF (tailored)
      const doc = new (jsPDF as any)({ unit: "pt", format: "letter" });
      const margin = 48;
      const pageW = doc.internal.pageSize.getWidth();
      const maxW = pageW - margin * 2;
      const lh = 14;

      let y = 56;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Your Tax Planning Profile", margin, y);
      y += 18;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      y = pdfWrapText(
        doc,
        "This pack is generated from your intake. It includes your snapshot, watchlist triggers, a prioritized question set, and a quarterly action calendar.",
        margin,
        y,
        maxW,
        lh
      );
      y += 10;

      doc.setFont("helvetica", "bold");
      doc.text("Snapshot", margin, y);
      y += 14;

      doc.setFont("helvetica", "normal");
      const snapshotLines = [
        `Entity type: ${safeLabel(findOption(opts, "entity_type", intake.entity_type)) || intake.entity_type || "—"}`,
        `States: ${(intake.states ?? []).join(", ") || "—"}`,
        `Industry: ${safeLabel(findOption(opts, "industry", intake.industry)) || intake.industry || "—"}`,
        `Revenue range: ${safeLabel(findOption(opts, "revenue_range", intake.revenue_range)) || intake.revenue_range || "—"}`,
        `W-2 employees: ${safeLabel(findOption(opts, "payroll_w2", intake.payroll_w2)) || intake.payroll_w2 || "—"}`,
        `Inventory present: ${safeLabel(findOption(opts, "inventory_presence", intake.inventory_presence)) || intake.inventory_presence || "—"}`,
        `Multi-state: ${safeLabel(findOption(opts, "multistate_presence", intake.multistate_presence)) || intake.multistate_presence || "—"}`,
        `International: ${safeLabel(findOption(opts, "international_presence", intake.international_presence)) || intake.international_presence || "—"}`,
      ];
      for (const s of snapshotLines) {
        y = pdfWrapText(doc, `• ${s}`, margin, y, maxW, lh);
      }
      y += 10;

      doc.setFont("helvetica", "bold");
      doc.text(`Risk score: ${risk.score}/100`, margin, y);
      y += 14;

      doc.setFont("helvetica", "normal");
      if (risk.drivers.length) {
        y = pdfWrapText(doc, `Drivers: ${risk.drivers.join(", ")}`, margin, y, maxW, lh);
        y += 6;
      }
      if (risk.whatToDoNext.length) {
        y = pdfWrapText(doc, `What to do next: ${risk.whatToDoNext.join(" ")}`, margin, y, maxW, lh);
        y += 6;
      }

      if (watchlist.length) {
        y += 6;
        doc.setFont("helvetica", "bold");
        doc.text("Watchlist", margin, y);
        y += 14;
        doc.setFont("helvetica", "normal");
        for (const w of watchlist.slice(0, 4)) {
          y = pdfWrapText(doc, `• ${w.title}`, margin, y, maxW, lh);
          y = pdfWrapText(doc, `  Trigger: ${w.trigger}`, margin, y, maxW, lh);
          y = pdfWrapText(doc, `  If missed: ${w.consequence}`, margin, y, maxW, lh);
          y += 6;
          if (y > 720) {
            doc.addPage();
            y = 56;
          }
        }
      }

      // Add memo page (worker setup)
      doc.addPage();
      y = 56;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Decision Memo + Audit Binder", margin, y);
      y += 18;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      y = pdfWrapText(
        doc,
        "Worker setup (W-2 vs 1099): memo generated from your selection and proof pack checklist.",
        margin,
        y,
        maxW,
        12
      );
      y += 10;

      const memoLines = currentMemoText.split("\n");
      for (const line of memoLines) {
        y = pdfWrapText(doc, line, margin, y, maxW, 12);
        if (y > 740) {
          doc.addPage();
          y = 56;
        }
      }

      const pdfBlob = doc.output("blob");

      // ZIP
      const zip = new (JSZip as any)();
      zip.file("btbb_tax_profile.json", JSON.stringify(intake, null, 2));
      zip.file("your-question-set.csv", csv);
      zip.file("quarterly-decision-calendar.ics", ics);
      zip.file("tax-planning-pack.pdf", pdfBlob);

      const zipBlob = await zip.generateAsync({ type: "blob" });
      await saveBlob("btbb-tax-planning-pack.zip", zipBlob);
    } finally {
      setZipBusy(false);
    }
  }

  const selectBase =
    "w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10";
  const labelBase = "text-sm font-medium text-neutral-800 flex items-center gap-2";
  const helpIcon = (txt: string) => (
    <span
      className="inline-flex items-center text-neutral-500"
      title={txt}
      aria-label={txt}
    >
      <Info size={14} />
    </span>
  );

  const entityOpts = opts["entity_type"] ?? [];
  const stateOpts = opts["us_states"] ?? [];
  const industryOpts = opts["industry"] ?? [];
  const revOpts = opts["revenue_range"] ?? [];
  const payrollOpts = opts["payroll_w2"] ?? [];
  const invOpts = opts["inventory_presence"] ?? [];
  const msOpts = opts["multistate_presence"] ?? [];
  const intlOpts = opts["international_presence"] ?? [];

  // group industry by group_label
  const industryGroups = React.useMemo(() => {
    const map: Record<string, OptionRow[]> = {};
    for (const o of industryOpts) {
      const g = o.group_label ?? "Other";
      if (!map[g]) map[g] = [];
      map[g].push(o);
    }
    const groupNames = Object.keys(map).sort((a, b) => a.localeCompare(b));
    return groupNames.map((name) => ({ name, items: map[name] ?? [] }));
  }, [industryOpts]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4">
        <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
          BTBB Tax Planning — Phase 3
        </div>
        <div className="text-xl font-semibold" style={{ color: BRAND.brown }}>
          Turn intake into documentation, decision prompts, and a quarterly action calendar.
        </div>
        <div className="mt-1 text-sm text-neutral-700">
          Save your intake once. Phase 3 uses it to build your memo + watchlist, then generates your question set and calendar.
        </div>
      </div>

      <Card className="rounded-2xl border-black/10">
        <CardHeader>
          <CardTitle className="text-base" style={{ color: BRAND.brown }}>
            Start here
          </CardTitle>
          <CardDescription>
            Intake (inputs 1–8). These answers drive the memo generator and the watchlist triggers.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4">
          {optsLoading ? (
            <div className="text-sm text-neutral-600">Loading dropdown options…</div>
          ) : optsError ? (
            <div className="text-sm text-red-700">
              Options failed to load from Supabase: {optsError}
              <div className="mt-1 text-neutral-700">
                Your page will still work, but dropdowns may appear empty until options load.
              </div>
            </div>
          ) : null}

          {/* 1) Entity type */}
          <div className="grid gap-1">
            <div className={labelBase}>
              1) Entity type {helpIcon("Pick the legal form / tax treatment that matches your setup right now.")}
            </div>
            <select
              className={selectBase}
              value={intake.entity_type}
              onChange={(e) => setField("entity_type", e.target.value)}
            >
              <option value="">Select…</option>
              {entityOpts.map((o) => (
                <option key={o.value} value={o.value} title={o.help ?? ""}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* 2) States */}
          <div className="grid gap-2">
            <div className={labelBase}>
              2) State(s) {helpIcon("Add every state that touches taxes or filings (home state, sales states, work states, inventory states).")}
            </div>

            <div className="flex items-center gap-2">
              <select
                className={cn(selectBase, "flex-1")}
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
              >
                <option value="">Select a state…</option>
                {stateOpts.map((o) => (
                  <option key={o.value} value={o.value} title={o.help ?? ""}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Button type="button" onClick={addState} style={{ backgroundColor: BRAND.teal }}>
                Add
              </Button>
            </div>

            <div className="text-xs text-neutral-600">
              Picked: {intake.states.length ? intake.states.join(", ") : "None"}
            </div>

            {intake.states.length ? (
              <div className="flex flex-wrap gap-2">
                {intake.states.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => removeState(s)}
                    className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-neutral-800 hover:bg-neutral-50"
                    title="Click to remove"
                  >
                    {s} ×
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* 3) Industry */}
          <div className="grid gap-1">
            <div className={labelBase}>
              3) Industry {helpIcon("Pick the closest match to your main revenue engine. This drives triggers and questions.")}
            </div>
            <select
              className={selectBase}
              value={intake.industry}
              onChange={(e) => setField("industry", e.target.value)}
            >
              <option value="">Select…</option>
              {industryGroups.map((g) => (
                <optgroup key={g.name} label={g.name}>
                  {g.items.map((o) => (
                    <option key={o.value} value={o.value} title={o.help ?? ""}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* 4) Revenue range */}
          <div className="grid gap-1">
            <div className={labelBase}>
              4) Revenue range {helpIcon("Choose your best estimate of annual top-line revenue. This shifts planning thresholds.")}
            </div>
            <select
              className={selectBase}
              value={intake.revenue_range}
              onChange={(e) => setField("revenue_range", e.target.value)}
            >
              <option value="">Select…</option>
              {revOpts.map((o) => (
                <option key={o.value} value={o.value} title={o.help ?? ""}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* 5) Payroll headcount */}
          <div className="grid gap-1">
            <div className={labelBase}>
              5) W-2 employees (on payroll) {helpIcon("How many W-2 employees do you run through payroll today?")}
            </div>
            <select
              className={selectBase}
              value={intake.payroll_w2}
              onChange={(e) => setField("payroll_w2", e.target.value)}
            >
              <option value="">Select…</option>
              {payrollOpts.map((o) => (
                <option key={o.value} value={o.value} title={o.help ?? ""}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* 6) Inventory */}
          <div className="grid gap-1">
            <div className={labelBase}>
              6) Inventory present {helpIcon("Inventory changes documentation expectations and can change accounting method decisions.")}
            </div>
            <select
              className={selectBase}
              value={intake.inventory_presence}
              onChange={(e) => setField("inventory_presence", e.target.value as any)}
            >
              <option value="">Select…</option>
              {invOpts.map((o) => (
                <option key={o.value} value={o.value} title={o.help ?? ""}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* 7) Multi-state */}
          <div className="grid gap-1">
            <div className={labelBase}>
              7) Multi-state {helpIcon("Do you sell/work/store inventory across state lines? This drives nexus watch.")}
            </div>
            <select
              className={selectBase}
              value={intake.multistate_presence}
              onChange={(e) => setField("multistate_presence", e.target.value as any)}
            >
              <option value="">Select…</option>
              {msOpts.map((o) => (
                <option key={o.value} value={o.value} title={o.help ?? ""}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* 8) International */}
          <div className="grid gap-1">
            <div className={labelBase}>
              8) International {helpIcon("Any foreign customers, vendors, labor, shipping, or foreign accounts?")}
            </div>
            <select
              className={selectBase}
              value={intake.international_presence}
              onChange={(e) => setField("international_presence", e.target.value as any)}
            >
              <option value="">Select…</option>
              {intlOpts.map((o) => (
                <option key={o.value} value={o.value} title={o.help ?? ""}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {buildError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {buildError}
            </div>
          ) : null}

          <Button
            type="button"
            onClick={onBuildProfile}
            style={{ backgroundColor: BRAND.teal }}
            className="w-full"
          >
            Build profile
          </Button>

          {/* RESULTS */}
          <div id="results" className="pt-2">
            <Card className="rounded-2xl border-black/10">
              <CardHeader>
                <CardTitle className="text-base" style={{ color: BRAND.brown }}>
                  Results
                </CardTitle>
                <CardDescription>
                  “Your Tax Planning Profile” (one-page summary)
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-3">
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between border-b border-black/5 pb-2">
                    <span className="text-neutral-600">entity_type</span>
                    <span className="font-medium">{intake.entity_type || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-black/5 pb-2">
                    <span className="text-neutral-600">states</span>
                    <span className="font-medium">{intake.states.length ? intake.states.join(", ") : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-black/5 pb-2">
                    <span className="text-neutral-600">industry</span>
                    <span className="font-medium">{intake.industry || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-black/5 pb-2">
                    <span className="text-neutral-600">revenue_range</span>
                    <span className="font-medium">{intake.revenue_range || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-black/5 pb-2">
                    <span className="text-neutral-600">payroll_w2</span>
                    <span className="font-medium">{intake.payroll_w2 || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-black/5 pb-2">
                    <span className="text-neutral-600">inventory_presence</span>
                    <span className="font-medium">{intake.inventory_presence || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-black/5 pb-2">
                    <span className="text-neutral-600">multistate_presence</span>
                    <span className="font-medium">{intake.multistate_presence || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">international_presence</span>
                    <span className="font-medium">{intake.international_presence || "—"}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-black/10 bg-white px-3 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold" style={{ color: BRAND.brown }}>
                      Audit risk score
                    </div>
                    <div className="font-semibold" style={{ color: BRAND.teal }}>
                      {risk.score}/100
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-neutral-700">
                    {risk.drivers.length ? `Drivers: ${risk.drivers.join(", ")}` : "Add more intake detail to sharpen drivers."}
                  </div>
                </div>

                <Button type="button" variant="outline" onClick={onGoQuestions} className="w-full">
                  Next steps → Your Question Set
                </Button>

                <Button type="button" variant="outline" onClick={onGoCalendar} className="w-full">
                  Quarterly Decision Calendar
                </Button>

                <Button
                  type="button"
                  onClick={downloadZip}
                  disabled={!profileReady || zipBusy}
                  style={{ backgroundColor: BRAND.teal }}
                  className="w-full text-white"
                >
                  {zipBusy ? "Building ZIP…" : "Download ZIP (PDF + ICS + CSV)"}
                </Button>

                {!profileReady ? (
                  <div className="text-xs text-neutral-600">
                    Finish Entity type + Industry + Revenue range to unlock tailored outputs.
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* PHASE 3 BLOCKS */}
          <div className="pt-2">
            <Card className="rounded-2xl border-black/10">
              <CardHeader>
                <CardTitle className="text-base" style={{ color: BRAND.brown }}>
                  Decision Memo + Audit Binder
                </CardTitle>
                <CardDescription>
                  Every “next step” produces a Tax Position Memo you can save, re-open, and export.
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-3">
                <div className="rounded-xl border border-black/10 bg-white p-3">
                  <div className="mb-2 text-sm font-semibold" style={{ color: BRAND.brown }}>
                    Planning topic
                  </div>
                  <div className="text-sm text-neutral-800">
                    Worker setup (W-2 vs 1099)
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={memoTab === "decision" ? "default" : "outline"}
                    onClick={() => setMemoTab("decision")}
                    style={memoTab === "decision" ? { backgroundColor: BRAND.teal, color: "white" } : undefined}
                  >
                    Decision
                  </Button>
                  <Button
                    type="button"
                    variant={memoTab === "rationale" ? "default" : "outline"}
                    onClick={() => setMemoTab("rationale")}
                    style={memoTab === "rationale" ? { backgroundColor: BRAND.teal, color: "white" } : undefined}
                  >
                    Rationale
                  </Button>
                  <Button
                    type="button"
                    variant={memoTab === "proof" ? "default" : "outline"}
                    onClick={() => setMemoTab("proof")}
                    style={memoTab === "proof" ? { backgroundColor: BRAND.teal, color: "white" } : undefined}
                  >
                    Proof Pack
                  </Button>
                  <Button
                    type="button"
                    variant={memoTab === "memo" ? "default" : "outline"}
                    onClick={() => setMemoTab("memo")}
                    style={memoTab === "memo" ? { backgroundColor: BRAND.teal, color: "white" } : undefined}
                  >
                    Memo
                  </Button>
                </div>

                {memoTab === "decision" ? (
                  <div className="grid gap-3 rounded-xl border border-black/10 bg-white p-3">
                    <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                      Which worker setup applies right now?
                    </div>

                    <div className="grid gap-2 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="workerDecision"
                          checked={workerDecision === "no_workers"}
                          onChange={() => setWorkerDecision("no_workers")}
                        />
                        No workers yet
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="workerDecision"
                          checked={workerDecision === "all_w2"}
                          onChange={() => setWorkerDecision("all_w2")}
                        />
                        All W-2 employees
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="workerDecision"
                          checked={workerDecision === "all_1099"}
                          onChange={() => setWorkerDecision("all_1099")}
                        />
                        All 1099 contractors
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="workerDecision"
                          checked={workerDecision === "mixed"}
                          onChange={() => setWorkerDecision("mixed")}
                        />
                        Mixed (W-2 + 1099)
                      </label>
                    </div>

                    <div className="rounded-lg border border-black/10 bg-neutral-50 p-3 text-sm">
                      <div className="font-semibold" style={{ color: BRAND.brown }}>
                        Best fit for you (v1)
                      </div>
                      <div className="mt-1 text-neutral-700">
                        {workerDecision === "no_workers"
                          ? "No workers yet. Keep the proof pack ready so hiring doesn’t create missing docs."
                          : workerDecision === "all_w2"
                          ? "W-2 path. Payroll cadence becomes a core system. Write deadlines and approvals now."
                          : workerDecision === "all_1099"
                          ? "1099 path. Classification proof matters. Contracts + W-9s + invoices are your baseline."
                          : workerDecision === "mixed"
                          ? "Mixed model. Run payroll controls and contractor controls side-by-side."
                          : "Select one option to generate the memo and proof pack priorities."}
                      </div>
                    </div>
                  </div>
                ) : null}

                {memoTab === "rationale" ? (
                  <div className="grid gap-3 rounded-xl border border-black/10 bg-white p-3 text-sm">
                    <div className="font-semibold" style={{ color: BRAND.brown }}>
                      Plain-English rationale + tradeoffs
                    </div>
                    <div className="text-neutral-800">
                      Your worker setup decision sets your compliance workload and your audit story.
                    </div>

                    <div className="grid gap-2">
                      <div className="font-semibold text-neutral-800">Tradeoffs</div>
                      <ul className="list-disc pl-5 text-neutral-700">
                        <li>W-2: stronger control story, more deadlines and filings.</li>
                        <li>1099: simpler payroll footprint, higher classification proof expectations.</li>
                        <li>Mixed: most flexible, demands clean documentation in both lanes.</li>
                      </ul>
                    </div>

                    <div className="rounded-lg border border-black/10 bg-neutral-50 p-3">
                      <div className="font-semibold text-neutral-800">If asked, say this (audit narrative draft)</div>
                      <div className="mt-1 text-neutral-700">
                        “We documented our worker setup choice, enforced consistent onboarding paperwork, and kept proof items current as routine operations.”
                      </div>
                    </div>
                  </div>
                ) : null}

                {memoTab === "proof" ? (
                  <div className="grid gap-3 rounded-xl border border-black/10 bg-white p-3 text-sm">
                    <div className="font-semibold" style={{ color: BRAND.brown }}>
                      Proof Pack (what counts as proof)
                    </div>

                    <div className="grid gap-2">
                      {proofPack.map((p) => (
                        <div key={p.id} className="rounded-lg border border-black/10 bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-neutral-800">
                                {p.label} {p.required ? <span className="text-xs text-red-700">(required)</span> : <span className="text-xs text-neutral-500">(optional)</span>}
                              </div>
                              <div className="mt-1 text-xs text-neutral-600">
                                Accepts: {p.accept.join(", ")} • Review: {p.review_cadence}
                              </div>
                              <div className="mt-2 text-xs text-neutral-700">
                                Done definition: {p.done_definition}
                              </div>
                            </div>

                            <div className="pt-1">
                              <Button
                                type="button"
                                variant={proofDone[p.id] ? "default" : "outline"}
                                onClick={() => toggleProof(p.id)}
                                style={proofDone[p.id] ? { backgroundColor: BRAND.teal, color: "white" } : undefined}
                              >
                                {proofDone[p.id] ? "Done" : "Mark done"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {memoTab === "memo" ? (
                  <div className="grid gap-3 rounded-xl border border-black/10 bg-white p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold" style={{ color: BRAND.brown }}>
                        Tax Position Memo (auto-generated)
                      </div>
                      <Button type="button" onClick={saveMemoVersion} style={{ backgroundColor: BRAND.teal, color: "white" }}>
                        Save memo version
                      </Button>
                    </div>

                    <textarea
                      className="h-64 w-full rounded-md border border-black/10 bg-white p-3 font-mono text-xs"
                      readOnly
                      value={currentMemoText}
                    />

                    <div className="rounded-lg border border-black/10 bg-neutral-50 p-3">
                      <div className="font-semibold text-neutral-800">Saved memo versions</div>
                      <div className="mt-1 text-xs text-neutral-600">Newest first. Topic-specific.</div>

                      {memoVersions.length ? (
                        <div className="mt-2 grid gap-2">
                          {memoVersions.slice(0, 5).map((m) => (
                            <div key={m.id} className="rounded-md border border-black/10 bg-white p-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-neutral-800">{m.topicTitle}</span>
                                <span className="text-neutral-500">{m.createdAtISO.slice(0, 10)}</span>
                              </div>
                              <div className="mt-1 text-xs text-neutral-700">
                                Decision: {m.decision}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-neutral-700">No saved memos yet.</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Watchlist */}
          <div className="pt-2">
            <Card className="rounded-2xl border-black/10">
              <CardHeader>
                <CardTitle className="text-base" style={{ color: BRAND.brown }}>
                  Elections + Threshold Radar (Watchlist)
                </CardTitle>
                <CardDescription>
                  These are decisions and deadlines that can cost money if missed.
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-3">
                {watchlist.length ? (
                  watchlist.map((w) => (
                    <div key={w.id} className="rounded-xl border border-black/10 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                            {w.title}
                          </div>
                          <div className="mt-1 text-xs text-neutral-600">
                            Trigger: {w.trigger}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button type="button" variant="outline" onClick={onGoCalendar}>
                            Add to calendar
                          </Button>
                          <Button type="button" variant="outline" onClick={onGoQuestions}>
                            Add questions to my list
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm">
                        <div className="rounded-lg border border-black/10 bg-neutral-50 p-2">
                          <div className="text-xs font-semibold text-neutral-800">What happens if missed</div>
                          <div className="mt-1 text-xs text-neutral-700">{w.consequence}</div>
                        </div>

                        <div className="rounded-lg border border-black/10 bg-neutral-50 p-2">
                          <div className="text-xs font-semibold text-neutral-800">Readiness checklist</div>
                          <ul className="mt-1 list-disc pl-5 text-xs text-neutral-700">
                            {w.readiness.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="rounded-lg border border-black/10 bg-white p-2">
                          <div className="text-xs font-semibold text-neutral-800">Decision prompt</div>
                          <div className="mt-1 text-xs text-neutral-700">{w.decision_prompt}</div>
                        </div>
                      </div>

                      {w.tags?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {w.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-black/10 bg-white px-2 py-1 text-[11px] text-neutral-700"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-neutral-700">
                    No watchlist items yet. Add intake detail to trigger your radar.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Question Set */}
          <div id="questions" className="pt-2">
            <Card className="rounded-2xl border-black/10">
              <CardHeader>
                <CardTitle className="text-base" style={{ color: BRAND.brown }}>
                  Your Question Set
                </CardTitle>
                <CardDescription>
                  Prioritized checklist, grouped by what your intake triggers.
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4">
                {questions.map((g) => (
                  <div key={g.title} className="rounded-xl border border-black/10 bg-white p-3">
                    <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                      {g.title}
                    </div>
                    <div className="mt-1 text-xs text-neutral-600">{g.subtitle}</div>

                    <div className="mt-3 grid gap-3">
                      {g.items.map((q) => (
                        <div key={q.id} className="rounded-lg border border-black/10 bg-neutral-50 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-semibold text-neutral-800">
                              {q.question}
                            </div>
                            <span
                              className={cn(
                                "rounded-full px-2 py-1 text-[11px] font-semibold",
                                q.priority === "High"
                                  ? "bg-red-100 text-red-800"
                                  : q.priority === "Medium"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              )}
                              title="Priority"
                            >
                              {q.priority}
                            </span>
                          </div>

                          <div className="mt-2 text-xs text-neutral-700">{q.why_it_matters}</div>

                          <div className="mt-2 grid gap-2 text-xs">
                            <div>
                              <div className="font-semibold text-neutral-800">What to gather</div>
                              <ul className="mt-1 list-disc pl-5 text-neutral-700">
                                {q.what_to_gather.map((w) => (
                                  <li key={w}>{w}</li>
                                ))}
                              </ul>
                            </div>

                            <div>
                              <div className="font-semibold text-neutral-800">Red flags</div>
                              <ul className="mt-1 list-disc pl-5 text-neutral-700">
                                {q.red_flags.map((r) => (
                                  <li key={r}>{r}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="rounded-md border border-black/10 bg-white p-2">
                              <div className="font-semibold text-neutral-800">Next action</div>
                              <div className="mt-1 text-neutral-700">{q.next_action}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Calendar */}
          <div id="calendar" className="pt-2">
            <Card className="rounded-2xl border-black/10">
              <CardHeader>
                <CardTitle className="text-base" style={{ color: BRAND.brown }}>
                  Quarterly Decision Calendar
                </CardTitle>
                <CardDescription>
                  Actions + key federal estimated tax target dates, tailored by your triggers.
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-3">
                <div className="text-xs text-neutral-600">
                  Target dates are planning checkpoints. Practical due dates can shift for weekends/holidays.
                </div>

                <div className="grid gap-2">
                  {calendar.slice(0, 24).map((c) => (
                    <div key={`${c.dateISO}-${c.title}`} className="rounded-lg border border-black/10 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-neutral-800">
                            {c.title}
                          </div>
                          <div className="mt-1 text-xs text-neutral-600">{c.dateISO}</div>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                          {c.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-black/10 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-700"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-neutral-700">{c.notes}</div>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-neutral-600">
                  ZIP export includes the full calendar as an ICS file.
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
