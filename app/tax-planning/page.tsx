"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CalendarDays, Download, FileText, ListChecks } from "lucide-react";
import { buildIcs, downloadTextFile } from "@/lib/tax/ics";
import { calcConfidence, evalRuleGroup, guessBestFitFromRules, type Intake } from "@/lib/tax/rules";
import { buildTaxPositionMemoMarkdown } from "@/lib/tax/memo";

const BRAND = {
  teal: "#1C6F66",
  brown: "#6B4A2E",
  gold: "#E8B765",
};

type DecisionTopicRow = {
  key: string;
  title: string;
  decision_question: string;
  options: any;
  suggestion_rules: any;
  rationale: string;
  tradeoffs: any;
  audit_narrative: string;
  sort: number;
};

type EvidenceLibraryRow = {
  key: string;
  topic_key: string;
  title: string;
  required: boolean;
  accepted_file_types: string[];
  done_definition: string;
  review_cadence: string;
  sample_template_filename: string | null;
  sample_template_text: string | null;
  sort: number;
};

type UserEvidenceRow = {
  id: string;
  user_id: string;
  evidence_key: string;
  status: "missing" | "in_progress" | "complete";
  notes: string;
};

type MemoRow = {
  id: string;
  user_id: string;
  topic_key: string;
  decision_value: string;
  confidence: number;
  memo_markdown: string;
  version: number;
  created_at: string;
};

type WatchlistRow = {
  key: string;
  title: string;
  trigger_rules: any;
  readiness_checklist: string[];
  consequence: string;
  decision_prompt: any;
  deadlines: any;
  question_suggestions: string[];
  calendar_title: string;
  calendar_description: string;
  calendar_duration_mins: number;
  tags: string[];
  sort: number;
};

function safeJsonArray<T = any>(v: any): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object" && Array.isArray((v as any).items)) return (v as any).items as T[];
  return [];
}

function normalizeTopic(row: DecisionTopicRow) {
  const options = safeJsonArray<any>(row.options);
  return {
    key: row.key,
    title: row.title,
    decision_question: row.decision_question,
    options: options.map((o) => ({
      value: String(o.value ?? ""),
      label: String(o.label ?? ""),
      outcomes: safeJsonArray<string>(o.outcomes),
    })),
    suggestion_rules: safeJsonArray<any>(row.suggestion_rules),
    rationale: row.rationale,
    tradeoffs: row.tradeoffs,
    audit_narrative: row.audit_narrative,
  };
}

function intakeDefaults(): Intake {
  return {
    entity_legal_form: "",
    entity_tax_classification: "",
    state_codes: [],
    industry: "",
    revenue_range: "",
    payroll_w2_bracket: "0",
    inventory: false,
    multi_state: false,
    international: false,
  };
}

export default function TaxPlanningPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);

  const [intake, setIntake] = useState<Intake>(intakeDefaults());

  const [topics, setTopics] = useState<DecisionTopicRow[]>([]);
  const [evidenceLib, setEvidenceLib] = useState<EvidenceLibraryRow[]>([]);
  const [userEvidence, setUserEvidence] = useState<UserEvidenceRow[]>([]);
  const [priorMemos, setPriorMemos] = useState<MemoRow[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistRow[]>([]);
  const [activeTopicKey, setActiveTopicKey] = useState<string>("");

  const [decisionValue, setDecisionValue] = useState<string>("");
  const [assumptionsText, setAssumptionsText] = useState<string>(
    "Books are reasonably complete for the period covered by this memo.\nThis memo reflects current facts; changes in workers, states, inventory, or entity status can change the answer."
  );
  const [cpaQuestionsText, setCpaQuestionsText] = useState<string>(
    "Are there any fact patterns here that change the recommended treatment?\nWhat documentation would you want to see to be comfortable signing a return?\nWhat deadlines should be added to the calendar for this topic?"
  );

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr) {
        toast.error(uErr.message);
        setLoading(false);
        return;
      }

      const uid = u.user?.id ?? null;
      setUserId(uid);

      if (!uid) {
        router.push("/auth");
        return;
      }

      const [{ data: intakeRow }, { data: topicRows }, { data: evRows }, { data: ueRows }, { data: memRows }, { data: wlRows }] =
        await Promise.all([
          supabase.from("btbb_tax_intake").select("*").eq("user_id", uid).maybeSingle(),
          supabase.from("btbb_tax_decision_topics").select("*").order("sort", { ascending: true }),
          supabase.from("btbb_tax_evidence_library").select("*").order("sort", { ascending: true }),
          supabase.from("btbb_tax_user_evidence").select("*").eq("user_id", uid),
          supabase.from("btbb_tax_decision_memos").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
          supabase.from("btbb_tax_watchlist_library").select("*").order("sort", { ascending: true }),
        ]);

      if (intakeRow) {
        setIntake({
          entity_legal_form: String(intakeRow.entity_legal_form ?? ""),
          entity_tax_classification: String(intakeRow.entity_tax_classification ?? ""),
          state_codes: Array.isArray(intakeRow.state_codes) ? intakeRow.state_codes : [],
          industry: String(intakeRow.industry ?? ""),
          revenue_range: String(intakeRow.revenue_range ?? ""),
          payroll_w2_bracket: String(intakeRow.payroll_w2_bracket ?? "0"),
          inventory: Boolean(intakeRow.inventory ?? false),
          multi_state: Boolean(intakeRow.multi_state ?? false),
          international: Boolean(intakeRow.international ?? false),
        });
      }

      const t = (topicRows ?? []) as any[];
      setTopics(t as DecisionTopicRow[]);
      const firstTopic = (t[0]?.key as string | undefined) ?? "";
      setActiveTopicKey(firstTopic);

      setEvidenceLib((evRows ?? []) as EvidenceLibraryRow[]);
      setUserEvidence((ueRows ?? []) as UserEvidenceRow[]);
      setPriorMemos((memRows ?? []) as MemoRow[]);
      setWatchlist((wlRows ?? []) as WatchlistRow[]);

      setLoading(false);
    })();
  }, [router]);

  const normalizedTopics = useMemo(() => topics.map(normalizeTopic), [topics]);

  const activeTopic = useMemo(() => normalizedTopics.find((t) => t.key === activeTopicKey) ?? null, [normalizedTopics, activeTopicKey]);

  const topicEvidence = useMemo(() => {
    const lib = evidenceLib.filter((e) => e.topic_key === activeTopicKey);
    const map = new Map(userEvidence.map((ue) => [ue.evidence_key, ue]));
    return lib.map((e) => {
      const ue = map.get(e.key);
      const status = ue?.status ?? "missing";
      return {
        ...e,
        status,
        notes: ue?.notes ?? "",
      };
    });
  }, [evidenceLib, userEvidence, activeTopicKey]);

  const evidenceCompletePct = useMemo(() => {
    if (!topicEvidence.length) return 0;
    const complete = topicEvidence.filter((e) => e.status === "complete").length;
    return complete / topicEvidence.length;
  }, [topicEvidence]);

  const bestFit = useMemo(() => {
    if (!activeTopic) return "";
    return guessBestFitFromRules(intake, activeTopic.suggestion_rules);
  }, [intake, activeTopic]);

  useEffect(() => {
    if (!decisionValue && bestFit) setDecisionValue(bestFit);
  }, [bestFit, decisionValue]);

  const decisionLabel = useMemo(() => {
    if (!activeTopic) return "";
    return activeTopic.options.find((o) => o.value === decisionValue)?.label ?? "";
  }, [activeTopic, decisionValue]);

  const confidence = useMemo(() => {
    return calcConfidence({
      intake,
      hasDecision: Boolean(decisionValue),
      evidenceCompletePct,
    });
  }, [intake, decisionValue, evidenceCompletePct]);

  const visibleWatchlist = useMemo(() => {
    return watchlist.filter((w) => evalRuleGroup(intake, w.trigger_rules));
  }, [watchlist, intake]);

  async function saveIntake() {
    if (!userId) return;
    setSaving(true);

    const payload = {
      user_id: userId,
      entity_legal_form: intake.entity_legal_form,
      entity_tax_classification: intake.entity_tax_classification,
      state_codes: intake.state_codes,
      industry: intake.industry,
      revenue_range: intake.revenue_range,
      payroll_w2_bracket: intake.payroll_w2_bracket,
      inventory: intake.inventory,
      multi_state: intake.multi_state,
      international: intake.international,
    };

    const { error } = await supabase.from("btbb_tax_intake").upsert(payload, { onConflict: "user_id" });
    setSaving(false);

    if (error) toast.error(error.message);
    else toast.success("Saved.");
  }

  async function setEvidenceStatus(evidenceKey: string, status: UserEvidenceRow["status"]) {
    if (!userId) return;
    const { error } = await supabase
      .from("btbb_tax_user_evidence")
      .upsert({ user_id: userId, evidence_key: evidenceKey, status }, { onConflict: "user_id,evidence_key" });
    if (error) toast.error(error.message);
    else {
      setUserEvidence((prev) => {
        const idx = prev.findIndex((x) => x.evidence_key === evidenceKey);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], status };
          return copy;
        }
        return [...prev, { id: crypto.randomUUID(), user_id: userId, evidence_key: evidenceKey, status, notes: "" }];
      });
    }
  }

  async function setEvidenceNotes(evidenceKey: string, notes: string) {
    if (!userId) return;
    const { error } = await supabase
      .from("btbb_tax_user_evidence")
      .upsert({ user_id: userId, evidence_key: evidenceKey, notes }, { onConflict: "user_id,evidence_key" });
    if (error) toast.error(error.message);
    else {
      setUserEvidence((prev) => {
        const idx = prev.findIndex((x) => x.evidence_key === evidenceKey);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], notes };
          return copy;
        }
        return [...prev, { id: crypto.randomUUID(), user_id: userId, evidence_key: evidenceKey, status: "missing", notes }];
      });
    }
  }

  async function saveNewMemoVersion() {
    if (!userId || !activeTopic) return;

    const existing = priorMemos.filter((m) => m.topic_key === activeTopic.key);
    const nextVersion = existing.length ? Math.max(...existing.map((m) => m.version)) + 1 : 1;

    const evidenceForMemo = topicEvidence.map((e) => ({
      evidence_key: e.key,
      title: e.title,
      required: e.required,
      status: e.status,
      done_definition: e.done_definition,
      review_cadence: e.review_cadence,
    }));

    const assumptions = assumptionsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const cpaQs = cpaQuestionsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const memoMarkdown = buildTaxPositionMemoMarkdown({
      topic: {
        key: activeTopic.key,
        title: activeTopic.title,
        decision_question: activeTopic.decision_question,
        options: activeTopic.options,
        rationale: activeTopic.rationale,
        tradeoffs: activeTopic.tradeoffs,
        audit_narrative: activeTopic.audit_narrative,
      },
      version: nextVersion,
      decisionValue,
      decisionLabel: decisionLabel || decisionValue || "(no selection)",
      confidence,
      intake,
      evidence: evidenceForMemo,
      assumptions,
      cpaQuestions: cpaQs,
    });

    const attached = evidenceForMemo.filter((x) => x.status === "complete").map((x) => x.evidence_key);
    const missing = evidenceForMemo.filter((x) => x.status !== "complete").map((x) => x.evidence_key);

    const { error } = await supabase.from("btbb_tax_decision_memos").insert({
      user_id: userId,
      topic_key: activeTopic.key,
      decision_value: decisionValue,
      confidence,
      facts: intake as any,
      assumptions,
      attached_evidence: attached,
      missing_evidence: missing,
      cpa_questions: cpaQs,
      memo_markdown: memoMarkdown,
      version: nextVersion,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Saved memo v${nextVersion}`);
    setPriorMemos((prev) => [
      {
        id: crypto.randomUUID(),
        user_id: userId,
        topic_key: activeTopic.key,
        decision_value: decisionValue,
        confidence,
        memo_markdown: memoMarkdown,
        version: nextVersion,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  function exportCurrentMemo() {
    if (!activeTopic) return;

    const existing = priorMemos.filter((m) => m.topic_key === activeTopic.key);
    const version = existing.length ? Math.max(...existing.map((m) => m.version)) : 1;

    const evidenceForMemo = topicEvidence.map((e) => ({
      evidence_key: e.key,
      title: e.title,
      required: e.required,
      status: e.status,
      done_definition: e.done_definition,
      review_cadence: e.review_cadence,
    }));

    const assumptions = assumptionsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const cpaQs = cpaQuestionsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const memoMarkdown = buildTaxPositionMemoMarkdown({
      topic: {
        key: activeTopic.key,
        title: activeTopic.title,
        decision_question: activeTopic.decision_question,
        options: activeTopic.options,
        rationale: activeTopic.rationale,
        tradeoffs: activeTopic.tradeoffs,
        audit_narrative: activeTopic.audit_narrative,
      },
      version,
      decisionValue,
      decisionLabel: decisionLabel || decisionValue || "(no selection)",
      confidence,
      intake,
      evidence: evidenceForMemo,
      assumptions,
      cpaQuestions: cpaQs,
    });

    downloadTextFile(`tax-position-memo_${activeTopic.key}.md`, memoMarkdown, "text/plain");
  }

  async function addWatchlistToMyBoard(watchKey: string) {
    if (!userId) return;
    const { error } = await supabase
      .from("btbb_tax_user_watchlist")
      .upsert({ user_id: userId, watch_key: watchKey, status: "watching" }, { onConflict: "user_id,watch_key" });
    if (error) toast.error(error.message);
    else toast.success("Added to your watchlist.");
  }

  async function addQuestionsToMyList(item: WatchlistRow) {
    if (!userId) return;

    const qs = item.question_suggestions ?? [];
    if (!qs.length) {
      toast.message("No suggested questions found for this item.");
      return;
    }

    const rows = qs.map((q, idx) => ({
      user_id: userId,
      source: "watchlist",
      topic: item.title,
      question: q,
      priority: 20 + idx,
    }));

    const { error } = await supabase.from("btbb_tax_question_queue").insert(rows);
    if (error) toast.error(error.message);
    else toast.success("Added questions to your list.");
  }

  function addToCalendar(item: WatchlistRow, dateHint?: string) {
    const start = new Date();
    start.setHours(9, 0, 0, 0);

    const ics = buildIcs({
      title: item.calendar_title || item.title || "BTBB Tax Planning",
      description: `${item.calendar_description || ""}\n\nWatchlist item: ${item.title}\nDate hint: ${dateHint || ""}`.trim(),
      startLocal: start,
      durationMinutes: item.calendar_duration_mins || 30,
    });

    downloadTextFile(`btbb_watchlist_${item.key}.ics`, ics, "text/calendar");
    toast.success("Downloaded calendar file (.ics).");
  }

  const entityLegalFormOptions = [
    "Sole proprietorship (no entity formed)",
    "Single-member LLC (SMLLC)",
    "Multi-member LLC",
    "General partnership (GP)",
    "Limited partnership (LP)",
    "Limited liability partnership (LLP)",
    "Limited liability limited partnership (LLLP)",
    "C corporation (Inc./Corp.)",
    "S corporation (Inc./Corp. or LLC that elected S status)",
    "Nonprofit corporation",
    "Cooperative (co-op)",
    "Trust-owned operating entity",
    "Joint venture",
    "Foreign entity registered to do business in a state",
  ];

  const entityTaxOptions = [
    "Disregarded entity",
    "Partnership taxation",
    "S corporation taxation",
    "C corporation taxation",
    "Nonprofit / tax-exempt organization",
    "Trust taxation",
  ];

  const revenueRanges = [
    "Pre-revenue (no sales yet)",
    "$1–$10,000",
    "$10,001–$25,000",
    "$25,001–$50,000",
    "$50,001–$100,000",
    "$100,001–$250,000",
    "$250,001–$500,000",
    "$500,001–$1,000,000",
    "$1,000,001–$2,500,000",
    "$2,500,001–$5,000,000",
    "$5,000,001–$10,000,000",
    "$10,000,001–$25,000,000",
    "$25,000,001–$50,000,000",
    "$50,000,001–$100,000,000",
    "$100,000,001–$250,000,000",
    "$250,000,001–$500,000,000",
    "$500,000,001–$1,000,000,000",
    "$1B+",
  ];

  const payrollW2Brackets = ["0", "1", "2–3", "4–5", "6–10", "11–19", "20–49", "50–99", "100–249", "250–499", "500–999", "1,000+"];

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl p-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle style={{ color: BRAND.brown }}>Tax Planning</CardTitle>
            <CardDescription>Loading…</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle style={{ color: BRAND.brown }}>BTBB Tax Planning — Phase 3</CardTitle>
          <CardDescription>
            This page implements two Phase 3 blocks: Decision Memo + Audit Binder and Elections + Threshold Radar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTitle>Before Phase 3 runs, intake needs to exist</AlertTitle>
            <AlertDescription>
              The memo and watchlist are driven by your answers below. Save once, then the rest of the page becomes personalized.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle style={{ color: BRAND.brown }}>Intake (inputs 1–8)</CardTitle>
          <CardDescription>These inputs drive the memo generator and the watchlist triggers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>1) Entity type (legal form)</Label>
              <Select value={intake.entity_legal_form} onValueChange={(v) => setIntake((p) => ({ ...p, entity_legal_form: v }))}>
                <SelectTrigger><SelectValue placeholder="Select one" /></SelectTrigger>
                <SelectContent>
                  {entityLegalFormOptions.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>1) Entity type (tax treatment)</Label>
              <Select
                value={intake.entity_tax_classification}
                onValueChange={(v) => setIntake((p) => ({ ...p, entity_tax_classification: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select one" /></SelectTrigger>
                <SelectContent>
                  {entityTaxOptions.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>2) State(s) (comma-separated codes)</Label>
              <Input
                value={intake.state_codes.join(", ")}
                onChange={(e) =>
                  setIntake((p) => ({
                    ...p,
                    state_codes: e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="NC, SC, GA"
              />
            </div>

            <div className="space-y-2">
              <Label>3) Industry</Label>
              <Input value={intake.industry} onChange={(e) => setIntake((p) => ({ ...p, industry: e.target.value }))} placeholder="E-commerce / services / etc." />
            </div>

            <div className="space-y-2">
              <Label>4) Revenue range</Label>
              <Select value={intake.revenue_range} onValueChange={(v) => setIntake((p) => ({ ...p, revenue_range: v }))}>
                <SelectTrigger><SelectValue placeholder="Select one" /></SelectTrigger>
                <SelectContent>
                  {revenueRanges.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>5) Payroll headcount (count each worker type separately) — W-2 employees (on payroll)</Label>
              <Select value={intake.payroll_w2_bracket} onValueChange={(v) => setIntake((p) => ({ ...p, payroll_w2_bracket: v }))}>
                <SelectTrigger><SelectValue placeholder="Pick one bracket" /></SelectTrigger>
                <SelectContent>
                  {payrollW2Brackets.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">6) Inventory</div>
                <div className="text-sm text-muted-foreground">Yes / no</div>
              </div>
              <Switch checked={intake.inventory} onCheckedChange={(v) => setIntake((p) => ({ ...p, inventory: v }))} />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">7) Multi-state</div>
                <div className="text-sm text-muted-foreground">Yes / no</div>
              </div>
              <Switch checked={intake.multi_state} onCheckedChange={(v) => setIntake((p) => ({ ...p, multi_state: v }))} />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3 md:col-span-2">
              <div>
                <div className="font-medium">8) International</div>
                <div className="text-sm text-muted-foreground">Yes / no</div>
              </div>
              <Switch checked={intake.international} onCheckedChange={(v) => setIntake((p) => ({ ...p, international: v }))} />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={saveIntake} disabled={saving} style={{ backgroundColor: BRAND.teal }}>
              Save intake
            </Button>
            <div className="text-sm text-muted-foreground">Saved intake is used across memo + watchlist.</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recommendation 4 — Decision Memo + Audit Binder (auto-created, versioned, exportable)
          </CardTitle>
          <CardDescription>
            What the user sees: Every “next step” is not just a task. It produces a short Tax Position Memo the user can save,
            re-open, and export. This is how advisory firms document judgment calls.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTitle>How it works on the page</AlertTitle>
            <AlertDescription>
              <div className="space-y-2">
                <div>Each major planning topic gets a “Decision Workspace” with 4 tabs:</div>
                <ul className="list-disc ml-5">
                  <li>Decision</li>
                  <li>Rationale</li>
                  <li>Proof Pack</li>
                  <li>Memo</li>
                </ul>
                <div className="mt-2">Decision tab includes:</div>
                <ul className="list-disc ml-5">
                  <li>A single decision question (radio options)</li>
                  <li>“Best fit for you” suggestion</li>
                  <li>“Confidence” meter + what inputs raise confidence</li>
                  <li>“If you pick this” outcomes (1–2 lines)</li>
                </ul>
                <div className="mt-2">Rationale tab includes:</div>
                <ul className="list-disc ml-5">
                  <li>Plain-English reason</li>
                  <li>“Tradeoffs” (pros/cons)</li>
                  <li>“If asked, say this” (audit narrative draft)</li>
                </ul>
                <div className="mt-2">Proof Pack tab includes:</div>
                <ul className="list-disc ml-5">
                  <li>A checklist of evidence items (what counts as proof)</li>
                  <li>Each item has: required / optional</li>
                  <li>what file types are accepted</li>
                  <li>sample templates (if needed)</li>
                  <li>“Done definition” and “review cadence”</li>
                </ul>
                <div className="mt-2">Memo tab auto-generates a 1–2 page “Tax Position Memo”:</div>
                <ul className="list-disc ml-5">
                  <li>Facts (from intake)</li>
                  <li>Assumptions (explicit)</li>
                  <li>Decision selected + date</li>
                  <li>Risks and mitigations</li>
                  <li>Documents attached / missing</li>
                  <li>CPA questions (copy/paste)</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-1 space-y-2">
              <Label>Planning topic</Label>
              <Select
                value={activeTopicKey}
                onValueChange={(v) => {
                  setActiveTopicKey(v);
                  setDecisionValue("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a topic" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="rounded-md border p-3">
                <div className="text-sm font-medium">Confidence</div>
                <div className="text-xs text-muted-foreground mb-2">
                  Based on intake completeness + proof pack completeness + a selected decision.
                </div>
                <Progress value={confidence} />
                <div className="mt-2 text-xs text-muted-foreground">{confidence}/100</div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-sm font-medium">Saved memo versions</div>
                <div className="text-xs text-muted-foreground">Newest first (topic-specific).</div>
                <div className="max-h-48 overflow-auto space-y-2">
                  {priorMemos
                    .filter((m) => m.topic_key === activeTopicKey)
                    .slice(0, 10)
                    .map((m) => (
                      <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div>
                          <div className="text-sm">v{m.version}</div>
                          <div className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            downloadTextFile(
                              `tax-position-memo_${m.topic_key}_v${m.version}.md`,
                              m.memo_markdown,
                              "text/plain"
                            );
                          }}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Export
                        </Button>
                      </div>
                    ))}
                  {priorMemos.filter((m) => m.topic_key === activeTopicKey).length === 0 ? (
                    <div className="text-sm text-muted-foreground">No saved memos yet.</div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              {!activeTopic ? (
                <div className="rounded-md border p-6 text-sm text-muted-foreground">No topic selected.</div>
              ) : (
                <Tabs defaultValue="decision" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="decision">Decision</TabsTrigger>
                    <TabsTrigger value="rationale">Rationale</TabsTrigger>
                    <TabsTrigger value="proof">Proof Pack</TabsTrigger>
                    <TabsTrigger value="memo">Memo</TabsTrigger>
                  </TabsList>

                  <TabsContent value="decision" className="space-y-4">
                    <div className="rounded-md border p-4">
                      <div className="text-sm font-medium">{activeTopic.decision_question}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Best fit for you suggestion:{" "}
                        <span className="font-medium">{bestFit ? bestFit : "(none yet)"}</span>
                      </div>

                      <RadioGroup value={decisionValue} onValueChange={setDecisionValue} className="mt-4 space-y-3">
                        {activeTopic.options.map((o) => (
                          <div key={o.value} className="flex items-start gap-3 rounded-md border p-3">
                            <RadioGroupItem value={o.value} id={`opt-${o.value}`} />
                            <div className="space-y-1">
                              <Label htmlFor={`opt-${o.value}`} className="font-medium">
                                {o.label}
                              </Label>
                              {o.outcomes?.length ? (
                                <ul className="list-disc ml-5 text-xs text-muted-foreground">
                                  {o.outcomes.slice(0, 2).map((x, i) => (
                                    <li key={i}>{x}</li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </TabsContent>

                  <TabsContent value="rationale" className="space-y-4">
                    <div className="rounded-md border p-4 space-y-3">
                      <div>
                        <div className="text-sm font-medium">Plain-English reason</div>
                        <div className="text-sm text-muted-foreground mt-1">{activeTopic.rationale}</div>
                      </div>

                      <Separator />

                      <div>
                        <div className="text-sm font-medium">“Tradeoffs” (pros/cons)</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {Array.isArray(activeTopic.tradeoffs) ? (
                            <ul className="list-disc ml-5">
                              {activeTopic.tradeoffs.map((t: any, i: number) => (
                                <li key={i}>{String(t)}</li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-xs">(none)</div>
                          )}
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <div className="text-sm font-medium">“If asked, say this” (audit narrative draft)</div>
                        <div className="text-sm text-muted-foreground mt-1">{activeTopic.audit_narrative}</div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="proof" className="space-y-4">
                    <div className="rounded-md border p-4">
                      <div className="text-sm font-medium">A checklist of evidence items (what counts as proof)</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Mark items complete and add notes. Sample templates can be downloaded when present.
                      </div>

                      <div className="mt-4 space-y-3">
                        {topicEvidence.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No evidence items found for this topic.</div>
                        ) : (
                          topicEvidence.map((e) => (
                            <div key={e.key} className="rounded-md border p-3 space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium flex items-center gap-2">
                                    {e.title}
                                    {e.required ? <Badge style={{ backgroundColor: BRAND.gold, color: "#111" }}>required</Badge> : <Badge variant="secondary">optional</Badge>}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Accepted: {(e.accepted_file_types || []).join(", ") || "n/a"}
                                  </div>
                                </div>

                                <Select
                                  value={e.status}
                                  onValueChange={(v) => setEvidenceStatus(e.key, v as any)}
                                >
                                  <SelectTrigger className="w-44">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="missing">missing</SelectItem>
                                    <SelectItem value="in_progress">in_progress</SelectItem>
                                    <SelectItem value="complete">complete</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="grid gap-2 md:grid-cols-2">
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-medium">Done definition:</span> {e.done_definition}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-medium">Review cadence:</span> {e.review_cadence}
                                </div>
                              </div>

                              <Textarea
                                value={e.notes}
                                onChange={(ev) => setEvidenceNotes(e.key, ev.target.value)}
                                placeholder="Notes… (what you have, where it is stored, what’s missing)"
                              />

                              {(e.sample_template_filename && e.sample_template_text) ? (
                                <div className="flex items-center justify-between">
                                  <div className="text-xs text-muted-foreground">
                                    sample templates (if needed): {e.sample_template_filename}
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => downloadTextFile(e.sample_template_filename!, e.sample_template_text!, "text/plain")}
                                  >
                                    <Download className="h-4 w-4 mr-1" /> Download template
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="memo" className="space-y-4">
                    <div className="rounded-md border p-4 space-y-3">
                      <div className="text-sm font-medium">Auto-generates a 1–2 page “Tax Position Memo”</div>
                      <div className="text-xs text-muted-foreground">
                        Facts are pulled from intake; assumptions and CPA questions are editable. Save as a new version.
                      </div>

                      <Separator />

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Assumptions (explicit)</Label>
                          <Textarea value={assumptionsText} onChange={(e) => setAssumptionsText(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>CPA questions (copy/paste)</Label>
                          <Textarea value={cpaQuestionsText} onChange={(e) => setCpaQuestionsText(e.target.value)} />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button onClick={saveNewMemoVersion} style={{ backgroundColor: BRAND.teal }}>
                          Save new memo version
                        </Button>
                        <Button variant="outline" onClick={exportCurrentMemo}>
                          <Download className="h-4 w-4 mr-1" />
                          Export memo (MD)
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            const payload = {
                              topic: activeTopic?.key,
                              intake,
                              decisionValue,
                              confidence,
                              evidence: topicEvidence,
                            };
                            downloadTextFile(`memo_payload_${activeTopic?.key}.json`, JSON.stringify(payload, null, 2), "application/json");
                          }}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Export payload (JSON)
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Recommendation 6 — Elections + Threshold Radar (deadlines, consequences, readiness)
          </CardTitle>
          <CardDescription>
            What the user sees: A guided “Elections & Thresholds” board that says: “These are the decisions and deadlines
            that can cost money if missed.”
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTitle>How it works on the page</AlertTitle>
            <AlertDescription>
              <div className="space-y-2">
                <div>Add a new block inside Phase 3: “Watchlist”</div>
                <ul className="list-disc ml-5">
                  <li>Elections to consider (based on profile)</li>
                  <li>Thresholds to watch (based on profile)</li>
                  <li>Deadlines coming up (calendar-linked)</li>
                </ul>

                <div className="mt-2">Each item shows:</div>
                <ul className="list-disc ml-5">
                  <li>Trigger: what makes this relevant (ex: entity type, revenue band, payroll, inventory, multi-state)</li>
                  <li>Readiness checklist: what must be true before taking action</li>
                  <li>What happens if missed: plain-English consequence</li>
                  <li>Decision prompt: a short Q/A to decide if it applies</li>
                  <li>Action button: “Add to calendar” + “Add questions to my list”</li>
                </ul>

                <div className="mt-2">Examples of watchlist items (driven by your existing intake):</div>
                <ul className="list-disc ml-5">
                  <li>Payroll present → payroll compliance cadence + year-end forms readiness</li>
                  <li>Inventory present → accounting method prompts + COGS substantiation pack</li>
                  <li>Multi-state yes → sales-tax tracking + nexus watch</li>
                  <li>S-corp selection → owner comp planning prompts + wage reasonableness evidence pack</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          <div className="rounded-md border p-3">
            <div className="font-medium">Watchlist</div>
            <div className="text-sm text-muted-foreground mt-1">
              Elections to consider (based on profile) • Thresholds to watch (based on profile) • Deadlines coming up
              (calendar-linked)
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {visibleWatchlist.map((item) => {
              const deadlines = safeJsonArray<any>(item.deadlines);
              const prompt = item.decision_prompt || {};
              const promptQ = String(prompt.question ?? "");
              const promptA = safeJsonArray<string>(prompt.answers);

              return (
                <Card key={item.key}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" /> {item.title}
                    </CardTitle>
                    <CardDescription>
                      <span className="font-medium">What happens if missed:</span> {item.consequence}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {(item.tags || []).map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </div>

                    {deadlines.length ? (
                      <div className="rounded-md border p-3">
                        <div className="text-sm font-medium">Deadlines coming up</div>
                        <ul className="mt-2 list-disc ml-5 text-sm text-muted-foreground">
                          {deadlines.map((d, i) => (
                            <li key={i}>
                              {String(d.label ?? "Deadline")}: {String(d.date_hint ?? "")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="rounded-md border p-3">
                      <div className="text-sm font-medium">Readiness checklist</div>
                      <ul className="mt-2 list-disc ml-5 text-sm text-muted-foreground">
                        {(item.readiness_checklist || []).map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>

                    {(promptQ || promptA.length) ? (
                      <Accordion type="single" collapsible>
                        <AccordionItem value="decision">
                          <AccordionTrigger>Decision prompt</AccordionTrigger>
                          <AccordionContent>
                            <div className="text-sm font-medium">{promptQ}</div>
                            {promptA.length ? (
                              <ul className="mt-2 list-disc ml-5 text-sm text-muted-foreground">
                                {promptA.map((a, i) => (
                                  <li key={i}>{a}</li>
                                ))}
                              </ul>
                            ) : null}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => addWatchlistToMyBoard(item.key)}
                      >
                        Add to my watchlist
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => addQuestionsToMyList(item)}
                      >
                        Add questions to my list
                      </Button>

                      <Button
                        onClick={() => addToCalendar(item, deadlines?.[0]?.date_hint)}
                        style={{ backgroundColor: BRAND.teal }}
                      >
                        Add to calendar (.ics)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {visibleWatchlist.length === 0 ? (
              <div className="rounded-md border p-6 text-sm text-muted-foreground md:col-span-2">
                No watchlist items match your current intake.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Tip: For “Export memo as PDF”, use your browser print dialog after exporting the memo to a clean Markdown viewer, or keep the MD export as the source of truth for versioning.
      </div>
    </main>
  );
}
