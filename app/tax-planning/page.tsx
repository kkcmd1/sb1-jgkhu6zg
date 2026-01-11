"use client";

import * as React from "react";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Info, FileDown, CalendarDays, ListChecks, AlertTriangle } from "lucide-react";

type OptionRow = {
  set_key: string;
  value: string;
  label: string;
  sort: number | null;
  group_label: string | null;
  help: string | null;
  meta: any;
};

type OptionMap = Record<string, OptionRow[]>;

const BRAND = {
  teal: "#1C6F66",
  brown: "#6B4A2E",
  gold: "#E8B765",
  card: "bg-white/90 border rounded-2xl shadow-sm",
};

const SET_KEYS = [
  "entity_type",
  "state",
  "industry",
  "revenue_range",
  "payroll_w2",
  "inventory_presence",
  "inventory_type",
  "inventory_tracking",
  "multistate_presence",
  "international_presence",
] as const;

type Intake = {
  entity_type: string;
  states: string[];
  industry: string;
  revenue_range: string;

  payroll_w2: string;

  inventory_presence: "yes" | "no" | "";
  inventory_type: string;
  inventory_tracking: string;

  multistate_presence: "yes" | "no" | "";
  international_presence: "yes" | "no" | "";
};

type WatchItem = {
  id: string;
  title: string;
  trigger: string;
  readiness: string[];
  consequence: string;
  decision_prompt: string;
  tags: string[];
};

function uniqueStrings(list: string[]) {
  const out: string[] = [];
  for (const s of list) {
    if (!out.includes(s)) out.push(s);
  }
  return out;
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

function toCSV(rows: { col1: string; col2: string; col3?: string }[]) {
  const esc = (v: string) => `"${String(v).replaceAll(`"`, `""`)}"`;
  const header = [esc("Category"), esc("Item"), esc("Notes")].join(",");
  const body = rows
    .map((r) => [esc(r.col1), esc(r.col2), esc(r.col3 ?? "")].join(","))
    .join("\n");
  return `${header}\n${body}\n`;
}

function buildIcsQuarterly(year: number) {
  // Standard quarterly estimated-tax due dates (calendar-only). Dates can shift for weekends/holidays.
  const pad = (n: number) => String(n).padStart(2, "0");
  const dt = (y: number, m: number, d: number) => `${y}${pad(m)}${pad(d)}T120000Z`;

  const events = [
    { y: year, m: 4, d: 15, title: "Estimated tax (Q1) — verify final due date" },
    { y: year, m: 6, d: 15, title: "Estimated tax (Q2) — verify final due date" },
    { y: year, m: 9, d: 15, title: "Estimated tax (Q3) — verify final due date" },
    { y: year + 1, m: 1, d: 15, title: "Estimated tax (Q4) — verify final due date" },
  ];

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BTBB//Tax Planning//EN",
    "CALSCALE:GREGORIAN",
  ];

  for (const e of events) {
    const uid = `btbb-est-${e.y}${pad(e.m)}${pad(e.d)}@btbb`;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dt(year, 1, 1)}`);
    lines.push(`DTSTART:${dt(e.y, e.m, e.d)}`);
    lines.push(`SUMMARY:${e.title}`);
    lines.push("DESCRIPTION:Calendar marker only. Confirm final IRS due date for weekends/holidays.");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

async function loadOptions(): Promise<{ map: OptionMap; errorText: string | null }> {
  const keys = [...SET_KEYS];

  const { data, error } = await supabase
    .from("btbb_tax_options")
    .select("set_key,value,label,sort,group_label,help,meta")
    .in("set_key", keys)
    .order("set_key", { ascending: true })
    .order("sort", { ascending: true });

  if (error) {
    return { map: {}, errorText: `${error.message}` };
  }

  const rows = (data ?? []) as OptionRow[];
  const map: OptionMap = {};
  for (const k of keys) map[k] = [];

  for (const r of rows) {
    if (!map[r.set_key]) map[r.set_key] = [];
    map[r.set_key].push(r);
  }

  // If a set is empty, the UI still renders but dropdown will be blank.
  return { map, errorText: null };
}

function LabelWithHelp(props: { label: string; help?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-sm font-medium" style={{ color: BRAND.brown }}>
        {props.label}
      </div>
      {props.help ? (
        <span
          className="inline-flex items-center text-muted-foreground"
          title={props.help}
          aria-label={props.help}
        >
          <Info size={16} />
        </span>
      ) : null}
    </div>
  );
}

function SelectBasic(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: OptionRow[];
  help?: string;
  label: string;
  groupBy?: boolean;
}) {
  const grouped = React.useMemo(() => {
    if (!props.groupBy) return null;
    const groups = uniqueStrings(props.options.map((o) => o.group_label ?? "Other"));
    return groups.map((g) => ({
      group: g,
      items: props.options.filter((o) => (o.group_label ?? "Other") === g),
    }));
  }, [props.groupBy, props.options]);

  return (
    <div className="grid gap-2">
      <LabelWithHelp label={props.label} help={props.help} />
      <select
        className="w-full rounded-md border bg-white px-3 py-2 text-sm"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        <option value="">{props.placeholder}</option>

        {!props.groupBy
          ? props.options.map((o) => (
              <option key={`${o.set_key}:${o.value}`} value={o.value}>
                {o.label}
              </option>
            ))
          : grouped?.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((o) => (
                  <option key={`${o.set_key}:${o.value}`} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
      </select>
    </div>
  );
}

export default function TaxPlanningPhase3Page() {
  const [optMap, setOptMap] = React.useState<OptionMap>({});
  const [optError, setOptError] = React.useState<string | null>(null);
  const [loadingOpts, setLoadingOpts] = React.useState(true);

  const [intake, setIntake] = React.useState<Intake>({
    entity_type: "",
    states: [],
    industry: "",
    revenue_range: "",
    payroll_w2: "",
    inventory_presence: "",
    inventory_type: "",
    inventory_tracking: "",
    multistate_presence: "",
    international_presence: "",
  });

  const [stateToAdd, setStateToAdd] = React.useState("");
  const [buildError, setBuildError] = React.useState<string | null>(null);
  const [profileJson, setProfileJson] = React.useState<any | null>(null);
  const [watchlist, setWatchlist] = React.useState<WatchItem[]>([]);
  const [tab, setTab] = React.useState<"decision" | "rationale" | "proof" | "memo">("decision");
  const [workerDecision, setWorkerDecision] = React.useState<string>("");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingOpts(true);
      const res = await loadOptions();
      if (!alive) return;
      setOptMap(res.map);
      setOptError(res.errorText);
      setLoadingOpts(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const entityTypeOpts = optMap["entity_type"] ?? [];
  const stateOpts = optMap["state"] ?? [];
  const industryOpts = optMap["industry"] ?? [];
  const revenueOpts = optMap["revenue_range"] ?? [];
  const payrollW2Opts = optMap["payroll_w2"] ?? [];
  const invPresenceOpts = optMap["inventory_presence"] ?? [];
  const invTypeOpts = optMap["inventory_type"] ?? [];
  const invTrackOpts = optMap["inventory_tracking"] ?? [];
  const multistateOpts = optMap["multistate_presence"] ?? [];
  const intlOpts = optMap["international_presence"] ?? [];

  const optionCounts = React.useMemo(() => {
    const out: Record<string, number> = {};
    for (const k of SET_KEYS) out[k] = (optMap[k]?.length ?? 0);
    return out;
  }, [optMap]);

  function addState() {
    const code = stateToAdd.trim();
    if (!code) return;
    if (intake.states.includes(code)) return;
    setIntake((p) => ({ ...p, states: [...p.states, code] }));
    setStateToAdd("");
  }

  function removeState(code: string) {
    setIntake((p) => ({ ...p, states: p.states.filter((s) => s !== code) }));
  }

  function buildWatchlist(p: any): WatchItem[] {
    const items: WatchItem[] = [];

    const payrollHasPeople = p.payroll_w2 && p.payroll_w2 !== "0";

    if (payrollHasPeople) {
      items.push({
        id: "payroll_cadence",
        title: "Payroll cadence + year-end forms readiness",
        trigger: "Payroll present",
        readiness: [
          "Payroll processor chosen and active",
          "W-4 / state equivalents collected and stored",
          "I-9 workflow exists",
          "Quarterly filings owner assigned",
          "Year-end W-2 timeline and cutoff noted",
        ],
        consequence:
          "Late or incorrect payroll filings can create penalties, audit friction, and cleanup work at year-end.",
        decision_prompt:
          "Do you want a monthly payroll review cadence (tight controls) or a quarterly cadence (lighter workload)?",
        tags: ["payroll", "year-end", "controls"],
      });
    }

    if (p.inventory_presence === "yes") {
      items.push({
        id: "inventory_cogs_pack",
        title: "Accounting method prompts + COGS substantiation pack",
        trigger: "Inventory present",
        readiness: [
          "Inventory purchase support is stored by month",
          "Count cadence chosen (monthly/quarterly) and written down",
          "COGS note exists (shrink/adjustments policy included)",
          "If using 3PL, storage locations are listed and tracked",
        ],
        consequence:
          "Weak inventory records can inflate taxable income, create audit friction, and misstate margins.",
        decision_prompt:
          "What is your count cadence right now (monthly, quarterly, year-end only)?",
        tags: ["inventory", "cogs", "documentation"],
      });
    }

    if (p.multistate_presence === "yes") {
      items.push({
        id: "nexus_watch",
        title: "Sales-tax tracking + nexus watch",
        trigger: "Multi-state",
        readiness: [
          "States list is complete (sales + people + inventory footprint)",
          "Sales by state can be exported",
          "Marketplace vs direct sales split is visible",
          "Nexus threshold review cadence exists",
        ],
        consequence:
          "Missing registrations can lead to back filings, penalties, and forced catch-up work.",
        decision_prompt:
          "Which states are highest volume, and which states have inventory or people footprint?",
        tags: ["sales-tax", "nexus", "multistate"],
      });
    }

    if (p.entity_type === "s_corp") {
      items.push({
        id: "owner_comp",
        title: "Owner comp planning prompts + wage support pack",
        trigger: "S-corp selection",
        readiness: [
          "Role description and time allocation written down",
          "Comparable wage support saved (notes + sources)",
          "Payroll is active for owner wages",
          "Quarterly distributions policy written down",
        ],
        consequence:
          "Owner wage issues can create audit pressure and reclassification risk.",
        decision_prompt:
          "Do you have an owner wage story that matches your role, hours, and market pay?",
        tags: ["s-corp", "owner-comp", "evidence"],
      });
    }

    return items;
  }

  function buildProfile() {
    setBuildError(null);

    if (!intake.entity_type) {
      setBuildError("Pick an entity type to build your profile.");
      return;
    }
    if (!intake.industry) {
      setBuildError("Pick an industry to build your profile.");
      return;
    }

    const profile = {
      intake: {
        entity_type: intake.entity_type,
        states: intake.states,
        industry: intake.industry,
        revenue_range: intake.revenue_range || null,
        payroll_w2: intake.payroll_w2 || null,
        inventory_presence: intake.inventory_presence || null,
        inventory_type: intake.inventory_type || null,
        inventory_tracking: intake.inventory_tracking || null,
        multistate_presence: intake.multistate_presence || null,
        international_presence: intake.international_presence || null,
      },
      phase: 3,
      generated_at: new Date().toISOString(),
    };

    setProfileJson(profile);

    const wl = buildWatchlist(profile.intake);
    setWatchlist(wl);

    // Worker decision defaults
    if (!workerDecision) {
      if (!intake.payroll_w2 || intake.payroll_w2 === "0") setWorkerDecision("none");
      else setWorkerDecision("w2");
    }
  }

  async function downloadBundleZip() {
    if (!profileJson) return;

    // Dynamic imports to reduce TS/module pressure in WebContainer
    const zipMod: any = await import("jszip");
    const JSZipCtor = zipMod.default ?? zipMod;
    const zip = new JSZipCtor();

    const jsonText = JSON.stringify(profileJson, null, 2);

    const csvRows: { col1: string; col2: string; col3?: string }[] = [];
    for (const item of watchlist) {
      for (const r of item.readiness) csvRows.push({ col1: item.title, col2: r, col3: item.trigger });
    }
    const csvText = toCSV(csvRows);

    const icsText = buildIcsQuarterly(new Date().getFullYear());

    // PDF (jsPDF)
    const jspdfMod: any = await import("jspdf");
    const JsPDF = jspdfMod.jsPDF ?? jspdfMod.default?.jsPDF ?? jspdfMod.default;
    const doc = new JsPDF({ unit: "pt", format: "letter" });

    const left = 48;
    let y = 60;

    doc.setFontSize(18);
    doc.text("Your Tax Planning Profile", left, y);
    y += 18;

    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, left, y);
    y += 18;

    doc.setFontSize(12);
    doc.text("Intake", left, y);
    y += 14;

    doc.setFontSize(10);
    const lines = [
      `Entity type: ${profileJson.intake.entity_type}`,
      `State(s): ${(profileJson.intake.states ?? []).join(", ") || "—"}`,
      `Industry: ${profileJson.intake.industry}`,
      `Revenue range: ${profileJson.intake.revenue_range ?? "—"}`,
      `Payroll (W-2): ${profileJson.intake.payroll_w2 ?? "—"}`,
      `Inventory present: ${profileJson.intake.inventory_presence ?? "—"}`,
      `Inventory type: ${profileJson.intake.inventory_type ?? "—"}`,
      `Multi-state: ${profileJson.intake.multistate_presence ?? "—"}`,
      `International: ${profileJson.intake.international_presence ?? "—"}`,
    ];
    for (const l of lines) {
      doc.text(l, left, y);
      y += 14;
    }

    y += 8;
    doc.setFontSize(12);
    doc.text("Watchlist", left, y);
    y += 14;

    doc.setFontSize(10);
    for (const item of watchlist) {
      doc.text(`• ${item.title}`, left, y);
      y += 12;
    }

    const pdfBlob: Blob = doc.output("blob");

    zip.file("btbb-tax-profile.json", jsonText);
    zip.file("btbb-tax-watchlist.csv", csvText);
    zip.file("btbb-quarterly-calendar.ics", icsText);
    zip.file("btbb-tax-profile.pdf", pdfBlob);

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "btbb-tax-planning-bundle.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const cardBase = "rounded-2xl border bg-white/90 shadow-sm";

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className={cn(cardBase, "p-6")}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
              BTBB Tax Planning — Phase 3
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Turn your answers into documentation, decision prompts, and a quarterly action calendar.
            </div>
          </div>
          <Badge
            className="rounded-full px-3 py-1"
            style={{ backgroundColor: BRAND.gold, color: BRAND.brown }}
          >
            Phase 3
          </Badge>
        </div>

        <div className="mt-4 grid gap-3">
          {loadingOpts ? (
            <div className="text-sm text-muted-foreground">Loading dropdown options…</div>
          ) : optError ? (
            <div className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <AlertTriangle size={18} className="mt-0.5" />
              <div>
                <div className="font-medium">Options load error</div>
                <div className="text-muted-foreground">{optError}</div>
                <div className="mt-2 text-muted-foreground">
                  If the dropdowns stay empty, the usual causes are: seed SQL did not run, or RLS is blocking reads.
                </div>
              </div>
            </div>
          ) : null}

          {!loadingOpts ? (
            <div className="text-xs text-muted-foreground">
              Options loaded:{" "}
              {SET_KEYS.map((k, idx) => (
                <span key={k}>
                  {idx ? " · " : ""}
                  {k}={optionCounts[k]}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        <Card className={cardBase}>
          <CardHeader>
            <CardTitle style={{ color: BRAND.brown }}>Start here</CardTitle>
            <CardDescription>
              Save your intake once. Phase 3 uses it to build your memo + watchlist.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="rounded-xl border p-4">
              <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                Intake (inputs 1–8)
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                These inputs drive the memo generator and the watchlist triggers.
              </div>

              <div className="mt-4 grid gap-4">
                <SelectBasic
                  label="1) Entity type"
                  placeholder="Select…"
                  value={intake.entity_type}
                  onChange={(v) => setIntake((p) => ({ ...p, entity_type: v }))}
                  options={entityTypeOpts}
                  help="Legal form and tax baseline."
                />

                <div className="grid gap-2">
                  <LabelWithHelp
                    label="2) State(s)"
                    help="Add each state that touches formation, people, property, inventory, or sales."
                  />
                  <div className="flex gap-2">
                    <select
                      className="w-full rounded-md border bg-white px-3 py-2 text-sm"
                      value={stateToAdd}
                      onChange={(e) => setStateToAdd(e.target.value)}
                    >
                      <option value="">Select a state…</option>
                      {stateOpts.map((o) => (
                        <option key={`state:${o.value}`} value={o.value}>
                          {o.label} ({o.value})
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      onClick={addState}
                      style={{ backgroundColor: BRAND.teal }}
                      className="text-white"
                    >
                      Add
                    </Button>
                  </div>

                  {intake.states.length ? (
                    <div className="flex flex-wrap gap-2">
                      {intake.states.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => removeState(s)}
                          className="rounded-full border px-3 py-1 text-xs"
                          title="Click to remove"
                        >
                          {s} ✕
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Picked: None</div>
                  )}
                </div>

                <SelectBasic
                  label="3) Industry"
                  placeholder="Select…"
                  value={intake.industry}
                  onChange={(v) => setIntake((p) => ({ ...p, industry: v }))}
                  options={industryOpts}
                  groupBy
                  help="Pick the closest match. This drives topic prompts and proof packs."
                />

                <SelectBasic
                  label="4) Revenue range"
                  placeholder="Select…"
                  value={intake.revenue_range}
                  onChange={(v) => setIntake((p) => ({ ...p, revenue_range: v }))}
                  options={revenueOpts}
                  help="Annual top-line range. Used for planning triggers."
                />

                <SelectBasic
                  label="5) W-2 employees (on payroll)"
                  placeholder="Select…"
                  value={intake.payroll_w2}
                  onChange={(v) => setIntake((p) => ({ ...p, payroll_w2: v }))}
                  options={payrollW2Opts}
                  help="Pick one bracket for current W-2 headcount."
                />

                <SelectBasic
                  label="6) Inventory present"
                  placeholder="Select…"
                  value={intake.inventory_presence}
                  onChange={(v) =>
                    setIntake((p) => ({
                      ...p,
                      inventory_presence: v as any,
                      inventory_type: v === "yes" ? p.inventory_type : "",
                      inventory_tracking: v === "yes" ? p.inventory_tracking : "",
                    }))
                  }
                  options={invPresenceOpts}
                  help="Inventory means goods held for sale, inputs, packaging held for sale units, or stock in 3PL/warehouses."
                />

                {intake.inventory_presence === "yes" ? (
                  <div className="grid gap-4 rounded-xl border p-4">
                    <SelectBasic
                      label="6B) Inventory type"
                      placeholder="Select…"
                      value={intake.inventory_type}
                      onChange={(v) => setIntake((p) => ({ ...p, inventory_type: v }))}
                      options={invTypeOpts}
                      help="Pick the closest inventory category."
                    />
                    <SelectBasic
                      label="6C) Inventory tracking"
                      placeholder="Select…"
                      value={intake.inventory_tracking}
                      onChange={(v) => setIntake((p) => ({ ...p, inventory_tracking: v }))}
                      options={invTrackOpts}
                      help="How inventory is tracked today."
                    />
                  </div>
                ) : null}

                <SelectBasic
                  label="7) Multi-state"
                  placeholder="Select…"
                  value={intake.multistate_presence}
                  onChange={(v) => setIntake((p) => ({ ...p, multistate_presence: v as any }))}
                  options={multistateOpts}
                  help="Yes if you sell into other states, have workers/contractors out of state, or store inventory out of state."
                />

                <SelectBasic
                  label="8) International"
                  placeholder="Select…"
                  value={intake.international_presence}
                  onChange={(v) => setIntake((p) => ({ ...p, international_presence: v as any }))}
                  options={intlOpts}
                  help="Yes if you have foreign customers, vendors, labor, shipping, or accounts."
                />

                {buildError ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {buildError}
                  </div>
                ) : null}

                <Button
                  type="button"
                  onClick={buildProfile}
                  className="w-full"
                  style={{ backgroundColor: BRAND.teal, color: "white" }}
                >
                  Build profile
                </Button>
              </div>
            </div>

            {profileJson ? (
              <Card className={cn(cardBase, "bg-white")}>
                <CardHeader>
                  <CardTitle style={{ color: BRAND.brown }}>Your Tax Planning Profile</CardTitle>
                  <CardDescription>
                    This is your saved snapshot. Downloads below include JSON + PDF + optional add-ons.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="rounded-xl border p-3">
                    <div className="text-xs font-semibold" style={{ color: BRAND.brown }}>
                      Profile JSON
                    </div>
                    <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-[11px]">
                      {JSON.stringify(profileJson, null, 2)}
                    </pre>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          downloadText("btbb-tax-profile.json", JSON.stringify(profileJson, null, 2), "application/json")
                        }
                      >
                        <FileDown size={16} className="mr-2" />
                        Download JSON
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const rows: { col1: string; col2: string; col3?: string }[] = [];
                          for (const item of watchlist) {
                            for (const r of item.readiness) rows.push({ col1: item.title, col2: r, col3: item.trigger });
                          }
                          downloadText("btbb-tax-watchlist.csv", toCSV(rows), "text/csv");
                        }}
                      >
                        <ListChecks size={16} className="mr-2" />
                        Download CSV checklist
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => downloadText("btbb-quarterly-calendar.ics", buildIcsQuarterly(new Date().getFullYear()), "text/calendar")}
                      >
                        <CalendarDays size={16} className="mr-2" />
                        Download ICS calendar
                      </Button>

                      <Button
                        type="button"
                        onClick={downloadBundleZip}
                        style={{ backgroundColor: BRAND.teal, color: "white" }}
                      >
                        <FileDown size={16} className="mr-2" />
                        Download bundle (ZIP)
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </CardContent>
        </Card>

        {/* Phase 3 block: Decision Memo + Audit Binder + Watchlist */}
        {profileJson ? (
          <div className="grid gap-4">
            <Card className={cardBase}>
              <CardHeader>
                <CardTitle style={{ color: BRAND.brown }}>
                  Decision Memo + Audit Binder
                </CardTitle>
                <CardDescription>
                  Every “next step” is a documented decision. You can save, re-open, and export your memo.
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4">
                <div className="flex flex-wrap gap-2">
                  {(["decision", "rationale", "proof", "memo"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTab(k)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs",
                        tab === k ? "bg-slate-900 text-white" : "bg-white"
                      )}
                    >
                      {k === "decision" ? "Decision" : k === "rationale" ? "Rationale" : k === "proof" ? "Proof Pack" : "Memo"}
                    </button>
                  ))}
                </div>

                {tab === "decision" ? (
                  <div className="grid gap-3 rounded-xl border p-4">
                    <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                      Planning topic: Worker setup (W-2 vs 1099)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Pick what applies right now. Your memo updates with the choice.
                    </div>

                    <div className="grid gap-2">
                      {[
                        { v: "none", t: "No workers yet", d: "No payroll or 1099 setup yet. Keep the proof pack ready for when you hire." },
                        { v: "w2", t: "All W-2 employees", d: "Payroll cadence becomes a core system." },
                        { v: "1099", t: "All 1099 contractors", d: "Classification proof matters; collect W-9s and contracts." },
                        { v: "mixed", t: "Mixed (W-2 + 1099)", d: "Run payroll controls and contractor controls side-by-side." },
                      ].map((o) => (
                        <label key={o.v} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                          <input
                            type="radio"
                            name="workerDecision"
                            value={o.v}
                            checked={workerDecision === o.v}
                            onChange={() => setWorkerDecision(o.v)}
                            className="mt-1"
                          />
                          <div>
                            <div className="text-sm font-medium">{o.t}</div>
                            <div className="text-xs text-muted-foreground">{o.d}</div>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="rounded-lg bg-slate-50 p-3 text-xs">
                      <div className="font-semibold">Best fit for you suggestion</div>
                      <div className="text-muted-foreground">
                        {workerDecision === "none"
                          ? "No workers yet."
                          : workerDecision === "w2"
                          ? "W-2 payroll controls should be built first."
                          : workerDecision === "1099"
                          ? "Contractor classification proof should be built first."
                          : workerDecision === "mixed"
                          ? "Payroll controls and contractor controls should run together."
                          : "None selected."}
                      </div>
                    </div>
                  </div>
                ) : null}

                {tab === "rationale" ? (
                  <div className="grid gap-3 rounded-xl border p-4">
                    <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                      Rationale
                    </div>
                    <div className="text-sm">
                      This workspace records a plain-English reason, tradeoffs, and an audit narrative draft.
                    </div>
                    <div className="grid gap-2 text-sm">
                      <div className="rounded-lg border p-3">
                        <div className="font-semibold">Tradeoffs (pros / cons)</div>
                        <ul className="mt-2 list-disc pl-5 text-sm">
                          <li>W-2: clean control model, heavier admin.</li>
                          <li>1099: lighter admin, higher classification proof burden.</li>
                          <li>Mixed: flexible, needs two control tracks.</li>
                        </ul>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="font-semibold">If asked, say this (audit narrative draft)</div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          “We classified workers based on facts and documentation (contracts, scope, control, and payment structure),
                          and we keep proof in a repeatable binder that is reviewed on a set cadence.”
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {tab === "proof" ? (
                  <div className="grid gap-3 rounded-xl border p-4">
                    <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                      Proof Pack
                    </div>
                    <div className="text-xs text-muted-foreground">
                      What counts as proof. Build this once, then keep it updated on a cadence.
                    </div>

                    <div className="grid gap-2">
                      {[
                        { t: "Contracts for all contractors (required)", d: "Signed scope + pay terms. PDF preferred.", r: true },
                        { t: "W-9s collected (required for 1099)", d: "Store by vendor name. PDF/JPG accepted.", r: true },
                        { t: "Payroll reports (required for W-2)", d: "Quarterly summaries + year-end W-2 outputs.", r: true },
                        { t: "Role descriptions (optional but strong)", d: "Job duties and control model; supports classification story.", r: false },
                      ].map((x) => (
                        <div key={x.t} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                          <div>
                            <div className="text-sm font-medium">{x.t}</div>
                            <div className="text-xs text-muted-foreground">{x.d}</div>
                          </div>
                          <Badge variant={x.r ? "default" : "secondary"}>
                            {x.r ? "Required" : "Optional"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {tab === "memo" ? (
                  <div className="grid gap-3 rounded-xl border p-4">
                    <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                      Tax Position Memo (draft)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Facts from intake, assumptions, decision, risks/mitigations, and a CPA question list.
                    </div>

                    <div className="rounded-lg bg-slate-50 p-3 text-xs">
                      <pre className="whitespace-pre-wrap">
{`Facts
- Entity type: ${profileJson.intake.entity_type}
- State(s): ${(profileJson.intake.states ?? []).join(", ") || "—"}
- Industry: ${profileJson.intake.industry}
- Payroll (W-2): ${profileJson.intake.payroll_w2 ?? "—"}

Assumptions
- Intake reflects current operations as of ${new Date().toLocaleDateString()}.

Decision selected + date
- Worker setup: ${workerDecision || "none selected"} (${new Date().toLocaleDateString()})

Risks and mitigations
- Risk: worker classification mismatch
- Mitigation: keep contracts/W-9s/payroll reports and review quarterly

Documents attached / missing
- Build your Proof Pack items as listed in the Proof Pack tab

CPA questions (copy/paste)
- Any state-specific payroll registrations needed for listed states?
- Any industry-specific compliance items that affect deductions or timing?
`}
                      </pre>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className={cardBase}>
              <CardHeader>
                <CardTitle style={{ color: BRAND.brown }}>Elections + Threshold Radar</CardTitle>
                <CardDescription>
                  Watchlist of decisions and deadlines that can cost money if missed.
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-3">
                <div className="text-xs text-muted-foreground">
                  Elections to consider (based on profile) • Thresholds to watch (based on profile) • Deadlines coming up (calendar-linked)
                </div>

                {watchlist.length ? (
                  <div className="grid gap-3">
                    {watchlist.map((w) => (
                      <div key={w.id} className="rounded-xl border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                              {w.title}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Trigger: {w.trigger}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {w.tags.map((t) => (
                              <Badge key={t} variant="secondary">
                                {t}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm">
                          <div className="rounded-lg bg-slate-50 p-3">
                            <div className="text-xs font-semibold">What happens if missed</div>
                            <div className="mt-1 text-xs text-muted-foreground">{w.consequence}</div>
                          </div>

                          <div className="rounded-lg border p-3">
                            <div className="text-xs font-semibold">Readiness checklist</div>
                            <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                              {w.readiness.map((r) => (
                                <li key={r}>{r}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="rounded-lg border p-3">
                            <div className="text-xs font-semibold">Decision prompt</div>
                            <div className="mt-1 text-xs text-muted-foreground">{w.decision_prompt}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                    No watchlist items triggered yet. Add more intake details, then rebuild.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </main>
  );
}
