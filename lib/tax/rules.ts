export type Intake = {
    entity_legal_form: string;
    entity_tax_classification: string;
    state_codes: string[];
    industry: string;
    revenue_range: string;
    payroll_w2_bracket: string;
    inventory: boolean;
    multi_state: boolean;
    international: boolean;
  };
  
  export type RuleOp = "eq" | "neq" | "contains" | "in" | "truthy" | "falsy";
  
  export type Rule = {
    field: keyof Intake;
    op: RuleOp;
    value?: any;
  };
  
  export type RuleGroup =
    | { all: Rule[] }
    | { any: Rule[] };
  
  export function evalRule(intake: Intake, rule: Rule): boolean {
    const v = intake[rule.field];
  
    if (rule.op === "truthy") return Boolean(v);
    if (rule.op === "falsy") return !Boolean(v);
  
    if (typeof v === "string") {
      if (rule.op === "eq") return v === String(rule.value ?? "");
      if (rule.op === "neq") return v !== String(rule.value ?? "");
      if (rule.op === "contains") return v.toLowerCase().includes(String(rule.value ?? "").toLowerCase());
      if (rule.op === "in") {
        const arr = Array.isArray(rule.value) ? rule.value : [];
        return arr.map(String).includes(v);
      }
    }
  
    if (Array.isArray(v)) {
      if (rule.op === "contains") return v.map(String).includes(String(rule.value ?? ""));
      if (rule.op === "in") {
        const arr = Array.isArray(rule.value) ? rule.value : [];
        return v.some((x) => arr.map(String).includes(String(x)));
      }
      if (rule.op === "eq") return JSON.stringify(v) === JSON.stringify(rule.value ?? []);
      if (rule.op === "neq") return JSON.stringify(v) !== JSON.stringify(rule.value ?? []);
    }
  
    if (typeof v === "boolean") {
      if (rule.op === "eq") return v === Boolean(rule.value);
      if (rule.op === "neq") return v !== Boolean(rule.value);
    }
  
    return false;
  }
  
  export function evalRuleGroup(intake: Intake, group?: any): boolean {
    if (!group) return false;
  
    const anyRules: Rule[] | undefined = Array.isArray(group.any) ? group.any : undefined;
    const allRules: Rule[] | undefined = Array.isArray(group.all) ? group.all : undefined;
  
    if (anyRules) return anyRules.some((r) => evalRule(intake, r));
    if (allRules) return allRules.every((r) => evalRule(intake, r));
  
    return false;
  }
  
  export function guessBestFitFromRules(
    intake: Intake,
    suggestions: Array<{ value: string; when: any }>
  ): string {
    for (const s of suggestions) {
      if (evalRuleGroup(intake, s.when)) return s.value;
    }
    return "";
  }
  
  export function calcConfidence(args: {
    intake: Intake;
    hasDecision: boolean;
    evidenceCompletePct: number; // 0..1
  }): number {
    const { intake, hasDecision, evidenceCompletePct } = args;
  
    const fields: Array<[keyof Intake, (v: any) => boolean]> = [
      ["entity_legal_form", (v) => String(v || "").trim().length > 0],
      ["entity_tax_classification", (v) => String(v || "").trim().length > 0],
      ["state_codes", (v) => Array.isArray(v) && v.length > 0],
      ["industry", (v) => String(v || "").trim().length > 0],
      ["revenue_range", (v) => String(v || "").trim().length > 0],
      ["payroll_w2_bracket", (v) => String(v || "").trim().length > 0],
      ["inventory", (_v) => true],
      ["multi_state", (_v) => true],
      ["international", (_v) => true],
    ];
  
    const filled = fields.reduce((acc, [k, ok]) => acc + (ok(intake[k]) ? 1 : 0), 0);
    const intakePct = filled / fields.length;
  
    let score = 10;
    score += Math.round(intakePct * 45);
    score += hasDecision ? 10 : 0;
    score += Math.round(evidenceCompletePct * 35);
  
    return Math.max(0, Math.min(100, score));
  }
  