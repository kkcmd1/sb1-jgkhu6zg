"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

type ChapterCard = {
  id: number;
  title: string;
  subtitle: string;
  isFree: boolean;
};

const CHAPTERS: ChapterCard[] = [
  { id: 1, title: "Chapter 1: Foundation", subtitle: "Set the legal + money basics.", isFree: true },
  { id: 2, title: "Chapter 2: Problem + Offer", subtitle: "Turn your idea into a clear offer.", isFree: true },
  { id: 3, title: "Chapter 3: Go-to-Market", subtitle: "Validate demand and ship your first loop.", isFree: true }, // unlocked
  { id: 4, title: "Chapter 4: Money System", subtitle: "Build a money routine you can repeat.", isFree: false },
  { id: 5, title: "Chapter 5: Operations", subtitle: "Write SOPs so work stays consistent.", isFree: false },
  { id: 6, title: "Chapter 6: Weekly Cadence", subtitle: "Run the business weekly, not randomly.", isFree: true },
  { id: 7, title: "Chapter 7: Scale + Lead", subtitle: "Stabilize cash, scale what works.", isFree: false },
  { id: 8, title: "Chapter 8: Leadership", subtitle: "Lead the business you built.", isFree: false },
];

export default function ChaptersIndexPage() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="text-xl font-semibold text-[#6B4A2E]">Stable Ground</div>

      <div className="mt-4">
        <div className="text-lg font-semibold text-[#6B4A2E]">Chapters</div>
        <div className="mt-1 text-sm text-gray-600">
          {session ? "Signed in." : "Not signed in."}{" "}
          <span className="ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-gray-700">
            {session ? "Free" : "Guest"}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {CHAPTERS.map((c) => (
          <Link
            key={c.id}
            href={`/chapters/${c.id}`}
            className="block rounded-xl border bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-[#6B4A2E]">{c.title}</div>
                <div className="mt-1 text-sm text-gray-600">{c.subtitle}</div>
              </div>

              <span
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
                  c.isFree
                    ? "border-[#1C6F66] text-[#1C6F66]"
                    : "border-gray-300 text-gray-600"
                }`}
              >
                {c.isFree ? "Free" : "Locked"}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 text-xs text-gray-500">
        <div className="flex items-center justify-center gap-4">
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
      </div>
    </main>
  );
}
