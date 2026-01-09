"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/hooks/useSession";

type OfferDraft = {
  who: string;
  problem: string;
  solution: string;
  outcome: string;
  timeframe: string;
  investment: string;
  guarantee: string;
};

export default function OfferBuilderPage({
  params,
}: {
  params: { chapter: string };
}) {
  const router = useRouter();
  const { session, loading } = useSession();

  const chapterNumber = Number(params.chapter);
  const chapterId = Number.isFinite(chapterNumber) ? chapterNumber : null;

  const [draft, setDraft] = useState<OfferDraft>({
    who: "",
    problem: "",
    solution: "",
    outcome: "",
    timeframe: "",
    investment: "",
    guarantee: "",
  });

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const offerCard = useMemo(() => {
    return [
      `WHO → ${draft.who || "[fill]"}`,
      `PROBLEM → ${draft.problem || "[fill]"}`,
      `SOLUTION → ${draft.solution || "[fill]"}`,
      `OUTCOME → ${draft.outcome || "[fill]"}`,
      `TIMEFRAME → ${draft.timeframe || "[fill]"}`,
      `INVESTMENT → ${draft.investment || "[fill]"}`,
      `GUARANTEE → ${draft.guarantee || "[fill]"}`,
    ].join("\n");
  }, [draft]);

  async function saveOffer() {
    setErrorMsg(null);
    setSavedMsg(null);

    const userId = session?.user?.id;
    if (!userId) {
      setErrorMsg("You must be signed in to save.");
      return;
    }

    setSaving(true);
    try {
      // Save the offer card as a "calculation" record
      const { error: insertCalcErr } = await supabase.from("calculations").insert({
        user_id: userId,
        calculation_type: "offer_card",
        input_data: draft,
        result_data: { offer_card: offerCard, chapter: params.chapter },
      });

      if (insertCalcErr) throw insertCalcErr;

      // Log the action
      await supabase.from("user_activities").insert({
        user_id: userId,
        action_type: "saved_offer_card",
        chapter_id: chapterId ?? 0,
        metadata: { chapter: params.chapter },
      });

      setSavedMsg("Offer saved.");
    } catch (e: any) {
      setErrorMsg(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <div className="text-sm text-gray-600">Loading…</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="mb-4">
        <div className="text-sm text-gray-600">
          <Link className="underline" href={`/chapters/${params.chapter}`}>
            Back to Chapter {params.chapter}
          </Link>
        </div>

        <h1 className="mt-2 text-2xl font-semibold text-[#6B4A2E]">
          Offer Builder
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Fill this once, then refine. Save writes to Supabase.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
        <Field
          label="WHO (target customer)"
          value={draft.who}
          onChange={(v) => setDraft({ ...draft, who: v })}
          placeholder="Example: solo service business owners"
        />
        <Field
          label="PROBLEM (what they want fixed)"
          value={draft.problem}
          onChange={(v) => setDraft({ ...draft, problem: v })}
          placeholder="Example: inconsistent weekly workflow"
        />
        <Field
          label="SOLUTION (what you do)"
          value={draft.solution}
          onChange={(v) => setDraft({ ...draft, solution: v })}
          placeholder="Example: 30-day system setup with checklists + prompts"
        />
        <Field
          label="OUTCOME (measurable result)"
          value={draft.outcome}
          onChange={(v) => setDraft({ ...draft, outcome: v })}
          placeholder="Example: stable weekly cadence + clear numbers"
        />
        <Field
          label="TIMEFRAME"
          value={draft.timeframe}
          onChange={(v) => setDraft({ ...draft, timeframe: v })}
          placeholder="Example: 30 days"
        />
        <Field
          label="INVESTMENT (price)"
          value={draft.investment}
          onChange={(v) => setDraft({ ...draft, investment: v })}
          placeholder="Example: $12/month"
        />
        <Field
          label="GUARANTEE (optional)"
          value={draft.guarantee}
          onChange={(v) => setDraft({ ...draft, guarantee: v })}
          placeholder="Example: cancel anytime"
        />

        <div className="rounded-lg bg-gray-50 p-3">
          <div className="text-sm font-medium text-[#6B4A2E]">Offer card</div>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
            {offerCard}
          </pre>
        </div>

        {errorMsg ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errorMsg}
          </div>
        ) : null}

        {savedMsg ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {savedMsg}
          </div>
        ) : null}

        <div className="flex gap-3">
          <button
            className="rounded-lg bg-[#1C6F66] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={saveOffer}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save offer"}
          </button>

          <button
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
            onClick={() => router.push(`/chapters/${params.chapter}`)}
          >
            Done
          </button>
        </div>
      </div>

      <div className="mt-6 flex gap-4 text-xs text-gray-500">
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

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-[#6B4A2E]">{props.label}</div>
      <input
        className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-[#1C6F66]"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder || ""}
      />
    </div>
  );
}
