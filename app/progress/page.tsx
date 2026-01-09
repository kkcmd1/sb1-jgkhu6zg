"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";

type ChapterProgressRow = {
  chapter_id?: number | string | null;
};

function todayLocalYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function countCheckedAnyShape(checked: any): number {
  if (!checked) return 0;

  if (typeof checked === "string") {
    try {
      checked = JSON.parse(checked);
    } catch {
      return 0;
    }
  }

  if (Array.isArray(checked)) return checked.filter(Boolean).length;

  if (typeof checked === "object") {
    return Object.values(checked).filter((v) => v === true).length;
  }

  return 0;
}

function StatusPill({ done }: { done: boolean }) {
  return (
    <span
      className={[
        "ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
        done
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700",
      ].join(" ")}
    >
      {done ? "Done" : "To do"}
    </span>
  );
}

function Card({
  title,
  done,
  body,
  href,
  linkText,
}: {
  title: string;
  done: boolean;
  body: string;
  href: string;
  linkText: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="font-semibold text-[#6B4A2E]">{title}</div>
        <StatusPill done={done} />
      </div>
      <div className="mt-1 text-sm text-gray-600">{body}</div>
      <div className="mt-2">
        <Link className="text-sm font-medium text-[#1C6F66] underline" href={href}>
          {linkText}
        </Link>
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const todayStr = useMemo(() => todayLocalYYYYMMDD(), []);

  const [phase, setPhase] = useState<"boot" | "ready">("boot");
  const [user, setUser] = useState<User | null>(null);

  const [note, setNote] = useState<string | null>(null);

  const [onboardingSaved, setOnboardingSaved] = useState(false);
  const [chapter1Saved, setChapter1Saved] = useState(false);
  const [chapter2Saved, setChapter2Saved] = useState(false);
  const [chapter6Saved, setChapter6Saved] = useState(false);

  const [weeklyPlansCount, setWeeklyPlansCount] = useState(0);
  const [sopsCount, setSopsCount] = useState(0);
  const [dailyRoutinesCount, setDailyRoutinesCount] = useState(0);
  const [todayCompletionCount, setTodayCompletionCount] = useState(0);

  const [loadingData, setLoadingData] = useState(false);

  // Boot: get current session + keep user in sync
  useEffect(() => {
    let alive = true;

    async function boot() {
      setPhase("boot");
      setNote(null);

      const { data, error } = await supabase.auth.getSession();
      if (!alive) return;

      if (error) {
        setUser(null);
        setNote(`Auth session error: ${error.message}`);
        setPhase("ready");
        return;
      }

      setUser(data.session?.user ?? null);
      setPhase("ready");
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Load Progress data when user is present
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) {
        setOnboardingSaved(false);
        setChapter1Saved(false);
        setChapter2Saved(false);
        setChapter6Saved(false);
        setWeeklyPlansCount(0);
        setSopsCount(0);
        setDailyRoutinesCount(0);
        setTodayCompletionCount(0);
        return;
      }

      setLoadingData(true);
      setNote(null);

      try {
        // Onboarding saved
        const prof = await supabase.from("user_profiles").select("id").eq("id", user.id).maybeSingle();
        if (cancelled) return;
        setOnboardingSaved(!!prof.data);

        // Chapter progress
        const cp = await supabase.from("chapter_progress").select("chapter_id").eq("user_id", user.id);
        if (!cancelled && !cp.error) {
          const rows = (cp.data ?? []) as ChapterProgressRow[];
          const has = (n: number) => rows.some((r) => String(r.chapter_id ?? "") === String(n));
          setChapter1Saved(has(1));
          setChapter2Saved(has(2));
          setChapter6Saved(has(6));
        }

        // Weekly plans count
        const wp = await supabase
          .from("weekly_plans")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        if (!cancelled && !wp.error) setWeeklyPlansCount(wp.count ?? 0);

        // SOPs count
        const sops = await supabase
          .from("sops")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        if (!cancelled && !sops.error) setSopsCount(sops.count ?? 0);

        // Daily routines count
        const dr = await supabase
          .from("daily_routines")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        if (!cancelled && !dr.error) setDailyRoutinesCount(dr.count ?? 0);

        // Today completion: read latest row for today, count checked items
        const tc = await supabase
          .from("routine_completions")
          .select("id, checked, created_at")
          .eq("user_id", user.id)
          .eq("completed_date", todayStr)
          .order("created_at", { ascending: false })
          .limit(1);

        if (cancelled) return;

        if (tc.error) {
          setTodayCompletionCount(0);
          setNote(`Completion read note: ${tc.error.message}`);
        } else {
          const row = (tc.data ?? [])[0];
          const counted = countCheckedAnyShape(row?.checked);
          const fallback = row ? 1 : 0; // row exists even if checked is empty
          setTodayCompletionCount(counted > 0 ? counted : fallback);
        }
      } catch (e: any) {
        if (!cancelled) setNote(e?.message ?? "Progress load error.");
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user, todayStr]);

  if (phase === "boot") {
    return (
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="text-xl font-semibold text-[#6B4A2E]">Stable Ground</div>
        <div className="mt-6 rounded-xl border bg-white p-4 text-sm text-gray-600">Loading…</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="text-xl font-semibold text-[#6B4A2E]">Stable Ground</div>
        <div className="mt-1 text-sm text-gray-600">Progress</div>

        <div className="mt-4 rounded-xl border bg-white p-4 text-sm text-gray-600">
          Sign in to view Progress.
        </div>

        {note ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {note}
          </div>
        ) : null}

        <div className="mt-4">
          <Link className="text-sm font-medium text-[#1C6F66] underline" href="/settings">
            Go to Settings →
          </Link>
        </div>
      </main>
    );
  }

  const routineDone = todayCompletionCount > 0;

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="text-xl font-semibold text-[#6B4A2E]">Stable Ground</div>
      <div className="mt-1 text-sm text-gray-600">Progress</div>

      {note ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {note}
        </div>
      ) : null}

      {loadingData ? (
        <div className="mt-4 rounded-xl border bg-white p-4 text-sm text-gray-600">Loading…</div>
      ) : null}

      <div className="mt-4 grid gap-3">
        <Card
          title="Onboarding saved"
          done={onboardingSaved}
          body={onboardingSaved ? "Complete" : "Open onboarding and save once."}
          href="/onboarding"
          linkText="Open onboarding →"
        />

        <Card
          title="Chapter 1 assessment saved"
          done={chapter1Saved}
          body={chapter1Saved ? "Complete" : "Open Chapter 1 → Assessment → Save."}
          href="/chapters/1"
          linkText="Open Chapter 1 →"
        />

        <Card
          title="Chapter 2 offer saved"
          done={chapter2Saved}
          body={chapter2Saved ? "Complete" : "Open Chapter 2 → Offer Builder → Save."}
          href="/chapters/2"
          linkText="Open Chapter 2 →"
        />

        <Card
          title="Chapter 6 weekly cadence saved"
          done={chapter6Saved}
          body={chapter6Saved ? "Complete" : "Open Chapter 6 → Cadence → Save."}
          href="/chapters/6/cadence"
          linkText="Open Chapter 6 cadence →"
        />

        <Card
          title="Daily routines saved"
          done={dailyRoutinesCount >= 3}
          body={`Saved routines: ${dailyRoutinesCount} (target: 3)`}
          href="/chapters/6/routines"
          linkText="Open daily routines →"
        />

        <Card
          title="Routine completion saved today"
          done={routineDone}
          body={`Today (${todayStr}) completions: ${todayCompletionCount}`}
          href="/chapters/6/routines"
          linkText="Open routines and check one →"
        />

        <Card
          title="SOP saved"
          done={sopsCount > 0}
          body={`Saved SOPs: ${sopsCount}`}
          href="/chapters/5/sop"
          linkText="Open SOP Builder →"
        />

        <Card
          title="Weekly plan exists"
          done={weeklyPlansCount > 0}
          body={`Weekly plans: ${weeklyPlansCount}`}
          href="/plan"
          linkText="Go to My Plan →"
        />
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          href="/chapters"
          className="inline-flex items-center justify-center rounded-lg bg-[#1C6F66] px-4 py-2 text-sm font-medium text-white"
        >
          Go to Chapters
        </Link>
        <Link
          href="/plan"
          className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium text-[#1C6F66]"
        >
          Go to My Plan
        </Link>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4 text-xs text-gray-500">
        <Link className="underline" href="/privacy">
          Privacy
        </Link>
        <Link className="underline" href="/terms">
          Terms
        </Link>
        <Link className="underline" href="/refunds">
          Refunds
        </Link>
      </div>
    </main>
  );
}
