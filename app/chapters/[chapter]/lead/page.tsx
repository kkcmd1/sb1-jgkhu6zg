"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabase/client";

type RuleItem = { rule: string; trigger: string };

function isoToday(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function mondayStartISO(d: Date): string {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* -------------------------
   Chapter 7 placeholder (keeps route safe)
   If you already have a Chapter 7 lead page elsewhere, this will still work.
------------------------- */
function Chapter7Lead() {
  const weekStart = useMemo(() => mondayStartISO(new Date()), []);

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="text-xl font-semibold text-[#6B4A2E]">Stable Ground</div>
      <div className="mt-1 text-sm text-gray-600">Chapter 7 — Scale + Lead</div>

      <div className="mt-6 rounded-xl border bg-white p-4 text-sm text-gray-700">
        This route is active. Week start: <span className="font-medium">{weekStart}</span>
        <div className="mt-3">
          <Link className="underline text-[#1C6F66]" href="/chapters/7">
            Back to Chapter 7 →
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <Link className="rounded-lg border px-4 py-2 text-sm" href="/chapters">
          Back to Chapters
        </Link>
      </div>
    </main>
  );
}

/* -------------------------
   Chapter 8 — Leadership Compass
------------------------- */
function Chapter8Compass() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const [identity, setIdentity] = useState("I lead with clarity, calm execution, and clean boundaries.");
  const [values, setValues] = useState<string[]>(["Stability", "Integrity", "Quality", "Family", "Cash discipline"]);
  const [nonneg, setNonneg] = useState<string[]>(["No chaos commitments", "No unpaid scope creep", "Cash before expansion"]);
  const [boundaries, setBoundaries] = useState<string[]>([
    "Work window: 7–10pm",
    "No new work if delivery behind",
    "Friday review only",
    "One channel at a time",
    "One theme per week",
  ]);

  const [hoursPerWeek, setHoursPerWeek] = useState("5–15");
  const [peakHours, setPeakHours] = useState("7–10pm");
  const [hardStop, setHardStop] = useState("10:15pm");
  const [noWorkDay, setNoWorkDay] = useState("Sunday");

  const [rules, setRules] = useState<RuleItem[]>([
    { rule: "If it does not move revenue or delivery, it waits.", trigger: "When tempted to add a new task" },
    { rule: "If a request is not a clear yes, it is a no.", trigger: "When someone asks for extra work" },
    { rule: "If cash is tight, cut scope before adding hours.", trigger: "When stress spikes" },
  ]);

  const [notes, setNotes] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const ok = !!data.session;
      setSignedIn(ok);

      if (!ok) {
        setLoading(false);
        return;
      }

      const { data: row } = await supabase
        .from("leadership_compass")
        .select("*")
        .eq("chapter_id", 8)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (row) {
        setIdentity(row.identity_statement ?? "");
        setValues(Array.isArray(row.values) ? row.values : []);
        setNonneg(Array.isArray(row.nonnegotiables) ? row.nonnegotiables : []);
        setBoundaries(Array.isArray(row.boundaries) ? row.boundaries : []);
        const eb = row.energy_budget ?? {};
        setHoursPerWeek(String(eb.hours_per_week ?? hoursPerWeek));
        setPeakHours(String(eb.peak_hours ?? peakHours));
        setHardStop(String(eb.hard_stop ?? hardStop));
        setNoWorkDay(String(eb.no_work_day ?? noWorkDay));
        setRules(Array.isArray(row.leadership_rules) ? row.leadership_rules : []);
        setNotes(row.notes ?? "");
      }

      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      if (!mounted) return;
      setSignedIn(!!sess);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setAt(setter: (v: any) => void, arr: string[], i: number, v: string) {
    const next = [...arr];
    next[i] = v;
    setter(next);
  }

  function setRule(i: number, patch: Partial<RuleItem>) {
    setRules((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  async function save() {
    setStatus("");
    if (!signedIn) {
      setStatus("Sign in to save.");
      return;
    }

    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      setSaving(false);
      setStatus("Sign in to save.");
      return;
    }

    const payload = {
      user_id: userId,
      chapter_id: 8,
      identity_statement: identity,
      values,
      nonnegotiables: nonneg,
      boundaries,
      energy_budget: {
        hours_per_week: hoursPerWeek,
        peak_hours: peakHours,
        hard_stop: hardStop,
        no_work_day: noWorkDay,
      },
      leadership_rules: rules,
      notes,
    };

    const { error } = await supabase
      .from("leadership_compass")
      .upsert(payload, { onConflict: "user_id,chapter_id" });

    setSaving(false);

    if (error) {
      setStatus(`Save failed: ${error.message}`);
      return;
    }

    setStatus("Saved.");
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="text-xl font-semibold text-[#6B4A2E]">Stable Ground</div>
        <div className="mt-6 rounded-xl border bg-white p-4">Loading…</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="text-xl font-semibold text-[#6B4A2E]">Stable Ground</div>
      <div className="mt-1 text-sm text-gray-600">Chapter 8 — Leadership Compass</div>

      {!signedIn && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          You can read this page. Sign in to save.
          <div className="mt-2">
            <Link className="underline" href="/settings">
              Go to Settings →
            </Link>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border bg-white p-4">
        <div className="font-semibold text-[#6B4A2E]">Your leadership statement</div>
        <textarea className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" rows={3} value={identity} onChange={(e) => setIdentity(e.target.value)} />

        <div className="mt-5 rounded-lg border p-3">
          <div className="font-medium text-gray-800">Values (5)</div>
          <div className="mt-2 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <input
                key={i}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={values[i] ?? ""}
                onChange={(e) => setAt(setValues, values, i, e.target.value)}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-lg border p-3">
          <div className="font-medium text-gray-800">Non-negotiables (3)</div>
          <div className="mt-2 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <input
                key={i}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={nonneg[i] ?? ""}
                onChange={(e) => setAt(setNonneg, nonneg, i, e.target.value)}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-lg border p-3">
          <div className="font-medium text-gray-800">Boundaries (5)</div>
          <div className="mt-2 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <input
                key={i}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={boundaries[i] ?? ""}
                onChange={(e) => setAt(setBoundaries, boundaries, i, e.target.value)}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-lg border p-3">
          <div className="font-medium text-gray-800">Capacity</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-medium text-gray-600">Hours/week</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} />
            </div>
            <div>
              <div className="text-xs font-medium text-gray-600">Peak hours</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={peakHours} onChange={(e) => setPeakHours(e.target.value)} />
            </div>
            <div>
              <div className="text-xs font-medium text-gray-600">Hard stop</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={hardStop} onChange={(e) => setHardStop(e.target.value)} />
            </div>
            <div>
              <div className="text-xs font-medium text-gray-600">No-work day</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={noWorkDay} onChange={(e) => setNoWorkDay(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border p-3">
          <div className="font-medium text-gray-800">Personal rules (3)</div>
          <div className="mt-2 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="text-xs font-medium text-gray-600">Rule</div>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={rules[i]?.rule ?? ""}
                  onChange={(e) => setRule(i, { rule: e.target.value })}
                />
                <div className="mt-2 text-xs font-medium text-gray-600">Trigger</div>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={rules[i]?.trigger ?? ""}
                  onChange={(e) => setRule(i, { trigger: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-sm font-medium text-gray-700">Notes</div>
          <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="mt-5 rounded-lg border bg-gray-50 p-3 text-sm">
          <div className="font-semibold text-gray-800">Preview</div>
          <div className="mt-2 text-gray-700">{identity}</div>
          <div className="mt-3 text-gray-800 font-medium">Non-negotiables</div>
          <ul className="mt-1 list-disc pl-5 text-gray-700">
            {nonneg.filter(Boolean).map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
          <div className="mt-3 text-gray-800 font-medium">Capacity</div>
          <div className="mt-1 text-gray-700">
            {hoursPerWeek} hrs/week • peak {peakHours} • hard stop {hardStop} • no-work {noWorkDay}
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button className="rounded-lg bg-[#1C6F66] px-4 py-2 text-sm font-medium text-white" onClick={save} type="button" disabled={saving}>
            {saving ? "Saving…" : "Save compass"}
          </button>

          <Link className="rounded-lg border px-4 py-2 text-sm" href="/chapters/8">
            Back
          </Link>
        </div>

        {status && <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm text-gray-700">{status}</div>}

        <div className="mt-3 text-center text-xs text-gray-500">Today: {isoToday()}</div>
      </div>
    </main>
  );
}

/* -------------------------
   Route switch
------------------------- */
export default function LeadPage({ params }: { params: { chapter: string } }) {
  const chapterId = useMemo(() => Number(params.chapter), [params.chapter]);

  if (chapterId === 8) return <Chapter8Compass />;
  if (chapterId === 7) return <Chapter7Lead />;

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="text-xl font-semibold text-[#6B4A2E]">Stable Ground</div>
      <div className="mt-6 rounded-xl border bg-white p-4 text-sm text-gray-700">This page is for Chapter 7 or Chapter 8.</div>
      <div className="mt-4">
        <Link className="underline text-sm text-[#1C6F66]" href="/chapters">
          Back to Chapters →
        </Link>
      </div>
    </main>
  );
}
