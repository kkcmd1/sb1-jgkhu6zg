"use client";

import * as React from "react";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

type Opt = { value: string; label: string; sort: number; meta?: any };
type OptionMap = Record<string, Opt[]>;

type Intake = {
  entity_type: string | null;
  states: string[];
  industry: string | null;
  revenue_range: string | null;

  payroll_w2: string | null;
  payroll_owner: string | null;
  payroll_1099: string | null;

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

type Profile = {
  version: "phase0";
  created_at: string;
  snapshot: {
    entity_type: string | null;
    states: string[];
    industry: string | null;
    revenue_range: string | null;
    payroll: {
      w2: string | null;
      owner: string | null;
      contractors_1099: string | null;
    };
    inventory: {
      presence: "yes" | "no" | null;
      type: string | null;
      tracking: string | null;
    };
    multistate: {
      presence: "yes" | "no" | null;
      exposure: string | null;
      intensity: string | null;
    };
    international: {
      presence: "yes" | "no" | null;
      exposure: string | null;
      scope: string | null;
    };
  };
  flags: {
    payroll_complexity: "low" | "medium" | "high";
    inventory_complexity: "none" | "basic" | "complex";
    multistate_risk: "low" | "medium" | "high";
    international_risk: "low" | "medium" | "high";
  };
  topics: string[];
};

type Question = {
  id: string;
  topic: string;
  priority: 1 | 2 | 3;
  question: string;
  why_it_matters: string;
};

type CalendarEvent = {
  title: string;
  dateISO: string; // YYYY-MM-DD
  notes?: string;
};

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function humanDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function safeVal(v: string | null) {
  if (!v) return null;
  if (v === "skip") return null;
  return v;
}

/** ---------- Profile engine (Phase 0) ---------- */
function buildProfile(intake: Intake): Profile {
  const payrollScore = (() => {
    const hasW2 = intake.payroll_w2 && intake.payroll_w2 !== "0";
    const hasOwner = intake.payroll_owner && intake.payroll_owner !== "0";
    const has1099 = intake.payroll_1099 && intake.payroll_1099 !== "0";
    const count = [hasW2, hasOwner, has1099].filter(Boolean).length;
    if (count >= 2) return "high" as const;
    if (count === 1) return "medium" as const;
    return "low" as const;
  })();

  const inventoryComplexity = (() => {
    if (intake.inventory_presence !== "yes") return "none" as const;
    const type = intake.inventory_type || "";
    if (type === "wip" || type === "raw_materials" || type === "regulated") return "complex" as const;
    return "basic" as const;
  })();

  const multistateRisk = (() => {
    if (intake.multistate_presence !== "yes") return "low" as const;
    const exposure = intake.multistate_exposure || "";
    const intensity = intake.multistate_intensity || "";
    if (exposure === "property_inventory" || exposure === "entity") return "high" as const;
    if (intensity === "11_25" || intensity === "26_50") return "high" as const;
    return "medium" as const;
  })();

  const internationalRisk = (() => {
    if (intake.international_presence !== "yes") return "low" as const;
    const ex = intake.international_exposure || "";
    if (ex === "foreign_financial" || ex === "foreign_ownership") return "high" as const;
    return "medium" as const;
  })();

  const topics = uniq(
    [
      "Foundation",
      intake.entity_type?.includes("s_corp") ? "Owner comp + payroll" : null,
      intake.inventory_presence === "yes" ? "COGS + inventory" : null,
      intake.multistate_presence === "yes" ? "Multi-state compliance" : null,
      intake.international_presence === "yes" ? "International reporting" : null,
      intake.industry ? "Industry specifics" : null,
      "Quarterly cadence",
      "Year-end close"
    ].filter(Boolean) as string[]
  );

  return {
    version: "phase0",
    created_at: new Date().toISOString(),
    snapshot: {
      entity_type: safeVal(intake.entity_type),
      states: intake.states,
      industry: safeVal(intake.industry),
      revenue_range: safeVal(intake.revenue_range),
      payroll: {
        w2: safeVal(intake.payroll_w2),
        owner: safeVal(intake.payroll_owner),
        contractors_1099: safeVal(intake.payroll_1099)
      },
      inventory: {
        presence: intake.inventory_presence,
        type: safeVal(intake.inventory_type),
        tracking: safeVal(intake.inventory_tracking)
      },
      multistate: {
        presence: intake.multistate_presence,
        exposure: safeVal(intake.multistate_exposure),
        intensity: safeVal(intake.multistate_intensity)
      },
      international: {
        presence: intake.international_presence,
        exposure: safeVal(intake.international_exposure),
        scope: safeVal(intake.international_scope)
      }
    },
    flags: {
      payroll_complexity: payrollScore,
      inventory_complexity: inventoryComplexity,
      multistate_risk: multistateRisk,
      international_risk: internationalRisk
    },
    topics
  };
}

/** ---------- Question set engine (Phase 0) ---------- */
function buildQuestionSet(profile: Profile): Question[] {
  const p = profile.snapshot;
  const q: Question[] = [];

  const add = (topic: string, priority: 1 | 2 | 3, question: string, why: string) => {
    q.push({
      id: `${topic}-${priority}-${q.length + 1}`,
      topic,
      priority,
      question,
      why_it_matters: why
    });
  };

  // Foundation
  add("Foundation", 1, "Do you have separate business bank + card accounts?", "It prevents commingling, speeds bookkeeping, and supports deductions.");
  add("Foundation", 1, "What accounting method are you using (cash vs accrual) and why?", "Timing drives taxable income and controls reporting consistency.");
  add("Foundation", 1, "Do you have a documented chart of accounts and consistent category rules?", "Consistency reduces missed deductions and avoids messy reclass work.");
  add("Foundation", 2, "Are you tracking receipts with merchant, date, business purpose, and amount?", "Audit defense depends on documentation quality.");
  add("Foundation", 2, "Do you have a home office situation (exclusive space, regular use)?", "It can change deductible costs and recordkeeping needs.");
  add("Foundation", 3, "Do you have financing, interest, or large asset purchases planned?", "Depreciation and interest tracing change the plan.");

  // Entity + tax treatment
  add("Entity + filings", 1, "What return type will be filed (Schedule C, 1065, 1120-S, 1120)?", "The return drives deadlines, owner tax flow, and required records.");
  add("Entity + filings", 2, "Do you have an operating agreement / ownership records that match reality?", "Ownership drives K-1s, basis tracking, and dispute prevention.");
  add("Entity + filings", 2, "Do owners take draws/distributions correctly and track owner basis?", "Basis limits loss deductions and affects taxable distributions.");

  // Payroll
  if (profile.flags.payroll_complexity !== "low") {
    add("Owner comp + payroll", 1, "If S corp, are owner wages set using a defensible process?", "Underpaying wages is a common audit trigger.");
    add("Owner comp + payroll", 1, "Do you run payroll on time and reconcile payroll liabilities monthly?", "Late deposits and mismatches create penalties.");
    add("Owner comp + payroll", 2, "Do you have a clean worker classification file (W-2 vs 1099) with support?", "Misclassification risk can be expensive.");
    add("Owner comp + payroll", 2, "Do you have benefit plans (HSA, retirement, stipend) and correct payroll tax handling?", "Benefits change taxable wages and reporting.");
  }

  // Inventory
  if (p.inventory.presence === "yes") {
    add("COGS + inventory", 1, "Do you have a repeatable inventory count process and cut-off rules?", "Bad cut-off breaks COGS and income accuracy.");
    add("COGS + inventory", 1, "Do you track COGS components (materials, freight, packaging, labor where relevant)?", "COGS classification impacts margin and taxable income.");
    add("COGS + inventory", 2, "Do you store inventory in third-party warehouses or marketplaces?", "That can create multi-state nexus and reporting work.");
    add("COGS + inventory", 3, "Do you know if you qualify for simplified inventory methods?", "Method choice reduces admin overhead when allowed.");
  }

  // Multi-state
  if (p.multistate.presence === "yes") {
    add("Multi-state compliance", 1, "Which states create sales tax collection duties (economic nexus / marketplace rules)?", "Missing registration and filings creates back tax risk.");
    add("Multi-state compliance", 2, "Do you have out-of-state workers or contractors and withholding exposure?", "Payroll state rules can apply even with one remote worker.");
    add("Multi-state compliance", 2, "Do you store inventory outside your home state?", "Inventory location is a common nexus trigger.");
    add("Multi-state compliance", 3, "Do you have entity registrations and annual reports lined up per state?", "Missed filings lead to penalties and administrative issues.");
  }

  // International
  if (p.international.presence === "yes") {
    add("International reporting", 1, "Do you pay foreign contractors and have W-8s / withholding analysis?", "Cross-border payments can trigger reporting and withholding.");
    add("International reporting", 1, "Do you have foreign accounts or balances that require reporting?", "Some filings can be severe if missed.");
    add("International reporting", 2, "Do you import/export goods and track duties, VAT, and landed cost?", "Landed cost affects COGS and pricing.");
    add("International reporting", 3, "Do you have foreign owners or entities tied to your business?", "Ownership structures can add filing layers.");
  }

  // Quarterly cadence
  add("Quarterly cadence", 1, "Do you run a quarterly tax estimate based on year-to-date results?", "Estimates reduce surprises and penalty risk.");
  add("Quarterly cadence", 1, "Do you set aside tax cash in a separate account after each deposit cycle?", "It protects cashflow and prevents scrambling.");
  add("Quarterly cadence", 2, "Do you reconcile bank + cards monthly with a locked close process?", "Clean books are the base for tax planning.");
  add("Quarterly cadence", 3, "Do you review pricing, margin, and expense leaks quarterly?", "Margin fixes often beat tax hacks.");

  // Year-end close
  add("Year-end close", 1, "Do you have a year-end checklist for 1099s, W-2s, and reconciliations?", "A clean year-end reduces amendments and late filings.");
  add("Year-end close", 2, "Do you plan asset purchases, retirement contributions, and bonuses before year-end?", "Timing decisions can change tax outcomes.");
  add("Year-end close", 3, "Do you have documentation for major deductions (travel, vehicle, meals, home office)?", "Documentation is what makes deductions real.");

  // Sort: priority then topic
  return q.sort((a, b) => (a.priority - b.priority) || a.topic.localeCompare(b.topic));
}

/** ---------- Calendar engine (Phase 0) ---------- */
function buildQuarterCalendar(profile: Profile): CalendarEvent[] {
  const entity = profile.snapshot.entity_type || "";

  const year = new Date().getFullYear();
  const nextYear = year + 1;

  // Individual (1040) estimated tax due dates:
  // Apr 15, Jun 15, Sep 15, Jan 15 (next year)
  // Corporate (1120) estimated tax due dates:
  // Apr 15, Jun 15, Sep 15, Dec 15 (calendar-year corp)
  const isCorp = entity.includes("c_corp");

  const estimateDates = isCorp
    ? [`${year}-04-15`, `${year}-06-15`, `${year}-09-15`, `${year}-12-15`]
    : [`${year}-04-15`, `${year}-06-15`, `${year}-09-15`, `${nextYear}-01-15`];

  const events: CalendarEvent[] = [];

  for (const d of estimateDates) {
    events.push({
      title: "Estimated tax payment due (key federal date)",
      dateISO: d,
      notes: isCorp ? "Calendar-year corporation schedule" : "Individual / pass-through schedule"
    });
  }

  // Quarterly cadence actions
  const cadence = [
    { title: "Quarterly: reconcile accounts + lock close", offsetDays: 10 },
    { title: "Quarterly: run tax estimate + set aside cash", offsetDays: 12 },
    { title: "Quarterly: review margin + pricing + expense leaks", offsetDays: 15 },
  ];

  // Generate next 4 quarter anchors
  const now = new Date();
  const qStartMonths = [0, 3, 6, 9];
  const currentQ = Math.floor(now.getMonth() / 3);
  const anchors: Date[] = [];
  for (let i = 0; i < 4; i++) {
    const qIndex = (currentQ + i) % 4;
    const y = year + Math.floor((currentQ + i) / 4);
    anchors.push(new Date(y, qStartMonths[qIndex], 1));
  }

  for (const a of anchors) {
    for (const c of cadence) {
      const d = new Date(a);
      d.setDate(d.getDate() + c.offsetDays);
      const iso = d.toISOString().slice(0, 10);
      events.push({ title: c.title, dateISO: iso });
    }
  }

  // Add conditional actions
  if (profile.snapshot.inventory.presence === "yes") {
    events.push({ title: "Quarterly: inventory count + cut-off check", dateISO: todayISO() });
  }
  if (profile.snapshot.multistate.presence === "yes") {
    events.push({ title: "Quarterly: multi-state review (sales tax + payroll states)", dateISO: todayISO() });
  }

  // Sort by date
  return events.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

/** ---------- File generators ---------- */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCSV(rows: Record<string, any>[]) {
  const headers = Object.keys(rows[0] || {});
  const esc = (v: any) => {
    const s = String(v ?? "");
    if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => esc(r[h])).join(","))].join("\n");
}

function icsEscape(s: string) {
  return s.replaceAll("\\", "\\\\").replaceAll(",", "\\,").replaceAll(";", "\\;").replaceAll("\n", "\\n");
}

function buildICS(events: CalendarEvent[]) {
  const lines: string[] = [];
  const dtstamp = new Date().toISOString().replaceAll(/[-:]/g, "").replaceAll(".000Z", "Z");

  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//BTBB//Tax Planning//EN");

  events.forEach((e, idx) => {
    const dt = e.dateISO.replaceAll("-", "");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:btbb-tax-${dt}-${idx}@btbb`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dt}`);
    lines.push(`SUMMARY:${icsEscape(e.title)}`);
    if (e.notes) lines.push(`DESCRIPTION:${icsEscape(e.notes)}`);
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

async function buildPDF(profile: Profile, questions: Question[], events: CalendarEvent[]) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]); // US Letter
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 760;
  const left = 48;

  const draw = (text: string, size = 11, bold = false) => {
    page.drawText(text, { x: left, y, size, font: bold ? fontBold : font });
    y -= size + 6;
  };

  draw("BTBB Tax Planning Profile", 18, true);
  draw(`Generated: ${new Date(profile.created_at).toLocaleString()}`, 10, false);
  y -= 6;

  draw("Your Tax Planning Profile (Snapshot)", 13, true);
  const s = profile.snapshot;
  draw(`Entity type: ${s.entity_type ?? "—"}`);
  draw(`State(s): ${s.states.length ? s.states.join(", ") : "—"}`);
  draw(`Industry: ${s.industry ?? "—"}`);
  draw(`Revenue range: ${s.revenue_range ?? "—"}`);
  draw(`Payroll (W-2 / Owner / 1099): ${s.payroll.w2 ?? "—"} / ${s.payroll.owner ?? "—"} / ${s.payroll.contractors_1099 ?? "—"}`);
  draw(`Inventory: ${s.inventory.presence ?? "—"}  | Type: ${s.inventory.type ?? "—"}  | Tracking: ${s.inventory.tracking ?? "—"}`);
  draw(`Multi-state: ${s.multistate.presence ?? "—"}  | ${s.multistate.exposure ?? "—"}  | ${s.multistate.intensity ?? "—"}`);
  draw(`International: ${s.international.presence ?? "—"}  | ${s.international.exposure ?? "—"}  | ${s.international.scope ?? "—"}`);

  y -= 8;
  draw("Top priorities (first 10 items from your question set)", 13, true);

  const top10 = questions.filter(q => q.priority === 1).slice(0, 10);
  for (const item of top10) {
    const line = `• ${item.question}`;
    if (y < 72) break;
    draw(line, 10, false);
  }

  y -= 8;
  draw("Quarterly Decision Calendar (high level)", 13, true);
  const next10 = events.slice(0, 10);
  for (const e of next10) {
    if (y < 72) break;
    draw(`• ${humanDate(e.dateISO)} — ${e.title}`, 10, false);
  }

  y = 56;
  page.drawText("Note: Dates can shift for weekends/holidays. Confirm final filing/payment dates for your facts.", {
    x: left,
    y,
    size: 9,
    font
  });

  const bytes = await pdf.save();
  return bytes;
}

/** ---------- UI helpers ---------- */
function optLabel(map: OptionMap | null, setKey: string, value: string | null) {
  if (!value) return "—";
  const found = (map?.[setKey] || []).find(o => o.value === value);
  return found?.label ?? value;
}

function sectionTitle(text: string) {
  return <div className="text-sm font-semibold text-[#6B4A2E]">{text}</div>;
}

function MultiStatePicker({
  allStates,
  value,
  onChange
}: {
  allStates: Opt[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = value;
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between">
            {selected.length ? `Picked: ${selected.length}` : "Pick state(s)"}
            <span className="text-xs text-muted-foreground">Search</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-2" align="start">
          <Command>
            <CommandInput placeholder="Search states..." />
            <CommandList>
              <CommandEmpty>No results</CommandEmpty>
              <CommandGroup heading="States">
                {allStates.map(s => {
                  const isOn = selectedSet.has(s.value);
                  return (
                    <CommandItem
                      key={s.value}
                      value={`${s.label} ${s.value}`}
                      onSelect={() => {
                        if (isOn) onChange(selected.filter(x => x !== s.value));
                        else onChange([...selected, s.value]);
                      }}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span>{s.label}</span>
                        <span className={cn("text-xs", isOn ? "text-[#1C6F66]" : "text-muted-foreground")}>
                          {isOn ? "Selected" : s.value}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <div className="flex flex-wrap gap-2">
        {selected.map(code => (
          <Badge
            key={code}
            className="cursor-pointer bg-[#1C6F66] text-white hover:bg-[#15534d]"
            onClick={() => onChange(selected.filter(x => x !== code))}
            title="Click to remove"
          >
            {code}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/** ---------- Page ---------- */
export default function TaxPlanningPage() {
  const [loadingOptions, setLoadingOptions] = React.useState(true);
  const [options, setOptions] = React.useState<OptionMap | null>(null);

  const [intake, setIntake] = React.useState<Intake>({
    entity_type: null,
    states: [],
    industry: null,
    revenue_range: null,

    payroll_w2: "0",
    payroll_owner: "0",
    payroll_1099: "0",

    inventory_presence: "no",
    inventory_type: null,
    inventory_tracking: null,

    multistate_presence: "no",
    multistate_exposure: null,
    multistate_intensity: null,

    international_presence: "no",
    international_exposure: null,
    international_scope: null
  });

  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [calendar, setCalendar] = React.useState<CalendarEvent[]>([]);
  const [step, setStep] = React.useState<"intake" | "profile" | "questions" | "calendar" | "download">("intake");

  const [saveErr, setSaveErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      setLoadingOptions(true);
      const { data, error } = await supabase
        .from("btbb_tax_options")
        .select("set_key,value,label,sort,meta");

      if (!alive) return;

      if (error || !data?.length) {
        setOptions(null);
        setLoadingOptions(false);
        return;
      }

      const map: OptionMap = {};
      for (const row of data as any[]) {
        const k = row.set_key as string;
        map[k] ||= [];
        map[k].push({ value: row.value, label: row.label, sort: row.sort ?? 0, meta: row.meta ?? {} });
      }
      Object.keys(map).forEach(k => {
        map[k] = map[k]
          .slice()
          .sort((a, b) => (a.sort - b.sort) || a.label.localeCompare(b.label));
      });

      setOptions(map);
      setLoadingOptions(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const doBuild = async () => {
    setSaveErr(null);
    setBusy(true);

    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const session = sessionRes.session;

      if (!session?.user) {
        setSaveErr("Sign in first, then build your profile.");
        setBusy(false);
        return;
      }

      const built = buildProfile(intake);
      const qs = buildQuestionSet(built);
      const cal = buildQuarterCalendar(built);

      setProfile(built);
      setQuestions(qs);
      setCalendar(cal);
      setStep("profile");

      const payload = {
        user_id: session.user.id,
        entity_type: safeVal(intake.entity_type),
        states: intake.states,
        industry: safeVal(intake.industry),
        revenue_range: safeVal(intake.revenue_range),

        payroll_w2: safeVal(intake.payroll_w2),
        payroll_owner: safeVal(intake.payroll_owner),
        payroll_1099: safeVal(intake.payroll_1099),

        inventory_presence: intake.inventory_presence,
        inventory_type: safeVal(intake.inventory_type),
        inventory_tracking: safeVal(intake.inventory_tracking),

        multistate_presence: intake.multistate_presence,
        multistate_exposure: safeVal(intake.multistate_exposure),
        multistate_intensity: safeVal(intake.multistate_intensity),

        international_presence: intake.international_presence,
        international_exposure: safeVal(intake.international_exposure),
        international_scope: safeVal(intake.international_scope),

        intake: intake as any,
        profile: built as any
      };

      const { error: upErr } = await supabase
        .from("btbb_tax_intakes")
        .upsert(payload, { onConflict: "user_id" });

      if (upErr) setSaveErr(upErr.message);
    } catch (e: any) {
      setSaveErr(e?.message ?? "Unknown error building profile.");
    } finally {
      setBusy(false);
    }
  };

  const downloadJSON = () => {
    if (!profile) return;
    const blob = new Blob([JSON.stringify({ profile, questions, calendar }, null, 2)], { type: "application/json" });
    downloadBlob(blob, "btbb-tax-planning.json");
  };

  const downloadCSV = () => {
    if (!questions.length) return;
    const rows = questions.map(q => ({
      priority: q.priority,
      topic: q.topic,
      question: q.question,
      why_it_matters: q.why_it_matters
    }));
    const blob = new Blob([toCSV(rows)], { type: "text/csv" });
    downloadBlob(blob, "btbb-tax-question-set.csv");
  };

  const downloadICS = () => {
    if (!calendar.length) return;
    const blob = new Blob([buildICS(calendar)], { type: "text/calendar" });
    downloadBlob(blob, "btbb-tax-calendar.ics");
  };

  const downloadPDF = async () => {
    if (!profile) return;
    const bytes = await buildPDF(profile, questions, calendar);
    const blob = new Blob([bytes], { type: "application/pdf" });
    downloadBlob(blob, "btbb-tax-profile.pdf");
  };

  const downloadZIP = async () => {
    if (!profile) return;

    const zip = new JSZip();
    zip.file("btbb-tax-planning.json", JSON.stringify({ profile, questions, calendar }, null, 2));
    zip.file("btbb-tax-question-set.csv", toCSV(questions.map(q => ({
      priority: q.priority,
      topic: q.topic,
      question: q.question,
      why_it_matters: q.why_it_matters
    }))));
    zip.file("btbb-tax-calendar.ics", buildICS(calendar));

    const pdfBytes = await buildPDF(profile, questions, calendar);
    zip.file("btbb-tax-profile.pdf", pdfBytes);

    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, "btbb-tax-planning-bundle.zip");
  };

  const allStates = options?.states || [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6">
      <Card className="border bg-white/90 shadow-sm">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl text-[#6B4A2E]">Tax Planning</CardTitle>
              <CardDescription>
                Answer the 8 items. Generate a profile, a question set, and a quarterly decision calendar.
              </CardDescription>
            </div>
            <Badge className="bg-[#E8B765] text-[#6B4A2E]">Phase 0</Badge>
          </div>

          {saveErr ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveErr}
            </div>
          ) : null}

          {loadingOptions ? (
            <div className="text-sm text-muted-foreground">Loading dropdown options…</div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* STEP NAV */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={step === "intake" ? "default" : "outline"}
              className={step === "intake" ? "bg-[#1C6F66] text-white hover:bg-[#15534d]" : ""}
              onClick={() => setStep("intake")}
            >
              Results input
            </Button>
            <Button
              type="button"
              variant={step === "profile" ? "default" : "outline"}
              className={step === "profile" ? "bg-[#1C6F66] text-white hover:bg-[#15534d]" : ""}
              disabled={!profile}
              onClick={() => setStep("profile")}
            >
              Your Tax Planning Profile
            </Button>
            <Button
              type="button"
              variant={step === "questions" ? "default" : "outline"}
              className={step === "questions" ? "bg-[#1C6F66] text-white hover:bg-[#15534d]" : ""}
              disabled={!profile}
              onClick={() => setStep("questions")}
            >
              Your Question Set
            </Button>
            <Button
              type="button"
              variant={step === "calendar" ? "default" : "outline"}
              className={step === "calendar" ? "bg-[#1C6F66] text-white hover:bg-[#15534d]" : ""}
              disabled={!profile}
              onClick={() => setStep("calendar")}
            >
              Quarterly Decision Calendar
            </Button>
            <Button
              type="button"
              variant={step === "download" ? "default" : "outline"}
              className={step === "download" ? "bg-[#1C6F66] text-white hover:bg-[#15534d]" : ""}
              disabled={!profile}
              onClick={() => setStep("download")}
            >
              Download bundle
            </Button>
          </div>

          {/* INTAKE */}
          {step === "intake" ? (
            <div className="space-y-5">
              {/* 1) Entity type */}
              <div className="space-y-2">
                {sectionTitle("1) Entity type")}
                <Select
                  value={intake.entity_type ?? undefined}
                  onValueChange={(v) => setIntake(x => ({ ...x, entity_type: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(options?.entity_type || []).map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 2) State(s) */}
              <div className="space-y-2">
                {sectionTitle("2) State(s)")}
                {allStates.length ? (
                  <MultiStatePicker
                    allStates={allStates}
                    value={intake.states}
                    onChange={(v) => setIntake(x => ({ ...x, states: v }))}
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No state options found. Run the SQL seed, then reload this page.
                  </div>
                )}
              </div>

              {/* 3) Industry */}
              <div className="space-y-2">
                {sectionTitle("3) Industry")}
                <Select
                  value={intake.industry ?? undefined}
                  onValueChange={(v) => setIntake(x => ({ ...x, industry: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {(options?.industry || []).map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 4) Revenue range */}
              <div className="space-y-2">
                {sectionTitle("4) Revenue range")}
                <Select
                  value={intake.revenue_range ?? undefined}
                  onValueChange={(v) => setIntake(x => ({ ...x, revenue_range: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a revenue range" />
                  </SelectTrigger>
                  <SelectContent>
                    {(options?.revenue_range || []).map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 5) Payroll headcount (FIXED: no duplicates; clean UI) */}
              <div className="space-y-3">
                {sectionTitle("5) Payroll headcount")}
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">W-2 employees</div>
                    <Select
                      value={intake.payroll_w2 ?? undefined}
                      onValueChange={(v) => setIntake(x => ({ ...x, payroll_w2: v }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pick" />
                      </SelectTrigger>
                      <SelectContent>
                        {(options?.payroll_w2_bracket || []).map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Owners on payroll</div>
                    <Select
                      value={intake.payroll_owner ?? undefined}
                      onValueChange={(v) => setIntake(x => ({ ...x, payroll_owner: v }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pick" />
                      </SelectTrigger>
                      <SelectContent>
                        {(options?.payroll_owner_bracket || []).map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">1099 contractors</div>
                    <Select
                      value={intake.payroll_1099 ?? undefined}
                      onValueChange={(v) => setIntake(x => ({ ...x, payroll_1099: v }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pick" />
                      </SelectTrigger>
                      <SelectContent>
                        {(options?.payroll_1099_bracket || []).map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 6) Inventory */}
              <div className="space-y-3">
                {sectionTitle("6) Inventory")}
                <Select
                  value={intake.inventory_presence ?? undefined}
                  onValueChange={(v: any) => setIntake(x => ({
                    ...x,
                    inventory_presence: v,
                    inventory_type: v === "yes" ? x.inventory_type : null,
                    inventory_tracking: v === "yes" ? x.inventory_tracking : null
                  }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(options?.inventory_presence || []).map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {intake.inventory_presence === "yes" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Inventory type</div>
                      <Select
                        value={intake.inventory_type ?? undefined}
                        onValueChange={(v) => setIntake(x => ({ ...x, inventory_type: v }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select inventory type" />
                        </SelectTrigger>
                        <SelectContent>
                          {(options?.inventory_type || []).map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Tracking sophistication</div>
                      <Select
                        value={intake.inventory_tracking ?? undefined}
                        onValueChange={(v) => setIntake(x => ({ ...x, inventory_tracking: v }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select tracking level" />
                        </SelectTrigger>
                        <SelectContent>
                          {(options?.inventory_tracking || []).map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* 7) Multi-state */}
              <div className="space-y-3">
                {sectionTitle("7) Multi-state")}
                <Select
                  value={intake.multistate_presence ?? undefined}
                  onValueChange={(v: any) => setIntake(x => ({
                    ...x,
                    multistate_presence: v,
                    multistate_exposure: v === "yes" ? x.multistate_exposure : null,
                    multistate_intensity: v === "yes" ? x.multistate_intensity : null
                  }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(options?.multistate_presence || []).map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {intake.multistate_presence === "yes" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Exposure type</div>
                      <Select
                        value={intake.multistate_exposure ?? undefined}
                        onValueChange={(v) => setIntake(x => ({ ...x, multistate_exposure: v }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select exposure type" />
                        </SelectTrigger>
                        <SelectContent>
                          {(options?.multistate_exposure || []).map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Intensity</div>
                      <Select
                        value={intake.multistate_intensity ?? undefined}
                        onValueChange={(v) => setIntake(x => ({ ...x, multistate_intensity: v }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select intensity" />
                        </SelectTrigger>
                        <SelectContent>
                          {(options?.multistate_intensity || []).map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* 8) International */}
              <div className="space-y-3">
                {sectionTitle("8) International")}
                <Select
                  value={intake.international_presence ?? undefined}
                  onValueChange={(v: any) => setIntake(x => ({
                    ...x,
                    international_presence: v,
                    international_exposure: v === "yes" ? x.international_exposure : null,
                    international_scope: v === "yes" ? x.international_scope : null
                  }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(options?.international_presence || []).map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {intake.international_presence === "yes" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Exposure type</div>
                      <Select
                        value={intake.international_exposure ?? undefined}
                        onValueChange={(v) => setIntake(x => ({ ...x, international_exposure: v }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select exposure type" />
                        </SelectTrigger>
                        <SelectContent>
                          {(options?.international_exposure || []).map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Scope</div>
                      <Select
                        value={intake.international_scope ?? undefined}
                        onValueChange={(v) => setIntake(x => ({ ...x, international_scope: v }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select scope" />
                        </SelectTrigger>
                        <SelectContent>
                          {(options?.international_scope || []).map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  className="w-full bg-[#1C6F66] text-white hover:bg-[#15534d]"
                  disabled={busy}
                  onClick={doBuild}
                >
                  {busy ? "Building…" : "Build profile"}
                </Button>
              </div>
            </div>
          ) : null}

          {/* PROFILE */}
          {step === "profile" && profile ? (
            <div className="space-y-4">
              <Card className="border">
                <CardHeader>
                  <CardTitle className="text-lg text-[#6B4A2E]">Your Tax Planning Profile</CardTitle>
                  <CardDescription>1-page style summary preview. Downloads are in the last step.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div><span className="font-semibold">Entity:</span> {optLabel(options, "entity_type", profile.snapshot.entity_type)}</div>
                    <div><span className="font-semibold">States:</span> {profile.snapshot.states.length ? profile.snapshot.states.join(", ") : "—"}</div>
                    <div><span className="font-semibold">Industry:</span> {optLabel(options, "industry", profile.snapshot.industry)}</div>
                    <div><span className="font-semibold">Revenue:</span> {optLabel(options, "revenue_range", profile.snapshot.revenue_range)}</div>
                    <div className="md:col-span-2">
                      <span className="font-semibold">Payroll:</span>{" "}
                      W-2 {optLabel(options, "payroll_w2_bracket", profile.snapshot.payroll.w2)} | Owners{" "}
                      {optLabel(options, "payroll_owner_bracket", profile.snapshot.payroll.owner)} | 1099{" "}
                      {optLabel(options, "payroll_1099_bracket", profile.snapshot.payroll.contractors_1099)}
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-semibold">Flags:</span>{" "}
                      Payroll {profile.flags.payroll_complexity} • Inventory {profile.flags.inventory_complexity} •
                      Multi-state {profile.flags.multistate_risk} • International {profile.flags.international_risk}
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-semibold">Topics:</span> {profile.topics.join(" • ")}
                    </div>
                  </div>

                  <div className="rounded-md border bg-slate-50 p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-700">Profile JSON</div>
                    <pre className="max-h-72 overflow-auto text-xs">{JSON.stringify(profile, null, 2)}</pre>
                  </div>

                  <Button
                    type="button"
                    className="w-full bg-[#1C6F66] text-white hover:bg-[#15534d]"
                    onClick={() => setStep("questions")}
                  >
                    Next steps → Your Question Set
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* QUESTIONS */}
          {step === "questions" && profile ? (
            <div className="space-y-4">
              <Card className="border">
                <CardHeader>
                  <CardTitle className="text-lg text-[#6B4A2E]">Your Question Set</CardTitle>
                  <CardDescription>Prioritized checklist, grouped by topic.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {Object.entries(
                    questions.reduce((acc: Record<string, Question[]>, item) => {
                      acc[item.topic] ||= [];
                      acc[item.topic].push(item);
                      return acc;
                    }, {})
                  ).map(([topic, list]) => (
                    <div key={topic} className="space-y-2">
                      <div className="text-sm font-semibold text-[#6B4A2E]">{topic}</div>
                      <div className="space-y-2">
                        {list.map((item) => (
                          <div key={item.id} className="rounded-md border p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="font-medium">{item.question}</div>
                              <Badge className={cn(
                                item.priority === 1 ? "bg-[#1C6F66] text-white" :
                                item.priority === 2 ? "bg-[#E8B765] text-[#6B4A2E]" :
                                "bg-slate-200 text-slate-700"
                              )}>
                                Priority {item.priority}
                              </Badge>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">{item.why_it_matters}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    className="w-full bg-[#1C6F66] text-white hover:bg-[#15534d]"
                    onClick={() => setStep("calendar")}
                  >
                    Next steps → Quarterly Decision Calendar
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* CALENDAR */}
          {step === "calendar" && profile ? (
            <div className="space-y-4">
              <Card className="border">
                <CardHeader>
                  <CardTitle className="text-lg text-[#6B4A2E]">Quarterly Decision Calendar</CardTitle>
                  <CardDescription>Actions + key federal estimated tax dates.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-700">
                    The calendar is generated from your Phase 0 profile. Confirm final due dates for weekends/holidays.
                  </div>

                  <div className="space-y-2">
                    {calendar.slice(0, 30).map((e, idx) => (
                      <div key={`${e.dateISO}-${idx}`} className="flex items-start justify-between gap-3 rounded-md border p-3">
                        <div>
                          <div className="font-medium">{e.title}</div>
                          {e.notes ? <div className="text-xs text-muted-foreground">{e.notes}</div> : null}
                        </div>
                        <div className="text-sm font-semibold text-[#6B4A2E]">{humanDate(e.dateISO)}</div>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    className="w-full bg-[#1C6F66] text-white hover:bg-[#15534d]"
                    onClick={() => setStep("download")}
                  >
                    Next steps → Download bundle
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* DOWNLOAD */}
          {step === "download" && profile ? (
            <div className="space-y-4">
              <Card className="border">
                <CardHeader>
                  <CardTitle className="text-lg text-[#6B4A2E]">Download bundle</CardTitle>
                  <CardDescription>PDF + optional add-ons (ICS calendar file, CSV checklist) in a ZIP.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <Button type="button" variant="outline" onClick={downloadJSON}>Download JSON</Button>
                    <Button type="button" variant="outline" onClick={downloadCSV}>Download CSV</Button>
                    <Button type="button" variant="outline" onClick={downloadICS}>Download ICS</Button>
                    <Button type="button" variant="outline" onClick={downloadPDF}>Download PDF</Button>
                  </div>
                  <Button
                    type="button"
                    className="w-full bg-[#1C6F66] text-white hover:bg-[#15534d]"
                    onClick={downloadZIP}
                  >
                    Download ZIP bundle
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* If options did not load */}
          {!loadingOptions && !options ? (
            <div className="rounded-md border bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Dropdown options are empty. Run the Supabase SQL seed, then reload.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
