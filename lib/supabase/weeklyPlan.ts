import { supabase } from "@/lib/supabase/client";

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeek(monday: Date) {
  const x = new Date(monday);
  x.setDate(x.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export type PlanData = {
  mondayKickoff: { id: string; text: string; done: boolean }[];
  daily: { id: string; text: string; done: boolean }[];
  fridayCloseout: { id: string; text: string; done: boolean }[];
  notes: string;
};

export function defaultPlanData(): PlanData {
  return {
    mondayKickoff: [
      { id: "mk1", text: "Review last week numbers", done: false },
      { id: "mk2", text: "Pick 3 priorities for this week", done: false },
      { id: "mk3", text: "Check compliance tasks", done: false },
    ],
    daily: [
      { id: "d1", text: "Inbox clear (reply/flag)", done: false },
      { id: "d2", text: "Invoices sent", done: false },
      { id: "d3", text: "Payments tracked", done: false },
      { id: "d4", text: "Receipts saved", done: false },
      { id: "d5", text: "Reconcile accounts", done: false },
    ],
    fridayCloseout: [
      { id: "fc1", text: "Review: what worked / what didn’t", done: false },
      { id: "fc2", text: "Update key metrics", done: false },
      { id: "fc3", text: "Draft next week priorities", done: false },
    ],
    notes: "",
  };
}

export async function getOrCreateCurrentWeeklyPlan() {
  const { data: u } = await supabase.auth.getUser();
  const user = u.user;
  if (!user) return { ok: false, error: "No signed-in user." };

  const now = new Date();
  const mon = startOfWeek(now);
  const sun = endOfWeek(mon);

  const existing = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("user_id", user.id)
    .eq("week_start_date", isoDate(mon))
    .maybeSingle();

  if (existing.error) return { ok: false, error: existing.error.message };
  if (existing.data) return { ok: true, row: existing.data };

  // Clear any old "is_current" flags
  await supabase
    .from("weekly_plans")
    .update({ is_current: false })
    .eq("user_id", user.id)
    .eq("is_current", true);

  const insert = await supabase.from("weekly_plans").insert({
    user_id: user.id,
    week_start_date: isoDate(mon),
    week_end_date: isoDate(sun),
    is_current: true,
    plan_data: defaultPlanData(),
    completion_percentage: 0,
  }).select("*").single();

  if (insert.error) return { ok: false, error: insert.error.message };
  return { ok: true, row: insert.data };
}

export async function saveWeeklyPlan(planId: string, planData: PlanData) {
  const doneCount =
    planData.mondayKickoff.filter((x) => x.done).length +
    planData.daily.filter((x) => x.done).length +
    planData.fridayCloseout.filter((x) => x.done).length;

  const totalCount =
    planData.mondayKickoff.length + planData.daily.length + planData.fridayCloseout.length;

  const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  const upd = await supabase
    .from("weekly_plans")
    .update({
      plan_data: planData,
      completion_percentage: pct,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId)
    .select("*")
    .single();

  if (upd.error) return { ok: false, error: upd.error.message };
  return { ok: true, row: upd.data };
}