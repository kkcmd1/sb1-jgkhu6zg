"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type PlanTask = { id: string; text: string; done: boolean };
type PlanData = { tasks: PlanTask[] };

function toISODate(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function getWeekStartMonday(today: Date) {
  // Monday as week start
  const d = new Date(today);
  const day = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function defaultPlanData(): PlanData {
  return {
    tasks: [
      { id: "mon_kickoff_numbers", text: "Monday: Review last week numbers", done: false },
      { id: "mon_kickoff_priorities", text: "Monday: Set 3 priorities for this week", done: false },
      { id: "mon_kickoff_compliance", text: "Monday: Check compliance tasks", done: false },
      { id: "daily_morning", text: "Daily: Morning routine", done: false },
      { id: "daily_midday", text: "Daily: Midday routine", done: false },
      { id: "daily_endofday", text: "Daily: End-of-day routine", done: false },
      { id: "fri_review", text: "Friday: What worked / what didn’t", done: false },
      { id: "fri_metrics", text: "Friday: Update key metrics", done: false },
      { id: "fri_nextweek", text: "Friday: Plan next week", done: false },
    ],
  };
}

export default function PlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [planId, setPlanId] = useState<string>("");
  const [weekStart, setWeekStart] = useState<string>("");
  const [weekEnd, setWeekEnd] = useState<string>("");
  const [planData, setPlanData] = useState<PlanData>(defaultPlanData());

  const completion = useMemo(() => {
    const tasks = Array.isArray((planData as any)?.tasks) ? (planData as any).tasks : [];
    const total = tasks.length || 1;
    const done = tasks.filter((t: any) => t?.done).length;
    return Math.round((done / total) * 100);
  }, [planData]);
  

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        router.replace("/auth");
        return;
      }

      const userId = session.user.id;

      const start = getWeekStartMonday(new Date());
      const end = addDays(start, 6);

      const weekStartDate = toISODate(start);
      const weekEndDate = toISODate(end);

      setWeekStart(weekStartDate);
      setWeekEnd(weekEndDate);

      // Mark other weeks as not current (keeps “current week” clean)
      await supabase
        .from("weekly_plans")
        .update({ is_current: false })
        .eq("user_id", userId)
        .neq("week_start_date", weekStartDate);

      // Get the plan for this user + week (0 or 1 row because of unique index)
      const { data: existing, error: selErr } = await supabase
        .from("weekly_plans")
        .select("id, plan_data, completion_percentage")
        .eq("user_id", userId)
        .eq("week_start_date", weekStartDate)
        .limit(1)
        .maybeSingle();

      if (selErr) {
        setError(selErr.message);
        setLoading(false);
        return;
      }

      if (existing?.id) {
        setPlanId(existing.id);
      
        const candidate: any = existing.plan_data;
        const starter = defaultPlanData();
      
        const isValid = candidate && Array.isArray(candidate.tasks);
      
        if (isValid) {
          setPlanData(candidate);
        } else {
          // Bad/old shape in DB → repair it
          setPlanData(starter);
          await supabase
            .from("weekly_plans")
            .update({ plan_data: starter, completion_percentage: 0 })
            .eq("id", existing.id);
        }
      
        setLoading(false);
      
        await supabase
          .from("weekly_plans")
          .update({ is_current: true })
          .eq("id", existing.id);
      
        return;
      }
      

      // Create plan if it doesn’t exist
      const starter = defaultPlanData();

      const { data: created, error: insErr } = await supabase
        .from("weekly_plans")
        .insert({
          user_id: userId,
          week_start_date: weekStartDate,
          week_end_date: weekEndDate,
          is_current: true,
          plan_data: starter,
          completion_percentage: 0,
        })
        .select("id, plan_data")
        .single();

      if (insErr) {
        setError(insErr.message);
        setLoading(false);
        return;
      }

      setPlanId(created.id);
      setPlanData((created.plan_data as any) || starter);
      setLoading(false);
    })();
  }, [router]);

  async function toggleTask(taskId: string) {
    if (!planId) return;

    setSaving(true);
    setError("");

    const currentTasks: PlanTask[] = Array.isArray((planData as any)?.tasks)
  ? (planData as any).tasks
  : defaultPlanData().tasks;

const next: PlanData = {
  tasks: currentTasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
};


    setPlanData(next);

    const total = next.tasks.length || 1;
    const done = next.tasks.filter((t) => t.done).length;
    const nextPct = Math.round((done / total) * 100);

    const { error: upErr } = await supabase
      .from("weekly_plans")
      .update({
        plan_data: next,
        completion_percentage: nextPct,
      })
      .eq("id", planId);

    if (upErr) setError(upErr.message);

    setSaving(false);
  }

  if (loading) {
    return <div className="p-4 text-sm">Loading your plan…</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="text-2xl font-bold text-[#6B4A2E]">My Plan</div>
        <div className="text-sm text-[#9CA3AF]">
          Week of {weekStart} to {weekEnd}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-white p-3 text-sm text-[#374151]">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <div className="text-sm text-[#6B4A2E]">
          Completion: {completion}% {saving ? " (saving…)" : ""}
        </div>

        <div className="space-y-2">
          {planData.tasks.map((t) => (
            <label key={t.id} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggleTask(t.id)}
                className="mt-1 h-5 w-5"
              />
              <span className={t.done ? "text-[#9CA3AF] line-through" : "text-[#374151]"}>
                {t.text}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}