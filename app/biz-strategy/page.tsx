"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type OptionRow = {
  id: number;
  set_key: string;
  value: string;
  label: string;
  sort: number | null;
  group_label: string | null;
  help: string | null;
  meta: Record<string, any> | null;
};

const BRAND = {
  teal: "#1C6F66",
  brown: "#6B4A2E",
  gold: "#E8B765",
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

/**
 * Filters are resilient to different meta shapes.
 * If your seed uses slightly different meta keys across rows, this still matches.
 */
function rowMatchesEntity(row: OptionRow, entityValue: string) {
  if (!entityValue) return true;
  const m = row.meta ?? {};
  const candidates = [
    m.entity_key,
    m.entity,
    m.entity_type_key,
    m.entityTypeKey,
    m.entity_type,
    m.entity_value,
    m.entityValue,
    m.entity_family,
    m.entityFamily,
  ].map(safeStr);

  // direct match
  if (candidates.some((c) => norm(c) === norm(entityValue))) return true;

  // sometimes stored inside a nested object
  const nested =
    (m.entity && typeof m.entity === "object" ? m.entity : null) ??
    (m.entity_type && typeof m.entity_type === "object" ? m.entity_type : null);

  if (nested) {
    const nestedCandidates = [
      nested.key,
      nested.value,
      nested.entity_key,
      nested.entity_type_key,
    ].map(safeStr);
    if (nestedCandidates.some((c) => norm(c) === norm(entityValue))) return true;
  }

  // some seeds encode it in group_label (rare, but safe to check)
  if (row.group_label && norm(row.group_label).includes(norm(entityValue))) return true;

  return false;
}

function rowMatchesTier(row: OptionRow, tierValue: string) {
  if (!tierValue) return true;
  const m = row.meta ?? {};
  const candidates = [
    m.tier_key,
    m.tier,
    m.tierKey,
    m.entity_tier_key,
    m.entityTierKey,
    m.tier_value,
    m.tierValue,
    m.level,
  ].map(safeStr);

  if (candidates.some((c) => norm(c) === norm(tierValue))) return true;

  const nested =
    (m.tier && typeof m.tier === "object" ? m.tier : null) ??
    (m.entity_tier && typeof m.entity_tier === "object" ? m.entity_tier : null);

  if (nested) {
    const nestedCandidates = [
      nested.key,
      nested.value,
      nested.tier_key,
      nested.entity_tier_key,
    ].map(safeStr);
    if (nestedCandidates.some((c) => norm(c) === norm(tierValue))) return true;
  }

  return false;
}

function pickTierKey(row: OptionRow): string {
  const m = row.meta ?? {};
  return (
    safeStr(m.entity_tier_key) ||
    safeStr(m.entityTierKey) ||
    safeStr(m.tier_key) ||
    safeStr(m.tierKey) ||
    safeStr(m.tier) ||
    row.value
  );
}

function downloadTextFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BizStrategyPage() {
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const [rows, setRows] = React.useState<OptionRow[]>([]);
  const [entityValue, setEntityValue] = React.useState("");
  const [tierValue, setTierValue] = React.useState("");

  React.useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      const { data, error } = await supabase
        .from("btbb_tax_options")
        .select("id,set_key,value,label,sort,group_label,help,meta")
        .in("set_key", ["ts_entity", "ts_entity_tier", "ts_practice", "ts_action", "ts_watchout"])
        .order("set_key", { ascending: true })
        .order("sort", { ascending: true });

      if (!alive) return;

      if (error) {
        setErr(error.message);
        setRows([]);
        setLoading(false);
        return;
      }

      setRows((data ?? []) as OptionRow[]);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const entities = React.useMemo(() => {
    return rows
      .filter((r) => r.set_key === "ts_entity")
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  }, [rows]);

  const tiersAll = React.useMemo(() => {
    return rows
      .filter((r) => r.set_key === "ts_entity_tier")
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  }, [rows]);

  const tiersForEntity = React.useMemo(() => {
    const filtered = tiersAll.filter((t) => rowMatchesEntity(t, entityValue));

    // de-dupe by the tier key we display
    const seen = new Set<string>();
    const deduped: OptionRow[] = [];
    for (const t of filtered) {
      const k = pickTierKey(t);
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(t);
    }
    return deduped;
  }, [tiersAll, entityValue]);

  // default tier when entity changes (first match)
  React.useEffect(() => {
    if (!entityValue) return;
    if (!tiersForEntity.length) return;
    // if current tier is no longer valid, reset to first
    const stillValid = tiersForEntity.some((t) => pickTierKey(t) === tierValue || t.value === tierValue);
    if (!stillValid) setTierValue(pickTierKey(tiersForEntity[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityValue, tiersForEntity.length]);

  const practicesAll = React.useMemo(() => rows.filter((r) => r.set_key === "ts_practice"), [rows]);
  const actionsAll = React.useMemo(() => rows.filter((r) => r.set_key === "ts_action"), [rows]);
  const watchoutsAll = React.useMemo(() => rows.filter((r) => r.set_key === "ts_watchout"), [rows]);

  const filteredPractices = React.useMemo(() => {
    return practicesAll
      .filter((r) => rowMatchesEntity(r, entityValue))
      .filter((r) => rowMatchesTier(r, tierValue))
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  }, [practicesAll, entityValue, tierValue]);

  const filteredActions = React.useMemo(() => {
    return actionsAll
      .filter((r) => rowMatchesEntity(r, entityValue))
      .filter((r) => rowMatchesTier(r, tierValue))
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  }, [actionsAll, entityValue, tierValue]);

  const filteredWatchouts = React.useMemo(() => {
    return watchoutsAll
      .filter((r) => rowMatchesEntity(r, entityValue))
      .filter((r) => rowMatchesTier(r, tierValue))
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  }, [watchoutsAll, entityValue, tierValue]);

  const selectedEntityLabel =
    entities.find((e) => e.value === entityValue)?.label ?? (entityValue ? entityValue : "Not selected");

  const selectedTierLabel =
    tiersAll.find((t) => pickTierKey(t) === tierValue || t.value === tierValue)?.label ??
    (tierValue ? tierValue : "Not selected");

  const exportJson = () => {
    const payload = {
      entity: { value: entityValue || null, label: selectedEntityLabel },
      tier: { value: tierValue || null, label: selectedTierLabel },
      practices: filteredPractices.map((r) => ({
        value: r.value,
        label: r.label,
        help: r.help,
        meta: r.meta ?? {},
      })),
      actions: filteredActions.map((r) => ({
        value: r.value,
        label: r.label,
        help: r.help,
        meta: r.meta ?? {},
      })),
      watchouts: filteredWatchouts.map((r) => ({
        value: r.value,
        label: r.label,
        help: r.help,
        meta: r.meta ?? {},
      })),
    };
    downloadTextFile("btbb_biz_strategy_export.json", JSON.stringify(payload, null, 2), "application/json");
  };

  const exportCsv = () => {
    const lines: string[] = [];
    lines.push(["type", "label", "help"].map((s) => `"${s.replaceAll('"', '""')}"`).join(","));

    const pushRows = (type: string, list: OptionRow[]) => {
      for (const r of list) {
        const cells = [type, r.label ?? "", r.help ?? ""].map((v) => `"${String(v).replaceAll('"', '""')}"`);
        lines.push(cells.join(","));
      }
    };

    pushRows("practice", filteredPractices);
    pushRows("action", filteredActions);
    pushRows("watchout", filteredWatchouts);

    downloadTextFile("btbb_biz_strategy_export.csv", lines.join("\n"), "text/csv");
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4">
        <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
          Biz Strategy
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight" style={{ color: BRAND.brown }}>
          Strategy Library (Entity + Tier)
        </h1>
        <p className="mt-1 text-sm text-gray-700">
          Pick your structure and tier to see the playbook: practices to consider, actions to take, and watch-outs to track.
        </p>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <div className="font-semibold">Couldn’t load strategy data.</div>
          <div className="mt-1">{err}</div>
          <div className="mt-2 text-xs text-red-700/80">
            This page expects rows in <code className="font-mono">btbb_tax_options</code> with{" "}
            <code className="font-mono">set_key</code> values:
            <span className="ml-1 font-mono">ts_entity, ts_entity_tier, ts_practice, ts_action, ts_watchout</span>.
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        {/* LEFT: Filters */}
        <section className="rounded-2xl border bg-white/85 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
              Filters
            </div>
            <div className="text-xs text-gray-600">{loading ? "Loading…" : `${rows.length} rows loaded`}</div>
          </div>

          <div className="mt-3 grid gap-3">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium" style={{ color: BRAND.brown }}>
                Entity family
                <span className="text-xs text-gray-500" title="These come from your Supabase seed data.">
                  ⓘ
                </span>
              </label>
              <select
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                value={entityValue}
                onChange={(e) => setEntityValue(e.target.value)}
              >
                <option value="">Select…</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-xs text-gray-600">{entities.find((e) => e.value === entityValue)?.help}</div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium" style={{ color: BRAND.brown }}>
                Tier
                <span className="text-xs text-gray-500" title="Tiers vary by entity.">
                  ⓘ
                </span>
              </label>
              <select
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
                value={tierValue}
                onChange={(e) => setTierValue(e.target.value)}
                disabled={!entityValue || tiersForEntity.length === 0}
              >
                <option value="">{!entityValue ? "Pick an entity first…" : "Select…"}</option>
                {tiersForEntity.map((t) => {
                  const key = pickTierKey(t);
                  return (
                    <option key={`${t.id}-${key}`} value={key}>
                      {t.label}
                    </option>
                  );
                })}
              </select>
              <div className="mt-1 text-xs text-gray-600">
                {tiersAll.find((t) => pickTierKey(t) === tierValue)?.help ?? ""}
              </div>
            </div>

            <div className="rounded-xl border bg-gray-50 p-3 text-sm">
              <div className="font-semibold" style={{ color: BRAND.brown }}>
                Current selection
              </div>
              <div className="mt-2 grid gap-1 text-sm text-gray-800">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-600">Entity</span>
                  <span className="font-medium">{selectedEntityLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-600">Tier</span>
                  <span className="font-medium">{selectedTierLabel}</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className={cn(
                    "rounded-md px-3 py-2 text-xs font-semibold text-white",
                    "disabled:opacity-50"
                  )}
                  style={{ backgroundColor: BRAND.teal }}
                  disabled={!entityValue}
                  onClick={exportJson}
                  title="Download the current selection as JSON."
                >
                  Download JSON
                </button>
                <button
                  className={cn(
                    "rounded-md px-3 py-2 text-xs font-semibold text-white",
                    "disabled:opacity-50"
                  )}
                  style={{ backgroundColor: BRAND.brown }}
                  disabled={!entityValue}
                  onClick={exportCsv}
                  title="Download the current selection as CSV."
                >
                  Download CSV
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT: Results */}
        <section className="rounded-2xl border bg-white/85 p-4 shadow-sm backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                Results
              </div>
              <div className="mt-1 text-sm text-gray-700">
                Practices, actions, and watch-outs filtered by your selection.
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="rounded-full border bg-white px-2 py-1">
                Practices: <span className="font-semibold">{filteredPractices.length}</span>
              </span>
              <span className="rounded-full border bg-white px-2 py-1">
                Actions: <span className="font-semibold">{filteredActions.length}</span>
              </span>
              <span className="rounded-full border bg-white px-2 py-1">
                Watch-outs: <span className="font-semibold">{filteredWatchouts.length}</span>
              </span>
            </div>
          </div>

          {!entityValue ? (
            <div className="mt-4 rounded-xl border bg-gray-50 p-4 text-sm text-gray-700">
              Pick an <span className="font-semibold">Entity family</span> to load the relevant tiers and playbook.
            </div>
          ) : null}

          <div className="mt-4 grid gap-4">
            <div className="rounded-xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                  Practices
                </div>
                <div className="text-xs text-gray-600">What to set up or review</div>
              </div>

              <ul className="mt-3 grid gap-2">
                {filteredPractices.length ? (
                  filteredPractices.map((r) => (
                    <li key={`p-${r.id}`} className="rounded-lg border bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-semibold text-gray-900">{r.label}</div>
                        <span className="rounded-full border px-2 py-0.5 text-[11px] text-gray-700">
                          practice
                        </span>
                      </div>
                      {r.help ? <div className="mt-1 text-sm text-gray-700">{r.help}</div> : null}
                    </li>
                  ))
                ) : (
                  <li className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
                    No practices match this selection yet.
                  </li>
                )}
              </ul>
            </div>

            <div className="rounded-xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                  Actions
                </div>
                <div className="text-xs text-gray-600">Next steps you can execute</div>
              </div>

              <ul className="mt-3 grid gap-2">
                {filteredActions.length ? (
                  filteredActions.map((r) => (
                    <li key={`a-${r.id}`} className="rounded-lg border bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-semibold text-gray-900">{r.label}</div>
                        <span className="rounded-full border px-2 py-0.5 text-[11px] text-gray-700">
                          action
                        </span>
                      </div>
                      {r.help ? <div className="mt-1 text-sm text-gray-700">{r.help}</div> : null}
                    </li>
                  ))
                ) : (
                  <li className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
                    No actions match this selection yet.
                  </li>
                )}
              </ul>
            </div>

            <div className="rounded-xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                  Watch-outs
                </div>
                <div className="text-xs text-gray-600">Common failure points</div>
              </div>

              <ul className="mt-3 grid gap-2">
                {filteredWatchouts.length ? (
                  filteredWatchouts.map((r) => (
                    <li key={`w-${r.id}`} className="rounded-lg border bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-semibold text-gray-900">{r.label}</div>
                        <span className="rounded-full border px-2 py-0.5 text-[11px] text-gray-700">
                          watch-out
                        </span>
                      </div>
                      {r.help ? <div className="mt-1 text-sm text-gray-700">{r.help}</div> : null}
                    </li>
                  ))
                ) : (
                  <li className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
                    No watch-outs match this selection yet.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 rounded-xl border bg-white/70 p-4 text-sm text-gray-700">
        <div className="font-semibold" style={{ color: BRAND.brown }}>
          Data source
        </div>
        <div className="mt-1">
          This tab reads from <code className="font-mono">btbb_tax_options</code> using these{" "}
          <code className="font-mono">set_key</code> groups:{" "}
          <span className="font-mono">ts_entity, ts_entity_tier, ts_practice, ts_action, ts_watchout</span>.
        </div>
      </div>
    </main>
  );
}
