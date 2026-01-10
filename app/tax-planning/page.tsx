"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/hooks/useSession";
import type {
  TaxCalendarAction,
  TaxDropdownOption,
  TaxIntake,
  TaxPlanningProfile,
  TaxQuestion,
} from "@/lib/tax-planning/types";
import { buildTaxPlanningProfile, deriveTags } from "@/lib/tax-planning/engine";

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsvCell(v: string) {
  const s = (v ?? "").toString();
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function profileToCsv(profile: TaxPlanningProfile) {
  const headers = [
    "question_key",
    "module",
    "difficulty",
    "priority_weight",
    "question_text",
    "why_it_matters",
  ];
  const rows = profile.questions.map((q) =>
    [
      q.question_key,
      q.module,
      q.difficulty,
      String(q.priority_weight ?? ""),
      q.question_text,
      q.why_it_matters,
    ]
      .map(toCsvCell)
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

function yyyymmdd(isoYmd: string) {
  return isoYmd.replaceAll("-", "");
}

function profileToIcs(profile: TaxPlanningProfile) {
  const dtstamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//BTBB//Tax Planning//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");

  for (const ev of profile.calendar) {
    const uid =
      (globalThis.crypto && "randomUUID" in globalThis.crypto && (globalThis.crypto as any).randomUUID()) ||
      `${Math.random().toString(16).slice(2)}-${Date.now()}`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${yyyymmdd(ev.date)}`);
    lines.push(`SUMMARY:${ev.title.replace(/\n/g, " ")}`);
    if (ev.note) lines.push(`DESCRIPTION:${ev.note.replace(/\n/g, " ")}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export default function TaxPlanningPage() {
  const { session, loading } = useSession();

  const [options, setOptions] = useState<TaxDropdownOption[]>([]);
  const [questionBank, setQuestionBank] = useState<TaxQuestion[]>([]);
  const [actionBank, setActionBank] = useState<TaxCalendarAction[]>([]);
  const [dataErr, setDataErr] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string>("");

  const [entityType, setEntityType] = useState("");
  const [states, setStates] = useState<string[]>([]);
  const [industry, setIndustry] = useState("");
  const [revenueRange, setRevenueRange] = useState("");
  const [payrollHeadcount, setPayrollHeadcount] = useState("");
  const [inventory, setInventory] = useState("");
  const [multistate, setMultistate] = useState("");
  const [international, setInternational] = useState("");

  const [profile, setProfile] = useState<TaxPlanningProfile | null>(null);

  const optionsByCategory = useMemo(() => {
    const map: Record<string, TaxDropdownOption[]> = {};
    for (const o of options) {
      map[o.category] = map[o.category] || [];
      map[o.category].push(o);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => {
        const sa = a.sort_order ?? 99999;
        const sb = b.sort_order ?? 99999;
        if (sa !== sb) return sa - sb;
        return a.label.localeCompare(b.label);
      });
    }
    return map;
  }, [options]);

  const stateOptions = optionsByCategory["state"] || [];

  useEffect(() => {
    let alive = true;

    (async () => {
      setDataErr("");

      const [optRes, qRes, aRes] = await Promise.all([
        supabase
          .from("btbb_tax_dropdown_options")
          .select("category,value,label,sort_order,meta")
          .eq("is_active", true),
        supabase
          .from("btbb_tax_question_bank")
          .select(
            "id,question_key,module,difficulty,priority_weight,tags,question_text,plain_language_help,why_it_matters"
          )
          .eq("is_active", true),
        supabase
          .from("btbb_tax_calendar_actions")
          .select("id,action_key,action_text,frequency,timing,tags")
          .eq("is_active", true),
      ]);

      if (!alive) return;

      if (optRes.error) setDataErr(optRes.error.message);
      if (qRes.error) setDataErr(qRes.error.message);
      if (aRes.error) setDataErr(aRes.error.message);

      setOptions((optRes.data as any) || []);
      setQuestionBank((qRes.data as any) || []);
      setActionBank((aRes.data as any) || []);
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      const userId = session?.user?.id;
      if (!userId) return;

      const profRes = await supabase
        .from("btbb_tax_profiles")
        .select("profile_json, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!alive) return;

      const row = profRes.data?.[0];
      if (row?.profile_json) setProfile(row.profile_json as any);
    })();

    return () => {
      alive = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!options.length) return;

    const pick = (cat: string) => optionsByCategory[cat]?.[0]?.value || "";

    if (!entityType) setEntityType(pick("entity_type"));
    if (!industry) setIndustry(pick("industry"));
    if (!revenueRange) setRevenueRange(pick("revenue_range"));
    if (!payrollHeadcount) setPayrollHeadcount(pick("payroll_headcount"));
    if (!inventory) setInventory(pick("inventory"));
    if (!multistate) setMultistate(pick("multistate"));
    if (!international) setInternational(pick("international"));
  }, [
    options.length,
    optionsByCategory,
    entityType,
    industry,
    revenueRange,
    payrollHeadcount,
    inventory,
    multistate,
    international,
  ]);

  async function generateProfile() {
    setBusy(true);
    setSaveErr("");

    try {
      const userId = session?.user?.id;
      if (!userId) {
        setSaveErr("Session expired. Sign in again, then retry.");
        return;
      }

      if (
        !entityType ||
        !industry ||
        !revenueRange ||
        !payrollHeadcount ||
        !inventory ||
        !multistate ||
        !international
      ) {
        setSaveErr("Pick an option for every field.");
        return;
      }

      if (!states.length) {
        setSaveErr("Pick at least one state.");
        return;
      }

      const intake: TaxIntake = {
        entity_type: entityType,
        states,
        industry,
        revenue_range: revenueRange,
        payroll_headcount: payrollHeadcount,
        inventory,
        multistate,
        international,
      };

      const intakeRes = await supabase
        .from("btbb_tax_intakes")
        .insert({
          user_id: userId,
          ...intake,
        })
        .select("id")
        .single();

      if (intakeRes.error) {
        setSaveErr(intakeRes.error.message);
        return;
      }

      const tags = new Set<string>(deriveTags(intake));

      const filteredQuestions = questionBank
        .filter((q) => (q.tags || []).some((t) => tags.has(t)))
        .sort((a, b) => (b.priority_weight || 0) - (a.priority_weight || 0));

      const filteredActions = actionBank.filter((a) =>
        (a.tags || []).some((t) => tags.has(t))
      );

      const built = buildTaxPlanningProfile({
        intake,
        questions: filteredQuestions,
        actions: filteredActions,
      });

      const profRes = await supabase
        .from("btbb_tax_profiles")
        .insert({
          user_id: userId,
          intake_id: intakeRes.data.id,
          profile_version: built.profile_version,
          profile_json: built,
        })
        .select("id")
        .single();

      if (profRes.error) {
        setSaveErr(profRes.error.message);
        return;
      }

      setProfile(built);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="rounded-xl border bg-white p-4 text-sm">Loading…</div>;
  }

  if (!session) {
    return (
      <div className="rounded-xl border bg-white p-4">
        <div className="text-lg font-semibold text-[#6B4A2E]">Tax Planning</div>
        <div className="mt-1 text-sm text-gray-700">Sign in to save your profile.</div>
        <Link
          href="/auth"
          className="mt-4 inline-block rounded-md bg-[#1C6F66] px-4 py-2 text-sm font-semibold text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-[#6B4A2E]">Tax Planning</div>
            <div className="mt-1 text-sm text-gray-700">
              Answer the 8 items. Get a compact profile, questions, and a quarter calendar.
            </div>
          </div>
          <span className="rounded-full border px-3 py-1 text-xs font-medium text-[#1C6F66]">
            Phase 0
          </span>
        </div>

        {dataErr ? (
          <div className="mt-3 rounded-md border border-red-200 bg-white p-3 text-sm text-gray-800">
            {dataErr}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3">
          <div>
            <label className="text-xs font-semibold text-[#6B4A2E]">1) Entity type</label>
            <select
              className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              {(optionsByCategory["entity_type"] || []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#6B4A2E]">2) State(s)</label>
            <div className="mt-2 rounded-md border bg-white p-3">
              <div className="text-xs text-gray-700">
                Picked: {states.length ? states.join(", ") : "None"}
              </div>

              <div className="mt-3 max-h-44 overflow-auto rounded-md border p-2">
                {stateOptions.map((o) => {
                  const checked = states.includes(o.value);
                  return (
                    <label key={o.value} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setStates((prev) => {
                            if (prev.includes(o.value)) return prev.filter((x) => x !== o.value);
                            return [...prev, o.value];
                          });
                        }}
                      />
                      <span>{o.label}</span>
                      <span className="ml-auto text-xs text-gray-500">{o.value}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#6B4A2E]">3) Industry</label>
            <select
              className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            >
              {(optionsByCategory["industry"] || []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#6B4A2E]">4) Revenue range</label>
            <select
              className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
              value={revenueRange}
              onChange={(e) => setRevenueRange(e.target.value)}
            >
              {(optionsByCategory["revenue_range"] || []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#6B4A2E]">5) Payroll headcount (W-2)</label>
            <select
              className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
              value={payrollHeadcount}
              onChange={(e) => setPayrollHeadcount(e.target.value)}
            >
              {(optionsByCategory["payroll_headcount"] || []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#6B4A2E]">6) Inventory</label>
            <select
              className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
              value={inventory}
              onChange={(e) => setInventory(e.target.value)}
            >
              {(optionsByCategory["inventory"] || []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#6B4A2E]">7) Multi-state</label>
            <select
              className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
              value={multistate}
              onChange={(e) => setMultistate(e.target.value)}
            >
              {(optionsByCategory["multistate"] || []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#6B4A2E]">8) International</label>
            <select
              className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
              value={international}
              onChange={(e) => setInternational(e.target.value)}
            >
              {(optionsByCategory["international"] || []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {saveErr ? (
            <div className="rounded-md border border-red-200 bg-white p-3 text-sm text-gray-800">
              {saveErr}
            </div>
          ) : null}

          <button
            onClick={generateProfile}
            disabled={busy}
            className="w-full rounded-md bg-[#1C6F66] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Working…" : "Build my tax planning profile"}
          </button>
        </div>
      </div>

      {profile ? (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-[#6B4A2E]">Your tax planning profile</div>
              <div className="mt-1 text-xs text-gray-600">
                Version {profile.profile_version} • {new Date(profile.created_at).toLocaleString()}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="rounded-md border bg-white px-3 py-2 text-xs font-semibold text-[#6B4A2E] hover:bg-[#F3EEE6]"
                onClick={() =>
                  downloadText("btbb-tax-profile.json", JSON.stringify(profile, null, 2), "application/json")
                }
              >
                Download JSON
              </button>
              <button
                className="rounded-md border bg-white px-3 py-2 text-xs font-semibold text-[#6B4A2E] hover:bg-[#F3EEE6]"
                onClick={() => downloadText("btbb-tax-questions.csv", profileToCsv(profile), "text/csv")}
              >
                Download CSV
              </button>
              <button
                className="rounded-md border bg-white px-3 py-2 text-xs font-semibold text-[#6B4A2E] hover:bg-[#F3EEE6]"
                onClick={() => downloadText("btbb-tax-calendar.ics", profileToIcs(profile), "text/calendar")}
              >
                Download ICS
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
