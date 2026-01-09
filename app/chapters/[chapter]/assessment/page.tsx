"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const teal = "#1C6F66";
const brown = "#6B4A2E";

type Answers = {
  businessDoes: string;          // Q1
  location: string;             // Q2
  monthlyRevenue: string;        // Q3
  liabilityRisk: "low" | "medium" | "high"; // Q4
  growthPlan: "stay_solo" | "hire_soon" | "scale_fast"; // Q5
  currentEntity: "none" | "sole_prop" | "llc" | "corp" | "other"; // Q6
  formedState: string;           // Q7
  hasBizBank: "yes" | "no";      // Q8
  hasAccounting: "yes" | "no";   // Q9
  biggestPain: "legal" | "customers" | "money" | "operations" | "time" | "compliance"; // Q10
  oneActionThisWeek: string;     // required for a useful output
};

function computeQuickRead(a: Answers) {
  const rev = Number(String(a.monthlyRevenue).replace(/[^0-9.]/g, "")) || 0;

  let priority: "Low" | "Medium" | "High" = "Medium";
  if (a.liabilityRisk === "high") priority = "High";
  if (rev >= 10000) priority = "High";

  const nextSteps: string[] = [];

  if (a.hasBizBank === "no") nextSteps.push("Open a dedicated business bank account and separate money.");
  if (a.hasAccounting === "no") nextSteps.push("Pick a simple bookkeeping method and log weekly.");

  if (a.currentEntity === "none" || a.currentEntity === "sole_prop") {
    if (a.liabilityRisk !== "low") nextSteps.push("Consider an LLC path for basic liability separation.");
  }

  nextSteps.push("Start a weekly routine (one weekly plan you repeat).");

  let migrateWhen = "Review structure after steady profit and consistent revenue.";
  if (rev >= 8000) migrateWhen = "Review tax elections after consistent profit for 3–6 months.";
  if (rev >= 15000) migrateWhen = "Review S-corp timing after stable profit and clean books.";

  return { priority, nextSteps, migrateWhen };
}

export default function AssessmentPage({ params }: { params: { chapter: string } }) {
  const router = useRouter();
  const chapterNumber = Number(params.chapter || "0");

  const [userEmail, setUserEmail] = useState<string>("");
  const [answers, setAnswers] = useState<Answers>({
    businessDoes: "",
    location: "",
    monthlyRevenue: "",
    liabilityRisk: "medium",
    growthPlan: "stay_solo",
    currentEntity: "none",
    formedState: "",
    hasBizBank: "no",
    hasAccounting: "no",
    biggestPain: "operations",
    oneActionThisWeek: "",
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      setUserEmail(data?.user?.email || "");
    })();
    return () => {
      alive = false;
    };
  }, []);

  const quickRead = useMemo(() => computeQuickRead(answers), [answers]);

  const missingCount = useMemo(() => {
    let m = 0;
    if (!answers.businessDoes.trim()) m++;
    if (!answers.location.trim()) m++;
    if (!answers.monthlyRevenue.trim()) m++;
    if (!answers.oneActionThisWeek.trim()) m++;
    return m;
  }, [answers]);

  async function saveAssessment() {
    setErrorMsg("");
    setSaved(false);

    setSaving(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const user = userData?.user;

      if (userErr || !user) {
        setErrorMsg("You must be signed in to save. Go to Settings and sign in with Google.");
        return;
      }

      const now = new Date().toISOString();

      // Save answers + quickread into calculations
      const calculationType = `ch${chapterNumber}_assessment`;

      const { error: calcErr } = await supabase
        .from("calculations")
        .upsert(
          {
            user_id: user.id,
            calculation_type: calculationType,
            input_data: answers,
            result_data: quickRead,
            updated_at: now,
          },
          { onConflict: "user_id,calculation_type" }
        );

      if (calcErr) {
        setErrorMsg(`Save failed (calculations): ${calcErr.message}`);
        return;
      }

      // Save progress marker
      const { error: progErr } = await supabase
        .from("chapter_progress")
        .upsert(
          {
            user_id: user.id,
            chapter_number: chapterNumber,
            completion_percentage: missingCount === 0 ? 100 : 60,
            completed_sections: missingCount === 0 ? ["assessment_complete"] : ["assessment_started"],
            last_accessed: now,
            updated_at: now,
          },
          { onConflict: "user_id,chapter_number" }
        );

      if (progErr) {
        setErrorMsg(`Saved answers, but progress update failed: ${progErr.message}`);
        setSaved(true);
        return;
      }

      setSaved(true);
    } catch (e: any) {
      setErrorMsg(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  // If you only want Chapter 1 assessment live right now:
  if (chapterNumber !== 1) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="text-2xl font-semibold" style={{ color: brown }}>
          Assessment
        </h1>
        <p className="mt-2 text-sm text-gray-700">
          This assessment is only set up for Chapter 1 right now.
        </p>
        <div className="mt-4">
          <Link className="underline text-sm" href={`/chapters/${chapterNumber}`}>
            Back
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: brown }}>
            Chapter 1 Assessment
          </h1>
          <div className="mt-1 text-sm text-gray-600">
            Status:{" "}
            <span className="font-medium">
              {userEmail ? `Signed in as ${userEmail}` : "Not signed in"}
            </span>
          </div>
        </div>

        <button
          className="rounded-lg border px-3 py-2 text-sm font-medium"
          style={{ borderColor: teal, color: teal }}
          onClick={() => router.push("/chapters/1")}
        >
          Back
        </button>
      </div>

      <div className="mt-5 rounded-xl border bg-white p-4">
        <div className="grid gap-4">
          <div>
            <label className="text-sm font-medium" style={{ color: brown }}>
              1) I run a business that does
            </label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={answers.businessDoes}
              onChange={(e) => setAnswers((a) => ({ ...a, businessDoes: e.target.value }))}
              placeholder="Example: digital products, freight dispatching, cleaning service"
            />
          </div>

          <div>
            <label className="text-sm font-medium" style={{ color: brown }}>
              2) I am located in
            </label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={answers.location}
              onChange={(e) => setAnswers((a) => ({ ...a, location: e.target.value }))}
              placeholder="Example: North Carolina, USA"
            />
          </div>

          <div>
            <label className="text-sm font-medium" style={{ color: brown }}>
              3) My monthly revenue is
            </label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={answers.monthlyRevenue}
              onChange={(e) => setAnswers((a) => ({ ...a, monthlyRevenue: e.target.value }))}
              placeholder="Example: 0 / 500 / 2500"
              inputMode="decimal"
            />
          </div>

          <div>
            <label className="text-sm font-medium" style={{ color: brown }}>
              4) Liability risk
            </label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={answers.liabilityRisk}
              onChange={(e) => setAnswers((a) => ({ ...a, liabilityRisk: e.target.value as any }))}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium" style={{ color: brown }}>
              5) Growth plan
            </label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={answers.growthPlan}
              onChange={(e) => setAnswers((a) => ({ ...a, growthPlan: e.target.value as any }))}
            >
              <option value="stay_solo">Stay solo</option>
              <option value="hire_soon">Hire soon</option>
              <option value="scale_fast">Scale fast</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium" style={{ color: brown }}>
              6) Current entity type
            </label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={answers.currentEntity}
              onChange={(e) => setAnswers((a) => ({ ...a, currentEntity: e.target.value as any }))}
            >
              <option value="none">Not sure / not set</option>
              <option value="sole_prop">Sole prop</option>
              <option value="llc">LLC</option>
              <option value="corp">Corporation</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium" style={{ color: brown }}>
              7) If formed, what state?
            </label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={answers.formedState}
              onChange={(e) => setAnswers((a) => ({ ...a, formedState: e.target.value }))}
              placeholder="Example: NC"
            />
          </div>

          <div>
            <label className="text-sm font-medium" style={{ color: brown }}>
              8) Business bank account?
            </label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={answers.hasBizBank}
              onChange={(e) => setAnswers((a) => ({ ...a, hasBizBank: e.target.value as any }))}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium" style={{ color: brown }}>
              9) Weekly tracking (income/expenses)?
            </label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={answers.hasAccounting}
              onChange={(e) => setAnswers((a) => ({ ...a, hasAccounting: e.target.value as any }))}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium" style={{ color: brown }}>
              10) Biggest pain right now
            </label>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={answers.biggestPain}
              onChange={(e) => setAnswers((a) => ({ ...a, biggestPain: e.target.value as any }))}
            >
              <option value="legal">Legal/structure</option>
              <option value="customers">Customers</option>
              <option value="money">Money</option>
              <option value="operations">Operations</option>
              <option value="time">Time</option>
              <option value="compliance">Compliance</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium" style={{ color: brown }}>
              One action you can do this week
            </label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={answers.oneActionThisWeek}
              onChange={(e) => setAnswers((a) => ({ ...a, oneActionThisWeek: e.target.value }))}
              placeholder="Example: open business checking"
            />
          </div>
        </div>

        <div className="mt-6 rounded-xl border bg-gray-50 p-4">
          <div className="text-sm font-medium" style={{ color: brown }}>
            Your quick read
          </div>
          <div className="mt-2 text-sm text-gray-700">
            <div>
              <span className="font-medium">Priority level:</span> {quickRead.priority}
            </div>
            <div className="mt-2">
              <span className="font-medium">Next steps</span>
              <ul className="mt-1 list-disc pl-5">
                {quickRead.nextSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="mt-2">
              <span className="font-medium">Migrate when:</span> {quickRead.migrateWhen}
            </div>
          </div>
        </div>

        {errorMsg ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        ) : null}

        <div className="mt-4 flex gap-3">
          <button
            className="rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: teal, opacity: saving ? 0.7 : 1 }}
            onClick={saveAssessment}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save assessment"}
          </button>

          <button
            className="rounded-lg border px-4 py-2 text-sm font-medium"
            style={{ borderColor: teal, color: teal }}
            onClick={() => router.push("/chapters/1")}
          >
            Done
          </button>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          {saved ? "Assessment saved." : missingCount > 0 ? `${missingCount} item(s) left.` : "All answered."}
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-600">
        <Link className="underline" href="/chapters">
          Back to Chapters
        </Link>
      </div>
    </main>
  );
}
