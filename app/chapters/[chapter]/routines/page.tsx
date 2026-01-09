"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/hooks/useSession";

type RoutineRow = {
  id: string;
  user_id: string;
  routine_key: string;
  title: string | null;
  items: any; // jsonb
};

function toStringArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (Array.isArray(v.items)) return v.items.map((x: any) => String(x));
  if (Array.isArray(v.lines)) return v.lines.map((x: any) => String(x));
  return [];
}

export default function DailyRoutinesPage() {
  const { session, loading } = useSession();
  const params = useParams<{ chapter: string }>();
  const chapter = String(params?.chapter ?? "");

  const userId = session?.user?.id ?? null;

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [routines, setRoutines] = useState<Array<{ routine_key: string; title: string; items: string[] }>>([
    { routine_key: "morning", title: "Morning routine", items: ["One key action to start the day"] },
    { routine_key: "midday", title: "Midday routine", items: ["One check-in to stay on track"] },
    { routine_key: "end", title: "End-of-day routine", items: ["One closeout step to finish clean"] },
  ]);

  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const todayStr = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setMsg(null);
      if (!userId) return;

      // load 3 routines for this user (morning/midday/end)
      const { data, error } = await supabase
        .from("daily_routines")
        .select("id,user_id,routine_key,title,items")
        .eq("user_id", userId)
        .in("routine_key", ["morning", "midday", "end"])
        .order("routine_key", { ascending: true });

      if (cancelled) return;

      if (error) {
        setMsg(error.message);
        return;
      }

      if (data && data.length > 0) {
        const rows = (data as RoutineRow[]).map((r) => ({
          routine_key: r.routine_key,
          title: r.title ?? (r.routine_key === "end" ? "End-of-day routine" : `${r.routine_key[0].toUpperCase()}${r.routine_key.slice(1)} routine`),
          items: toStringArray(r.items),
        }));

        // guarantee we always have all 3 keys
        const map = new Map(rows.map((x) => [x.routine_key, x]));
        const merged = ["morning", "midday", "end"].map((k) => map.get(k) ?? { routine_key: k, title: k === "end" ? "End-of-day routine" : `${k[0].toUpperCase()}${k.slice(1)} routine`, items: [""] });

        setRoutines(merged);
      }

      // load today's completion (one row per day)
      const { data: cData, error: cErr } = await supabase
        .from("routine_completions")
        .select("checked")
        .eq("user_id", userId)
        .eq("completed_date", todayStr)
        .maybeSingle();

      if (cancelled) return;

      if (cErr) {
        // not fatal; just show message
        setMsg(cErr.message);
        return;
      }

      const c = (cData as any)?.checked;
      if (c && typeof c === "object") {
        setChecked(c);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, todayStr]);

  function setRoutineTitle(idx: number, value: string) {
    setRoutines((prev) => prev.map((r, i) => (i === idx ? { ...r, title: value } : r)));
  }

  function setRoutineItem(idx: number, itemIdx: number, value: string) {
    setRoutines((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const items = [...r.items];
        items[itemIdx] = value;
        return { ...r, items };
      })
    );
  }

  function addRoutineItem(idx: number) {
    setRoutines((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        return { ...r, items: [...r.items, ""] };
      })
    );
  }

  function toggle(key: string) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function saveAll() {
    setMsg(null);

    if (!userId) {
      setMsg("You must be signed in to save.");
      return;
    }

    setSaving(true);
    try {
      // 1) save routines (3 rows)
      const payload = routines.map((r) => ({
        user_id: userId,
        routine_key: r.routine_key,
        title: r.title,
        items: r.items.filter((x) => String(x ?? "").trim().length > 0),
        updated_at: new Date().toISOString(),
      }));

      const { error: rErr } = await supabase.from("daily_routines").upsert(payload, {
        onConflict: "user_id,routine_key",
      });

      if (rErr) throw rErr;

      // 2) save ONE completion row for today (upsert by user_id + completed_date)
      const { error: cErr } = await supabase.from("routine_completions").upsert(
        {
          user_id: userId,
          completed_date: todayStr,
          checked,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,completed_date" }
      );

      if (cErr) throw cErr;

      setMsg("Saved.");
    } catch (e: any) {
      setMsg(e?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="text-xl font-semibold text-[#6B4A2E]">Stable Ground</div>
        <div className="mt-6 rounded-xl border bg-white p-4">Loading…</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="text-xl font-semibold text-[#6B4A2E]">Stable Ground</div>

      <div className="mt-2 text-sm text-gray-600">
        Chapter {chapter} — Daily routines
      </div>

      <div className="mt-6 rounded-xl border bg-white p-4">
        <div className="text-lg font-semibold text-[#6B4A2E]">Your 3 daily routines</div>
        <div className="mt-2 text-sm text-gray-600">Check at least one box, then save to record today’s completion.</div>

        <div className="mt-4 space-y-6">
          {routines.map((r, idx) => (
            <div key={r.routine_key} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-800">{r.routine_key.toUpperCase()}</div>
                <div className="text-xs text-gray-500">{todayStr}</div>
              </div>

              <label className="mt-2 block text-xs text-gray-600">Title</label>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={r.title}
                onChange={(e) => setRoutineTitle(idx, e.target.value)}
              />

              <div className="mt-3 text-xs font-semibold text-gray-700">Checklist</div>
              <div className="mt-2 space-y-2">
                {r.items.map((it, itemIdx) => {
                  const key = `${r.routine_key}:${itemIdx}`;
                  return (
                    <div key={key} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={!!checked[key]}
                        onChange={() => toggle(key)}
                      />
                      <input
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        value={it}
                        onChange={(e) => setRoutineItem(idx, itemIdx, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>

              <button
                className="mt-3 rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => addRoutineItem(idx)}
                type="button"
              >
                + Add line
              </button>
            </div>
          ))}
        </div>

        {msg ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {msg}
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-3">
          <button
            className="rounded-lg bg-[#1C6F66] px-4 py-2 text-sm font-medium text-white hover:bg-[#165a53]"
            onClick={saveAll}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save routines + today"}
          </button>

          <Link className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50" href={`/chapters/${chapter}`}>
            Back
          </Link>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4 text-xs text-gray-500">
        <Link className="underline" href="/privacy">Privacy</Link>
        <Link className="underline" href="/terms">Terms</Link>
        <Link className="underline" href="/refunds">Refunds</Link>
      </div>
    </main>
  );
}
