"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type StepRow = {
  action: string;
  tool: string;
  time: string;
  quality: string;
  notes: string;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function SopBuilderPage() {
  const params = useParams<{ chapter: string }>();
  const chapter = String(params?.chapter ?? "");
  const allowed = chapter === "6" || chapter === "5"; // use it from Chapter 6 even if Chapter 5 is locked

  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [trigger, setTrigger] = useState("");
  const [owner, setOwner] = useState("");
  const [tools, setTools] = useState("");
  const [timeEstimate, setTimeEstimate] = useState("");
  const [qualityStandard, setQualityStandard] = useState("");

  const [steps, setSteps] = useState<StepRow[]>(
    Array.from({ length: 12 }).map(() => ({
      action: "",
      tool: "",
      time: "",
      quality: "",
      notes: "",
    }))
  );

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const sopKey = useMemo(() => slugify(title || "untitled-sop"), [title]);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      setAuthLoading(true);
      const { data } = await supabase.auth.getSession();
      const uid = data?.session?.user?.id ?? null;
      if (!mounted) return;
      setUserId(uid);
      setAuthLoading(false);
    }

    loadSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function saveSop() {
    setStatus("");

    if (!userId) {
      setStatus("You must be signed in to save.");
      return;
    }

    if (!title.trim()) {
      setStatus("Add an SOP name first.");
      return;
    }

    setSaving(true);

    const payload = {
      user_id: userId,
      sop_key: sopKey,
      title: title.trim(),
      data: {
        sop_name: title.trim(),
        purpose,
        trigger,
        owner,
        tools_used: tools,
        time_estimate: timeEstimate,
        quality_standard: qualityStandard,
        steps,
      },
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("sops")
      .upsert(payload as any, { onConflict: "user_id,sop_key" });

    if (error) {
      setSaving(false);
      setStatus(`Save failed: ${error.message}`);
      return;
    }

    setSaving(false);
    setStatus("Saved.");
  }

  if (!allowed) {
    return (
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="text-xl font-semibold text-[#6B4A2E]">Stable Ground</div>
        <div className="mt-6 rounded-xl border bg-white p-4">
          <div className="text-lg font-semibold text-[#6B4A2E]">SOP Builder</div>
          <div className="mt-2 text-sm text-gray-600">Open this from Chapter 6.</div>
          <div className="mt-4">
            <Link className="underline text-[#1C6F66]" href="/chapters/6">
              Go to Chapter 6
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
        <div className="text-lg font-semibold text-[#6B4A2E]">SOP Builder</div>
        <div className="mt-1 text-sm text-gray-600">Save one SOP at a time.</div>

        <div className="mt-4 grid gap-3">
          <div>
            <div className="text-sm font-medium text-[#6B4A2E]">SOP name</div>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Example: Weekly Admin Block"
            />
          </div>

          <div>
            <div className="text-sm font-medium text-[#6B4A2E]">Purpose</div>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Why this SOP exists"
            />
          </div>

          <div>
            <div className="text-sm font-medium text-[#6B4A2E]">Trigger</div>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="This starts when…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-medium text-[#6B4A2E]">Owner</div>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="Role/person"
              />
            </div>
            <div>
              <div className="text-sm font-medium text-[#6B4A2E]">Time estimate</div>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={timeEstimate}
                onChange={(e) => setTimeEstimate(e.target.value)}
                placeholder="Example: 45 minutes"
              />
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-[#6B4A2E]">Tools used</div>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={tools}
              onChange={(e) => setTools(e.target.value)}
              placeholder="Apps, links, logins"
            />
          </div>

          <div>
            <div className="text-sm font-medium text-[#6B4A2E]">Quality standard</div>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={qualityStandard}
              onChange={(e) => setQualityStandard(e.target.value)}
              placeholder="Done correctly looks like…"
            />
          </div>
        </div>

        <div className="mt-5 rounded-xl border p-3">
          <div className="font-semibold text-[#6B4A2E]">Steps (12)</div>
          <div className="mt-3 grid gap-3">
            {steps.map((row, idx) => (
              <div key={idx} className="rounded-lg border p-3">
                <div className="text-sm font-medium text-[#6B4A2E]">Step {idx + 1}</div>

                <div className="mt-2 grid gap-2">
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    value={row.action}
                    onChange={(e) =>
                      setSteps((p) =>
                        p.map((r, i) => (i === idx ? { ...r, action: e.target.value } : r))
                      )
                    }
                    placeholder="Action"
                  />
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    value={row.tool}
                    onChange={(e) =>
                      setSteps((p) =>
                        p.map((r, i) => (i === idx ? { ...r, tool: e.target.value } : r))
                      )
                    }
                    placeholder="Tool / link"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      value={row.time}
                      onChange={(e) =>
                        setSteps((p) =>
                          p.map((r, i) => (i === idx ? { ...r, time: e.target.value } : r))
                        )
                      }
                      placeholder="Time"
                    />
                    <input
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      value={row.quality}
                      onChange={(e) =>
                        setSteps((p) =>
                          p.map((r, i) => (i === idx ? { ...r, quality: e.target.value } : r))
                        )
                      }
                      placeholder="Quality check"
                    />
                  </div>
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    value={row.notes}
                    onChange={(e) =>
                      setSteps((p) =>
                        p.map((r, i) => (i === idx ? { ...r, notes: e.target.value } : r))
                      )
                    }
                    placeholder="Notes"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            className="rounded-lg bg-[#1C6F66] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={saveSop}
            disabled={saving || authLoading}
          >
            {saving ? "Saving…" : "Save SOP"}
          </button>

          <Link
            className="rounded-lg border border-[#1C6F66] px-4 py-2 text-sm font-medium text-[#1C6F66] hover:bg-[#F0F9F7]"
            href="/chapters/6"
          >
            Back
          </Link>
        </div>

        <div className="mt-3 text-sm text-gray-600">
          {status || (authLoading ? "Checking sign-in…" : !userId ? "Not signed in." : "Ready.")}
        </div>

        {!userId && !authLoading && (
          <div className="mt-2 text-sm">
            <Link className="underline" href="/settings">
              Open Settings to sign in
            </Link>
          </div>
        )}
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
