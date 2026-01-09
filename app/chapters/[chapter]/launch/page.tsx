"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabase/client";

type Plan = {
  offer: string;
  channel: string;
  dailyMinutes: string;
  budget: string;
  days1to3: string[];
  days4to7: string[];
  days8to14: string[];
  successGreen: string;
  successYellow: string;
  successRed: string;
};

function isoToday(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function LaunchPage({ params }: { params: { chapter: string } }) {
  const chapterId = useMemo(() => Number(params.chapter), [params.chapter]);
  const startDate = useMemo(() => isoToday(), []);

  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const [plan, setPlan] = useState<Plan>({
    offer: "One clear offer",
    channel: "One channel",
    dailyMinutes: "30",
    budget: "$0",
    days1to3: ["Day 1: Write offer + hook", "Day 2: Build simple page / post", "Day 3: Collect first replies"],
    days4to7: ["Day 4: Go live", "Day 5: Engage + DM follow-ups", "Day 6: Ask for calls / deposits", "Day 7: Review objections"],
    days8to14: ["Days 8–10: Repeat best post + follow up", "Days 11–14: Tighten offer + ask again"],
    successGreen: "10+ conversations OR 2+ conversions",
    successYellow: "Some replies, low conversions",
    successRed: "No replies after 3 tries",
  });

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
        .from("launch_sprints")
        .select("*")
        .eq("chapter_id", 7)
        .eq("start_date", startDate)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (row?.plan) {
        setPlan(row.plan);
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
  }, [startDate]);

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
      start_date: startDate,
      plan,
    };

    const { error } = await supabase
      .from("launch_sprints")
      .upsert(payload, { onConflict: "user_id,chapter_id,start_date" });

    setSaving(false);

    if (error) {
      setStatus(`Save failed: ${error.message}`);
      return;
    }
    setStatus("Saved.");
  }

  function setLine(listKey: keyof Plan, index: number, value: string) {
    setPlan((p) => {
      const arr = Array.isArray(p[listKey]) ? ([...p[listKey]] as string[]) : [];
      arr[index] = value;
      return { ...p, [listKey]: arr } as Plan;
    });
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
      <div className="mt-1 text-sm text-gray-600">
        Chapter {chapterId} — 14-Day Leverage Sprint
      </div>

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
        <div className="font-semibold text-[#6B4A2E]">Start date: {startDate}</div>

        <div className="mt-4 space-y-3">
          <div>
            <div className="text-sm font-medium text-gray-700">Offer</div>
            <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={plan.offer} onChange={(e) => setPlan((p) => ({ ...p, offer: e.target.value }))} />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-700">Channel</div>
            <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={plan.channel} onChange={(e) => setPlan((p) => ({ ...p, channel: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-sm font-medium text-gray-700">Minutes/day</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={plan.dailyMinutes} onChange={(e) => setPlan((p) => ({ ...p, dailyMinutes: e.target.value }))} />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700">Budget</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={plan.budget} onChange={(e) => setPlan((p) => ({ ...p, budget: e.target.value }))} />
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="font-medium text-gray-800">Pre-launch (Days 1–3)</div>
            <div className="mt-2 space-y-2">
              {plan.days1to3.map((x, i) => (
                <input key={i} className="w-full rounded-lg border px-3 py-2 text-sm" value={x} onChange={(e) => setLine("days1to3", i, e.target.value)} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="font-medium text-gray-800">Launch (Days 4–7)</div>
            <div className="mt-2 space-y-2">
              {plan.days4to7.map((x, i) => (
                <input key={i} className="w-full rounded-lg border px-3 py-2 text-sm" value={x} onChange={(e) => setLine("days4to7", i, e.target.value)} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="font-medium text-gray-800">Momentum (Days 8–14)</div>
            <div className="mt-2 space-y-2">
              {plan.days8to14.map((x, i) => (
                <input key={i} className="w-full rounded-lg border px-3 py-2 text-sm" value={x} onChange={(e) => setLine("days8to14", i, e.target.value)} />
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="font-medium text-gray-800">Success criteria</div>
            <div className="mt-2 space-y-2">
              <div>
                <div className="text-xs font-medium text-gray-600">Green</div>
                <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={plan.successGreen} onChange={(e) => setPlan((p) => ({ ...p, successGreen: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-600">Yellow</div>
                <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={plan.successYellow} onChange={(e) => setPlan((p) => ({ ...p, successYellow: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-600">Red</div>
                <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={plan.successRed} onChange={(e) => setPlan((p) => ({ ...p, successRed: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button className="rounded-lg bg-[#1C6F66] px-4 py-2 text-sm font-medium text-white" onClick={save} type="button" disabled={saving}>
            {saving ? "Saving…" : "Save sprint"}
          </button>
          <Link className="rounded-lg border px-4 py-2 text-sm" href={`/chapters/${chapterId}`}>
            Back
          </Link>
        </div>

        {status && (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm text-gray-700">
            {status}
          </div>
        )}
      </div>
    </main>
  );
}
