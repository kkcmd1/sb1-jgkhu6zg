"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { jsPDF } from "jspdf";

type OptionRow = {
  set_key: string;
  value: string;
  label: string;
  sort: number | null;
  meta: any;
};

type Option = { value: string; label: string };

type Profile = {
  entity_type: string | null;
  states: string[];
  industry: string | null;
  revenue_range: string | null;

  payroll_w2_headcount: string | null;

  inventory_presence: "yes" | "no" | null;
  multistate_presence: "yes" | "no" | null;
  international_presence: "yes" | "no" | null;

  derived: {
    payroll_tag: "none" | "has_w2" | null;
    multistate_tag: "single_state" | "multi_state" | null;
    inventory_tag: "none" | "has_inventory" | null;
    international_tag: "none" | "has_international" | null;
  };
};

type QuestionItem = {
  topic: string;
  priority: 1 | 2 | 3;
  question: string;
};

type CalendarItem = {
  title: string;
  dateISO: string; // YYYY-MM-DD
  notes?: string;
};

const BRAND = {
  teal: "#1C6F66",
  brown: "#6B4A2E",
  gold: "#E8B765",
};

const PAYROLL_BRACKETS: Option[] = [
  { value: "0", label: "0" },
  { value: "1", label: "1" },
  { value: "2-3", label: "2–3" },
  { value: "4-5", label: "4–5" },
  { value: "6-10", label: "6–10" },
  { value: "11-19", label: "11–19" },
  { value: "20-49", label: "20–49" },
  { value: "50-99", label: "50–99" },
  { value: "100-249", label: "100–249" },
  { value: "250-499", label: "250–499" },
  { value: "500-999", label: "500–999" },
  { value: "1000+", label: "1,000+" },
];

const YES_NO: Option[] = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
];

const US_STATES: Option[] = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

const FALLBACK_OPTIONS: Record<string, Option[]> = {
  entity_type: [
    { value: "sole_prop", label: "Sole proprietorship (no entity formed)" },
    { value: "smllc", label: "Single-member LLC (SMLLC)" },
    { value: "mmlc", label: "Multi-member LLC" },
    { value: "gp", label: "General partnership (GP)" },
    { value: "lp", label: "Limited partnership (LP)" },
    { value: "llp", label: "Limited liability partnership (LLP)" },
    { value: "c_corp", label: "C corporation" },
    { value: "s_corp", label: "S corporation (tax status)" },
    { value: "nonprofit", label: "Nonprofit corporation" },
    { value: "coop", label: "Cooperative (co-op)" },
    { value: "trust_owned", label: "Trust-owned operating entity" },
    { value: "foreign_registered", label: "Foreign entity registered to do business" },
  ],
  industry: [
    { value: "pro_services", label: "Professional services (accounting/legal/consulting/agency/coaching)" },
    { value: "trades", label: "Skilled trades + field services" },
    { value: "health", label: "Healthcare + wellness" },
    { value: "retail", label: "Retail (in-person)" },
    { value: "ecom", label: "E-commerce / online sales" },
    { value: "food", label: "Food + beverage" },
    { value: "manufacturing", label: "Manufacturing / production" },
    { value: "logistics", label: "Transportation + logistics" },
    { value: "real_estate", label: "Real estate" },
    { value: "ag", label: "Agriculture + animals" },
    { value: "media", label: "Media + entertainment" },
    { value: "education", label: "Education" },
    { value: "finance", label: "Finance/insurance" },
    { value: "govcon", label: "Government contracting" },
    { value: "regulated", label: "Highly regulated / special tax regimes" },
  ],
  revenue_range: [
    { value: "pre", label: "Pre-revenue (no sales yet)" },
    { value: "1-10k", label: "$1–$10,000" },
    { value: "10-25k", label: "$10,001–$25,000" },
    { value: "25-50k", label: "$25,001–$50,000" },
    { value: "50-100k", label: "$50,001–$100,000" },
    { value: "100-250k", label: "$100,001–$250,000" },
    { value: "250-500k", label: "$250,001–$500,000" },
    { value: "500-1m", label: "$500,001–$1,000,000" },
    { value: "1-2_5m", label: "$1,000,001–$2,500,000" },
    { value: "2_5-5m", label: "$2,500,001–$5,000,000" },
    { value: "5-10m", label: "$5,000,001–$10,000,000" },
    { value: "10m+", label: "$10,000,001+" },
  ],
  payroll_w2: PAYROLL_BRACKETS,
  inventory_presence: YES_NO,
  multistate_presence: YES_NO,
  international_presence: YES_NO,
  states_us: US_STATES,
};

function groupOptions(rows: OptionRow[]): Record<string, Option[]> {
  const grouped: Record<string, Option[]> = {};
  for (const r of rows) {
    const key = r.set_key;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      value: r.value,
      label: r.label,
    });
  }
  return grouped;
}

function downloadText(filename: string, contents: string, mime = "text/plain") {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}

function toCSV(items: QuestionItem[]) {
  const header = ["priority", "topic", "question"];
  const lines = [header.join(",")];

  for (const it of items) {
    const row = [
      String(it.priority),
      `"${it.topic.replaceAll(`"`, `""`)}"`,
      `"${it.question.replaceAll(`"`, `""`)}"`,
    ];
    lines.push(row.join(","));
  }

  return lines.join("\n");
}

function buildICS(events: CalendarItem[], calName = "BTBB Quarterly Decision Calendar") {
  const dtStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const icsLines: string[] = [];
  icsLines.push("BEGIN:VCALENDAR");
  icsLines.push("VERSION:2.0");
  icsLines.push("PRODID:-//BTBB//Tax Calendar//EN");
  icsLines.push(`X-WR-CALNAME:${calName}`);

  for (const ev of events) {
    const dt = ev.dateISO.replaceAll("-", "");
    const uid = `${dt}-${Math.random().toString(16).slice(2)}@btbb`;

    icsLines.push("BEGIN:VEVENT");
    icsLines.push(`UID:${uid}`);
    icsLines.push(`DTSTAMP:${dtStamp}`);
    icsLines.push(`DTSTART;VALUE=DATE:${dt}`);
    icsLines.push(`SUMMARY:${ev.title}`);
    if (ev.notes) {
      icsLines.push(`DESCRIPTION:${ev.notes.replace(/\n/g, "\\n")}`);
    }
    icsLines.push("END:VEVENT");
  }

  icsLines.push("END:VCALENDAR");
  return icsLines.join("\r\n");
}

function makeDefaultCalendar(now = new Date()): CalendarItem[] {
  // Simple “quarter rhythm” + common estimated-tax cadence.
  // Dates can shift for weekends/holidays; this is a planning calendar.
  const year = now.getFullYear();

  const events: CalendarItem[] = [
    { title: "Quarter planning: clean books + review KPIs", dateISO: `${year}-01-25` },
    { title: "Quarter planning: clean books + review KPIs", dateISO: `${year}-04-25` },
    { title: "Quarter planning: clean books + review KPIs", dateISO: `${year}-07-25` },
    { title: "Quarter planning: clean books + review KPIs", dateISO: `${year}-10-25` },

    { title: "Estimated tax checkpoint (planning)", dateISO: `${year}-04-15` },
    { title: "Estimated tax checkpoint (planning)", dateISO: `${year}-06-15` },
    { title: "Estimated tax checkpoint (planning)", dateISO: `${year}-09-15` },
    { title: "Estimated tax checkpoint (planning)", dateISO: `${year + 1}-01-15` },
  ];

  return events;
}

function buildQuestions(p: Profile): QuestionItem[] {
  const q: QuestionItem[] = [];

  q.push(
    {
      topic: "Entity + tax setup",
      priority: 1,
      question: "What is the exact federal tax filing posture (Schedule C, 1065, 1120-S, 1120) and who files it?",
    },
    {
      topic: "Bookkeeping",
      priority: 1,
      question: "Are business accounts fully separated (bank + card), and is bookkeeping current monthly?",
    },
    {
      topic: "Quarterly rhythm",
      priority: 1,
      question: "Do you run a quarterly review (profit, cash, taxes, compliance dates) with documented next actions?",
    }
  );

  if (p.payroll_w2_headcount && p.payroll_w2_headcount !== "0") {
    q.push(
      {
        topic: "Payroll",
        priority: 1,
        question: "Do you have a payroll system that handles withholding, quarterly filings, and year-end forms?",
      },
      {
        topic: "Payroll",
        priority: 2,
        question: "Do you track worker types correctly (W-2 vs 1099) and keep signed paperwork on file?",
      }
    );
  } else {
    q.push({
      topic: "Payroll",
      priority: 2,
      question: "Do you plan to add payroll in the next 90 days? If yes, pick a payroll provider and setup checklist.",
    });
  }

  if (p.inventory_presence === "yes") {
    q.push(
      {
        topic: "Inventory + COGS",
        priority: 1,
        question: "Do you track inventory/COGS in a consistent method that matches your records and tax reporting?",
      },
      {
        topic: "Inventory + COGS",
        priority: 2,
        question: "Do you have a SKU list (even simple) and a monthly count/variance habit?",
      }
    );
  }

  const isMulti =
    p.multistate_presence === "yes" || (p.states && p.states.length > 1);

  if (isMulti) {
    q.push(
      {
        topic: "Multi-state",
        priority: 1,
        question: "Which states create filing or registration exposure (sales tax, payroll, entity registration, income/franchise)?",
      },
      {
        topic: "Multi-state",
        priority: 2,
        question: "Do you have a quarterly check that reviews where sales/people/inventory occurred by state?",
      }
    );
  }

  if (p.international_presence === "yes") {
    q.push(
      {
        topic: "International",
        priority: 1,
        question: "What international touchpoints exist (customers, contractors, imports/exports, foreign accounts)?",
      },
      {
        topic: "International",
        priority: 2,
        question: "Do you have documentation for cross-border payments and any platform statements you rely on?",
      }
    );
  }

  // Sort by priority
  q.sort((a, b) => a.priority - b.priority || a.topic.localeCompare(b.topic));
  return q;
}

function buildProfileFromInputs(args: {
  entity_type: string | null;
  states: string[];
  industry: string | null;
  revenue_range: string | null;
  payroll_w2_headcount: string | null;
  inventory_presence: "yes" | "no" | null;
  multistate_presence: "yes" | "no" | null;
  international_presence: "yes" | "no" | null;
}): Profile {
  const payrollTag: Profile["derived"]["payroll_tag"] =
    args.payroll_w2_headcount && args.payroll_w2_headcount !== "0" ? "has_w2" : "none";

  const multiTag: Profile["derived"]["multistate_tag"] =
    args.multistate_presence === "yes" || args.states.length > 1 ? "multi_state" : "single_state";

  const invTag: Profile["derived"]["inventory_tag"] =
    args.inventory_presence === "yes" ? "has_inventory" : "none";

  const intlTag: Profile["derived"]["international_tag"] =
    args.international_presence === "yes" ? "has_international" : "none";

  return {
    entity_type: args.entity_type,
    states: args.states,
    industry: args.industry,
    revenue_range: args.revenue_range,
    payroll_w2_headcount: args.payroll_w2_headcount,
    inventory_presence: args.inventory_presence,
    multistate_presence: args.multistate_presence,
    international_presence: args.international_presence,
    derived: {
      payroll_tag: payrollTag,
      multistate_tag: multiTag,
      inventory_tag: invTag,
      international_tag: intlTag,
    },
  };
}

function labelFor(optList: Option[], value: string | null) {
  if (!value) return "—";
  return optList.find(o => o.value === value)?.label ?? value;
}

export default function TaxPlanningPage() {
  const [loading, setLoading] = React.useState(true);
  const [sessionUserId, setSessionUserId] = React.useState<string | null>(null);

  const [options, setOptions] = React.useState<Record<string, Option[]>>(FALLBACK_OPTIONS);

  // Inputs
  const [entityType, setEntityType] = React.useState<string | null>(null);
  const [states, setStates] = React.useState<string[]>([]);
  const [industry, setIndustry] = React.useState<string | null>(null);
  const [revenueRange, setRevenueRange] = React.useState<string | null>(null);
  const [payrollW2, setPayrollW2] = React.useState<string | null>(null);
  const [inventoryPresence, setInventoryPresence] = React.useState<"yes" | "no" | null>(null);
  const [multistatePresence, setMultistatePresence] = React.useState<"yes" | "no" | null>(null);
  const [internationalPresence, setInternationalPresence] = React.useState<"yes" | "no" | null>(null);

  // Outputs
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [questions, setQuestions] = React.useState<QuestionItem[]>([]);
  const [calendar, setCalendar] = React.useState<CalendarItem[]>([]);
  const [notes, setNotes] = React.useState<string>("");

  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      setLoading(true);

      const { data } = await supabase.auth.getSession();
      setSessionUserId(data.session?.user?.id ?? null);

      // Try to load dropdown options from Supabase
      const { data: rows, error } = await supabase
        .from("btbb_tax_options")
        .select("set_key,value,label,sort,meta")
        .order("sort", { ascending: true });

      if (!error && rows && rows.length) {
        const grouped = groupOptions(rows as OptionRow[]);
        setOptions(prev => ({ ...prev, ...grouped }));
      }

      setLoading(false);
    })();
  }, []);

  const entityOpts = options.entity_type ?? FALLBACK_OPTIONS.entity_type;
  const industryOpts = options.industry ?? FALLBACK_OPTIONS.industry;
  const revenueOpts = options.revenue_range ?? FALLBACK_OPTIONS.revenue_range;
  const payrollOpts = options.payroll_w2 ?? FALLBACK_OPTIONS.payroll_w2;
  const invOpts = options.inventory_presence ?? FALLBACK_OPTIONS.inventory_presence;
  const msOpts = options.multistate_presence ?? FALLBACK_OPTIONS.multistate_presence;
  const intlOpts = options.international_presence ?? FALLBACK_OPTIONS.international_presence;
  const stateOpts = options.states_us ?? FALLBACK_OPTIONS.states_us;

  const pickedStatesLabel =
    states.length === 0
      ? "None"
      : states
          .map((s) => stateOpts.find((o) => o.value === s)?.label ?? s)
          .join(", ");

  async function onBuildProfile() {
    setBusy(true);
    setMsg(null);

    const p = buildProfileFromInputs({
      entity_type: entityType,
      states,
      industry,
      revenue_range: revenueRange,
      payroll_w2_headcount: payrollW2,
      inventory_presence: inventoryPresence,
      multistate_presence: multistatePresence,
      international_presence: internationalPresence,
    });

    const q = buildQuestions(p);
    const cal = makeDefaultCalendar(new Date());

    setProfile(p);
    setQuestions(q);
    setCalendar(cal);

    // Save intake if signed in + table exists (won’t block UI if it fails)
    if (sessionUserId) {
      try {
        await supabase.from("btbb_tax_intakes").insert({
          user_id: sessionUserId,
          intake: {
            profile: p,
            notes,
            questions: q,
            calendar: cal,
          },
        });
      } catch {
        // ignore (table may not exist yet, or RLS)
      }
    }

    setBusy(false);
    setMsg("Profile created. Scroll down for results, questions, calendar, downloads.");
  }

  function makePDFBlob(p: Profile, q: QuestionItem[], cal: CalendarItem[]) {
    const doc = new jsPDF();
    let y = 14;

    doc.setFontSize(16);
    doc.text("Your Tax Planning Profile", 14, y);
    y += 8;

    doc.setFontSize(11);
    doc.text(`Entity type: ${labelFor(entityOpts, p.entity_type)}`, 14, y); y += 6;
    doc.text(`State(s): ${p.states.join(", ") || "—"}`, 14, y); y += 6;
    doc.text(`Industry: ${labelFor(industryOpts, p.industry)}`, 14, y); y += 6;
    doc.text(`Revenue range: ${labelFor(revenueOpts, p.revenue_range)}`, 14, y); y += 6;
    doc.text(`Payroll (W-2): ${p.payroll_w2_headcount ?? "—"}`, 14, y); y += 6;
    doc.text(`Inventory: ${p.inventory_presence ?? "—"}`, 14, y); y += 6;
    doc.text(`Multi-state: ${p.multistate_presence ?? "—"}`, 14, y); y += 6;
    doc.text(`International: ${p.international_presence ?? "—"}`, 14, y); y += 8;

    doc.setFontSize(13);
    doc.text("Your Question Set", 14, y); y += 7;

    doc.setFontSize(10);
    for (const item of q.slice(0, 18)) {
      const line = `[P${item.priority}] ${item.topic}: ${item.question}`;
      const split = doc.splitTextToSize(line, 180);
      doc.text(split, 14, y);
      y += split.length * 5;
      if (y > 270) {
        doc.addPage();
        y = 14;
      }
    }

    doc.setFontSize(13);
    if (y > 250) {
      doc.addPage();
      y = 14;
    }
    doc.text("Quarterly Decision Calendar", 14, y); y += 7;

    doc.setFontSize(10);
    for (const ev of cal.slice(0, 14)) {
      const line = `${ev.dateISO}: ${ev.title}`;
      const split = doc.splitTextToSize(line, 180);
      doc.text(split, 14, y);
      y += split.length * 5;
      if (y > 270) {
        doc.addPage();
        y = 14;
      }
    }

    const blob = doc.output("blob");
    return blob;
  }

  async function downloadBundleZIP() {
    if (!profile) return;

    setBusy(true);
    setMsg(null);

    const json = JSON.stringify(
      { profile, notes, questions, calendar },
      null,
      2
    );
    const csv = toCSV(questions);
    const ics = buildICS(calendar);

    const pdfBlob = makePDFBlob(profile, questions, calendar);

    // Dynamic import so TS/module resolution issues don’t kill the page
    let JSZipCtor: any = null;
    try {
      const mod: any = await import("jszip");
      JSZipCtor = mod?.default ?? mod;
    } catch {
      JSZipCtor = null;
    }

    if (!JSZipCtor) {
      // Fallback: download separately
      downloadText("btbb-tax-profile.json", json, "application/json");
      downloadText("btbb-tax-questions.csv", csv, "text/csv");
      downloadText("btbb-tax-calendar.ics", ics, "text/calendar");

      const pdfUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = pdfUrl;
      a.download = "btbb-tax-profile.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(pdfUrl);

      setBusy(false);
      setMsg("ZIP library not available in this session. Downloaded files separately.");
      return;
    }

    const zip = new JSZipCtor();
    zip.file("btbb-tax-profile.json", json);
    zip.file("btbb-tax-questions.csv", csv);
    zip.file("btbb-tax-calendar.ics", ics);

    const pdfBytes = await blobToUint8Array(pdfBlob);
    zip.file("btbb-tax-profile.pdf", pdfBytes);

    const zipBlob: Blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "btbb-tax-bundle.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setBusy(false);
    setMsg("ZIP downloaded.");
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Tax Planning</CardTitle>
            <CardDescription>Loading…</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: BRAND.brown }}>
            Tax Planning
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Answer the 8 items. Get a profile, question set, and a quarterly calendar.
          </p>
        </div>
        <Badge variant="outline" className="rounded-full">
          Phase 0
        </Badge>
      </div>

      {msg ? (
        <div className="mt-4 rounded-lg border bg-white p-3 text-sm">
          {msg}
        </div>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Intake</CardTitle>
          <CardDescription>Fill these out once, then build outputs.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* 1 Entity */}
          <div className="space-y-2">
            <Label>1) Entity type</Label>
            <Select value={entityType ?? ""} onValueChange={(v) => setEntityType(v || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {entityOpts.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2 States */}
          <div className="space-y-2">
            <Label>2) State(s)</Label>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Picked: {pickedStatesLabel}</div>

              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStates([])}
                  className="h-8"
                >
                  Clear
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-8">
                      Pick states
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0">
                    <div className="border-b p-3 text-sm font-medium">States</div>
                    <ScrollArea className="h-72 p-3">
                      <div className="space-y-2">
                        {stateOpts.map((o) => {
                          const checked = states.includes(o.value);
                          return (
                            <label
                              key={o.value}
                              className="flex cursor-pointer items-center gap-2 text-sm"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) => {
                                  const isOn = Boolean(c);
                                  setStates((prev) => {
                                    if (isOn) return Array.from(new Set([...prev, o.value]));
                                    return prev.filter((x) => x !== o.value);
                                  });
                                }}
                              />
                              <span>{o.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* 3 Industry */}
          <div className="space-y-2">
            <Label>3) Industry</Label>
            <Select value={industry ?? ""} onValueChange={(v) => setIndustry(v || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {industryOpts.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 4 Revenue */}
          <div className="space-y-2">
            <Label>4) Revenue range</Label>
            <Select value={revenueRange ?? ""} onValueChange={(v) => setRevenueRange(v || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {revenueOpts.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 5 Payroll */}
          <div className="space-y-2">
            <Label>5) Payroll headcount — W-2 employees</Label>
            <Select value={payrollW2 ?? ""} onValueChange={(v) => setPayrollW2(v || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {payrollOpts.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This list is now a single clean set (no duplicates).
            </p>
          </div>

          {/* 6 Inventory */}
          <div className="space-y-2">
            <Label>6) Inventory</Label>
            <Select
              value={inventoryPresence ?? ""}
              onValueChange={(v) => setInventoryPresence((v as any) || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {invOpts.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 7 Multi-state */}
          <div className="space-y-2">
            <Label>7) Multi-state</Label>
            <Select
              value={multistatePresence ?? ""}
              onValueChange={(v) => setMultistatePresence((v as any) || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {msOpts.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 8 International */}
          <div className="space-y-2">
            <Label>8) International</Label>
            <Select
              value={internationalPresence ?? ""}
              onValueChange={(v) => setInternationalPresence((v as any) || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {intlOpts.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything that affects your tax setup…"
            />
          </div>

          <Button
            onClick={onBuildProfile}
            disabled={busy}
            className="w-full"
            style={{ backgroundColor: BRAND.teal, color: "white" }}
          >
            {busy ? "Building…" : "Build profile"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {profile ? (
        <>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Your Tax Planning Profile</CardTitle>
              <CardDescription>1-page style summary</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><span className="font-medium">Entity:</span> {labelFor(entityOpts, profile.entity_type)}</div>
              <div><span className="font-medium">States:</span> {profile.states.join(", ") || "—"}</div>
              <div><span className="font-medium">Industry:</span> {labelFor(industryOpts, profile.industry)}</div>
              <div><span className="font-medium">Revenue:</span> {labelFor(revenueOpts, profile.revenue_range)}</div>
              <div><span className="font-medium">Payroll (W-2):</span> {profile.payroll_w2_headcount ?? "—"}</div>
              <div><span className="font-medium">Inventory:</span> {profile.inventory_presence ?? "—"}</div>
              <div><span className="font-medium">Multi-state:</span> {profile.multistate_presence ?? "—"}</div>
              <div><span className="font-medium">International:</span> {profile.international_presence ?? "—"}</div>

              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const el = document.getElementById("question-set");
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  Next steps → Your Question Set
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6" id="question-set">
            <CardHeader>
              <CardTitle>Your Question Set</CardTitle>
              <CardDescription>Prioritized checklist, grouped by topic</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from(new Set(questions.map(q => q.topic))).map((topic) => {
                const topicItems = questions.filter(q => q.topic === topic);
                return (
                  <div key={topic} className="rounded-lg border p-3">
                    <div className="mb-2 font-medium">{topic}</div>
                    <ul className="space-y-2 text-sm">
                      {topicItems.map((it, idx) => (
                        <li key={`${topic}-${idx}`} className="flex gap-2">
                          <span className="mt-0.5 inline-flex h-5 w-8 items-center justify-center rounded bg-muted text-xs">
                            P{it.priority}
                          </span>
                          <span>{it.question}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              <Button
                type="button"
                onClick={() => {
                  const el = document.getElementById("calendar");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                style={{ backgroundColor: BRAND.teal, color: "white" }}
              >
                Next → Quarterly Decision Calendar
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-6" id="calendar">
            <CardHeader>
              <CardTitle>Quarterly Decision Calendar</CardTitle>
              <CardDescription>Actions + planning checkpoints</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                Planning calendar. Dates can shift for weekends/holidays. Confirm when filing/paying.
              </div>

              <ul className="space-y-2">
                {calendar.map((ev, idx) => (
                  <li key={idx} className="rounded border p-3">
                    <div className="font-medium">{ev.title}</div>
                    <div className="text-muted-foreground">{ev.dateISO}</div>
                    {ev.notes ? <div className="mt-1">{ev.notes}</div> : null}
                  </li>
                ))}
              </ul>

              <Button
                type="button"
                onClick={() => {
                  const el = document.getElementById("downloads");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                variant="outline"
              >
                Next → Downloads
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-6" id="downloads">
            <CardHeader>
              <CardTitle>Downloads</CardTitle>
              <CardDescription>PDF + add-ons (ICS + CSV) and bundle</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!profile) return;
                    downloadText(
                      "btbb-tax-profile.json",
                      JSON.stringify({ profile, notes, questions, calendar }, null, 2),
                      "application/json"
                    );
                  }}
                >
                  Download JSON
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    downloadText("btbb-tax-questions.csv", toCSV(questions), "text/csv");
                  }}
                >
                  Download CSV checklist
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    downloadText("btbb-tax-calendar.ics", buildICS(calendar), "text/calendar");
                  }}
                >
                  Download ICS calendar
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!profile) return;
                    const blob = makePDFBlob(profile, questions, calendar);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "btbb-tax-profile.pdf";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download PDF
                </Button>
              </div>

              <Button
                type="button"
                disabled={busy}
                onClick={downloadBundleZIP}
                className="w-full"
                style={{ backgroundColor: BRAND.teal, color: "white" }}
              >
                {busy ? "Building bundle…" : "Download ZIP bundle (PDF + ICS + CSV + JSON)"}
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}
    </main>
  );
}
