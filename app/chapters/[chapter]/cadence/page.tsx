"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabase/client";

type CadenceData = {
  sellWhat: string;
  volume: string;
  bottleneck: string;
  peakHours: string;
  weeklyRevenueTarget: string;
  teamSize: string;

  mondayTheme: string;
  mondayPriorities: string;
  mondayNumbers: string;
  mondayExperiment: string;

  dailyMorning: string;
  dailyAfternoon: string;
  dailyCheckpoint: string;

  fridayReview: string;
  fridayNextTheme: string;
  fridayStopDoing: string;

  bufferPercent: string;
  filterRule: string;
  emergencyProtocol: string;

  savedAt?: string;
};

const ALLOWED_CHAPTER = 6;

export default function CadencePage({ params }: { params: { chapter: string } }) {
  const chapterNum = Number(params.chapter);

  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [sellWhat, setSellWhat] = useState("Digital products + services");
  const [volume, setVolume] = useState("5–10 tasks/week");
  const [bottleneck, setBottleneck] = useState("Sales");
  const [peakHours, setPeakHours] = useState("7–10pm");
  const [weeklyRevenueTarget, setWeeklyRevenueTarget] = useState("$500");
  const [teamSize, setTeamSize] = useState("Just me");

  const [mondayTheme, setMondayTheme] = useState("One focus");
  const [mondayPriorities, setMondayPriorities] = useState("1) Revenue\n2) Delivery\n3) Admin");
  const [mondayNumbers, setMondayNumbers] = useState("1) Sales calls\n2) Cash collected\n3) Work delivered");
  const [mondayExperiment, setMondayExperiment] = useState("Test one new outreach message.");

  const [dailyMorning, setDailyMorning] = useState("Sell: outreach or content");
  const [dailyAfternoon, setDailyAfternoon] = useState("Deliver: client work or product build");
  const [dailyCheckpoint, setDailyCheckpoint] = useState("15-min checkpoint: cash, pipeline, tasks");

  const [fridayReview, setFridayReview] = useState("Did we hit the 3 numbers? What worked?");
  const [fridayNextTheme, setFridayNextTheme] = useState("Pick next week’s theme.");
  const [fridayStopDoing, setFridayStopDoing] = useState("Stop low-signal tasks.");

  const [bufferPercent, setBufferPercent] = useState("20%");
  const [filterRule, setFilterRule] = useState("Hell yes or no.");
  const [emergencyProtocol, setEmergencyProtocol] = useState("If behind: pause new work, finish delivery, collect cash.");

  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUserId(data.user?.id ?? null);
      setAuthLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (chapterNum !== ALLOWED_CHAPTER) return;

    (async () => {
      const { data, error } = await supabase
        .from("chapter_progress")
        .select("data")
        .eq("user_id", userId)
        .eq("chapter_id", chapterNum)
        .limit(1)
        .maybeSingle();

      if (error) return;

      const d = (data?.data ?? null) as CadenceData | null;
      if (!d) return;

      setSellWhat(d.sellWhat ?? "");
      setVolume(d.volume ?? "");
      setBottleneck(d.bottleneck ?? "");
      setPeakHours(d.peakHours ?? "");
      setWeeklyRevenueTarget(d.weeklyRevenueTarget ?? "");
      setTeamSize(d.teamSize ?? "");

      setMondayTheme(d.mondayTheme ?? "");
      setMondayPriorities(d.mondayPriorities ?? "");
      setMondayNumbers(d.mondayNumbers ?? "");
      setMondayExperiment(d.mondayExperiment ?? "");

      setDailyMorning(d.dailyMorning ?? "");
      setDailyAfternoon(d.dailyAfternoon ?? "");
      setDailyCheckpoint(d.dailyCheckpoint ?? "");

      setFridayReview(d.fridayReview ?? "");
      setFridayNextTheme(d.fridayNextTheme ?? "");
      setFridayStopDoing(d.fridayStopDoing ?? "");

      setBufferPercent(d.bufferPercent ?? "20%");
      setFilterRule(d.filterRule ?? "");
      setEmergencyProtocol(d.emergencyProtocol ?? "");

      setStatus(d.savedAt ? "Loaded saved cadence." : "");
    })();
  }, [userId, chapterNum]);

  const preview = useMemo(() => {
    return {
      monday: [
        `Theme: ${mondayTheme || "—"}`,
        "Priorities:",
        mondayPriorities || "—",
        "Numbers:",
        mondayNumbers || "—",
        `Experiment: ${mondayExperiment || "—"}`,
      ],
      daily: [dailyMorning || "—", dailyAfternoon || "—", dailyCheckpoint || "—"],
      friday: [fridayReview || "—", fridayNextTheme || "—", fridayStopDoing || "—"],
    };
  }, [
    mondayTheme,
    mondayPriorities,
    mondayNumbers,
    mondayExperiment,
    dailyMorning,
    dailyAfternoon,
    dailyCheckpoint,
    fridayReview,
    fridayNextTheme,
    fridayStopDoing,
  ]);

  async function save() {
    setStatus("");

    if (chapterNum !== ALLOWED_CHAPTER) {
      setStatus("Wrong chapter route for this tool.");
      return;
    }
    if (!userId) {
      setStatus("Sign in first, then save.");
      return;
    }

    setSaving(true);

    const payload: CadenceData = {
      sellWhat,
      volume,
      bottleneck,
      peakHours,
      weeklyRevenueTarget,
      teamSize,

      mondayTheme,
      mondayPriorities,
      mondayNumbers,
      mondayExperiment,

      dailyMorning,
      dailyAfternoon,
      dailyCheckpoint,

      fridayReview,
      fridayNextTheme,
      fridayStopDoing,

      bufferPercent,
      filterRule,
      emergencyProtocol,

      savedAt: new Date().toISOString(),
    };

    const { error } = await supabase.from("chapter_progress").upsert(
      { user_id: userId, chapter_id: chapterNum, data: payload },
      { onConflict: "user_id,chapter_id" }
    );

    setSaving(false);

    if (error) {
      setStatus(`Save failed: ${error.message}`);
      return;
    }

    setStatus("Cadence saved.");
  }

  if (chapterNum !== ALLOWED_CHAPTER) {
    return (
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="text-xl font-semibold text-[#6B4A2E]">Stable Ground</div>
        <div className="mt-6 rounded-xl border bg-white p-4">
          <div className="text-lg font-semibold text-[#6B4A2E]">Tool not available</div>
          <div className="mt-2 text-sm text-gray-600">This page is for Chapter 6.</div>
          <div className="mt-4 flex gap-3">
            <Link
              href="/chapters/6"
              className="rounded-lg bg-[#1C6F66] px-4 py-2 text-sm font-semibold text-white"
            >
              Go to Chapter 6
            </Link>
            <Link
              href="/chapters"
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-[#6B4A2E]"
            >
              Chapters
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="text-xl font-semibold text-[#6B4A2E]">Stable Ground</div>

      <div className="mt-6 rounded-xl border bg-white p-4">
        <div className="text-lg font-semibold text-[#6B4A2E]">Chapter 6 — Weekly Cadence</div>
        <div className="mt-1 text-sm text-gray-600">Set your week so you can repeat it.</div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <div className="text-sm font-medium">What you sell</div>
            <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={sellWhat} onChange={(e) => setSellWhat(e.target.value)} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-sm font-medium">Current volume</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={volume} onChange={(e) => setVolume(e.target.value)} />
            </label>
            <label className="block">
              <div className="text-sm font-medium">Bottleneck</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={bottleneck} onChange={(e) => setBottleneck(e.target.value)} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-sm font-medium">Peak hours</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={peakHours} onChange={(e) => setPeakHours(e.target.value)} />
            </label>
            <label className="block">
              <div className="text-sm font-medium">Weekly revenue target</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={weeklyRevenueTarget} onChange={(e) => setWeeklyRevenueTarget(e.target.value)} />
            </label>
          </div>

          <label className="block">
            <div className="text-sm font-medium">Team size</div>
            <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={teamSize} onChange={(e) => setTeamSize(e.target.value)} />
          </label>

          <div className="mt-4 rounded-xl bg-[#F8F9FA] p-4">
            <div className="text-sm font-semibold text-[#6B4A2E]">Monday (30 min)</div>

            <label className="mt-3 block">
              <div className="text-sm font-medium">Week theme</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={mondayTheme} onChange={(e) => setMondayTheme(e.target.value)} />
            </label>

            <label className="mt-3 block">
              <div className="text-sm font-medium">3 priority outcomes (one per line)</div>
              <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={3} value={mondayPriorities} onChange={(e) => setMondayPriorities(e.target.value)} />
            </label>

            <label className="mt-3 block">
              <div className="text-sm font-medium">3 numbers to track (one per line)</div>
              <textarea className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" rows={3} value={mondayNumbers} onChange={(e) => setMondayNumbers(e.target.value)} />
            </label>

            <label className="mt-3 block">
              <div className="text-sm font-medium">Bottleneck experiment</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={mondayExperiment} onChange={(e) => setMondayExperiment(e.target.value)} />
            </label>
          </div>

          <div className="rounded-xl bg-[#F8F9FA] p-4">
            <div className="text-sm font-semibold text-[#6B4A2E]">Daily routine (per 4-hour block)</div>

            <label className="mt-3 block">
              <div className="text-sm font-medium">Morning</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={dailyMorning} onChange={(e) => setDailyMorning(e.target.value)} />
            </label>

            <label className="mt-3 block">
              <div className="text-sm font-medium">Afternoon</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={dailyAfternoon} onChange={(e) => setDailyAfternoon(e.target.value)} />
            </label>

            <label className="mt-3 block">
              <div className="text-sm font-medium">15-min checkpoint</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={dailyCheckpoint} onChange={(e) => setDailyCheckpoint(e.target.value)} />
            </label>
          </div>

          <div className="rounded-xl bg-[#F8F9FA] p-4">
            <div className="text-sm font-semibold text-[#6B4A2E]">Friday (45 min)</div>

            <label className="mt-3 block">
              <div className="text-sm font-medium">Results check</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={fridayReview} onChange={(e) => setFridayReview(e.target.value)} />
            </label>

            <label className="mt-3 block">
              <div className="text-sm font-medium">Next week’s theme</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={fridayNextTheme} onChange={(e) => setFridayNextTheme(e.target.value)} />
            </label>

            <label className="mt-3 block">
              <div className="text-sm font-medium">What to stop doing</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={fridayStopDoing} onChange={(e) => setFridayStopDoing(e.target.value)} />
            </label>
          </div>

          <div className="rounded-xl bg-[#F8F9FA] p-4">
            <div className="text-sm font-semibold text-[#6B4A2E]">Rules</div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="text-sm font-medium">Buffer time %</div>
                <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={bufferPercent} onChange={(e) => setBufferPercent(e.target.value)} />
              </label>
              <label className="block">
                <div className="text-sm font-medium">Filter rule</div>
                <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={filterRule} onChange={(e) => setFilterRule(e.target.value)} />
              </label>
            </div>

            <label className="mt-3 block">
              <div className="text-sm font-medium">Emergency protocol</div>
              <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={emergencyProtocol} onChange={(e) => setEmergencyProtocol(e.target.value)} />
            </label>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <div className="text-sm font-semibold text-[#6B4A2E]">Preview</div>
            <div className="mt-2 text-sm text-gray-700">
              <div className="font-semibold">Monday</div>
              <div className="whitespace-pre-line">{preview.monday.join("\n")}</div>
              <div className="mt-3 font-semibold">Daily</div>
              <div className="whitespace-pre-line">{preview.daily.join("\n")}</div>
              <div className="mt-3 font-semibold">Friday</div>
              <div className="whitespace-pre-line">{preview.friday.join("\n")}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving || authLoading}
            className="rounded-lg bg-[#1C6F66] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save cadence"}
          </button>

          <Link
            href={`/chapters/${params.chapter}`}
            className="rounded-lg border px-4 py-2 text-sm font-semibold text-[#6B4A2E]"
          >
            Back
          </Link>
        </div>

        {status ? <div className="mt-3 text-sm text-gray-700">{status}</div> : null}

        {!userId && !authLoading ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            You are not signed in. Go to Settings to sign in.
          </div>
        ) : null}
      </div>
    </main>
  );
}
