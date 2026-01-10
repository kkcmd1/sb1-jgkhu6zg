export type TaxIntake = {
    entity_type: string;
    states: string[];
    industry: string;
    revenue_range: string;
    payroll_headcount: string;
    inventory: string;
    multistate: string;
    international: string;
  };
  
  export type TaxDropdownOption = {
    category: string;
    value: string;
    label: string;
    sort_order: number | null;
    meta: Record<string, unknown> | null;
  };
  
  export type TaxQuestion = {
    id: string;
    question_key: string;
    module: string;
    difficulty: string;
    priority_weight: number;
    tags: string[];
    question_text: string;
    plain_language_help: string;
    why_it_matters: string;
  };
  
  export type TaxCalendarAction = {
    id: string;
    action_key: string;
    action_text: string;
    frequency: string;
    timing: Record<string, unknown> | null;
    tags: string[];
  };
  
  export type TaxProfilePriority = {
    title: string;
    reason: string;
    tags: string[];
  };
  
  export type TaxCalendarEvent = {
    title: string;
    date: string; // YYYY-MM-DD
    note?: string;
  };
  
  export type TaxPlanningProfile = {
    profile_version: string;
    created_at: string;
    snapshot: TaxIntake;
    tags: string[];
    modules: string[];
    priorities: TaxProfilePriority[];
    questions: TaxQuestion[];
    calendar: TaxCalendarEvent[];
  };
  