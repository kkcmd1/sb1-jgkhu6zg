"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const { session, loading } = useSession();

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");

  const [businessType, setBusinessType] = useState("solo");
  const [businessStage, setBusinessStage] = useState("just_starting");
  const [biggestChallenge, setBiggestChallenge] = useState("operations");
  const [entityType, setEntityType] = useState("not_sure");
  const [primaryGoal, setPrimaryGoal] = useState("stability");

  useEffect(() => {
    if (!loading && !session) router.push("/auth");
  }, [loading, session, router]);

  async function save() {
    setSaving(true);
    setErr("");

    const { data: u } = await supabase.auth.getUser();
    const user = u.user;
    if (!user) {
      setErr("No signed-in user.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("user_profiles")
      .update({
        business_type: businessType,
        business_stage: businessStage,
        biggest_challenge: biggestChallenge,
        entity_type: entityType,
        primary_goal: primaryGoal,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }

    router.push("/chapters");
  }

  if (loading) return <div>Loading…</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#6B4A2E]">Onboarding</h1>
      <p className="text-sm text-[#374151]">
        5 quick answers so the app can sort what to show first.
      </p>

      {err ? (
        <div className="rounded-md border border-red-200 bg-white p-3 text-sm">
          <div className="font-semibold">Error</div>
          <div className="text-[#374151]">{err}</div>
        </div>
      ) : null}

      <div className="space-y-2 rounded-md border bg-white p-3">
        <label className="text-sm font-medium text-[#6B4A2E]">
          What best describes your business?
        </label>
        <select
          className="w-full rounded-md border p-2"
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
        >
          <option value="solo">Solo founder</option>
          <option value="small_team">Small team (1–5)</option>
          <option value="established">Established (5–20)</option>
        </select>
      </div>

      <div className="space-y-2 rounded-md border bg-white p-3">
        <label className="text-sm font-medium text-[#6B4A2E]">
          How long have you been operating?
        </label>
        <select
          className="w-full rounded-md border p-2"
          value={businessStage}
          onChange={(e) => setBusinessStage(e.target.value)}
        >
          <option value="just_starting">Just starting</option>
          <option value="0_1_year">0–1 year</option>
          <option value="1_3_years">1–3 years</option>
          <option value="3plus_years">3+ years</option>
        </select>
      </div>

      <div className="space-y-2 rounded-md border bg-white p-3">
        <label className="text-sm font-medium text-[#6B4A2E]">
          Biggest challenge right now
        </label>
        <select
          className="w-full rounded-md border p-2"
          value={biggestChallenge}
          onChange={(e) => setBiggestChallenge(e.target.value)}
        >
          <option value="legal">Legal / structure</option>
          <option value="customers">Finding customers</option>
          <option value="money">Money management</option>
          <option value="operations">Operations chaos</option>
          <option value="scaling">Scaling</option>
          <option value="leadership">Leadership</option>
        </select>
      </div>

      <div className="space-y-2 rounded-md border bg-white p-3">
        <label className="text-sm font-medium text-[#6B4A2E]">
          Do you have a legal business entity?
        </label>
        <select
          className="w-full rounded-md border p-2"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        >
          <option value="llc">Yes — LLC</option>
          <option value="corp">Yes — Corp</option>
          <option value="other">Yes — other</option>
          <option value="none">Not yet</option>
          <option value="not_sure">Not sure</option>
        </select>
      </div>

      <div className="space-y-2 rounded-md border bg-white p-3">
        <label className="text-sm font-medium text-[#6B4A2E]">
          Primary goal
        </label>
        <select
          className="w-full rounded-md border p-2"
          value={primaryGoal}
          onChange={(e) => setPrimaryGoal(e.target.value)}
        >
          <option value="stability">Get stable</option>
          <option value="growth">Grow revenue</option>
          <option value="systems">Build systems</option>
          <option value="stress_reduction">Reduce stress</option>
          <option value="scaling">Scale the team</option>
        </select>
      </div>

      <button
        className="w-full rounded-md bg-[#1C6F66] px-4 py-3 text-white disabled:opacity-60"
        onClick={save}
        disabled={saving}
      >
        {saving ? "Saving…" : "Save and continue"}
      </button>
    </div>
  );
}
