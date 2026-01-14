"use client";

import * as React from "react";

import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Download, FileJson, FileSpreadsheet } from "lucide-react";

type Kind = "practice" | "action" | "watchout";

type NormRow = {
  // identity
  entityKey: string; // entity family key
  entityLabel: string;

  tierKey: string; // entity-tier key
  tierLabel: string;
  revenueBand?: string | null;

  // content
  kind: Kind;
  title: string;
  detail: string;

  // sorting + metadata
  sort: number;
  tags: string[];
  source?: string | null;
  raw: Record<string, any>;
};

type TierOption = {
  entityKey: string;
  entityLabel: string;
  tierKey: string;
  tierLabel: string;
  revenueBand?: string | null;
};

const BRAND = {
  teal: "#1C6F66",
  brown: "#6B4A2E",
  gold: "#E8B765",
};

function str(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function num(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pickFirst(row: Record<string, any>, keys: string[]): any {
  for (const k of keys) {
    if (row[k] !== null && row[k] !== undefined && row[k] !== "") return row[k];
  }
  return undefined;
}

function normKind(row: Record<string, any>): Kind {
  const k = str(
    pickFirst(row, ["kind", "item_type", "type", "category", "bucket", "group"])
  ).toLowerCase();

  if (k.includes("practice")) return "practice";
  if (k.includes("action")) return "action";
  if (k.includes("watch") || k.includes("warning") || k.includes("risk"))
    return "watchout";

  // heuristic fallbacks (handles “practice_title”, etc.)
  if (pickFirst(row, ["practice", "practice_title", "practice_name"])) return "practice";
  if (pickFirst(row, ["action", "action_title", "action_name"])) return "action";
  return "watchout";
}

function normTags(row: Record<string, any>): string[] {
  const t = pickFirst(row, ["tags", "tag", "labels"]);
  if (Array.isArray(t)) return t.map((x) => str(x)).filter(Boolean);

  const meta = pickFirst(row, ["meta"]);
  if (meta && typeof meta === "object" && Array.isArray(meta.tags)) {
    return meta.tags.map((x: any) => str(x)).filter(Boolean);
  }

  const s = str(t).trim();
  if (!s) return [];
  // allow comma or pipe separated
  return s
    .split(/[,|]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function normalizeRow(row: Record<string, any>): NormRow {
  // entity
  const entityKey = str(
    pickFirst(row, [
      "entity_key",
      "entity_type_key",
      "entity_family_key",
      "entity_family",
      "entity_type",
      "entity",
    ])
  ).trim();

  const entityLabel =
    str(
      pickFirst(row, [
        "entity_label",
        "entity_type_label",
        "entity_family_label",
        "entity_family",
        "entity_type",
        "entity",
      ])
    ).trim() || entityKey;

  // tier
  const tierKey = str(
    pickFirst(row, [
      "tier_key",
      "entity_tier_key",
      "tier",
      "tier_code",
      "entity_tier",
      "tier_id",
    ])
  ).trim();

  const tierLabel =
    str(
      pickFirst(row, [
        "tier_label",
        "entity_tier_label",
        "tier_name",
        "tier_title",
        "tier_display",
      ])
    ).trim() || tierKey;

  const revenueBand = str(
    pickFirst(row, ["revenue_band", "tier_revenue_band", "rev_band", "band"])
  ).trim();

  const kind = normKind(row);

  const title =
    str(
      pickFirst(row, [
        "title",
        "name",
        "practice_title",
        "practice_name",
        "action_title",
        "action_name",
        "watchout_title",
        "warning_title",
        "risk_title",
        "heading",
      ])
    ).trim() || "(Untitled)";

  const detail =
    str(
      pickFirst(row, [
        "detail",
        "description",
        "practice_detail",
        "practice_description",
        "action_detail",
        "action_description",
        "watchout_detail",
        "warning_detail",
        "risk_detail",
        "body",
        "notes",
      ])
    ).trim() || "";

  const sort = num(pickFirst(row, ["sort", "order", "rank", "priority"]), 9999);

  const tags = normTags(row);
  const source = str(pickFirst(row, ["source", "citation", "ref", "reference"])).trim();

  return {
    entityKey,
    entityLabel,
    tierKey,
    tierLabel,
    revenueBand: revenueBand || null,
    kind,
    title,
    detail,
    sort,
    tags,
    source: source || null,
    raw: row,
  };
}

async function tryLoadFromTable(table: string) {
  // High cap so you don’t silently “load but miss” content
  const { data, error } = await supabase.from(table).select("*").limit(5000);
  if (error) return { ok: false as const, error, data: null };
  return { ok: true as const, error: null, data: (data ?? []) as any[] };
}

async function loadStrategyRows(): Promise<{ rows: NormRow[]; sourceTable: string }> {
  // Try a few likely table names (keeps the page resilient while you evolve schema)
  const candidates = [
    "btbb_tax_strategy_master",
    "btbb_tax_strategy_library",
    "btbb_tax_strategy_rows",
    "btbb_tax_strategy",
    "btbb_strategy_library",
  ];

  let lastErr: any = null;

  for (const t of candidates) {
    const res = await tryLoadFromTable(t);
    if (res.ok) {
      const normalized = res.data.map((r) => normalizeRow(r));
      return { rows: normalized, sourceTable: t };
    }
    lastErr = res.error;
  }

  const msg =
    lastErr?.message ||
    "No strategy table found. Create a strategy library table, then reload.";
  throw new Error(msg);
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCSV(rows: NormRow[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = [
    "kind",
    "entityKey",
    "entityLabel",
    "tierKey",
    "tierLabel",
    "revenueBand",
    "title",
    "detail",
    "tags",
    "source",
    "sort",
  ];
  const lines = [header.map(esc).join(",")];

  for (const r of rows) {
    const line = [
      r.kind,
      r.entityKey,
      r.entityLabel,
      r.tierKey,
      r.tierLabel,
      r.revenueBand ?? "",
      r.title,
      r.detail,
      r.tags.join("|"),
      r.source ?? "",
      String(r.sort),
    ];
    lines.push(line.map((x) => esc(String(x ?? ""))).join(","));
  }

  return lines.join("\n");
}

export default function BizStrategyPage() {
  const [loading, setLoading] = React.useState(true);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);

  const [rows, setRows] = React.useState<NormRow[]>([]);
  const [sourceTable, setSourceTable] = React.useState<string>("");

  // Selection
  const [entityKey, setEntityKey] = React.useState<string>("");
  const [tierKey, setTierKey] = React.useState<string>("");

  // Initial load
  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setLoadErr(null);

        const { rows: loaded, sourceTable: t } = await loadStrategyRows();
        if (!alive) return;

        // keep only rows that have at least one key
        const clean = loaded.filter((r) => r.entityKey || r.tierKey);
        setRows(clean);
        setSourceTable(t);

        // default selection: first usable entity, then first tier within that entity
        const firstEntity = clean.find((r) => r.entityKey)?.entityKey || "";
        const firstEntityLabel =
          clean.find((r) => r.entityKey === firstEntity)?.entityLabel || "";

        if (firstEntity) {
          setEntityKey(firstEntity);

          // choose first tier that matches the entity
          const firstTier = clean.find(
            (r) => r.entityKey === firstEntity && r.tierKey
          );
          if (firstTier?.tierKey) setTierKey(firstTier.tierKey);
        } else if (!firstEntity && clean.find((r) => r.tierKey)?.tierKey) {
          // fallback: tier-only datasets
          const tKey = clean.find((r) => r.tierKey)?.tierKey || "";
          setTierKey(tKey);
          const tRow = clean.find((r) => r.tierKey === tKey);
          if (tRow?.entityKey) {
            setEntityKey(tRow.entityKey);
          }
        }

        // minor: prevent empty label look if entity exists but label missing
        if (firstEntity && !firstEntityLabel) {
          // no-op; UI already falls back to key
        }
      } catch (e: any) {
        if (!alive) return;
        setLoadErr(e?.message || "Failed to load Biz Strategy library.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Build entity list without Set (avoids TS downlevel iteration issues)
  const entities = React.useMemo(() => {
    const out: { key: string; label: string }[] = [];
    const seen: Record<string, boolean> = {};
    for (const r of rows) {
      if (!r.entityKey) continue;
      if (seen[r.entityKey]) continue;
      seen[r.entityKey] = true;
      out.push({ key: r.entityKey, label: r.entityLabel || r.entityKey });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [rows]);

  const allTiers = React.useMemo(() => {
    const out: TierOption[] = [];
    const seen: Record<string, boolean> = {};
    for (const r of rows) {
      if (!r.tierKey) continue;
      const key = `${r.entityKey}__${r.tierKey}`;
      if (seen[key]) continue;
      seen[key] = true;
      out.push({
        entityKey: r.entityKey,
        entityLabel: r.entityLabel || r.entityKey,
        tierKey: r.tierKey,
        tierLabel: r.tierLabel || r.tierKey,
        revenueBand: r.revenueBand ?? null,
      });
    }
    out.sort((a, b) => a.tierLabel.localeCompare(b.tierLabel));
    return out;
  }, [rows]);

  const tiersForEntity = React.useMemo(() => {
    if (!entityKey) return allTiers;
    return allTiers.filter((t) => t.entityKey === entityKey);
  }, [allTiers, entityKey]);

  // Keep tier synced when entity changes (prevents mismatched pairs)
  React.useEffect(() => {
    if (!entityKey) return;
    if (!tierKey) {
      if (tiersForEntity[0]?.tierKey) setTierKey(tiersForEntity[0].tierKey);
      return;
    }
    const stillValid = tiersForEntity.some((t) => t.tierKey === tierKey);
    if (!stillValid) {
      if (tiersForEntity[0]?.tierKey) setTierKey(tiersForEntity[0].tierKey);
    }
  }, [entityKey, tierKey, tiersForEntity]);

  const selectedTier = React.useMemo(() => {
    if (!tierKey) return null;
    return allTiers.find((t) => t.tierKey === tierKey) || null;
  }, [allTiers, tierKey]);

  // If user picks a tier that belongs to a different entity (rare after sync), snap entity to it
  React.useEffect(() => {
    if (!selectedTier?.entityKey) return;
    if (entityKey && selectedTier.entityKey !== entityKey) {
      setEntityKey(selectedTier.entityKey);
    }
  }, [selectedTier, entityKey]);

  const filteredRows = React.useMemo(() => {
    // Match tier first (best signal), then entity as supporting signal.
    // This makes the page work even if some rows are tier-only or entity-only.
    return rows.filter((r) => {
      const tierMatch =
        !tierKey ||
        r.tierKey === tierKey ||
        r.tierKey === "" ||
        r.tierKey.toLowerCase() === "all" ||
        r.tierKey.toLowerCase() === "any";

      const entityMatch =
        !entityKey ||
        r.entityKey === entityKey ||
        r.entityKey === "" ||
        r.entityKey.toLowerCase() === "all" ||
        r.entityKey.toLowerCase() === "any";

      return tierMatch && entityMatch;
    });
  }, [rows, tierKey, entityKey]);

  const practices = React.useMemo(
    () =>
      filteredRows
        .filter((r) => r.kind === "practice")
        .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title)),
    [filteredRows]
  );

  const actions = React.useMemo(
    () =>
      filteredRows
        .filter((r) => r.kind === "action")
        .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title)),
    [filteredRows]
  );

  const watchouts = React.useMemo(
    () =>
      filteredRows
        .filter((r) => r.kind === "watchout")
        .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title)),
    [filteredRows]
  );

  const currentEntityLabel =
    entities.find((e) => e.key === entityKey)?.label || entityKey || "—";

  const currentTierLabel =
    selectedTier?.tierLabel ||
    tiersForEntity.find((t) => t.tierKey === tierKey)?.tierLabel ||
    tierKey ||
    "—";

  const currentRevenueBand =
    selectedTier?.revenueBand ||
    (filteredRows.find((r) => r.revenueBand)?.revenueBand ?? null);

  function onDownloadJSON() {
    const payload = {
      source_table: sourceTable,
      selection: {
        entity_key: entityKey || null,
        entity_label: currentEntityLabel,
        tier_key: tierKey || null,
        tier_label: currentTierLabel,
        revenue_band: currentRevenueBand ?? null,
      },
      counts: {
        total_rows_matched: filteredRows.length,
        practices: practices.length,
        actions: actions.length,
        watchouts: watchouts.length,
      },
      practices: practices.map((r) => ({
        title: r.title,
        detail: r.detail,
        tags: r.tags,
        source: r.source,
        sort: r.sort,
      })),
      actions: actions.map((r) => ({
        title: r.title,
        detail: r.detail,
        tags: r.tags,
        source: r.source,
        sort: r.sort,
      })),
      watchouts: watchouts.map((r) => ({
        title: r.title,
        detail: r.detail,
        tags: r.tags,
        source: r.source,
        sort: r.sort,
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    downloadBlob("btbb_biz_strategy_export.json", blob);
  }

  function onDownloadCSV() {
    const merged = [...practices, ...actions, ...watchouts];
    const csv = toCSV(merged);
    const blob = new Blob([csv], { type: "text/csv" });
    downloadBlob("btbb_biz_strategy_export.csv", blob);
  }

  const pageBgClass =
    "bg-[radial-gradient(ellipse_at_top,rgba(232,183,101,0.18),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(28,111,102,0.14),transparent_55%)]";

  // Background image (keeps your transparent art sitting behind the full layout)
  const bgImageStyle: React.CSSProperties = {
    backgroundImage: "url('/assets/web-app-background.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    opacity: 0.22,
  };

  return (
    <main className="relative min-h-[calc(100vh-64px)] pb-24">
      <div className={cn("absolute inset-0 -z-20", pageBgClass)} />
      <div className="pointer-events-none absolute inset-0 -z-10" style={bgImageStyle} />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <div className="text-sm" style={{ color: BRAND.brown, opacity: 0.9 }}>
            Biz Strategy
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight" style={{ color: BRAND.brown }}>
            Strategy Library (Entity + Tier)
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-700">
            Pick your structure and tier to see the playbook: practices to consider, actions to take,
            and watch-outs to track.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <Badge variant="secondary" className="bg-white/80">
              {loading ? "Loading…" : `${rows.length} rows loaded`}
            </Badge>
            {sourceTable ? (
              <Badge variant="secondary" className="bg-white/80">
                Source: {sourceTable}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT: Filters */}
          <div className="lg:col-span-5">
            <Card className="bg-white/90 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base" style={{ color: BRAND.brown }}>
                  Filters
                </CardTitle>
                <CardDescription>
                  Choose an entity family and tier. Results update instantly.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {loadErr ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {loadErr}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium" style={{ color: BRAND.brown }}>
                      Entity family
                    </label>
                    <span className="text-xs text-gray-500"> </span>
                  </div>

                  <select
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2"
                    style={{ ["--tw-ring-color" as any]: BRAND.teal }}
                    value={entityKey}
                    onChange={(e) => setEntityKey(e.target.value)}
                    disabled={loading || !!loadErr || entities.length === 0}
                  >
                    {entities.length === 0 ? (
                      <option value="">No entities found</option>
                    ) : (
                      entities.map((e) => (
                        <option key={e.key} value={e.key}>
                          {e.label}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium" style={{ color: BRAND.brown }}>
                      Tier
                    </label>
                    <span className="text-xs text-gray-500">
                      {currentRevenueBand ? `Revenue band: ${currentRevenueBand}` : ""}
                    </span>
                  </div>

                  <select
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2"
                    style={{ ["--tw-ring-color" as any]: BRAND.teal }}
                    value={tierKey}
                    onChange={(e) => setTierKey(e.target.value)}
                    disabled={loading || !!loadErr || tiersForEntity.length === 0}
                  >
                    {tiersForEntity.length === 0 ? (
                      <option value="">No tiers found</option>
                    ) : (
                      tiersForEntity.map((t) => (
                        <option key={`${t.entityKey}__${t.tierKey}`} value={t.tierKey}>
                          {t.tierLabel}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <Card className="bg-white/80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm" style={{ color: BRAND.brown }}>
                      Current selection
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-gray-600">Entity</div>
                      <div className="text-right" style={{ color: BRAND.brown }}>
                        {currentEntityLabel}
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-gray-600">Tier</div>
                      <div className="text-right" style={{ color: BRAND.brown }}>
                        {currentTierLabel}
                      </div>
                    </div>
                    {currentRevenueBand ? (
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-gray-600">Revenue band</div>
                        <div className="text-right" style={{ color: BRAND.brown }}>
                          {currentRevenueBand}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="gap-2"
                        style={{ backgroundColor: BRAND.teal }}
                        onClick={onDownloadJSON}
                        disabled={loading || !!loadErr}
                      >
                        <FileJson className="h-4 w-4" aria-hidden />
                        Download JSON
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="gap-2"
                        onClick={onDownloadCSV}
                        disabled={loading || !!loadErr}
                      >
                        <FileSpreadsheet className="h-4 w-4" aria-hidden />
                        Download CSV
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Lightweight diagnostics */}
                <div className="rounded-md border bg-white/70 px-3 py-2 text-xs text-gray-600">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>
                      Matched: <b>{filteredRows.length}</b>
                    </span>
                    <span>•</span>
                    <span>
                      Practices: <b>{practices.length}</b>
                    </span>
                    <span>•</span>
                    <span>
                      Actions: <b>{actions.length}</b>
                    </span>
                    <span>•</span>
                    <span>
                      Watch-outs: <b>{watchouts.length}</b>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Results */}
          <div className="lg:col-span-7">
            <Card className="bg-white/90 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base" style={{ color: BRAND.brown }}>
                      Results
                    </CardTitle>
                    <CardDescription>
                      Practices, actions, and watch-outs filtered by your selection.
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-white/90 text-gray-700" variant="secondary">
                      Practices: {practices.length}
                    </Badge>
                    <Badge className="bg-white/90 text-gray-700" variant="secondary">
                      Actions: {actions.length}
                    </Badge>
                    <Badge className="bg-white/90 text-gray-700" variant="secondary">
                      Watch-outs: {watchouts.length}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <Card className="bg-white/85">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm" style={{ color: BRAND.brown }}>
                      Practices
                    </CardTitle>
                    <CardDescription>What to set up or review</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {practices.length === 0 ? (
                      <div className="rounded-md border bg-white px-3 py-3 text-sm text-gray-600">
                        No practices match this selection yet.
                      </div>
                    ) : (
                      practices.slice(0, 40).map((p, idx) => (
                        <div
                          key={`${p.kind}-${p.tierKey}-${idx}-${p.title}`}
                          className="rounded-md border bg-white px-3 py-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="font-medium" style={{ color: BRAND.brown }}>
                              {p.title}
                            </div>
                            {p.tags.length ? (
                              <div className="flex flex-wrap gap-1">
                                {p.tags.slice(0, 4).map((t) => (
                                  <Badge key={t} variant="secondary" className="bg-gray-100">
                                    {t}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          {p.detail ? (
                            <div className="mt-1 text-sm text-gray-700">{p.detail}</div>
                          ) : null}
                          {p.source ? (
                            <div className="mt-2 text-xs text-gray-500">Source: {p.source}</div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white/85">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm" style={{ color: BRAND.brown }}>
                      Actions
                    </CardTitle>
                    <CardDescription>Next steps you can execute</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {actions.length === 0 ? (
                      <div className="rounded-md border bg-white px-3 py-3 text-sm text-gray-600">
                        No actions match this selection yet.
                      </div>
                    ) : (
                      actions.slice(0, 40).map((a, idx) => (
                        <div
                          key={`${a.kind}-${a.tierKey}-${idx}-${a.title}`}
                          className="rounded-md border bg-white px-3 py-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="font-medium" style={{ color: BRAND.brown }}>
                              {a.title}
                            </div>
                            {a.tags.length ? (
                              <div className="flex flex-wrap gap-1">
                                {a.tags.slice(0, 4).map((t) => (
                                  <Badge key={t} variant="secondary" className="bg-gray-100">
                                    {t}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          {a.detail ? (
                            <div className="mt-1 text-sm text-gray-700">{a.detail}</div>
                          ) : null}
                          {a.source ? (
                            <div className="mt-2 text-xs text-gray-500">Source: {a.source}</div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white/85">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm" style={{ color: BRAND.brown }}>
                      Watch-outs
                    </CardTitle>
                    <CardDescription>Common failure points</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {watchouts.length === 0 ? (
                      <div className="rounded-md border bg-white px-3 py-3 text-sm text-gray-600">
                        No watch-outs match this selection yet.
                      </div>
                    ) : (
                      watchouts.slice(0, 40).map((w, idx) => (
                        <div
                          key={`${w.kind}-${w.tierKey}-${idx}-${w.title}`}
                          className="rounded-md border bg-white px-3 py-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="font-medium" style={{ color: BRAND.brown }}>
                              {w.title}
                            </div>
                            {w.tags.length ? (
                              <div className="flex flex-wrap gap-1">
                                {w.tags.slice(0, 4).map((t) => (
                                  <Badge key={t} variant="secondary" className="bg-gray-100">
                                    {t}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          {w.detail ? (
                            <div className="mt-1 text-sm text-gray-700">{w.detail}</div>
                          ) : null}
                          {w.source ? (
                            <div className="mt-2 text-xs text-gray-500">Source: {w.source}</div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-2 text-sm"
                    onClick={() => {
                      // quick export of just the filtered content
                      const blob = new Blob([toCSV([...practices, ...actions, ...watchouts])], {
                        type: "text/csv",
                      });
                      downloadBlob("btbb_biz_strategy_filtered.csv", blob);
                    }}
                    disabled={loading || !!loadErr}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Export filtered rows
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="mt-4 text-xs text-gray-500">
              Tip: if a tier looks wrong for the selected entity, re-pick the entity first. The tier
              list is now entity-scoped.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
