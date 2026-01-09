"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase/client";

type SessionState = { loading: boolean; signedIn: boolean };

const CHAPTER_TITLES: Record<number, { title: string; subtitle: string }> = {
  1: { title: "Chapter 1: Foundation", subtitle: "Set the legal + money basics." },
  2: { title: "Chapter 2: Problem + Offer", subtitle: "Define the customer and build a simple offer." },
  3: { title: "Chapter 3: Go-to-Market", subtitle: "Validate demand and ship your first loop." },
  4: { title: "Chapter 4: Money System", subtitle: "Build a money system you can run weekly." },
  5: { title: "Chapter 5: Operations", subtitle: "Document the work so it repeats." },
  6: { title: "Chapter 6: Weekly Cadence", subtitle: "Set your week so you can repeat it." },
  7: { title: "Chapter 7: Scale + Lead", subtitle: "Stabilize, reduce risk, lead the work." },
  8: { title: "Chapter 8: Leadership", subtitle: "Grow without losing yourself." },
};

function weekStartISO(d = new Date()): string {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function ChapterPage({ params }: { params: { chapter: string } }) {
  const chapterId = useMemo(() => Number(params.chapter), [params.chapter]);
  const meta = CHAPTER_TITLES[chapterId] ?? { title: `Chapter ${chapterId}`, subtitle: "" };

  const [session, setSession] = useState<SessionState>({ loading: true, signedIn: false });

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession({ loading: false, signedIn: !!data.session });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession({ loading: false, signedIn: !!newSession });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const tools = useMemo(() => {
    if (chapterId === 1) {
      return [{ title: "Assessment", desc: "Answer 10 questions and save progress.", href: `/chapters/${chapterId}/assessment`, cta: "Open assessment →" }];
    }
    if (chapterId === 2) {
      return [{ title: "Offer Builder", desc: "Build and save your offer card.", href: `/chapters/${chapterId}/offer`, cta: "Open offer builder →" }];
    }
    if (chapterId === 3) {
      return [
        { title: "Go-to-Market System", desc: "Validation + one-channel focus plan.", href: `/chapters/${chapterId}/gtm`, cta: "Open GTM system →" },
        { title: "14-Day Launch Sprint", desc: "A simple sprint you can run.", href: `/chapters/${chapterId}/launch`, cta: "Open launch sprint →" },
      ];
    }
    if (chapterId === 4) {
      return [{ title: "Money System", desc: "Accounts, rules, routine, panic button.", href: `/chapters/${chapterId}/money`, cta: "Open money system →" }];
    }
    if (chapterId === 5) {
      return [{ title: "SOP Builder", desc: "Write steps once so the work repeats.", href: `/chapters/${chapterId}/sop`, cta: "Open SOP builder →" }];
    }
    if (chapterId === 6) {
      return [
        { title: "Weekly Cadence", desc: "Design your repeatable week.", href: `/chapters/${chapterId}/cadence`, cta: "Open cadence →" },
        { title: "Daily Routines", desc: "Save routines + mark today complete.", href: `/chapters/${chapterId}/routines`, cta: "Open daily routines →" },
      ];
    }
    if (chapterId === 7) {
      return [
        { title: "Scale + Lead Plan", desc: "Constraints, stop list, delegation, risk list.", href: `/chapters/${chapterId}/lead`, cta: "Open scale plan →" },
        { title: "Leadership Scorecard", desc: "North star + leading indicators + health checks.", href: `/chapters/${chapterId}/metrics`, cta: "Open scorecard →" },
        { title: "14-Day Leverage Sprint", desc: "Focus, ship, follow up, repeat.", href: `/chapters/${chapterId}/launch`, cta: "Open sprint →" },
      ];
    }
    if (chapterId === 8) {
      return [
        { title: "Leadership Compass", desc: "Values, boundaries, capacity, personal rules.", href: `/chapters/${chapterId}/lead`, cta: "Open compass →" },
        { title: "Season Plan + Decisions", desc: "90-day theme, outcomes, habits, decision log.", href: `/chapters/${chapterId}/metrics`, cta: "Open season plan →" },
      ];
    }
    return [];
  }, [chapterId]);

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="text-xl font-semibold text-[#6B4A2E]">Stable Ground</div>

      <div className="mt-6 rounded-xl border bg-white p-4">
        <div className="text-lg font-semibold text-[#6B4A2E]">{meta.title}</div>
        <div className="mt-1 text-sm text-gray-600">{meta.subtitle}</div>

        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-full border px-2 py-0.5 text-xs text-gray-700">
            {session.loading ? "…" : session.signedIn ? "Signed in" : "Signed out"}
          </span>
          <span className="rounded-full border px-2 py-0.5 text-xs text-gray-700">Week start: {weekStartISO()}</span>
        </div>

        {!session.loading && !session.signedIn && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            You can read pages. Sign in to save.
            <div className="mt-2">
              <Link className="underline" href="/settings">
                Go to Settings →
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {tools.map((t) => (
          <div key={t.href} className="rounded-xl border bg-white p-4">
            <div className="font-semibold text-[#6B4A2E]">{t.title}</div>
            <div className="mt-1 text-sm text-gray-600">{t.desc}</div>
            <div className="mt-3">
              <Link className="text-sm font-medium text-[#1C6F66] underline" href={t.href}>
                {t.cta}
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Link className="rounded-lg border px-3 py-2 text-sm text-gray-700" href="/chapters">
          Back
        </Link>
      </div>
    </main>
  );
}