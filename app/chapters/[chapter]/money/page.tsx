"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

type MoneyRow = {
  id: string;
  user_id: string;
  monthly_revenue: number | null;
  entity_type: string | null;
  effective_tax_rate: number | null;
  accounts_count: number | null;
  bank_type: string | null;
  followups: any;
  recommendation: any;
  updated_at: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function MoneySystemPage() {
  const params = useParams();
  const router = useRouter();

  const chapterId = useMemo(() => {
    const raw = (params?.chapter ?? "").toString();
    const n = Number(raw);
    return Number.isFinite(n) ? n : 4;
  }, [params]);

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // Inputs
  const [monthlyRevenue, setMonthlyRevenue] = useState<string>("");
  const [entityType, setEntityType] = useState<string>("LLC");
  const [effectiveTaxRate, setEffectiveTaxRate] = useState<string>("25");
  const [accountsCount, setAccountsCount] = useState<string>("1");
  const [bankType, setBankType] = useState<string>("Chase");

  // Follow-ups (max 5)
  const [q1, setQ1] = useState<string>("Yes");
  const [q2, setQ2] = useState<string>("Weekly");
  const [q3, setQ3] = useState<string>("No");
  const [q4, setQ4] = useState<string>("Low");
  const [q5, setQ5] = useState<string>("Owner draws monthly");

  const [loadedRow, setLoadedRow] = useState<MoneyRow | null>(null);

  useEffect(() => {
    let alive = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUser(data.user ?? null);
      setLoadingUser(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const run = async () => {
      setMsg("");
      if (!user) {
        setLoadedRow(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("money_systems")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setMsg(`Load error: ${error.message}`);
        setLoadedRow(null);
        setLoading(false);
        return;
      }

      if (data) {
        const row = data as MoneyRow;
        setLoadedRow(row);

        setMonthlyRevenue(row.monthly_revenue != null ? String(row.monthly_revenue) : "");
        setEntityType(row.entity_type ?? "LLC");
        setEffectiveTaxRate(row.effective_tax_rate != null ? String(row.effective_tax_rate) : "25");
        setAccountsCount(row.accounts_count != null ? String(row.accounts_count) : "1");
        setBankType(row.bank_type ?? "Chase");

        const f = row.followups ?? {};
        setQ1(f.q1 ?? "Yes");
        setQ2(f.q2 ?? "Weekly");
        setQ3(f.q3 ?? "No");
        setQ4(f.q4 ?? "Low");
        setQ5(f.q5 ?? "Owner draws monthly");
      }

      setLoading(false);
    };

    run();
  }, [user]);

  const computed = useMemo(() => {
    const rev = Number(monthlyRevenue || 0);
    const eff = Number(effectiveTaxRate || 0);
    const effPct = clamp((Number.isFinite(eff) ? eff : 25) / 100, 0.05, 0.5);

    // Simple, safe baseline split
    // Tax = effective tax rate
    // Owner = 30% baseline
    // Operating = remainder (min 20%)
    let tax = effPct;
    let owner = 0.3;
    let operating = 1 - tax - owner;

    if (operating < 0.2) {
      owner = clamp(1 - tax - 0.2, 0.05, 0.6);
      operating = 1 - tax - owner;
    }

    const taxAmt = rev * tax;
    const ownerAmt = rev * owner;
    const opAmt = rev * operating;

    const withholdFormula = `=ROUND(A2*(${(tax).toFixed(4)}),2)`;

    return {
      rev,
      taxPct: Math.round(tax * 100),
      ownerPct: Math.round(owner * 100),
      opPct: Math.round(operating * 100),
      taxAmt,
      ownerAmt,
      opAmt,
      withholdFormula,
    };
  }, [monthlyRevenue, effectiveTaxRate]);

  const recommendation = useMemo(() => {
    const rateText = effectiveTaxRate.trim() === "" ? "Not sure" : `${effectiveTaxRate}%`;

    const panicRule =
      "Stop owner draws if Operating account drops below 4 weeks of bills OR taxes are behind.";

    const weeklyRoutine =
      "Every Friday (15 min): move Tax %, move Owner %, leave the rest in Operating. Log it.";

    const monthlyChecklist = [
      "Reconcile all accounts",
      "Check tax balance vs expected",
      "Update profit + cash snapshot",
      "Review subscriptions/recurring costs",
      "Set next month’s draw cap",
    ];

    const automation = [
      `Bank: ${bankType}`,
      "Create 3 accounts: Operating / Tax / Owner",
      "Turn on low-balance alerts for Operating",
      "Turn on weekly transfer reminder (Friday)",
      "Turn on payment notifications",
    ];

    return {
      snapshot: {
        monthlyRevenue: computed.rev,
        entityType,
        effectiveTaxRate: rateText,
        accountsCount,
      },
      threeAccount: {
        operatingPct: `${computed.opPct}%`,
        taxPct: `${computed.taxPct}%`,
        ownerPct: `${computed.ownerPct}%`,
      },
      weeklyRoutine,
      monthlyChecklist,
      automation,
      panicRule,
      copyPasteTaxFormula: computed.withholdFormula,
    };
  }, [computed, entityType, effectiveTaxRate, accountsCount, bankType]);

  const save = async () => {
    setMsg("");
    if (!user) {
      setMsg("You must be signed in to save.");
      return;
    }

    setSaving(true);

    const payload = {
      user_id: user.id,
      monthly_revenue: monthlyRevenue.trim() === "" ? null : Number(monthlyRevenue),
      entity_type: entityType,
      effective_tax_rate: effectiveTaxRate.trim() === "" ? null : Number(effectiveTaxRate),
      accounts_count: accountsCount.trim() === "" ? null : Number(accountsCount),
      bank_type: bankType,
      followups: { q1, q2, q3, q4, q5 },
      recommendation,
    };

    const { error } = await supabase.from("money_systems").upsert(payload, {
      onConflict: "user_id",
    });

    if (error) {
      setMsg(`Save failed: ${error.message}`);
      setSaving(false);
      return;
    }

    setMsg("Money system saved.");
    setSaving(false);
  };

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="text-xl font-semibold text-[#6B4A2E]">Stable Ground</div>

      <div className="mt-6">
        <div className="text-2xl font-semibold text-[#6B4A2E]">Chapter {chapterId} — Money System</div>
        <div className="mt-1 text-sm text-gray-600">Build your 3-account setup and routines.</div>
        <div className="mt-2 text-sm text-gray-600">
          {loadingUser ? "Checking sign-in…" : user ? "Signed in." : "Not signed in."}
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-white p-4">
        <div className="font-semibold text-[#6B4A2E]">Your inputs</div>

        <div className="mt-3 space-y-3">
          <label className="block">
            <div className="text-sm font-medium text-gray-700">Monthly revenue ($)</div>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={monthlyRevenue}
              onChange={(e) => setMonthlyRevenue(e.target.value)}
              placeholder="5000"
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium text-gray-700">Entity type</div>
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            >
              <option>Sole prop</option>
              <option>LLC</option>
              <option>S-corp</option>
              <option>Corp</option>
            </select>
          </label>

          <label className="block">
            <div className="text-sm font-medium text-gray-700">Effective tax rate (%)</div>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={effectiveTaxRate}
              onChange={(e) => setEffectiveTaxRate(e.target.value)}
              placeholder="25"
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium text-gray-700">How many bank accounts do you use now?</div>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={accountsCount}
              onChange={(e) => setAccountsCount(e.target.value)}
              placeholder="1"
            />
          </label>

          <label className="block">
            <div className="text-sm font-medium text-gray-700">Bank</div>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={bankType}
              onChange={(e) => setBankType(e.target.value)}
              placeholder="Chase"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-white p-4">
        <div className="font-semibold text-[#6B4A2E]">Follow-up questions (max 5)</div>

        <div className="mt-3 space-y-3">
          <label className="block">
            <div className="text-sm font-medium text-gray-700">Do you want weekly transfers? (Yes/No)</div>
            <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={q1} onChange={(e) => setQ1(e.target.value)} />
          </label>

          <label className="block">
            <div className="text-sm font-medium text-gray-700">Reconciliation cadence (Weekly/Monthly)</div>
            <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={q2} onChange={(e) => setQ2(e.target.value)} />
          </label>

          <label className="block">
            <div className="text-sm font-medium text-gray-700">Do you have tax payments scheduled? (Yes/No)</div>
            <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={q3} onChange={(e) => setQ3(e.target.value)} />
          </label>

          <label className="block">
            <div className="text-sm font-medium text-gray-700">Cash flow volatility (Low/Medium/High)</div>
            <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={q4} onChange={(e) => setQ4(e.target.value)} />
          </label>

          <label className="block">
            <div className="text-sm font-medium text-gray-700">Owner draw style</div>
            <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={q5} onChange={(e) => setQ5(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-white p-4">
        <div className="font-semibold text-[#6B4A2E]">Your 3-account split</div>

        <div className="mt-3 space-y-2 text-sm text-gray-800">
          <div>
            <span className="font-medium">Operating:</span> {recommendation.threeAccount.operatingPct} (≈ $
            {Math.round(computed.opAmt).toLocaleString()})
          </div>
          <div>
            <span className="font-medium">Tax:</span> {recommendation.threeAccount.taxPct} (≈ $
            {Math.round(computed.taxAmt).toLocaleString()})
          </div>
          <div>
            <span className="font-medium">Owner:</span> {recommendation.threeAccount.ownerPct} (≈ $
            {Math.round(computed.ownerAmt).toLocaleString()})
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-700">
          <div className="font-medium">Copy/paste spreadsheet formula (tax withholding)</div>
          <div className="mt-1 rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs">{recommendation.copyPasteTaxFormula}</div>
          <div className="mt-1 text-xs text-gray-500">Put gross revenue in A2.</div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-white p-4">
        <div className="font-semibold text-[#6B4A2E]">Routines + guardrails</div>
        <div className="mt-3 text-sm text-gray-800">
          <div className="font-medium">Weekly routine</div>
          <div className="mt-1 text-gray-700">{recommendation.weeklyRoutine}</div>

          <div className="mt-4 font-medium">Monthly checklist</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-gray-700">
            {recommendation.monthlyChecklist.map((x: string) => (
              <li key={x}>{x}</li>
            ))}
          </ul>

          <div className="mt-4 font-medium">Automation setup</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-gray-700">
            {recommendation.automation.map((x: string) => (
              <li key={x}>{x}</li>
            ))}
          </ul>

          <div className="mt-4 font-medium text-[#B6522B]">Panic button rule</div>
          <div className="mt-1 text-gray-700">{recommendation.panicRule}</div>
        </div>
      </div>

      {msg ? <div className="mt-4 rounded-lg border bg-white p-3 text-sm text-gray-700">{msg}</div> : null}

      <div className="mt-4 flex gap-3">
        <button
          className="rounded-lg bg-[#1C6F66] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          onClick={save}
          disabled={saving || loading}
        >
          {saving ? "Saving…" : "Save money system"}
        </button>

        <button
          className="rounded-lg border px-4 py-2 text-sm font-medium text-[#1C6F66] hover:bg-[#F0F9F7]"
          onClick={() => router.push("/chapters")}
        >
          Back
        </button>
      </div>

      {loading ? <div className="mt-3 text-sm text-gray-600">Loading…</div> : null}
    </main>
  );
}
