"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

type QuizOption = {
  id: "a" | "b" | "c" | "d";
  label: string;
};

type SignalTracker = {
  weak: {
    likes: number;
    comments: number;
    pollVotes: number;
    emailOpens: number;
  };
  strong: {
    depositsCount: number;
    depositsTotal: number;
    discoveryCalls: number;
    bookedNextStep: number;
    waitlistIntent: number;
    paidTrials: number;
  };
  topObjections: string[];
};

type ValidationPlan = {
  offer: string;
  audience: string;
  promise: string;
  windowDays: number;
  primaryChannel: string;

  testChosen: "deposit" | "discovery" | "waitlist";
  testNotes: string;

  successPass: string;
  successFail: string;
  stopEarlyIf: string;

  dailyTracker: {
    day: string;
    action: string;
    reach: string;
    conversations: string;
    conversions: string;
    learning: string;
  }[];
};

type GTMSystem = {
  oneChannelFocus: string;
  message: string;
  cadence: {
    daily: string;
    weekly: string;
  };
  assets: {
    landing: string;
    checkout: string;
    proof: string;
  };
};

type FollowUpSystem = {
  rules: string;
  templates: {
    firstTouch: string;
    followUp1: string;
    followUp2: string;
    closeOut: string;
  };
};

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "free" | "locked" | "info";
}) {
  const cls =
    tone === "free"
      ? "border-[#1C6F66] text-[#1C6F66]"
      : tone === "locked"
      ? "border-gray-300 text-gray-600"
      : "border-[#D8A34A] text-[#6B4A2E]";
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mt-8">
      <div className="text-base font-semibold text-[#6B4A2E]">{title}</div>
      {desc ? <div className="mt-1 text-sm text-gray-600">{desc}</div> : null}
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-[#6B4A2E]">{label}</div>
      <textarea
        className="mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#1C6F66]"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-[#6B4A2E]">{label}</div>
      <input
        className="mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#1C6F66]"
        value={value}
        type={type}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function NumInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-[#6B4A2E]">{label}</div>
      <input
        className="mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#1C6F66]"
        value={Number.isFinite(value) ? String(value) : "0"}
        type="number"
        onChange={(e) => onChange(Number(e.target.value || "0"))}
      />
    </label>
  );
}

export default function GoToMarketPage() {
  const params = useParams<{ chapter: string }>();
  const router = useRouter();
  const chapterNum = Number(params?.chapter || "0");

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const quizOptions: QuizOption[] = [
    { id: "a", label: "500 Instagram likes on your announcement" },
    { id: "b", label: '50 people say "I’d totally buy this"' },
    { id: "c", label: "10 people pay a $50 deposit to reserve a spot" },
    { id: "d", label: "2,000 email subscribers" },
  ];

  const [quizPick, setQuizPick] = useState<QuizOption["id"] | null>(null);
  const quizCorrect = quizPick === "c";

  const [signalTracker, setSignalTracker] = useState<SignalTracker>({
    weak: { likes: 0, comments: 0, pollVotes: 0, emailOpens: 0 },
    strong: {
      depositsCount: 0,
      depositsTotal: 0,
      discoveryCalls: 0,
      bookedNextStep: 0,
      waitlistIntent: 0,
      paidTrials: 0,
    },
    topObjections: ["", "", ""],
  });

  const [validationPlan, setValidationPlan] = useState<ValidationPlan>({
    offer: "",
    audience: "",
    promise: "",
    windowDays: 14,
    primaryChannel: "",

    testChosen: "deposit",
    testNotes: "",

    successPass: "Pass = at least 3 paid deposits OR 5 qualified calls booked inside 14 days.",
    successFail: "Fail = fewer than 10 real conversations OR zero next steps after 14 days.",
    stopEarlyIf: "Stop early if you get 3 identical objections that point to unclear value or wrong audience.",

    dailyTracker: [
      { day: "Day 1", action: "", reach: "", conversations: "", conversions: "", learning: "" },
      { day: "Day 2", action: "", reach: "", conversations: "", conversions: "", learning: "" },
      { day: "Day 3", action: "", reach: "", conversations: "", conversions: "", learning: "" },
      { day: "Day 4", action: "", reach: "", conversations: "", conversions: "", learning: "" },
      { day: "Day 5", action: "", reach: "", conversations: "", conversions: "", learning: "" },
      { day: "Day 6", action: "", reach: "", conversations: "", conversions: "", learning: "" },
      { day: "Day 7", action: "", reach: "", conversations: "", conversions: "", learning: "" },
      { day: "Day 8", action: "", reach: "", conversations: "", conversions: "", learning: "" },
      { day: "Day 9", action: "", reach: "", conversations: "", conversions: "", learning: "" },
      { day: "Day 10", action: "", reach: "", conversations: "", conversions: "", learning: "" },
      { day: "Day 11", action: "", reach: "", conversations: "", conversions: "", learning: "" },
      { day: "Day 12", action: "", reach: "", conversations: "", conversions: "", learning: "" },
      { day: "Day 13", action: "", reach: "", conversations: "", conversions: "", learning: "" },
      { day: "Day 14", action: "", reach: "", conversations: "", conversions: "", learning: "" },
    ],
  });

  const [gtmSystem, setGtmSystem] = useState<GTMSystem>({
    oneChannelFocus: "",
    message: "",
    cadence: {
      daily: "Post or outreach daily (15–30 minutes).",
      weekly: "One weekly review: numbers + objections + next test.",
    },
    assets: {
      landing: "One page: who it’s for, outcome, proof, next step.",
      checkout: "One clear way to pay (deposit, invoice, checkout link).",
      proof: "3 proof bullets: results, screenshots, testimonials, before/after.",
    },
  });

  const [followUp, setFollowUp] = useState<FollowUpSystem>({
    rules: "Follow up 3 times over 7 days. If they say ‘not now’, ask what would make it a ‘yes’ later.",
    templates: {
      firstTouch: "",
      followUp1: "",
      followUp2: "",
      closeOut: "",
    },
  });

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string>("");

  const autoTemplates = useMemo(() => {
    const who = validationPlan.audience || "your audience";
    const offer = validationPlan.offer || "your offer";
    const promise = validationPlan.promise || "a clear outcome";
    return {
      firstTouch: `Quick question — are you still trying to solve this right now?\n\nIf you’re ${who}, I’m running a short 14-day test for ${offer}.\nThe goal: ${promise}.\n\nIf you want, I can share the next step to reserve a spot.`,
      followUp1: `Following up — I’m closing the current test window soon.\n\nIf this is relevant, reply “YES” and I’ll send the details.\nIf not, reply “NO” and I’ll stop.`,
      followUp2: `Last nudge — if timing is the issue, what would make this a “yes” later?\n\nA) budget\nB) time\nC) unclear value\nD) wrong fit\n\nReply with A/B/C/D and I’ll adjust.`,
      closeOut: `All good — I’m closing out this thread.\n\nIf you want me to circle back later, reply with:\n“Later: [month]”`,
    };
  }, [validationPlan.audience, validationPlan.offer, validationPlan.promise]);

  useEffect(() => {
    if (followUp.templates.firstTouch.trim() === "") {
      setFollowUp((p) => ({ ...p, templates: { ...p.templates, ...autoTemplates } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTemplates.firstTouch]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // load saved data (if any)
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setSavedMsg("");

      const { data: sess } = await supabase.auth.getSession();
      const s = sess.session ?? null;
      setSession(s);

      if (!s?.user?.id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("gtm_plans")
        .select("*")
        .eq("user_id", s.user.id)
        .maybeSingle();

      if (!error && data) {
        const d = (data.data ?? {}) as any;

        if (typeof data.offer === "string") setValidationPlan((p) => ({ ...p, offer: data.offer }));
        if (typeof data.audience === "string") setValidationPlan((p) => ({ ...p, audience: data.audience }));
        if (typeof data.promise === "string") setValidationPlan((p) => ({ ...p, promise: data.promise }));
        if (typeof data.primary_channel === "string") setValidationPlan((p) => ({ ...p, primaryChannel: data.primary_channel }));
        if (typeof data.window_days === "number") setValidationPlan((p) => ({ ...p, windowDays: data.window_days }));

        if (d.quizPick) setQuizPick(d.quizPick);
        if (d.signalTracker) setSignalTracker(d.signalTracker);
        if (d.validationPlan) setValidationPlan((p) => ({ ...p, ...d.validationPlan }));
        if (d.gtmSystem) setGtmSystem(d.gtmSystem);
        if (d.followUp) setFollowUp(d.followUp);
      }

      setLoading(false);
    };

    run();
  }, []);

  const strongSignalScore = useMemo(() => {
    const s = signalTracker.strong;
    const moneySignal = s.depositsTotal + (s.paidTrials * 25);
    const nextSteps = s.bookedNextStep * 2 + s.discoveryCalls + s.waitlistIntent;
    return moneySignal + nextSteps;
  }, [signalTracker.strong]);

  const saveAll = async () => {
    setSavedMsg("");

    const { data: sess } = await supabase.auth.getSession();
    const s = sess.session ?? null;

    if (!s?.user?.id) {
      setSavedMsg("Sign in to save.");
      return;
    }

    setSaving(true);

    const payload = {
      user_id: s.user.id,
      offer: validationPlan.offer,
      audience: validationPlan.audience,
      promise: validationPlan.promise,
      primary_channel: validationPlan.primaryChannel,
      window_days: validationPlan.windowDays,
      data: {
        quizPick,
        signalTracker,
        validationPlan,
        gtmSystem,
        followUp,
      },
    };

    const { error } = await supabase
      .from("gtm_plans")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      setSavedMsg(`Save failed: ${error.message}`);
      setSaving(false);
      return;
    }

    setSavedMsg("Saved.");
    setSaving(false);
  };

  if (chapterNum !== 3) {
    return (
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="text-xl font-semibold text-[#6B4A2E]">Stable Ground</div>
        <div className="mt-6 rounded-xl border bg-white p-4">
          <div className="font-semibold text-[#6B4A2E]">Go-to-Market System</div>
          <div className="mt-2 text-sm text-gray-600">This tool is for Chapter 3.</div>
          <div className="mt-4">
            <Link className="text-sm font-medium text-[#1C6F66] underline" href={`/chapters/${chapterNum}`}>
              Back →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="text-xl font-semibold text-[#6B4A2E]">Stable Ground</div>

      <div className="mt-5 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-[#6B4A2E]">Chapter 3: Go-to-Market</div>
            <div className="mt-1 text-sm text-gray-600">Get real signals before you sink time or money.</div>
          </div>
          <Pill tone="free">Free</Pill>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border p-3">
            <div className="font-semibold text-[#6B4A2E]">What you’ll build</div>
            <ul className="mt-2 list-disc pl-5 text-gray-700">
              <li>Validation test</li>
              <li>One-channel plan</li>
              <li>Follow-up system</li>
              <li>Decision rules</li>
            </ul>
          </div>
          <div className="rounded-lg border p-3">
            <div className="font-semibold text-[#6B4A2E]">Save status</div>
            <div className="mt-2 text-gray-700">{session ? "Signed in." : "Not signed in."}</div>
            <div className="mt-2 text-xs text-gray-500">
              {session ? "You can save edits anytime." : "Open Settings to sign in."}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={saveAll}
            disabled={saving || loading}
            className="rounded-lg bg-[#1C6F66] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Chapter 3"}
          </button>

          <button
            onClick={() => router.push("/chapters/3")}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
          >
            Back
          </button>
        </div>

        {savedMsg ? (
          <div className={`mt-3 rounded-lg border p-3 text-sm ${savedMsg.startsWith("Save failed") ? "border-red-300 text-red-700" : "border-green-300 text-green-700"}`}>
            {savedMsg}
          </div>
        ) : null}
      </div>

      <SectionTitle
        title="Section 1: Demand validation fundamentals"
        desc="Interest feels good. Demand shows up as money, time, or commitment."
      />

      <div className="mt-3 rounded-xl border bg-white p-4 shadow-sm">
        <div className="text-sm text-gray-700">
          <div className="font-semibold text-[#6B4A2E]">Real validation = behavior that costs something.</div>
          <div className="mt-2">
            You want signals that prove willingness to exchange money, time, or commitment.
          </div>
        </div>

        <div className="mt-4 rounded-lg border">
          <div className="grid grid-cols-2 gap-0">
            <div className="border-r p-3">
              <div className="text-sm font-semibold text-gray-700">❌ Weak signals</div>
              <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">
                <li>Likes, follows</li>
                <li>“This is cool” comments</li>
                <li>Poll replies</li>
                <li>Email opens with no action</li>
              </ul>
            </div>
            <div className="p-3">
              <div className="text-sm font-semibold text-gray-700">✅ Strong signals</div>
              <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">
                <li>Deposits / paid trials</li>
                <li>Calls booked + next step</li>
                <li>Waitlist with intent to buy</li>
                <li>Pilot customers committed</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-lg border p-3">
          <div className="text-sm font-semibold text-[#6B4A2E]">Signal strength quiz</div>
          <div className="mt-2 text-sm text-gray-700">Which is the strongest validation signal?</div>

          <div className="mt-3 space-y-2">
            {quizOptions.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                <input
                  type="radio"
                  name="quiz"
                  checked={quizPick === o.id}
                  onChange={() => setQuizPick(o.id)}
                  className="mt-1"
                />
                <div className="text-sm text-gray-700">{o.label}</div>
              </label>
            ))}
          </div>

          {quizPick ? (
            <div className={`mt-3 rounded-lg border p-3 text-sm ${quizCorrect ? "border-green-300 text-green-700" : "border-amber-300 text-amber-800"}`}>
              {quizCorrect ? (
                <div>
                  <div className="font-semibold">Correct.</div>
                  <div className="mt-1">
                    10 deposits at $50 = $500 committed. Money exchanged for a promise is real demand data.
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-semibold">Close, but not quite.</div>
                  <div className="mt-1">
                    Likes and “I’d buy” statements can be interest. Deposits force a real commitment.
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <SectionTitle
        title="Section 2: Run your validation test"
        desc="One offer. One audience. One channel. Short window. Clear pass/fail."
      />

      <div className="mt-3 rounded-xl border bg-white p-4 shadow-sm space-y-4">
        <TextArea
          label="Offer (what you’re selling)"
          value={validationPlan.offer}
          onChange={(v) => setValidationPlan((p) => ({ ...p, offer: v }))}
          rows={3}
          placeholder="Example: 4-week dispatch onboarding intensive"
        />

        <TextArea
          label="Audience (who it’s for)"
          value={validationPlan.audience}
          onChange={(v) => setValidationPlan((p) => ({ ...p, audience: v }))}
          rows={2}
          placeholder="Example: new owner-operators running dry van"
        />

        <TextArea
          label="Promise (measurable outcome)"
          value={validationPlan.promise}
          onChange={(v) => setValidationPlan((p) => ({ ...p, promise: v }))}
          rows={2}
          placeholder="Example: book consistent loads with a repeatable weekly system"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Primary channel"
            value={validationPlan.primaryChannel}
            onChange={(v) => setValidationPlan((p) => ({ ...p, primaryChannel: v }))}
            placeholder="Example: TikTok, Facebook groups, cold email"
          />
          <NumInput
            label="Validation window (days)"
            value={validationPlan.windowDays}
            onChange={(v) => setValidationPlan((p) => ({ ...p, windowDays: Math.max(1, Math.min(30, v)) }))}
          />
        </div>

        <div className="rounded-lg border p-3">
          <div className="text-sm font-semibold text-[#6B4A2E]">Choose 1 test</div>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <label className="flex items-start gap-3 rounded-lg border p-3">
              <input
                type="radio"
                checked={validationPlan.testChosen === "deposit"}
                onChange={() => setValidationPlan((p) => ({ ...p, testChosen: "deposit" }))}
                className="mt-1"
              />
              <div className="text-sm text-gray-700">
                <div className="font-semibold">Deposit test</div>
                <div className="mt-1 text-gray-600">Ask for a small deposit to reserve a spot.</div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border p-3">
              <input
                type="radio"
                checked={validationPlan.testChosen === "discovery"}
                onChange={() => setValidationPlan((p) => ({ ...p, testChosen: "discovery" }))}
                className="mt-1"
              />
              <div className="text-sm text-gray-700">
                <div className="font-semibold">Discovery-call test</div>
                <div className="mt-1 text-gray-600">Book calls, then push to a next step.</div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border p-3">
              <input
                type="radio"
                checked={validationPlan.testChosen === "waitlist"}
                onChange={() => setValidationPlan((p) => ({ ...p, testChosen: "waitlist" }))}
                className="mt-1"
              />
              <div className="text-sm text-gray-700">
                <div className="font-semibold">Waitlist + intent test</div>
                <div className="mt-1 text-gray-600">Collect waitlist + intent-to-buy answers.</div>
              </div>
            </label>
          </div>

          <TextArea
            label="Test notes (where you’ll post, who you’ll DM, what you’ll say)"
            value={validationPlan.testNotes}
            onChange={(v) => setValidationPlan((p) => ({ ...p, testNotes: v }))}
            rows={4}
            placeholder="Write your exact plan so you can repeat it."
          />
        </div>

        <div className="rounded-lg border p-3 space-y-3">
          <div className="text-sm font-semibold text-[#6B4A2E]">Decision rules</div>
          <TextArea
            label="Pass condition"
            value={validationPlan.successPass}
            onChange={(v) => setValidationPlan((p) => ({ ...p, successPass: v }))}
            rows={2}
          />
          <TextArea
            label="Fail condition"
            value={validationPlan.successFail}
            onChange={(v) => setValidationPlan((p) => ({ ...p, successFail: v }))}
            rows={2}
          />
          <TextArea
            label="Stop early rule"
            value={validationPlan.stopEarlyIf}
            onChange={(v) => setValidationPlan((p) => ({ ...p, stopEarlyIf: v }))}
            rows={2}
          />
        </div>

        <div className="rounded-lg border p-3">
          <div className="text-sm font-semibold text-[#6B4A2E]">Validation signal tracker</div>
          <div className="mt-2 text-xs text-gray-500">
            Strong signals beat weak signals. This score helps you compare weeks, not chase vanity metrics.
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-sm font-semibold text-gray-700">Weak signals</div>
              <div className="mt-3 space-y-3">
                <NumInput
                  label="Likes"
                  value={signalTracker.weak.likes}
                  onChange={(v) => setSignalTracker((p) => ({ ...p, weak: { ...p.weak, likes: v } }))}
                />
                <NumInput
                  label="Comments"
                  value={signalTracker.weak.comments}
                  onChange={(v) => setSignalTracker((p) => ({ ...p, weak: { ...p.weak, comments: v } }))}
                />
                <NumInput
                  label="Poll votes"
                  value={signalTracker.weak.pollVotes}
                  onChange={(v) => setSignalTracker((p) => ({ ...p, weak: { ...p.weak, pollVotes: v } }))}
                />
                <NumInput
                  label="Email opens"
                  value={signalTracker.weak.emailOpens}
                  onChange={(v) => setSignalTracker((p) => ({ ...p, weak: { ...p.weak, emailOpens: v } }))}
                />
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <div className="text-sm font-semibold text-gray-700">Strong signals</div>
              <div className="mt-3 space-y-3">
                <NumInput
                  label="Deposits (count)"
                  value={signalTracker.strong.depositsCount}
                  onChange={(v) => setSignalTracker((p) => ({ ...p, strong: { ...p.strong, depositsCount: v } }))}
                />
                <NumInput
                  label="Deposits ($ total)"
                  value={signalTracker.strong.depositsTotal}
                  onChange={(v) => setSignalTracker((p) => ({ ...p, strong: { ...p.strong, depositsTotal: v } }))}
                />
                <NumInput
                  label="Discovery calls"
                  value={signalTracker.strong.discoveryCalls}
                  onChange={(v) => setSignalTracker((p) => ({ ...p, strong: { ...p.strong, discoveryCalls: v } }))}
                />
                <NumInput
                  label="Booked next step"
                  value={signalTracker.strong.bookedNextStep}
                  onChange={(v) => setSignalTracker((p) => ({ ...p, strong: { ...p.strong, bookedNextStep: v } }))}
                />
                <NumInput
                  label="Waitlist intent"
                  value={signalTracker.strong.waitlistIntent}
                  onChange={(v) => setSignalTracker((p) => ({ ...p, strong: { ...p.strong, waitlistIntent: v } }))}
                />
                <NumInput
                  label="Paid trials"
                  value={signalTracker.strong.paidTrials}
                  onChange={(v) => setSignalTracker((p) => ({ ...p, strong: { ...p.strong, paidTrials: v } }))}
                />
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[#6B4A2E]">Signal score</div>
              <Pill tone="info">{strongSignalScore} pts</Pill>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Money + next steps carry the score. Weak signals don’t move it.
            </div>
          </div>

          <div className="mt-3 rounded-lg border p-3 space-y-3">
            <div className="text-sm font-semibold text-[#6B4A2E]">Top objections (listen to “why not”)</div>
            <Input
              label="Objection 1"
              value={signalTracker.topObjections[0] || ""}
              onChange={(v) =>
                setSignalTracker((p) => ({ ...p, topObjections: [v, p.topObjections[1] || "", p.topObjections[2] || ""] }))
              }
            />
            <Input
              label="Objection 2"
              value={signalTracker.topObjections[1] || ""}
              onChange={(v) =>
                setSignalTracker((p) => ({ ...p, topObjections: [p.topObjections[0] || "", v, p.topObjections[2] || ""] }))
              }
            />
            <Input
              label="Objection 3"
              value={signalTracker.topObjections[2] || ""}
              onChange={(v) =>
                setSignalTracker((p) => ({ ...p, topObjections: [p.topObjections[0] || "", p.topObjections[1] || "", v] }))
              }
            />
          </div>
        </div>
      </div>

      <SectionTitle
        title="Section 3: Build your go-to-market system"
        desc="One channel, one message, one cadence — repeat until the numbers move."
      />

      <div className="mt-3 rounded-xl border bg-white p-4 shadow-sm space-y-4">
        <Input
          label="One-channel focus (pick just one)"
          value={gtmSystem.oneChannelFocus}
          onChange={(v) => setGtmSystem((p) => ({ ...p, oneChannelFocus: v }))}
          placeholder="Example: TikTok (1 post/day) + DM responders"
        />

        <TextArea
          label="Core message (say it in one breath)"
          value={gtmSystem.message}
          onChange={(v) => setGtmSystem((p) => ({ ...p, message: v }))}
          rows={3}
          placeholder='Format: "I help [who] get [result] in [time] without [pain]."'
        />

        <TextArea
          label="Cadence — daily"
          value={gtmSystem.cadence.daily}
          onChange={(v) => setGtmSystem((p) => ({ ...p, cadence: { ...p.cadence, daily: v } }))}
          rows={2}
        />

        <TextArea
          label="Cadence — weekly"
          value={gtmSystem.cadence.weekly}
          onChange={(v) => setGtmSystem((p) => ({ ...p, cadence: { ...p.cadence, weekly: v } }))}
          rows={2}
        />

        <div className="rounded-lg border p-3 space-y-3">
          <div className="text-sm font-semibold text-[#6B4A2E]">Assets checklist</div>
          <TextArea
            label="Landing page"
            value={gtmSystem.assets.landing}
            onChange={(v) => setGtmSystem((p) => ({ ...p, assets: { ...p.assets, landing: v } }))}
            rows={2}
          />
          <TextArea
            label="Checkout / payment"
            value={gtmSystem.assets.checkout}
            onChange={(v) => setGtmSystem((p) => ({ ...p, assets: { ...p.assets, checkout: v } }))}
            rows={2}
          />
          <TextArea
            label="Proof"
            value={gtmSystem.assets.proof}
            onChange={(v) => setGtmSystem((p) => ({ ...p, assets: { ...p.assets, proof: v } }))}
            rows={2}
          />
        </div>
      </div>

      <SectionTitle
        title="Section 4: Set up your follow-up system"
        desc="Follow-up is part of delivery. It’s where most conversions happen."
      />

      <div className="mt-3 rounded-xl border bg-white p-4 shadow-sm space-y-4">
        <TextArea
          label="Follow-up rules"
          value={followUp.rules}
          onChange={(v) => setFollowUp((p) => ({ ...p, rules: v }))}
          rows={3}
        />

        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-[#6B4A2E]">Templates (copy/paste)</div>
            <button
              onClick={() => setFollowUp((p) => ({ ...p, templates: { ...p.templates, ...autoTemplates } }))}
              className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700"
            >
              Regenerate from your offer
            </button>
          </div>

          <TextArea
            label="First touch"
            value={followUp.templates.firstTouch}
            onChange={(v) => setFollowUp((p) => ({ ...p, templates: { ...p.templates, firstTouch: v } }))}
            rows={5}
          />
          <TextArea
            label="Follow-up 1"
            value={followUp.templates.followUp1}
            onChange={(v) => setFollowUp((p) => ({ ...p, templates: { ...p.templates, followUp1: v } }))}
            rows={4}
          />
          <TextArea
            label="Follow-up 2"
            value={followUp.templates.followUp2}
            onChange={(v) => setFollowUp((p) => ({ ...p, templates: { ...p.templates, followUp2: v } }))}
            rows={4}
          />
          <TextArea
            label="Close-out"
            value={followUp.templates.closeOut}
            onChange={(v) => setFollowUp((p) => ({ ...p, templates: { ...p.templates, closeOut: v } }))}
            rows={4}
          />
        </div>

        <div className="rounded-lg border p-3">
          <div className="text-sm font-semibold text-[#6B4A2E]">Your go-to-market snapshot</div>
          <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
            <div className="font-semibold">Offer</div>
            {validationPlan.offer || "—"}
            {"\n\n"}
            <div className="font-semibold">Audience</div>
            {validationPlan.audience || "—"}
            {"\n\n"}
            <div className="font-semibold">Promise</div>
            {validationPlan.promise || "—"}
            {"\n\n"}
            <div className="font-semibold">Channel + window</div>
            {(validationPlan.primaryChannel || "—") + ` • ${validationPlan.windowDays} days`}
            {"\n\n"}
            <div className="font-semibold">Test</div>
            {validationPlan.testChosen}
            {"\n\n"}
            <div className="font-semibold">Pass rule</div>
            {validationPlan.successPass}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={saveAll}
            disabled={saving || loading}
            className="rounded-lg bg-[#1C6F66] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Chapter 3"}
          </button>

          <Link
            href="/chapters/3"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
          >
            Back
          </Link>
        </div>

        {savedMsg ? (
          <div className={`rounded-lg border p-3 text-sm ${savedMsg.startsWith("Save failed") ? "border-red-300 text-red-700" : "border-green-300 text-green-700"}`}>
            {savedMsg}
          </div>
        ) : null}
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
