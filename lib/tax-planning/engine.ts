import type {
    TaxCalendarAction,
    TaxCalendarEvent,
    TaxIntake,
    TaxPlanningProfile,
    TaxProfilePriority,
    TaxQuestion,
  } from "./types";
  
  function norm(v: string) {
    return (v || "").trim().toLowerCase();
  }
  
  export function deriveTags(intake: TaxIntake): string[] {
    const tags = new Set<string>();
  
    // Core tags (so the core question bank always matches)
    tags.add("core.books");
    tags.add("core.cash");
  
    const entity = norm(intake.entity_type);
    const industry = norm(intake.industry);
    const revenue = norm(intake.revenue_range);
    const payroll = norm(intake.payroll_headcount);
    const inventory = norm(intake.inventory);
    const multistate = norm(intake.multistate);
    const intl = norm(intake.international);
  
    if (entity) tags.add(`entity.${entity}`);
    if (entity.includes("s_corp") || entity.includes("s corp")) tags.add("entity.s_corp");
    if (entity.includes("c_corp") || entity.includes("c corp")) tags.add("entity.c_corp");
    if (entity.includes("partnership") || entity.includes("multi_member")) tags.add("entity.partnership");
    if (entity.includes("sole") || entity.includes("sole_prop")) tags.add("entity.sole_prop");
    if (entity.includes("nonprofit")) tags.add("entity.nonprofit");
    if (entity.includes("trust")) tags.add("entity.trust");
  
    if (industry) tags.add(`industry.${industry}`);
    if (revenue) tags.add(`revenue.${revenue}`);
  
    if (payroll && payroll !== "0" && payroll !== "none") tags.add("payroll.yes");
    if (!tags.has("payroll.yes")) tags.add("payroll.no");
  
    if (inventory && !inventory.startsWith("no")) tags.add("inventory.yes");
    if (!tags.has("inventory.yes")) tags.add("inventory.no");
  
    if (multistate && !multistate.startsWith("no")) tags.add("multistate.yes");
    if (!tags.has("multistate.yes")) tags.add("multistate.no");
  
    if (intl && !intl.startsWith("no")) tags.add("international.yes");
    if (!tags.has("international.yes")) tags.add("international.no");
  
    if (Array.isArray(intake.states) && intake.states.length > 1) tags.add("states.multi");
    if (Array.isArray(intake.states) && intake.states.length === 1) tags.add(`states.${norm(intake.states[0])}`);
  
    return Array.from(tags);
  }
  
  function buildModules(tags: string[]) {
    const set = new Set<string>();
    set.add("core");
    if (tags.includes("payroll.yes")) set.add("payroll");
    if (tags.includes("inventory.yes")) set.add("inventory");
    if (tags.includes("multistate.yes") || tags.includes("states.multi")) set.add("multistate");
    if (tags.includes("international.yes")) set.add("international");
    if (tags.includes("entity.s_corp")) set.add("owner-pay");
    return Array.from(set);
  }
  
  function priority(title: string, reason: string, tags: string[]): TaxProfilePriority {
    return { title, reason, tags };
  }
  
  function buildPriorities(tags: string[]): TaxProfilePriority[] {
    const list: TaxProfilePriority[] = [];
  
    list.push(
      priority("Clean books", "Monthly reconciles plus clear categories keeps tax time calm.", ["core.books"])
    );
  
    list.push(
      priority("Tax set-aside", "A steady set-aside blocks surprise bills.", ["core.cash"])
    );
  
    if (tags.includes("entity.s_corp")) {
      list.push(
        priority(
          "Owner pay plan",
          "S-corp owners often need wages plus distributions that match the facts.",
          ["entity.s_corp", "owner-pay"]
        )
      );
    }
  
    if (tags.includes("payroll.yes")) {
      list.push(priority("Payroll filings", "Pay dates drive deposits plus quarterly forms.", ["payroll.yes"]));
    }
  
    if (tags.includes("inventory.yes")) {
      list.push(priority("COGS tracking", "Inventory ties straight to profit and taxes.", ["inventory.yes"]));
    }
  
    if (tags.includes("multistate.yes") || tags.includes("states.multi")) {
      list.push(priority("Multi-state watch", "States can create filing and sales tax duties.", ["multistate.yes", "states.multi"]));
    }
  
    if (tags.includes("international.yes")) {
      list.push(priority("Cross-border vendors", "Foreign payees and payments can trigger extra forms.", ["international.yes"]));
    }
  
    return list.slice(0, 6);
  }
  
  function ymd(d: Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  
  function estTaxDates(year: number): TaxCalendarEvent[] {
    const raw = [
      new Date(year, 3, 15),
      new Date(year, 5, 15),
      new Date(year, 8, 15),
      new Date(year + 1, 0, 15),
    ];
  
    return raw.map((d, i) => {
      const label = ["Q1", "Q2", "Q3", "Q4"][i] || "Quarter";
      return {
        title: `Estimated tax due (${label})`,
        date: ymd(d),
        note: "If this lands on a weekend or holiday, use the next business day.",
      };
    });
  }
  
  function quarterCheckIns(year: number): TaxCalendarEvent[] {
    const dates = [new Date(year, 0, 10), new Date(year, 3, 10), new Date(year, 6, 10), new Date(year, 9, 10)];
    const labels = ["Q1", "Q2", "Q3", "Q4"];
    return dates.map((d, i) => ({
      title: `Tax check-in (${labels[i]})`,
      date: ymd(d),
      note: "Review profit, set-aside, filings, and records.",
    }));
  }
  
  function actionToEvents(action: TaxCalendarAction, year: number): TaxCalendarEvent[] {
    const freq = norm(action.frequency);
  
    if (freq === "monthly") {
      return [{ title: action.action_text, date: ymd(new Date(year, 0, 25)), note: "Monthly habit" }];
    }
  
    if (freq === "annual") {
      return [{ title: action.action_text, date: ymd(new Date(year, 11, 1)), note: "Annual review" }];
    }
  
    if (freq === "quarterly") {
      const labels = ["Q1", "Q2", "Q3", "Q4"];
      const d = [new Date(year, 0, 12), new Date(year, 3, 12), new Date(year, 6, 12), new Date(year, 9, 12)];
      return d.map((dt, i) => ({ title: `${action.action_text} (${labels[i]})`, date: ymd(dt) }));
    }
  
    return [];
  }
  
  export function buildTaxPlanningProfile(args: {
    intake: TaxIntake;
    questions: TaxQuestion[];
    actions: TaxCalendarAction[];
    profileVersion?: string;
  }): TaxPlanningProfile {
    const now = new Date();
    const year = now.getFullYear();
  
    const tags = deriveTags(args.intake);
    const modules = buildModules(tags);
    const priorities = buildPriorities(tags);
  
    const questions = [...args.questions]
      .sort((a, b) => (b.priority_weight || 0) - (a.priority_weight || 0))
      .slice(0, 25);
  
    const calendar: TaxCalendarEvent[] = [...quarterCheckIns(year), ...estTaxDates(year)];
    for (const a of args.actions) calendar.push(...actionToEvents(a, year));
  
    const seen = new Set<string>();
    const calendarUniq = calendar.filter((ev) => {
      const key = `${ev.date}::${ev.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  
    calendarUniq.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  
    return {
      profile_version: args.profileVersion || "btbb_tax_v0",
      created_at: now.toISOString(),
      snapshot: args.intake,
      tags,
      modules,
      priorities,
      questions,
      calendar: calendarUniq,
    };
  }
  