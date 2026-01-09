"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabase/client";

/* -------------------------
   Helpers
------------------------- */
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

function isoToday(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* =========================
   CHAPTER 7 (existing scorecard)
========================= */
type Item = { name: string; target: string; redFlag?: string };

function Chapter7Metrics({ chapterId }: { chapterId: number }) {
  const weekStart = useMemo(() => mondayStartISO(new Date()), []);

  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const [northStarName, setNorthStarName] = useState("Cash collected");
  const [northStarTarget, setNorthStarTarget] = useState("$500 this week");

  const [leading, setLeading] = useState<Item[]>([
    { name: "Outbound messages sent", target: "25", redFlag: "<10" },
    { name: "Follow-ups completed", target: "15", redFlag: "<5" },
    { name: "Delivery blocks finished", target: "5", redFlag: "<3" },
  ]);

  const [health, setHealth] = useState<Item[]>([
    { name: "Overdue delivery items", target: "0", redFlag: ">0" },
    { name: "Owner burnout signal", target: "Low", redFlag: "High" },
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
        .from("leadership_scorecards")
        .select("*")
        .eq("chapter_id", 7)
        .eq("week_start_date", weekStart)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (row) {
        setNorthStarName(row.north_star_name ?? "");
        setNorthStarTarget(row.north_star_target ?? "");
        setLeading(Array.isArray(row.leading_indicators) ? row.leading_indicators : []);
        setHealth(Array.isArray(row.health_checks) ? row.health_checks : []);
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
  }, [weekStart]);

  function updateList(setter: (v: any) => void, list: Item[], i: number, patch: Partial<Item>) {
    setter(list.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
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
      chapter_id: 7,
      week_start_date: weekStart,
      north_star_name: northStarName,
      north_star_target: northStarTarget,
      leading_indicators: leading,
      health_checks: health,
      notes,
    };

    const { error } = await supabase
      .from("leadership_scorecards")
      .upsert(payload, { onConflict: "user_id,chapter_id,week_start_date" });

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
      <div className="mt-1 text-sm text-gray-600">Chapter {chapterId} — Leadership Scorecard</div>

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
        <div className="font-semibold text-[#6B4A2E]">Week of {weekStart}</div>

        <div className="mt-4">
          <div className="text-sm font-medium text-gray-700">North star</div>
          <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={northStarName} onChange={(e) => setNorthStarName(e.target.value)} />
          <div className="mt-2 text-sm font-medium text-gray-700">Target</div>
          <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={northStarTarget} onChange={(e) => setNorthStarTarget(e.target.value)} />
        </div>

        <div className="mt-5 rounded-lg border p-3">
          <div className="font-medium text-gray-800">Leading indicators</div>
          <div className="mt-2 space-y-3">
            {leading.map((x, i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="text-xs font-medium text-gray-600">Metric</div>
                <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={x.name} onChange={(e) => updateList(setLeading, leading, i, { name: e.target.value })} />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs font-medium text-gray-600">Weekly target</div>
                    <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={x.target} onChange={(e) => updateList(setLeading, leading, i, { target: e.target.value })} />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-600">Red flag</div>
                    <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={x.redFlag ?? ""} onChange={(e) => updateList(setLeading, leading, i, { redFlag: e.target.value })} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-lg border p-3">
          <div className="font-medium text-gray-800">Health checks</div>
          <div className="mt-2 space-y-3">
            {health.map((x, i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="text-xs font-medium text-gray-600">Metric</div>
                <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={x.name} onChange={(e) => updateList(setHealth, health, i, { name: e.target.value })} />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs font-medium text-gray-600">Target</div>
                    <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={x.target} onChange={(e) => updateList(setHealth, health, i, { target: e.target.value })} />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-600">Red flag</div>
                    <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={x.redFlag ?? ""} onChange={(e) => updateList(setHealth, health, i, { redFlag: e.target.value })} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-sm font-medium text-gray-700">Notes</div>
          <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="mt-5 flex gap-3">
          <button className="rounded-lg bg-[#1C6F66] px-4 py-2 text-sm font-medium text-white" onClick={save} type="button" disabled={saving}>
            {saving ? "Saving…" : "Save scorecard"}
          </button>

          <Link className="rounded-lg border px-4 py-2 text-sm" href={`/chapters/${chapterId}`}>
            Back
          </Link>
        </div>

        {status && <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm text-gray-700">{status}</div>}
      </div>
    </main>
  );
}

/* =========================
   CHAPTER 8 (Season Plan + Decision Log)
========================= */
type Outcome = { outcome: string; metric: string; target_date: string };

function Chapter8Season({ chapterId }: { chapterId: number }) {
  const startDate = useMemo(() => isoToday(), []);

  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const [theme, setTheme] = useState("Stabilize cash flow and protect time");
  const [outcomes, setOutcomes] = useState<Outcome[]>([
    { outcome: "Weekly revenue consistency", metric: "$500/week", target_date: "" },
    { outcome: "Delivery on-time rate", metric: "100% on-time", target_date: "" },
    { outcome: "Admin under control", metric: "1 weekly admin block", target_date: "" },
  ]);
  const [habits, setHabits] = useState<string[]>(["Daily 15-min follow-up", "Weekly plan every Monday", "Friday review + cleanup"]);
  const [stopList, setStopList] = useState<string[]>(["Random new projects", "Unpaid extra work", "Busywork social scrolling"]);
  const [support, setSupport] = useState<string[]>(["Ask family for one protected work block", "Use templates for repeat messages"]);
  const [weeklyDay, setWeeklyDay] = useState("Friday");
  const [weeklyTime, setWeeklyTime] = useState("8:30pm");
  const [monthlyCheck, setMonthlyCheck] = useState("Last Friday of month");
  const [notes, setNotes] = useState("");

  // decision log
  const [decisions, setDecisions] = useState<any[]>([]);
  const [dDecision, setDDecision] = useState("");
  const [dPrinciple, setDPrinciple] = useState("Cash + delivery first");
  const [dRisk, setDRisk] = useState("");
  const [dNext, setDNext] = useState("");
  const [dStatus, setDStatus] = useState("open");
  const [savingDecision, setSavingDecision] = useState(false);

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

      const { data: planRow } = await supabase
        .from("season_plans")
        .select("*")
        .eq("chapter_id", 8)
        .eq("start_date", startDate)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (planRow) {
        setTheme(planRow.theme ?? "");
        setOutcomes(Array.isArray(planRow.outcomes) ? planRow.outcomes : []);
        setHabits(Array.isArray(planRow.weekly_habits) ? planRow.weekly_habits : []);
        setStopList(Array.isArray(planRow.stop_list) ? planRow.stop_list : []);
        setSupport(Array.isArray(planRow.support_requests) ? planRow.support_requests : []);
        const rs = planRow.review_schedule ?? {};
        setWeeklyDay(String(rs.weekly_day ?? weeklyDay));
        setWeeklyTime(String(rs.weekly_time ?? weeklyTime));
        setMonthlyCheck(String(rs.monthly_check ?? monthlyCheck));
        setNotes(planRow.notes ?? "");
      }

      const { data: decRows } = await supabase
        .from("decision_logs")
        .select("*")
        .eq("chapter_id", 8)
        .order("created_at", { ascending: false })
        .limit(20);

      setDecisions(decRows ?? []);
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
  }, [startDate]);

  function setOutcome(i: number, patch: Partial<Outcome>) {
    setOutcomes((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function setAt(setter: (v: any) => void, arr: string[], i: number, v: string) {
    const next = [...arr];
    next[i] = v;
    setter(next);
  }

  async function savePlan() {
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
      start_date: startDate,
      horizon_days: 90,
      theme,
      outcomes,
      weekly_habits: habits,
      stop_list: stopList,
      support_requests: support,
      review_schedule: { weekly_day: weeklyDay, weekly_time: weeklyTime, monthly_check: monthlyCheck },
      notes,
    };

    const { error } = await supabase
      .from("season_plans")
      .upsert(payload, { onConflict: "user_id,chapter_id,start_date" });

    setSaving(false);

    if (error) {
      setStatus(`Save failed: ${error.message}`);
      return;
    }
    setStatus("Saved.");
  }

  async function addDecision() {
    if (!signedIn) {
      setStatus("Sign in to save.");
      return;
    }
    setSavingDecision(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      setSavingDecision(false);
      setStatus("Sign in to save.");
      return;
    }

    const payload = {
      user_id: userId,
      chapter_id: 8,
      decision_date: startDate,
      decision: dDecision,
      principle: dPrinciple,
      risk: dRisk,
      next_step: dNext,
      status: dStatus,
    };

    const { error } = await supabase.from("decision_logs").insert(payload);

    if (error) {
      setSavingDecision(false);
      setStatus(`Save failed: ${error.message}`);
      return;
    }

    const { data: decRows } = await supabase
      .from("decision_logs")
      .select("*")
      .eq("chapter_id", 8)
      .order("created_at", { ascending: false })
      .limit(20);

    setDecisions(decRows ?? []);
    setDDecision("");
    setDRisk("");
    setDNext("");
    setDStatus("open");
    setSavingDecision(false);
    setStatus("Decision saved.");
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
      <div className="mt-1 text-sm text-gray-600">Chapter {chapterId} — Season Plan + Decisions</div>

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
        <div className="font-semibold text-[#6B4A2E]">Season start: {startDate}</div>

        <div className="mt-4">
          <div className="text-sm font-medium text-gray-700">Theme</div>
          <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={theme} onChange={(e) => setTheme(e.target.value)} />
        </div>

        <div className="mt-4 rounded-lg border p-3">
          <div className="font-medium text-gray-800">Outcomes (3)</div>
          <div className="mt-2 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="text-xs font-medium text-gray-600">Outcome</div>
                <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={outcomes[i]?.outcome ?? ""} onChange={(e) => setOutcome(i, { outcome: e.target.value })} />
                <div className="mt-2 text-xs font-medium text-gray-600">Metric</div>
                <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={outcomes[i]?.metric ?? ""} onChange={(e) => setOutcome(i, { metric: e.target.value })} />
                <div className="mt-2 text-xs font-medium text-gray-600">Target date (optional)</div>
                <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={outcomes[i]?.target_date ?? ""} onChange={(e) => setOutcome(i, { target_date: e.target.value })} placeholder="YYYY-MM-DD" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-lg border p-3">
          <div className="font-medium text-gray-800">Weekly habits (3)</div>
          <div className="mt-2 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <input key={i} className="w-full rounded-lg border px-3 py-2 text-sm" value={habits[i] ?? ""} onChange={(e) => setAt(setHabits, habits, i, e.target.value)} />
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-lg border p-3">
          <div className="font-medium text-gray-800">Stop list (3)</div>
          <div className="mt-2 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <input key={i} className="w-full rounded-lg border px-3 py-2 text-sm" value={stopList[i] ?? ""} onChange={(e) => setAt(setStopList, stopList, i, e.target.value)} />
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-lg border p-3">
          <div className="font-medium text-gray-800">Support requests (2)</div>
          <div className="mt-2 space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <input key={i} className="w-full rounded-lg border px-3 py-2 text-sm" value={support[i] ?? ""} onChange={(e) => setAt(setSupport, support, i, e.target.value)} />
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-lg border p-3">
          <div className="font-medium text-gray-800">Review schedule</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-medium text-gray-600">Weekly day</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={weeklyDay} onChange={(e) => setWeeklyDay(e.target.value)} />
            </div>
            <div>
              <div className="text-xs font-medium text-gray-600">Weekly time</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={weeklyTime} onChange={(e) => setWeeklyTime(e.target.value)} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xs font-medium text-gray-600">Monthly check</div>
            <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={monthlyCheck} onChange={(e) => setMonthlyCheck(e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <div className="text-sm font-medium text-gray-700">Notes</div>
          <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="mt-5 flex gap-3">
          <button className="rounded-lg bg-[#1C6F66] px-4 py-2 text-sm font-medium text-white" onClick={savePlan} type="button" disabled={saving}>
            {saving ? "Saving…" : "Save season plan"}
          </button>

          <Link className="rounded-lg border px-4 py-2 text-sm" href={`/chapters/${chapterId}`}>
            Back
          </Link>
        </div>

        {status && <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm text-gray-700">{status}</div>}
      </div>

      <div className="mt-5 rounded-xl border bg-white p-4">
        <div className="font-semibold text-[#6B4A2E]">Decision log</div>

        <div className="mt-3 space-y-2">
          <div className="text-xs font-medium text-gray-600">Decision</div>
          <input className="w-full rounded-lg border px-3 py-2 text-sm" value={dDecision} onChange={(e) => setDDecision(e.target.value)} placeholder="What decision are you making?" />
          <div className="text-xs font-medium text-gray-600">Principle</div>
          <input className="w-full rounded-lg border px-3 py-2 text-sm" value={dPrinciple} onChange={(e) => setDPrinciple(e.target.value)} />
          <div className="text-xs font-medium text-gray-600">Risk</div>
          <input className="w-full rounded-lg border px-3 py-2 text-sm" value={dRisk} onChange={(e) => setDRisk(e.target.value)} placeholder="What could go wrong?" />
          <div className="text-xs font-medium text-gray-600">Next step</div>
          <input className="w-full rounded-lg border px-3 py-2 text-sm" value={dNext} onChange={(e) => setDNext(e.target.value)} placeholder="One next action" />

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs font-medium text-gray-600">Status</div>
              <select className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={dStatus} onChange={(e) => setDStatus(e.target.value)}>
                <option value="open">open</option>
                <option value="done">done</option>
                <option value="killed">killed</option>
              </select>
            </div>
            <div className="flex items-end">
              <button className="w-full rounded-lg bg-[#1C6F66] px-4 py-2 text-sm font-medium text-white" onClick={addDecision} type="button" disabled={savingDecision}>
                {savingDecision ? "Saving…" : "Add decision"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {decisions.length === 0 ? (
            <div className="text-sm text-gray-600">No decisions saved yet.</div>
          ) : (
            decisions.map((d) => (
              <div key={d.id} className="rounded-lg border p-3">
                <div className="text-xs text-gray-500">{d.decision_date} • {d.status}</div>
                <div className="mt-1 font-medium text-gray-800">{d.decision}</div>
                <div className="mt-1 text-sm text-gray-700"><span className="font-medium">Principle:</span> {d.principle}</div>
                {d.risk && <div className="mt-1 text-sm text-gray-700"><span className="font-medium">Risk:</span> {d.risk}</div>}
                {d.next_step && <div className="mt-1 text-sm text-gray-700"><span className="font-medium">Next:</span> {d.next_step}</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

/* =========================
   Router
========================= */
export default function MetricsPage({ params }: { params: { chapter: string } }) {
  const chapterId = useMemo(() => Number(params.chapter), [params.chapter]);

  if (chapterId === 7) return <Chapter7Metrics chapterId={chapterId} />;
  if (chapterId === 8) return <Chapter8Season chapterId={chapterId} />;

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="text-xl font-semibold text-[#6B4A2E]">Stable Ground</div>
      <div className="mt-6 rounded-xl border bg-white p-4">This page is for Chapter 7 or 8.</div>
      <div className="mt-4">
        <Link className="underline text-sm text-[#1C6F66]" href="/chapters">
          Back to Chapters →
        </Link>
      </div>
    </main>
  );
}
