"use client";

import * as React from "react";
import JSZip from "jszip";
import * as jspdf from "jspdf";
import { Info, Download, ChevronRight, CalendarDays, ListChecks, FileText, ShieldCheck } from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Json = Record<string, any>;

type OptionRow = {
  id?: number;
  set_key: string;
  value: string;
  label: string;
  sort?: number | null;
  group_label?: string | null;
  help?: string | null;
  meta?: Json | null;
};

type OptionsByKey = Record<string, OptionRow[]>;

type Intake = {
  entity_type: string;
  states: string[];
  industry: string;
  revenue_range: string;
  payroll_w2: string;
  inventory_presence: "yes" | "no" | "";
  multistate_presence: "yes" | "no" | "";
  international_presence: "yes" | "no" | "";
};

type Profile = {
  entity_type: string;
  states: string[];
  industry: string;
  revenue_range: string;
  payroll_w2: string;
  inventory_presence: "yes" | "no";
  multistate_presence: "yes" | "no";
  international_presence: "yes" | "no";
  extras: Record<string, any>;
};

type Question = {
  id: string;
  group: string;
  priority: number; // lower = higher priority
  prompt: string;
  why: string;
  proof: string[];
  tags: string[];
  when: (p: Profile) => boolean;
};

type CalendarItem = {
  id: string;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  title: string;
  why: string;
  proof: string[];
  tags: string[];
  when: (p: Profile) => boolean;
};

type MemoVersion = {
  id: string;
  created_at: string;
  topic: string;
  decision: string;
  confidence: number;
  text: string;
};

const BRAND = {
  teal: "#1C6F66",
  brown: "#6B4A2E",
  gold: "#E8B765",
};

const APP_BG = "/assets/web-app-background.png"; // keep as-is if this is your current asset path

const OPTION_KEYS = [
  "entity_type",
  "us_states",
  "industry",
  "revenue_range",
  "payroll_w2",
  "inventory_presence",
  "multistate_presence",
  "international_presence",
] as const;

function bySort(a: OptionRow, b: OptionRow) {
  const sa = a.sort ?? 0;
  const sb = b.sort ?? 0;
  if (sa !== sb) return sa - sb;
  return (a.label || "").localeCompare(b.label || "");
}

function groupOptions(rows: OptionRow[]): OptionsByKey {
  const out: OptionsByKey = {};
  for (const r of rows) {
    if (!out[r.set_key]) out[r.set_key] = [];
    out[r.set_key].push(r);
  }
  return out;
}

function uniqByValue(rows: OptionRow[]) {
  const seen: Record<string, boolean> = {};
  const out: OptionRow[] = [];
  for (const r of rows) {
    const k = `${r.set_key}::${r.value}`;
    if (seen[k]) continue;
    seen[k] = true;
    out.push(r);
  }
  return out;
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

function escapeCsv(val: string) {
  const s = String(val ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function revenueTier(v: string) {
  // maps your current seeded values like: pre_revenue, 1_10k, 10_25k, 25_50k, 50_100k, 100_250k, 250_500k, 500_1m, 1m_2_5m...
  const map: Record<string, number> = {
    pre_revenue: 0,
    "1_10k": 1,
    "10_25k": 2,
    "25_50k": 3,
    "50_100k": 4,
    "100_250k": 5,
    "250_500k": 6,
    "500_1m": 7,
    "1m_2_5m": 8,
    "2_5m_5m": 9,
    "5m_10m": 10,
    "10m_25m": 11,
    "25m_50m": 12,
    "50m_100m": 13,
    "100m_250m": 14,
    "250m_500m": 15,
    "500m_1b": 16,
    "1b_plus": 17,
  };
  return map[v] ?? 0;
}

function hasPayroll(p: Profile) {
  return p.payroll_w2 !== "" && p.payroll_w2 !== "0";
}

function useLocalStorageState<T>(key: string, initial: T) {
  const [val, setVal] = React.useState<T>(initial);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      setVal(JSON.parse(raw));
    } catch {}
  }, [key]);

  React.useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  }, [key, val]);

  return [val, setVal] as const;
}

/**
 * FALLBACK OPTION DATA (keeps the page working even if RLS blocks reads or rows are missing)
 * This is the “big data” that got cut in the earlier file.
 */
const FALLBACK_ENTITY_TYPE: OptionRow[] = [
  { set_key: "entity_type", value: "sole_prop", label: "Sole proprietorship (no entity formed)", sort: 10, group_label: "Legal form", help: "One owner operating without an entity.", meta: {} },
  { set_key: "entity_type", value: "smllc", label: "Single-member LLC (SMLLC)", sort: 20, group_label: "Legal form", help: "One owner LLC. Default federal tax is disregarded.", meta: {} },
  { set_key: "entity_type", value: "mmllc", label: "Multi-member LLC", sort: 30, group_label: "Legal form", help: "Two+ owners. Default federal tax is partnership.", meta: {} },
  { set_key: "entity_type", value: "gp", label: "General partnership (GP)", sort: 40, group_label: "Legal form", help: "Two+ owners. Liability depends on facts and state law.", meta: {} },
  { set_key: "entity_type", value: "lp", label: "Limited partnership (LP)", sort: 50, group_label: "Legal form", help: "General partner + limited partner(s).", meta: {} },
  { set_key: "entity_type", value: "llp", label: "Limited liability partnership (LLP)", sort: 60, group_label: "Legal form", help: "Common in many professional firm setups.", meta: {} },
  { set_key: "entity_type", value: "c_corp", label: "C corporation (Inc./Corp.)", sort: 70, group_label: "Legal form", help: "Entity-level tax; dividends can add a second layer.", meta: {} },
  { set_key: "entity_type", value: "s_corp", label: "S corporation (election)", sort: 80, group_label: "Tax status", help: "Tax status; wages + distributions; eligibility rules apply.", meta: {} },
  { set_key: "entity_type", value: "nonprofit", label: "Nonprofit corporation", sort: 90, group_label: "Legal form", help: "State-law nonprofit. Exempt status is separate.", meta: {} },
  { set_key: "entity_type", value: "coop", label: "Cooperative (co-op)", sort: 100, group_label: "Legal form", help: "Often agriculture or purchasing/worker co-ops.", meta: {} },
  { set_key: "entity_type", value: "trust_owned", label: "Trust-owned operating entity", sort: 110, group_label: "Ownership", help: "A trust owns the operating LLC/corp.", meta: {} },
  { set_key: "entity_type", value: "foreign_reg", label: "Foreign entity registered to do business", sort: 120, group_label: "Legal form", help: "Formed in one state, registered in another.", meta: {} },
];

const FALLBACK_US_STATES: OptionRow[] = [
  // value = postal code, label = state name
  { set_key: "us_states", value: "AL", label: "Alabama", sort: 10, group_label: "US", help: "Add every state that touches taxes or filings.", meta: {} },
  { set_key: "us_states", value: "AK", label: "Alaska", sort: 20, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "AZ", label: "Arizona", sort: 30, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "AR", label: "Arkansas", sort: 40, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "CA", label: "California", sort: 50, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "CO", label: "Colorado", sort: 60, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "CT", label: "Connecticut", sort: 70, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "DE", label: "Delaware", sort: 80, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "FL", label: "Florida", sort: 90, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "GA", label: "Georgia", sort: 100, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "HI", label: "Hawaii", sort: 110, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "ID", label: "Idaho", sort: 120, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "IL", label: "Illinois", sort: 130, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "IN", label: "Indiana", sort: 140, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "IA", label: "Iowa", sort: 150, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "KS", label: "Kansas", sort: 160, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "KY", label: "Kentucky", sort: 170, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "LA", label: "Louisiana", sort: 180, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "ME", label: "Maine", sort: 190, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "MD", label: "Maryland", sort: 200, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "MA", label: "Massachusetts", sort: 210, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "MI", label: "Michigan", sort: 220, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "MN", label: "Minnesota", sort: 230, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "MS", label: "Mississippi", sort: 240, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "MO", label: "Missouri", sort: 250, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "MT", label: "Montana", sort: 260, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "NE", label: "Nebraska", sort: 270, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "NV", label: "Nevada", sort: 280, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "NH", label: "New Hampshire", sort: 290, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "NJ", label: "New Jersey", sort: 300, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "NM", label: "New Mexico", sort: 310, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "NY", label: "New York", sort: 320, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "NC", label: "North Carolina", sort: 330, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "ND", label: "North Dakota", sort: 340, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "OH", label: "Ohio", sort: 350, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "OK", label: "Oklahoma", sort: 360, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "OR", label: "Oregon", sort: 370, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "PA", label: "Pennsylvania", sort: 380, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "RI", label: "Rhode Island", sort: 390, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "SC", label: "South Carolina", sort: 400, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "SD", label: "South Dakota", sort: 410, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "TN", label: "Tennessee", sort: 420, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "TX", label: "Texas", sort: 430, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "UT", label: "Utah", sort: 440, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "VT", label: "Vermont", sort: 450, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "VA", label: "Virginia", sort: 460, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "WA", label: "Washington", sort: 470, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "WV", label: "West Virginia", sort: 480, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "WI", label: "Wisconsin", sort: 490, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "WY", label: "Wyoming", sort: 500, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "DC", label: "District of Columbia", sort: 510, group_label: "US", help: "", meta: {} },
  { set_key: "us_states", value: "PR", label: "Puerto Rico", sort: 520, group_label: "Territory", help: "", meta: {} },
  { set_key: "us_states", value: "VI", label: "U.S. Virgin Islands", sort: 530, group_label: "Territory", help: "", meta: {} },
  { set_key: "us_states", value: "GU", label: "Guam", sort: 540, group_label: "Territory", help: "", meta: {} },
  { set_key: "us_states", value: "AS", label: "American Samoa", sort: 550, group_label: "Territory", help: "", meta: {} },
  { set_key: "us_states", value: "MP", label: "Northern Mariana Islands", sort: 560, group_label: "Territory", help: "", meta: {} },
];

const FALLBACK_INDUSTRY: OptionRow[] = [
  // Values here are stable “codes” you can use in rules.
  { set_key: "industry", value: "prof_services_accounting", label: "Accounting / bookkeeping / tax", sort: 10, group_label: "Professional services", help: "Client work billed by hour, project, or retainer.", meta: { kind: "services" } },
  { set_key: "industry", value: "prof_services_legal", label: "Legal services", sort: 20, group_label: "Professional services", help: "Licensed services and engagement-driven work.", meta: { kind: "services" } },
  { set_key: "industry", value: "prof_services_consulting", label: "Consulting (ops / HR / finance / strategy)", sort: 30, group_label: "Professional services", help: "Advisory work, often retainer-based.", meta: { kind: "services" } },
  { set_key: "industry", value: "prof_services_marketing_agency", label: "Marketing / creative agency", sort: 40, group_label: "Professional services", help: "Delivery + client approvals + recurring retainers.", meta: { kind: "services" } },
  { set_key: "industry", value: "prof_services_it", label: "IT services / managed services", sort: 50, group_label: "Professional services", help: "Ticketing + SLAs + recurring service plans.", meta: { kind: "services" } },
  { set_key: "industry", value: "prof_services_coaching", label: "Coaching / training / speaking", sort: 60, group_label: "Professional services", help: "Session-based or program-based revenue.", meta: { kind: "services" } },

  { set_key: "industry", value: "field_services_cleaning", label: "Cleaning / janitorial", sort: 110, group_label: "Field services", help: "Route work, supplies, labor tracking.", meta: { kind: "services" } },
  { set_key: "industry", value: "field_services_landscaping", label: "Landscaping / lawn care", sort: 120, group_label: "Field services", help: "Job-based pricing, crews, equipment.", meta: { kind: "services" } },
  { set_key: "industry", value: "field_services_handyman", label: "Handyman / repairs", sort: 130, group_label: "Field services", help: "On-site labor + materials.", meta: { kind: "services" } },
  { set_key: "industry", value: "field_services_construction", label: "Construction (general / specialty)", sort: 140, group_label: "Field services", help: "Job costing and compliance are core.", meta: { kind: "services" } },

  { set_key: "industry", value: "ecom_physical_dtc", label: "Physical goods shipped (DTC)", sort: 210, group_label: "E-commerce", help: "Orders, shipping, returns, COGS.", meta: { kind: "goods" } },
  { set_key: "industry", value: "ecom_pod", label: "Print-on-demand", sort: 220, group_label: "E-commerce", help: "Vendor receipts + order mapping are key.", meta: { kind: "goods" } },
  { set_key: "industry", value: "ecom_dropship", label: "Dropshipping (no owned inventory)", sort: 230, group_label: "E-commerce", help: "Vendor paper trail and margins matter.", meta: { kind: "goods" } },
  { set_key: "industry", value: "ecom_subscription_box", label: "Subscription box", sort: 240, group_label: "E-commerce", help: "Recurring revenue and fulfillment cadence.", meta: { kind: "goods" } },

  { set_key: "industry", value: "econ_digital_downloads", label: "Digital downloads (templates / ebooks / courses)", sort: 310, group_label: "Digital", help: "Refund policy + state tax rules differ by state and product type.", meta: { kind: "digital" } },
  { set_key: "industry", value: "econ_membership", label: "Membership / community access", sort: 320, group_label: "Digital", help: "Recurring billing, cancellations, access logs.", meta: { kind: "digital" } },
  { set_key: "industry", value: "econ_saas", label: "Software / SaaS sold online", sort: 330, group_label: "Digital", help: "Billing, usage logs, subscription metrics.", meta: { kind: "digital" } },

  { set_key: "industry", value: "food_catering", label: "Catering / food service", sort: 410, group_label: "Food", help: "Permits, labor, inputs, sales tax rules vary.", meta: { kind: "goods" } },
  { set_key: "industry", value: "food_packaged_cpg", label: "Packaged foods / CPG", sort: 420, group_label: "Food", help: "COGS and compliance controls.", meta: { kind: "goods" } },

  { set_key: "industry", value: "transport_dispatch", label: "Dispatch services", sort: 510, group_label: "Transportation", help: "Broker/carrier records and fee agreements.", meta: { kind: "services" } },
  { set_key: "industry", value: "transport_trucking", label: "Trucking carrier", sort: 520, group_label: "Transportation", help: "Fuel, per diem, IFTA planning.", meta: { kind: "services" } },

  { set_key: "industry", value: "ag_poultry", label: "Livestock / poultry", sort: 610, group_label: "Agriculture", help: "Feed, inventory, direct sales, biosecurity logs.", meta: { kind: "goods" } },
  { set_key: "industry", value: "ag_farm_direct", label: "Farm products direct sales", sort: 620, group_label: "Agriculture", help: "Sales channels, labeling, and permits.", meta: { kind: "goods" } },

  { set_key: "industry", value: "media_creator", label: "Content creator / influencer", sort: 710, group_label: "Media", help: "Sponsorships, ads, platform statements.", meta: { kind: "digital" } },
  { set_key: "industry", value: "media_publishing", label: "Publishing (books / newsletters)", sort: 720, group_label: "Media", help: "Royalties, platform statements, sales tax varies.", meta: { kind: "digital" } },

  { set_key: "industry", value: "realestate_str", label: "Short-term rentals", sort: 810, group_label: "Real estate", help: "Occupancy taxes and platform reporting vary.", meta: { kind: "services" } },
  { set_key: "industry", value: "realestate_ltr", label: "Long-term rentals", sort: 820, group_label: "Real estate", help: "Lease records and expense substantiation.", meta: { kind: "services" } },

  { set_key: "industry", value: "other", label: "Other / not listed", sort: 999, group_label: "Other", help: "Pick this, then refine later.", meta: { kind: "other" } },
];

const FALLBACK_REVENUE: OptionRow[] = [
  { set_key: "revenue_range", value: "pre_revenue", label: "Pre-revenue (no sales yet)", sort: 10, group_label: "Annual", help: "Set up clean records early.", meta: {} },
  { set_key: "revenue_range", value: "1_10k", label: "$1–$10,000", sort: 20, group_label: "Annual", help: "Simple systems win here.", meta: {} },
  { set_key: "revenue_range", value: "10_25k", label: "$10,001–$25,000", sort: 30, group_label: "Annual", help: "Track margin and set a cadence.", meta: {} },
  { set_key: "revenue_range", value: "25_50k", label: "$25,001–$50,000", sort: 40, group_label: "Annual", help: "Estimated tax planning starts to matter.", meta: {} },
  { set_key: "revenue_range", value: "50_100k", label: "$50,001–$100,000", sort: 50, group_label: "Annual", help: "Tighten payroll/contractor rules and documentation.", meta: {} },
  { set_key: "revenue_range", value: "100_250k", label: "$100,001–$250,000", sort: 60, group_label: "Annual", help: "Upgrade bookkeeping and planning cadence.", meta: {} },
  { set_key: "revenue_range", value: "250_500k", label: "$250,001–$500,000", sort: 70, group_label: "Annual", help: "Formalize controls and reporting.", meta: {} },
  { set_key: "revenue_range", value: "500_1m", label: "$500,001–$1,000,000", sort: 80, group_label: "Annual", help: "Build repeatable finance operations.", meta: {} },
  { set_key: "revenue_range", value: "1m_2_5m", label: "$1,000,001–$2,500,000", sort: 90, group_label: "Annual", help: "Planning is a system here.", meta: {} },
  { set_key: "revenue_range", value: "2_5m_5m", label: "$2,500,001–$5,000,000", sort: 100, group_label: "Annual", help: "Add forecasting and governance.", meta: {} },
  { set_key: "revenue_range", value: "5m_10m", label: "$5,000,001–$10,000,000", sort: 110, group_label: "Annual", help: "Move into advanced controls.", meta: {} },
  { set_key: "revenue_range", value: "10m_25m", label: "$10,000,001–$25,000,000", sort: 120, group_label: "Annual", help: "Multi-entity planning becomes common.", meta: {} },
  { set_key: "revenue_range", value: "25m_50m", label: "$25,000,001–$50,000,000", sort: 130, group_label: "Annual", help: "Formal compliance operations.", meta: {} },
  { set_key: "revenue_range", value: "50m_100m", label: "$50,000,001–$100,000,000", sort: 140, group_label: "Annual", help: "Board-grade reporting.", meta: {} },
  { set_key: "revenue_range", value: "100m_250m", label: "$100,000,001–$250,000,000", sort: 150, group_label: "Annual", help: "Advanced tax governance.", meta: {} },
  { set_key: "revenue_range", value: "250m_500m", label: "$250,000,001–$500,000,000", sort: 160, group_label: "Annual", help: "Enterprise readiness.", meta: {} },
  { set_key: "revenue_range", value: "500m_1b", label: "$500,000,001–$1,000,000,000", sort: 170, group_label: "Annual", help: "Enterprise readiness.", meta: {} },
  { set_key: "revenue_range", value: "1b_plus", label: "$1B+", sort: 180, group_label: "Annual", help: "Enterprise readiness.", meta: {} },
];

const FALLBACK_PAYROLL: OptionRow[] = [
  { set_key: "payroll_w2", value: "0", label: "0", sort: 10, group_label: "W-2 headcount", help: "No W-2 payroll right now.", meta: {} },
  { set_key: "payroll_w2", value: "1", label: "1", sort: 20, group_label: "W-2 headcount", help: "One W-2 employee.", meta: {} },
  { set_key: "payroll_w2", value: "2_3", label: "2–3", sort: 30, group_label: "W-2 headcount", help: "Small payroll.", meta: {} },
  { set_key: "payroll_w2", value: "4_5", label: "4–5", sort: 40, group_label: "W-2 headcount", help: "Small payroll.", meta: {} },
  { set_key: "payroll_w2", value: "6_10", label: "6–10", sort: 50, group_label: "W-2 headcount", help: "Growing payroll.", meta: {} },
  { set_key: "payroll_w2", value: "11_19", label: "11–19", sort: 60, group_label: "W-2 headcount", help: "Growing payroll.", meta: {} },
  { set_key: "payroll_w2", value: "20_49", label: "20–49", sort: 70, group_label: "W-2 headcount", help: "Mid-size payroll.", meta: {} },
  { set_key: "payroll_w2", value: "50_99", label: "50–99", sort: 80, group_label: "W-2 headcount", help: "Larger payroll.", meta: {} },
  { set_key: "payroll_w2", value: "100_249", label: "100–249", sort: 90, group_label: "W-2 headcount", help: "Larger payroll.", meta: {} },
  { set_key: "payroll_w2", value: "250_499", label: "250–499", sort: 100, group_label: "W-2 headcount", help: "Large payroll.", meta: {} },
  { set_key: "payroll_w2", value: "500_999", label: "500–999", sort: 110, group_label: "W-2 headcount", help: "Large payroll.", meta: {} },
  { set_key: "payroll_w2", value: "1000_plus", label: "1,000+", sort: 120, group_label: "W-2 headcount", help: "Large payroll.", meta: {} },
];

const FALLBACK_YN_INVENTORY: OptionRow[] = [
  { set_key: "inventory_presence", value: "no", label: "No inventory", sort: 10, group_label: "Inventory", help: "Services or digital-only. No stock held.", meta: {} },
  { set_key: "inventory_presence", value: "yes", label: "Yes — inventory exists", sort: 20, group_label: "Inventory", help: "You hold goods, inputs, or items held for sale.", meta: {} },
];

const FALLBACK_YN_MULTISTATE: OptionRow[] = [
  { set_key: "multistate_presence", value: "no", label: "No multi-state exposure", sort: 10, group_label: "Multi-state", help: "Operations and activity stay in one state.", meta: {} },
  { set_key: "multistate_presence", value: "yes", label: "Yes — multi-state exposure", sort: 20, group_label: "Multi-state", help: "Sales, people, or inventory cross state lines.", meta: {} },
];

const FALLBACK_YN_INTL: OptionRow[] = [
  { set_key: "international_presence", value: "no", label: "No international touchpoints", sort: 10, group_label: "International", help: "No foreign customers, vendors, labor, or shipping.", meta: {} },
  { set_key: "international_presence", value: "yes", label: "Yes — international touchpoints", sort: 20, group_label: "International", help: "Foreign customers, vendors, labor, or shipping exist.", meta: {} },
];

function fallbackForKey(k: (typeof OPTION_KEYS)[number]): OptionRow[] {
  if (k === "entity_type") return FALLBACK_ENTITY_TYPE;
  if (k === "us_states") return FALLBACK_US_STATES;
  if (k === "industry") return FALLBACK_INDUSTRY;
  if (k === "revenue_range") return FALLBACK_REVENUE;
  if (k === "payroll_w2") return FALLBACK_PAYROLL;
  if (k === "inventory_presence") return FALLBACK_YN_INVENTORY;
  if (k === "multistate_presence") return FALLBACK_YN_MULTISTATE;
  if (k === "international_presence") return FALLBACK_YN_INTL;
  return [];
}

function selectHelp(opts: OptionsByKey, setKey: string, value: string) {
  const list = opts[setKey] ?? [];
  const found = list.find((o) => o.value === value);
  return found?.help ?? null;
}

function validateIntake(i: Intake): string | null {
  if (!i.entity_type) return "Pick an entity type to continue.";
  if (!i.states || i.states.length === 0) return "Add at least one state to continue.";
  if (!i.industry) return "Pick an industry to continue.";
  if (!i.revenue_range) return "Pick a revenue range to continue.";
  if (!i.payroll_w2) return "Pick your W-2 headcount to continue.";
  if (!i.inventory_presence) return "Pick your inventory status to continue.";
  if (!i.multistate_presence) return "Pick your multi-state status to continue.";
  if (!i.international_presence) return "Pick your international status to continue.";
  return null;
}

function buildProfileFromIntake(i: Intake): Profile {
  return {
    entity_type: i.entity_type,
    states: i.states,
    industry: i.industry,
    revenue_range: i.revenue_range,
    payroll_w2: i.payroll_w2,
    inventory_presence: i.inventory_presence as "yes" | "no",
    multistate_presence: i.multistate_presence as "yes" | "no",
    international_presence: i.international_presence as "yes" | "no",
    extras: {},
  };
}

function makeIcs(p: Profile, calendar: CalendarItem[]) {
  const y = new Date().getFullYear();
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uidBase = `btbb-${Math.random().toString(16).slice(2)}`;

  const taxEvents = [
    { title: "Estimated tax payment (Q1)", date: `${y}0415` },
    { title: "Estimated tax payment (Q2)", date: `${y}0615` },
    { title: "Estimated tax payment (Q3)", date: `${y}0915` },
    { title: "Estimated tax payment (Q4)", date: `${y + 1}0115` },
  ];

  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BTBB//Tax Planning//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];

  const addEvent = (idx: number, title: string, yyyymmdd: string, desc: string) => {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uidBase}-${idx}@btbb`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${yyyymmdd}`);
    lines.push(`DTEND;VALUE=DATE:${yyyymmdd}`);
    lines.push(`SUMMARY:${title}`);
    lines.push(`DESCRIPTION:${desc}`);
    lines.push("END:VEVENT");
  };

  let idx = 0;
  for (const e of taxEvents) {
    addEvent(
      idx++,
      e.title,
      e.date,
      `Profile: ${p.entity_type} | ${p.states.join(", ")} | ${p.industry} | Revenue: ${p.revenue_range}`
    );
  }

  // Add “plan” items as anchor reminders (one per quarter)
  const quarterDate: Record<CalendarItem["quarter"], string> = {
    Q1: `${y}0201`,
    Q2: `${y}0501`,
    Q3: `${y}0801`,
    Q4: `${y}1101`,
  };

  const picked = calendar.slice(0, 12);
  for (const c of picked) {
    addEvent(idx++, `BTBB: ${c.title}`, quarterDate[c.quarter], `Why: ${c.why}`);
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function makeChecklistCsv(questions: Question[]) {
  const header = ["group", "priority", "question", "why", "proof_items"];
  const rows = questions.map((q) => [
    q.group,
    String(q.priority),
    q.prompt,
    q.why,
    q.proof.join(" | "),
  ]);
  const csv = [header.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
  return csv;
}

function buildMemoText(args: {
  profile: Profile;
  topicLabel: string;
  decisionLabel: string;
  confidence: number;
  rationale: string[];
  tradeoffs: string[];
  auditNarrative: string[];
  proofPack: Array<{ label: string; required: boolean; done: boolean; accept: string[]; cadence: string }>;
}) {
  const { profile, topicLabel, decisionLabel, confidence, rationale, tradeoffs, auditNarrative, proofPack } = args;

  const reqMissing = proofPack.filter((x) => x.required && !x.done).map((x) => x.label);

  const lines: string[] = [];
  lines.push("BTBB — Tax Position Memo");
  lines.push("");
  lines.push(`Topic: ${topicLabel}`);
  lines.push(`Decision selected: ${decisionLabel}`);
  lines.push(`Confidence: ${confidence}/100`);
  lines.push(`Date: ${new Date().toLocaleDateString()}`);
  lines.push("");
  lines.push("Facts (from intake)");
  lines.push(`- Entity type: ${profile.entity_type}`);
  lines.push(`- State(s): ${profile.states.join(", ") || "—"}`);
  lines.push(`- Industry: ${profile.industry}`);
  lines.push(`- Revenue range: ${profile.revenue_range}`);
  lines.push(`- W-2 employees: ${profile.payroll_w2}`);
  lines.push(`- Inventory present: ${profile.inventory_presence}`);
  lines.push(`- Multi-state: ${profile.multistate_presence}`);
  lines.push(`- International: ${profile.international_presence}`);
  lines.push("");
  lines.push("Assumptions");
  lines.push("- Answers reflect current operations.");
  lines.push("- Proof items are stored in a repeatable folder structure.");
  lines.push("");
  lines.push("Rationale");
  for (const r of rationale) lines.push(`- ${r}`);
  lines.push("");
  lines.push("Tradeoffs");
  for (const t of tradeoffs) lines.push(`- ${t}`);
  lines.push("");
  lines.push("If asked, say this");
  for (const a of auditNarrative) lines.push(`- ${a}`);
  lines.push("");
  lines.push("Proof Pack");
  for (const p of proofPack) {
    const flag = p.required ? "Required" : "Optional";
    const status = p.done ? "Done" : "Missing";
    lines.push(`- ${p.label} | ${flag} | ${status} | Accept: ${p.accept.join(", ")} | Cadence: ${p.cadence}`);
  }
  lines.push("");
  lines.push("Documentation gaps");
  if (reqMissing.length === 0) lines.push("- None flagged for required items.");
  for (const m of reqMissing) lines.push(`- Missing: ${m}`);
  lines.push("");
  lines.push("CPA questions (copy/paste)");
  lines.push("- Any edge cases that change worker classification or payroll setup?");
  lines.push("- Any state-specific worker rules that change our documentation set?");
  lines.push("");

  return lines.join("\n");
}

function memoToPdfBytes(args: {
  title: string;
  profile: Profile;
  questions: Question[];
  calendar: CalendarItem[];
  memoText: string;
}) {
  const JsPDF: any = (jspdf as any).jsPDF ?? (jspdf as any).default ?? (jspdf as any);
  const doc = new JsPDF({ unit: "pt", format: "letter" });

  const margin = 54;
  const pageW = 612;
  const pageH = 792;
  const maxW = pageW - margin * 2;

  const addTitle = (t: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(t, margin, 72);
  };

  const addSub = (t: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(t, margin, y);
  };

  const addPara = (text: string, startY: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, maxW);
    let y = startY;
    for (const line of lines) {
      if (y > pageH - 72) {
        doc.addPage();
        y = 72;
      }
      doc.text(String(line), margin, y);
      y += 14;
    }
    return y;
  };

  const addBullets = (items: string[], startY: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let y = startY;
    for (const it of items) {
      const lines = doc.splitTextToSize(`• ${it}`, maxW);
      for (const line of lines) {
        if (y > pageH - 72) {
          doc.addPage();
          y = 72;
        }
        doc.text(String(line), margin, y);
        y += 14;
      }
    }
    return y;
  };

  addTitle(args.title);
  let y = 96;

  addSub("Your Tax Planning Profile", y);
  y += 18;

  const facts = [
    `Entity type: ${args.profile.entity_type}`,
    `State(s): ${args.profile.states.join(", ") || "—"}`,
    `Industry: ${args.profile.industry}`,
    `Revenue range: ${args.profile.revenue_range}`,
    `W-2 employees: ${args.profile.payroll_w2}`,
    `Inventory: ${args.profile.inventory_presence}`,
    `Multi-state: ${args.profile.multistate_presence}`,
    `International: ${args.profile.international_presence}`,
  ];
  y = addBullets(facts, y + 4);
  y += 10;

  addSub("Your Question Set", y);
  y += 18;

  // group questions by group name
  const grouped: Record<string, Question[]> = {};
  for (const q of args.questions) {
    if (!grouped[q.group]) grouped[q.group] = [];
    grouped[q.group].push(q);
  }
  const groupNames = Object.keys(grouped).sort();

  for (const g of groupNames) {
    if (y > pageH - 120) {
      doc.addPage();
      y = 72;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(g, margin, y);
    y += 16;

    const list = grouped[g].slice(0, 10);
    for (const q of list) {
      y = addPara(`Q: ${q.prompt}`, y);
      y = addPara(`Why: ${q.why}`, y);
      y = addPara(`Proof: ${q.proof.join("; ")}`, y);
      y += 8;
      if (y > pageH - 96) {
        doc.addPage();
        y = 72;
      }
    }
    y += 8;
  }

  doc.addPage();
  y = 72;
  addSub("Quarterly Decision Calendar", y);
  y += 18;

  const quarters: Array<CalendarItem["quarter"]> = ["Q1", "Q2", "Q3", "Q4"];
  for (const qtr of quarters) {
    const items = args.calendar.filter((c) => c.quarter === qtr);
    if (y > pageH - 120) {
      doc.addPage();
      y = 72;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(qtr, margin, y);
    y += 16;
    for (const it of items.slice(0, 8)) {
      y = addPara(`• ${it.title}`, y);
      y = addPara(`Why: ${it.why}`, y);
      y += 6;
      if (y > pageH - 96) {
        doc.addPage();
        y = 72;
      }
    }
    y += 10;
  }

  doc.addPage();
  y = 72;
  addSub("Tax Position Memo", y);
  y = addPara(args.memoText, y + 16);

  return doc.output("arraybuffer");
}

/**
 * “Big data” question bank (this is what got chopped before).
 * You can expand this later from tables; this keeps premium today.
 */
const QUESTION_BANK: Question[] = [
  // Baseline (always)
  {
    id: "base-001",
    group: "Baseline controls",
    priority: 1,
    prompt: "What is your single source of truth for income and expenses (bank feed, manual log, bookkeeping tool)?",
    why: "Your entire plan depends on clean, consistent records.",
    proof: ["Bank statements", "Processor statements", "Bookkeeping export", "Monthly close notes"],
    tags: ["baseline", "records"],
    when: () => true,
  },
  {
    id: "base-002",
    group: "Baseline controls",
    priority: 2,
    prompt: "Do you store receipts by month with a clear naming rule (date_vendor_amount)?",
    why: "Fast retrieval reduces stress and speeds reviews.",
    proof: ["Receipt folder structure", "Sample month showing completeness"],
    tags: ["baseline", "receipts"],
    when: () => true,
  },
  {
    id: "base-003",
    group: "Baseline controls",
    priority: 3,
    prompt: "Do you reconcile accounts on a set cadence (weekly or monthly)?",
    why: "Reconciliation catches missing income, duplicate expenses, and mis-categorized items.",
    proof: ["Reconciliation reports", "Checklist log"],
    tags: ["baseline", "reconcile"],
    when: () => true,
  },
  {
    id: "base-004",
    group: "Baseline controls",
    priority: 4,
    prompt: "Do you have a simple folder for tax-year evidence (income, expenses, payroll, sales tax, entity docs)?",
    why: "A binder mindset prevents scramble later.",
    proof: ["Folder tree screenshot", "Access controls"],
    tags: ["baseline", "binder"],
    when: () => true,
  },

  // Entity + tax posture
  {
    id: "ent-001",
    group: "Entity + tax posture",
    priority: 5,
    prompt: "Is your legal form aligned with your current business risk and revenue level?",
    why: "Misalignment can create liability gaps or unnecessary complexity.",
    proof: ["Formation docs", "Operating agreement", "Annual report filings"],
    tags: ["entity"],
    when: () => true,
  },
  {
    id: "ent-002",
    group: "Entity + tax posture",
    priority: 6,
    prompt: "Is your business address and registered agent information current across filings and banking?",
    why: "Old addresses can cause missed notices and compliance gaps.",
    proof: ["Secretary of State record", "Bank profile screenshot", "Tax account profile"],
    tags: ["entity", "compliance"],
    when: () => true,
  },
  {
    id: "ent-003",
    group: "Entity + tax posture",
    priority: 7,
    prompt: "Do you track owner draws/distributions separately from business expenses?",
    why: "Owner activity must be clean to avoid messy tax positions and mixed-use problems.",
    proof: ["Owner draw ledger", "Bank transfer notes"],
    tags: ["entity", "owner"],
    when: () => true,
  },

  // Revenue-range triggers
  {
    id: "rev-001",
    group: "Cash + estimated tax planning",
    priority: 8,
    prompt: "Do you set aside a tax reserve each week based on actual profit, not hope?",
    why: "A reserve prevents cash surprises at quarter end.",
    proof: ["Reserve transfers", "Simple reserve formula", "Quarterly review notes"],
    tags: ["tax", "cash"],
    when: (p) => revenueTier(p.revenue_range) >= 2,
  },
  {
    id: "rev-002",
    group: "Cash + estimated tax planning",
    priority: 9,
    prompt: "Do you compare current-year profit to last-year profit each quarter?",
    why: "Trend checks help avoid underpayment surprises.",
    proof: ["Quarterly P&L", "Comparison notes"],
    tags: ["tax", "trend"],
    when: (p) => revenueTier(p.revenue_range) >= 3,
  },
  {
    id: "rev-003",
    group: "Cash + estimated tax planning",
    priority: 10,
    prompt: "Do you have a year-end plan (final expenses, timing, documentation) written by November?",
    why: "Year-end is when planning choices matter most.",
    proof: ["Year-end checklist", "Calendar reminders", "Receipts and invoices"],
    tags: ["tax", "year-end"],
    when: (p) => revenueTier(p.revenue_range) >= 4,
  },

  // Payroll / workers
  {
    id: "pay-001",
    group: "Payroll + workers",
    priority: 11,
    prompt: "Do you have a documented payroll routine (who runs it, what gets saved, what gets reviewed)?",
    why: "Payroll issues trigger notices fast.",
    proof: ["Payroll run checklist", "Payroll reports", "Access log"],
    tags: ["payroll"],
    when: (p) => hasPayroll(p),
  },
  {
    id: "pay-002",
    group: "Payroll + workers",
    priority: 12,
    prompt: "Do you keep a worker file per employee (offer, I-9, W-4, policy ack, pay changes)?",
    why: "Worker files keep payroll and compliance consistent.",
    proof: ["Worker file checklist", "Redacted sample file"],
    tags: ["payroll", "hr"],
    when: (p) => hasPayroll(p),
  },
  {
    id: "pay-003",
    group: "Payroll + workers",
    priority: 13,
    prompt: "Do you keep contractor files (W-9, contract, scope, invoice trail) for each 1099 relationship?",
    why: "Contractor proof reduces classification risk.",
    proof: ["W-9s", "Contracts", "Invoices", "Payment proof"],
    tags: ["contractor"],
    when: () => true,
  },

  // Inventory
  {
    id: "inv-001",
    group: "Inventory + COGS",
    priority: 14,
    prompt: "Do you record inventory purchases with invoices tied to payment proof and SKU/category notes?",
    why: "COGS support depends on a clean purchase trail.",
    proof: ["Vendor invoices", "Payment proof", "SKU list or category notes"],
    tags: ["inventory", "cogs"],
    when: (p) => p.inventory_presence === "yes",
  },
  {
    id: "inv-002",
    group: "Inventory + COGS",
    priority: 15,
    prompt: "What is your count cadence (monthly or quarterly), and where is it documented?",
    why: "A consistent cadence is the backbone of inventory integrity.",
    proof: ["Count log", "Variance notes", "Signed count sheet"],
    tags: ["inventory"],
    when: (p) => p.inventory_presence === "yes",
  },
  {
    id: "inv-003",
    group: "Inventory + COGS",
    priority: 16,
    prompt: "Do you track shrink/returns/damage with short notes that explain adjustments?",
    why: "Adjustments without notes are hard to defend.",
    proof: ["Adjustment log", "Photos if relevant", "Return reports"],
    tags: ["inventory", "adjustments"],
    when: (p) => p.inventory_presence === "yes",
  },

  // Multi-state
  {
    id: "ms-001",
    group: "Multi-state exposure",
    priority: 17,
    prompt: "Can you pull a sales-by-state report in under 5 minutes?",
    why: "You need fast visibility to spot thresholds early.",
    proof: ["Processor report", "Marketplace report", "Spreadsheet export"],
    tags: ["multistate", "sales"],
    when: (p) => p.multistate_presence === "yes",
  },
  {
    id: "ms-002",
    group: "Multi-state exposure",
    priority: 18,
    prompt: "Do you list every state where you are registered for sales tax and the filing cadence?",
    why: "Missing a filing creates avoidable penalties.",
    proof: ["Registration list", "Login screenshots", "Filing calendar"],
    tags: ["multistate", "sales-tax"],
    when: (p) => p.multistate_presence === "yes",
  },

  // International
  {
    id: "intl-001",
    group: "International touchpoints",
    priority: 19,
    prompt: "Do you track foreign customers/vendors by country and keep contract/payment proof together?",
    why: "Cross-border work needs clean proof trails.",
    proof: ["Invoices/contracts", "Payment proof", "Country list"],
    tags: ["international"],
    when: (p) => p.international_presence === "yes",
  },

  // Digital downloads nuance
  {
    id: "dig-001",
    group: "Digital sales",
    priority: 20,
    prompt: "Do you store platform payout statements and refund/chargeback logs by month?",
    why: "Digital platforms create record gaps if statements are not stored.",
    proof: ["Platform statements", "Refund logs", "Chargeback notes"],
    tags: ["digital", "records"],
    when: (p) => p.industry === "econ_digital_downloads" || p.industry === "econ_membership" || p.industry === "econ_saas",
  },

  // More “bank-grade” depth (adds volume + quality)
  {
    id: "ops-001",
    group: "Baseline controls",
    priority: 21,
    prompt: "Do you have a monthly close checklist with a ‘done definition’?",
    why: "A close checklist is how you keep books repeatable.",
    proof: ["Monthly close checklist", "Completion log"],
    tags: ["baseline", "close"],
    when: (p) => revenueTier(p.revenue_range) >= 1,
  },
  {
    id: "ops-002",
    group: "Cash + estimated tax planning",
    priority: 22,
    prompt: "Do you compare projected tax reserve to cash on hand each month?",
    why: "This catches cash shortfalls early.",
    proof: ["Cash snapshot", "Reserve tracker", "Monthly note"],
    tags: ["tax", "cash"],
    when: (p) => revenueTier(p.revenue_range) >= 2,
  },
  {
    id: "ops-003",
    group: "Entity + tax posture",
    priority: 23,
    prompt: "Do you keep a log of major business decisions (new offers, hiring, big tools, big expenses) with dates?",
    why: "Decision logs support your story and keep planning consistent.",
    proof: ["Decision log", "Meeting notes"],
    tags: ["entity", "governance"],
    when: () => true,
  },
];

// Calendar library
const CALENDAR_LIBRARY: CalendarItem[] = [
  {
    id: "cal-001",
    quarter: "Q1",
    title: "Run a Q1 close: reconcile, categorize, file receipts by month",
    why: "A clean Q1 close sets the tone for the year.",
    proof: ["Reconciliation report", "Receipt folder completeness", "P&L export"],
    tags: ["baseline", "close"],
    when: () => true,
  },
  {
    id: "cal-002",
    quarter: "Q1",
    title: "Estimated tax plan check: reserve rule, cash coverage, payment prep",
    why: "Quarter-end payments are smoother with a written rule.",
    proof: ["Reserve rule", "Cash snapshot", "Payment confirmation"],
    tags: ["tax", "estimated"],
    when: (p) => revenueTier(p.revenue_range) >= 2,
  },
  {
    id: "cal-003",
    quarter: "Q2",
    title: "Mid-year documentation sweep: contracts, receipts, payout statements",
    why: "A mid-year sweep prevents a year-end scramble.",
    proof: ["Folder audit notes", "Missing item list"],
    tags: ["binder", "docs"],
    when: () => true,
  },
  {
    id: "cal-004",
    quarter: "Q2",
    title: "Worker setup checkpoint: payroll routine or contractor proof pack",
    why: "Worker issues get expensive fast.",
    proof: ["Proof pack status", "Payroll reports", "W-9/contracts"],
    tags: ["payroll", "contractor"],
    when: (p) => hasPayroll(p) || revenueTier(p.revenue_range) >= 3,
  },
  {
    id: "cal-005",
    quarter: "Q3",
    title: "Sales-by-state review and threshold watch",
    why: "Threshold watch is the calm way to handle multi-state exposure.",
    proof: ["Sales-by-state report", "Threshold notes", "Registration list"],
    tags: ["multistate", "sales-tax"],
    when: (p) => p.multistate_presence === "yes",
  },
  {
    id: "cal-006",
    quarter: "Q3",
    title: "Inventory integrity checkpoint: count cadence + adjustment notes",
    why: "Inventory records need a rhythm to stay credible.",
    proof: ["Count log", "Variance notes", "Purchase support"],
    tags: ["inventory"],
    when: (p) => p.inventory_presence === "yes",
  },
  {
    id: "cal-007",
    quarter: "Q4",
    title: "Year-end plan: finalize documentation, clean up categories, review reserves",
    why: "Q4 is where planning choices land.",
    proof: ["Year-end checklist", "P&L draft", "Reserve reconciliation"],
    tags: ["year-end", "tax"],
    when: (p) => revenueTier(p.revenue_range) >= 2,
  },
  {
    id: "cal-008",
    quarter: "Q4",
    title: "Proof pack hardening: finalize the audit binder for the tax year",
    why: "A clean binder saves time and reduces stress.",
    proof: ["Binder completeness checklist", "Access controls"],
    tags: ["binder"],
    when: () => true,
  },
];

function buildQuestionSet(p: Profile) {
  const picked = QUESTION_BANK.filter((q) => q.when(p));
  picked.sort((a, b) => a.priority - b.priority);

  // Add a few “smart” inserts for S-corp and multi-state at higher revenue
  const extra: Question[] = [];

  if (p.entity_type === "s_corp") {
    extra.push({
      id: "sc-001",
      group: "S-corp owner comp",
      priority: 6,
      prompt: "Do you have an owner compensation file (role, time, comparable wage support, pay decision notes)?",
      why: "Owner comp is a high-friction area without saved support.",
      proof: ["Role description", "Time notes", "Comparable wage support", "Pay decision memo"],
      tags: ["s-corp", "owner-comp"],
      when: () => true,
    });
  }

  if (p.multistate_presence === "yes" && revenueTier(p.revenue_range) >= 3) {
    extra.push({
      id: "ms-010",
      group: "Multi-state exposure",
      priority: 16,
      prompt: "Do you store marketplace and processor settings screenshots that show how sales tax is handled?",
      why: "Settings are part of the proof trail when questions come up.",
      proof: ["Settings screenshots", "Filing calendar", "State registration list"],
      tags: ["multistate", "sales-tax", "proof"],
      when: () => true,
    });
  }

  const all = uniqQuestions([...picked, ...extra]);
  all.sort((a, b) => a.priority - b.priority);
  return all;
}

function uniqQuestions(rows: Question[]) {
  const seen: Record<string, boolean> = {};
  const out: Question[] = [];
  for (const r of rows) {
    if (seen[r.id]) continue;
    seen[r.id] = true;
    out.push(r);
  }
  return out;
}

function buildCalendar(p: Profile) {
  const picked = CALENDAR_LIBRARY.filter((c) => c.when(p));
  // sort by quarter order
  const order: Record<CalendarItem["quarter"], number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
  picked.sort((a, b) => order[a.quarter] - order[b.quarter]);
  return picked;
}

export default function TaxPlanningPhase3Page() {
  const [opts, setOpts] = React.useState<OptionsByKey>({});
  const [loadingOpts, setLoadingOpts] = React.useState(false);
  const [optsErr, setOptsErr] = React.useState<string | null>(null);

  const [intake, setIntake] = useLocalStorageState<Intake>("btbb_tax_intake_phase3_v1", {
    entity_type: "",
    states: [],
    industry: "",
    revenue_range: "",
    payroll_w2: "",
    inventory_presence: "",
    multistate_presence: "",
    international_presence: "",
  });

  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [uiErr, setUiErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [pendingState, setPendingState] = React.useState<string>("");

  const [activePanel, setActivePanel] = React.useState<"results" | "questions" | "calendar">("results");

  const questionsRef = React.useRef<HTMLDivElement | null>(null);
  const calendarRef = React.useRef<HTMLDivElement | null>(null);

  // Decision workspace state
  const [decisionTab, setDecisionTab] = React.useState<"decision" | "rationale" | "proof" | "memo">("decision");
  const [workerDecision, setWorkerDecision] = React.useState<"none" | "all_w2" | "all_1099" | "mixed" | "">("");
  const [proofPackState, setProofPackState] = React.useState<Record<string, boolean>>({
    "W-9s collected (1099)": false,
    "Independent contractor agreements": false,
    "Payroll system configured (W-2)": false,
    "Onboarding checklist + policy": false,
  });

  const [memoVersions, setMemoVersions] = useLocalStorageState<MemoVersion[]>("btbb_tax_memo_versions_v1", []);
  const [memoText, setMemoText] = React.useState<string>("");

  const loadOptions = React.useCallback(async () => {
    setLoadingOpts(true);
    setOptsErr(null);

    // Start with fallbacks (so dropdowns always render)
    const base: OptionsByKey = {};
    for (const k of OPTION_KEYS) {
      base[k] = [...fallbackForKey(k)].sort(bySort);
    }
    setOpts(base);

    try {
      const { data, error } = await supabase
        .from("btbb_tax_options")
        .select("set_key,value,label,sort,group_label,help,meta")
        // @ts-ignore
        .in("set_key", [...OPTION_KEYS]);

      if (error) throw error;

      const rows = (data ?? []) as OptionRow[];
      for (const r of rows) r.meta = r.meta ?? {};

      const grouped = groupOptions(rows);

      // Merge: DB rows override fallback when present; fallback fills gaps
      const merged: OptionsByKey = {};
      for (const k of OPTION_KEYS) {
        const fromDb = uniqByValue((grouped[k] ?? []).map((x) => ({ ...x }))).sort(bySort);
        const fromFallback = uniqByValue([...fallbackForKey(k)]).sort(bySort);
        merged[k] = fromDb.length ? fromDb : fromFallback;
      }

      setOpts(merged);
    } catch (e: any) {
      setOptsErr(e?.message ?? "Option load failed. Fallback lists are active.");
    } finally {
      setLoadingOpts(false);
    }
  }, []);

  React.useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const cardBase = "rounded-2xl border border-black/10 bg-white/90 shadow-sm";
  const hintText = "text-xs text-black/60";
  const labelText = "text-sm font-medium";
  const infoIcon = "h-4 w-4 text-black/50";

  const selectBase =
    "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10";

  const entityOpts = (opts["entity_type"] ?? []).sort(bySort);
  const stateOpts = (opts["us_states"] ?? []).sort(bySort);
  const industryOpts = (opts["industry"] ?? []).sort(bySort);
  const revenueOpts = (opts["revenue_range"] ?? []).sort(bySort);
  const payrollOpts = (opts["payroll_w2"] ?? []).sort(bySort);
  const invOpts = (opts["inventory_presence"] ?? []).sort(bySort);
  const msOpts = (opts["multistate_presence"] ?? []).sort(bySort);
  const intlOpts = (opts["international_presence"] ?? []).sort(bySort);

  const removeState = (code: string) => {
    const next = intake.states.filter((s) => s !== code);
    setIntake({ ...intake, states: next });
  };

  const addStateFromSelect = (code: string) => {
    if (!code) return;
    const map: Record<string, boolean> = {};
    for (const s of intake.states) map[s] = true;
    map[code] = true;
    const next = Object.keys(map).sort();
    setIntake({ ...intake, states: next });
  };

  const buildProfile = async () => {
    setUiErr(null);
    const err = validateIntake(intake);
    if (err) {
      setUiErr(err);
      return;
    }

    const p = buildProfileFromIntake(intake);
    setProfile(p);
    setActivePanel("results");

    // best-fit defaults for decision workspace
    if (p.payroll_w2 === "0") setWorkerDecision("none");
    if (p.payroll_w2 !== "0" && p.payroll_w2 !== "") setWorkerDecision("all_w2");

    // Persist intake to Supabase when auth exists (safe no-op if not logged in)
    try {
      const u = await supabase.auth.getUser();
      const userId = u?.data?.user?.id;
      if (userId) {
        await supabase.from("btbb_tax_intake").upsert({
          user_id: userId,
          entity_type: p.entity_type,
          states: p.states,
          industry: p.industry,
          revenue_range: p.revenue_range,
          payroll_w2: p.payroll_w2,
          inventory_presence: p.inventory_presence,
          multistate_presence: p.multistate_presence,
          international_presence: p.international_presence,
          updated_at: new Date().toISOString(),
        } as any);
      }
    } catch {}
  };

  const questions = React.useMemo(() => {
    if (!profile) return [];
    return buildQuestionSet(profile);
  }, [profile]);

  const calendar = React.useMemo(() => {
    if (!profile) return [];
    return buildCalendar(profile);
  }, [profile]);

  const workerWorkspace = React.useMemo(() => {
    const topicLabel = "Worker setup (W-2 vs 1099)";

    const decisionOptions: Array<{ value: "none" | "all_w2" | "all_1099" | "mixed"; label: string; help: string }> = [
      { value: "none", label: "No workers yet", help: "No payroll/1099 setup yet. Keep the proof pack ready for when you hire." },
      { value: "all_w2", label: "All W-2 employees", help: "Payroll cadence becomes a core system." },
      { value: "all_1099", label: "All 1099 contractors", help: "Classification proof matters; collect W-9s and contracts." },
      { value: "mixed", label: "Mixed (W-2 + 1099)", help: "Run payroll controls and contractor controls side-by-side." },
    ];

    const confidence = (() => {
      let score = 40;
      if (profile) score += 25;
      if (workerDecision) score += 10;

      const keys = Object.keys(proofPackState);
      const doneCount = keys.filter((k) => proofPackState[k]).length;
      const ratio = keys.length ? doneCount / keys.length : 0;
      score += Math.round(ratio * 25);

      if (score > 100) score = 100;
      return score;
    })();

    const rationale = [
      "This decision is documented to match actual operations.",
      "A saved proof pack reduces rework and keeps the story consistent.",
    ];

    const tradeoffs = [
      "W-2: more admin work; clearer controls and payroll documentation.",
      "1099: simpler payroll; heavier proof burden for classification.",
    ];

    const auditNarrative = [
      "We documented the current worker model and why it matches the work relationship.",
      "We maintain a repeatable proof pack (contracts, W-9s, onboarding, payroll reports).",
    ];

    const proofPack: Array<{ label: string; required: boolean; done: boolean; accept: string[]; cadence: string }> = [
      { label: "W-9s collected (1099)", required: true, done: !!proofPackState["W-9s collected (1099)"], accept: ["PDF", "JPG", "PNG"], cadence: "At onboarding" },
      { label: "Independent contractor agreements", required: true, done: !!proofPackState["Independent contractor agreements"], accept: ["PDF", "DOCX"], cadence: "At onboarding / renew annually" },
      { label: "Payroll system configured (W-2)", required: true, done: !!proofPackState["Payroll system configured (W-2)"], accept: ["PDF", "Screenshot"], cadence: "Setup + verify quarterly" },
      { label: "Onboarding checklist + policy", required: false, done: !!proofPackState["Onboarding checklist + policy"], accept: ["PDF", "DOCX"], cadence: "Review quarterly" },
    ];

    const chosen = decisionOptions.find((d) => d.value === workerDecision);
    const decisionLabel = chosen?.label ?? "Not selected";

    const bestFit = (() => {
      if (!profile) return null;
      if (profile.payroll_w2 === "0") return "none";
      return "all_w2";
    })();

    return {
      topicLabel,
      decisionOptions,
      bestFit,
      confidence,
      rationale,
      tradeoffs,
      auditNarrative,
      proofPack,
      decisionLabel,
    };
  }, [profile, workerDecision, proofPackState]);

  React.useEffect(() => {
    if (!profile) return;
    const text = buildMemoText({
      profile,
      topicLabel: workerWorkspace.topicLabel,
      decisionLabel: workerWorkspace.decisionLabel,
      confidence: workerWorkspace.confidence,
      rationale: workerWorkspace.rationale,
      tradeoffs: workerWorkspace.tradeoffs,
      auditNarrative: workerWorkspace.auditNarrative,
      proofPack: workerWorkspace.proofPack,
    });
    setMemoText(text);
  }, [profile, workerWorkspace]);

  const saveMemoVersion = () => {
    if (!profile) return;
    const mv: MemoVersion = {
      id: `memo_${Math.random().toString(16).slice(2)}`,
      created_at: new Date().toISOString(),
      topic: workerWorkspace.topicLabel,
      decision: workerWorkspace.decisionLabel,
      confidence: workerWorkspace.confidence,
      text: memoText,
    };
    const next = [mv, ...memoVersions].slice(0, 25);
    setMemoVersions(next);
  };

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => {
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const goQuestions = () => {
    setActivePanel("questions");
    scrollTo(questionsRef);
  };

  const goCalendar = () => {
    setActivePanel("calendar");
    scrollTo(calendarRef);
  };

  const watchlist = React.useMemo(() => {
    if (!profile) return [];
    const items: Array<{
      key: string;
      title: string;
      trigger: string;
      readiness: string[];
      consequence: string;
      decisionPrompt: string;
      tags: string[];
    }> = [];

    if (hasPayroll(profile)) {
      items.push({
        key: "wl-payroll",
        title: "Payroll cadence + year-end forms readiness",
        trigger: "Payroll present",
        readiness: ["Payroll routine exists", "Reports saved each run", "Year-end checklist exists"],
        consequence: "Missed payroll steps can create notices, penalties, and messy corrections.",
        decisionPrompt: "Is payroll run + review documented (who/when/what gets saved)?",
        tags: ["payroll", "cadence", "year-end"],
      });
    }

    if (profile.inventory_presence === "yes") {
      items.push({
        key: "wl-inventory",
        title: "Inventory method prompts + COGS substantiation pack",
        trigger: "Inventory present",
        readiness: ["Purchase support stored by month", "Count cadence chosen", "Adjustments logged with notes"],
        consequence: "Weak inventory records can inflate taxable income and misstate margins.",
        decisionPrompt: "What count cadence fits your workflow: monthly or quarterly?",
        tags: ["inventory", "cogs", "proof"],
      });
    }

    if (profile.multistate_presence === "yes") {
      items.push({
        key: "wl-multistate",
        title: "Sales-tax tracking + nexus watch",
        trigger: "Multi-state exposure",
        readiness: ["Sales-by-state report exists", "Registration list exists", "Filing calendar exists"],
        consequence: "Crossing a threshold without tracking can create back filings and penalties.",
        decisionPrompt: "Can you pull a sales-by-state report in under 5 minutes?",
        tags: ["sales-tax", "multistate", "tracking"],
      });
    }

    if (profile.entity_type === "s_corp") {
      items.push({
        key: "wl-scorp",
        title: "Owner comp planning prompts + wage support pack",
        trigger: "S-corp selection",
        readiness: ["Role/time notes exist", "Comparable wage support saved", "Quarterly review cadence set"],
        consequence: "Owner pay set too low can create audit risk and reclassification exposure.",
        decisionPrompt: "Is owner pay reviewed quarterly with saved support?",
        tags: ["s-corp", "owner-comp", "evidence"],
      });
    }

    return items;
  }, [profile]);

  const downloadZip = async () => {
    if (!profile) return;
    setBusy(true);
    setUiErr(null);

    try {
      const stamp = nowStamp();

      const pdfBytes = memoToPdfBytes({
        title: "BTBB — Your Tax Planning Pack",
        profile,
        questions,
        calendar,
        memoText,
      });

      const ics = makeIcs(profile, calendar);
      const csv = makeChecklistCsv(questions);

      const zip = new JSZip();
      zip.file(`BTBB_Tax_Planning_Pack_${stamp}.pdf`, pdfBytes);
      zip.file(`BTBB_Quarterly_Decision_Calendar_${stamp}.ics`, ics);
      zip.file(`BTBB_Question_Set_${stamp}.csv`, csv);

      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(`BTBB_Tax_Planning_Bundle_${stamp}.zip`, blob);
    } catch (e: any) {
      setUiErr(e?.message ?? "Bundle build failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
<main className="relative mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
            BTBB Tax Planning
          </div>
          <div className="mt-1 text-sm text-black/70">
            Turn your answers into documentation, decision prompts, and a quarterly action calendar.
          </div>
          <div className="mt-2 text-xs text-black/60">
            This adds two premium blocks: Decision Memo + Audit Binder and Elections + Threshold Radar.
          </div>
        </div>
        <Badge variant="outline" className="rounded-full px-3 py-1" style={{ borderColor: BRAND.teal, color: BRAND.teal }}>
          Tax Prep
        </Badge>
      </div>

      <Card className={cn("relative overflow-hidden", cardBase)}>
        {/* Background stays behind the full card */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url(${APP_BG})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.16,
          }}
          aria-hidden="true"
        />
        <div className="relative">
          <CardHeader>
            <CardTitle className="text-base" style={{ color: BRAND.brown }}>
              Start here
            </CardTitle>
            <CardDescription>
              Save your intake once. This is used to build your memo + watchlist.
              <span className="mt-1 block text-xs text-black/60">
                Intake (inputs 1–8). These inputs drive the memo generator and the watchlist triggers.
              </span>
              {optsErr ? (
                <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {optsErr}
                </div>
              ) : null}
              {loadingOpts ? <div className="mt-2 text-xs text-black/60">Loading dropdown options…</div> : null}
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-5">
            {/* Intake */}
            <div className="grid gap-4 rounded-xl border border-black/10 bg-white/85 p-4">
              <div className="text-sm font-semibold" style={{ color: BRAND.brown }}>
                Intake (inputs 1–8)
              </div>

              {/* 1 Entity */}
              <div className="grid gap-1.5">
                <div className="flex items-center gap-2">
                  <div className={labelText}>1) Entity type</div>
                  <span title="Pick what matches your current legal setup. If you formed an LLC with one owner, choose Single-member LLC (SMLLC).">
                    <Info className={infoIcon} aria-label="Entity help" />
                  </span>
                </div>

                <select className={selectBase} value={intake.entity_type} onChange={(e) => setIntake({ ...intake, entity_type: e.target.value })}>
                  <option value="">Select…</option>
                  {entityOpts.map((o) => (
                    <option key={`${o.set_key}:${o.value}`} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                <div className={hintText}>{intake.entity_type ? selectHelp(opts, "entity_type", intake.entity_type) ?? " " : "Pick the closest match for today."}</div>
              </div>

              {/* 2 States */}
              <div className="grid gap-1.5">
                <div className="flex items-center gap-2">
                  <div className={labelText}>2) State(s)</div>
                  <span title="Add every state that touches taxes or filings: home state, registration states, key activity states, inventory storage states.">
                    <Info className={infoIcon} aria-label="States help" />
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <select className={selectBase} value={pendingState} onChange={(e) => setPendingState(e.target.value)}>
                    <option value="">Select a state…</option>
                    {stateOpts.map((o) => (
                      <option key={`${o.set_key}:${o.value}`} value={o.value}>
                        {o.label} ({o.value})
                      </option>
                    ))}
                  </select>

                  <Button
                    type="button"
                    className="rounded-md"
                    style={{ backgroundColor: BRAND.teal }}
                    onClick={() => {
                      addStateFromSelect(pendingState);
                      setPendingState("");
                    }}
                    disabled={!pendingState}
                    title="Add the selected state"
                  >
                    Add
                  </Button>
                </div>

                <div className={hintText}>Picked: {intake.states.length ? intake.states.join(", ") : "None"}</div>

                {intake.states.length ? (
                  <div className="flex flex-wrap gap-2">
                    {intake.states.map((s) => (
                      <span key={s} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-xs">
                        {s}
                        <button
                          type="button"
                          className="text-black/50 hover:text-black"
                          onClick={() => removeState(s)}
                          aria-label={`Remove state ${s}`}
                          title="Remove"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* 3 Industry */}
              <div className="grid gap-1.5">
                <div className="flex items-center gap-2">
                  <div className={labelText}>3) Industry</div>
                  <span title="Pick the closest revenue engine. This drives watchlist triggers and your question set.">
                    <Info className={infoIcon} aria-label="Industry help" />
                  </span>
                </div>

                <select className={selectBase} value={intake.industry} onChange={(e) => setIntake({ ...intake, industry: e.target.value })}>
                  <option value="">Select…</option>
                  {industryOpts.map((o) => (
                    <option key={`${o.set_key}:${o.value}`} value={o.value}>
                      {o.group_label ? `${o.group_label} — ${o.label}` : o.label}
                    </option>
                  ))}
                </select>

                <div className={hintText}>{intake.industry ? selectHelp(opts, "industry", intake.industry) ?? " " : "Pick the closest match, refine later."}</div>
              </div>

              {/* 4 Revenue */}
              <div className="grid gap-1.5">
                <div className="flex items-center gap-2">
                  <div className={labelText}>4) Revenue range</div>
                  <span title="Select the annual top-line bracket that best matches your records today.">
                    <Info className={infoIcon} aria-label="Revenue help" />
                  </span>
                </div>

                <select className={selectBase} value={intake.revenue_range} onChange={(e) => setIntake({ ...intake, revenue_range: e.target.value })}>
                  <option value="">Select…</option>
                  {revenueOpts.map((o) => (
                    <option key={`${o.set_key}:${o.value}`} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                <div className={hintText}>{intake.revenue_range ? selectHelp(opts, "revenue_range", intake.revenue_range) ?? " " : "Revenue drives planning depth and timing."}</div>
              </div>

              {/* 5 Payroll */}
              <div className="grid gap-1.5">
                <div className="flex items-center gap-2">
                  <div className={labelText}>5) W-2 employees (on payroll)</div>
                  <span title="Count W-2 employees on payroll right now. Contractors are handled inside the Decision Workspace.">
                    <Info className={infoIcon} aria-label="Payroll help" />
                  </span>
                </div>

                <select className={selectBase} value={intake.payroll_w2} onChange={(e) => setIntake({ ...intake, payroll_w2: e.target.value })}>
                  <option value="">Select…</option>
                  {payrollOpts.map((o) => (
                    <option key={`${o.set_key}:${o.value}`} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                <div className={hintText}>{intake.payroll_w2 ? selectHelp(opts, "payroll_w2", intake.payroll_w2) ?? " " : "Payroll triggers a compliance cadence."}</div>
              </div>

              {/* 6 Inventory */}
              <div className="grid gap-1.5">
                <div className="flex items-center gap-2">
                  <div className={labelText}>6) Inventory present</div>
                  <span title="Inventory changes record expectations. Pick what matches your current operations.">
                    <Info className={infoIcon} aria-label="Inventory help" />
                  </span>
                </div>

                <select
                  className={selectBase}
                  value={intake.inventory_presence}
                  onChange={(e) => setIntake({ ...intake, inventory_presence: e.target.value as any })}
                >
                  <option value="">Select…</option>
                  {invOpts.map((o) => (
                    <option key={`${o.set_key}:${o.value}`} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                <div className={hintText}>{intake.inventory_presence ? selectHelp(opts, "inventory_presence", intake.inventory_presence) ?? " " : "Inventory triggers proof-pack items and calendar steps."}</div>
              </div>

              {/* 7 Multi-state */}
              <div className="grid gap-1.5">
                <div className="flex items-center gap-2">
                  <div className={labelText}>7) Multi-state</div>
                  <span title="Multi-state exposure can trigger sales tax, registrations, and more documentation.">
                    <Info className={infoIcon} aria-label="Multi-state help" />
                  </span>
                </div>

                <select
                  className={selectBase}
                  value={intake.multistate_presence}
                  onChange={(e) => setIntake({ ...intake, multistate_presence: e.target.value as any })}
                >
                  <option value="">Select…</option>
                  {msOpts.map((o) => (
                    <option key={`${o.set_key}:${o.value}`} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                <div className={hintText}>{intake.multistate_presence ? selectHelp(opts, "multistate_presence", intake.multistate_presence) ?? " " : "This drives threshold watch items."}</div>
              </div>

              {/* 8 International */}
              <div className="grid gap-1.5">
                <div className="flex items-center gap-2">
                  <div className={labelText}>8) International</div>
                  <span title="Foreign customers, vendors, labor, or shipping adds documentation and reporting needs.">
                    <Info className={infoIcon} aria-label="International help" />
                  </span>
                </div>

                <select
                  className={selectBase}
                  value={intake.international_presence}
                  onChange={(e) => setIntake({ ...intake, international_presence: e.target.value as any })}
                >
                  <option value="">Select…</option>
                  {intlOpts.map((o) => (
                    <option key={`${o.set_key}:${o.value}`} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>

                <div className={hintText}>{intake.international_presence ? selectHelp(opts, "international_presence", intake.international_presence) ?? " " : "International touchpoints trigger extra proof needs."}</div>
              </div>

              {uiErr ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {uiErr}
                </div>
              ) : null}

              <Button type="button" className="w-full rounded-md py-6 text-base" style={{ backgroundColor: BRAND.teal }} onClick={buildProfile}>
                Build profile
              </Button>
            </div>

            {/* Results + Tax Prep blocks */}
            {profile ? (
              <div className="grid gap-4">
                <Card className={cn(cardBase, "bg-white")}>
                  <CardHeader>
                    <CardTitle className="text-base" style={{ color: BRAND.brown }}>
                      Results
                    </CardTitle>
                    <CardDescription>“Your Tax Planning Profile” (one-page summary)</CardDescription>
                  </CardHeader>

                  <CardContent className="grid gap-3">
                    <div className="rounded-lg border border-black/10 bg-white p-3 text-sm">
                      <div className="grid grid-cols-[160px_1fr] gap-y-2">
                        <div className="text-black/60">entity_type</div>
                        <div className="font-medium">{profile.entity_type}</div>
                        <div className="text-black/60">states</div>
                        <div className="font-medium">{profile.states.join(", ")}</div>
                        <div className="text-black/60">industry</div>
                        <div className="font-medium">{profile.industry}</div>
                        <div className="text-black/60">revenue_range</div>
                        <div className="font-medium">{profile.revenue_range}</div>
                        <div className="text-black/60">payroll_w2</div>
                        <div className="font-medium">{profile.payroll_w2}</div>
                        <div className="text-black/60">inventory_presence</div>
                        <div className="font-medium">{profile.inventory_presence}</div>
                        <div className="text-black/60">multistate_presence</div>
                        <div className="font-medium">{profile.multistate_presence}</div>
                        <div className="text-black/60">international_presence</div>
                        <div className="font-medium">{profile.international_presence}</div>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Button type="button" variant="outline" className="w-full justify-between rounded-md" onClick={goQuestions}>
                        <span className="inline-flex items-center gap-2">
                          <ListChecks className="h-4 w-4" aria-hidden="true" />
                          Next steps → Your Question Set
                        </span>
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Button>

                      <Button type="button" variant="outline" className="w-full justify-between rounded-md" onClick={goCalendar}>
                        <span className="inline-flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" aria-hidden="true" />
                          Quarterly Decision Calendar
                        </span>
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Button>

                      <Button type="button" className="w-full rounded-md" style={{ backgroundColor: BRAND.teal }} onClick={downloadZip} disabled={busy}>
                        <span className="inline-flex items-center gap-2">
                          <Download className="h-4 w-4" aria-hidden="true" />
                          {busy ? "Building bundle…" : "Download ZIP (PDF + ICS + CSV)"}
                        </span>
                      </Button>
                    </div>

                    <div className="rounded-md border border-black/10 bg-white px-3 py-2 text-xs text-black/70">
                      ZIP contains a tailored PDF pack (profile + question set + calendar + memo), plus an ICS calendar file and a CSV question checklist.
                    </div>
                  </CardContent>
                </Card>

                {/* Decision Memo + Audit Binder */}
                <Card className={cn(cardBase, "bg-white")}>
                  <CardHeader>
                    <CardTitle className="text-base" style={{ color: BRAND.brown }}>
                      Decision Memo + Audit Binder
                    </CardTitle>
                    <CardDescription>
                      Every “next step” produces a Tax Position Memo you can save, re-open, and export.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="grid gap-4">
                    <div className="rounded-lg border border-black/10 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{workerWorkspace.topicLabel}</div>
                          <div className="mt-1 text-xs text-black/60">
                            Confidence score updates from intake completeness + proof pack completeness + a selected decision.
                          </div>
                        </div>

                        <div className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm">
                          <span className="text-black/60">Confidence</span>{" "}
                          <span className="font-semibold">{workerWorkspace.confidence}/100</span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" variant={decisionTab === "decision" ? "default" : "outline"} className="rounded-md" style={decisionTab === "decision" ? { backgroundColor: BRAND.teal } : undefined} onClick={() => setDecisionTab("decision")}>
                          Decision
                        </Button>
                        <Button type="button" variant={decisionTab === "rationale" ? "default" : "outline"} className="rounded-md" style={decisionTab === "rationale" ? { backgroundColor: BRAND.teal } : undefined} onClick={() => setDecisionTab("rationale")}>
                          Rationale
                        </Button>
                        <Button type="button" variant={decisionTab === "proof" ? "default" : "outline"} className="rounded-md" style={decisionTab === "proof" ? { backgroundColor: BRAND.teal } : undefined} onClick={() => setDecisionTab("proof")}>
                          Proof Pack
                        </Button>
                        <Button type="button" variant={decisionTab === "memo" ? "default" : "outline"} className="rounded-md" style={decisionTab === "memo" ? { backgroundColor: BRAND.teal } : undefined} onClick={() => setDecisionTab("memo")}>
                          Memo
                        </Button>
                      </div>

                      {/* Decision tab */}
                      {decisionTab === "decision" ? (
                        <div className="mt-4 grid gap-3">
                          <div className="rounded-md border border-black/10 bg-white p-3">
                            <div className="text-sm font-semibold">Which worker setup applies right now?</div>
                            <div className="mt-1 text-xs text-black/60">
                              Best fit suggestion:{" "}
                              <span className="font-semibold">{workerWorkspace.bestFit ?? "none"}</span>
                            </div>

                            <div className="mt-3 grid gap-2">
                              {workerWorkspace.decisionOptions.map((o) => (
                                <label key={o.value} className="flex cursor-pointer items-start gap-3 rounded-md border border-black/10 bg-white p-3">
                                  <input
                                    type="radio"
                                    name="workerDecision"
                                    value={o.value}
                                    checked={workerDecision === o.value}
                                    onChange={() => setWorkerDecision(o.value)}
                                    className="mt-1"
                                  />
                                  <div className="grid gap-1">
                                    <div className="text-sm font-semibold">{o.label}</div>
                                    <div className="text-xs text-black/60">{o.help}</div>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-md border border-black/10 bg-white p-3">
                            <div className="text-sm font-semibold">If you pick this</div>
                            <div className="mt-2 text-sm text-black/80">
                              You’ll see the proof pack update with the exact documents that support the decision, plus a memo you can export.
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {/* Rationale tab */}
                      {decisionTab === "rationale" ? (
                        <div className="mt-4 grid gap-3">
                          <div className="rounded-md border border-black/10 bg-white p-3">
                            <div className="text-sm font-semibold">Plain-English reason</div>
                            <ul className="mt-2 list-disc pl-5 text-sm text-black/80">
                              {workerWorkspace.rationale.map((r) => (
                                <li key={r}>{r}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="rounded-md border border-black/10 bg-white p-3">
                            <div className="text-sm font-semibold">Tradeoffs</div>
                            <ul className="mt-2 list-disc pl-5 text-sm text-black/80">
                              {workerWorkspace.tradeoffs.map((t) => (
                                <li key={t}>{t}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="rounded-md border border-black/10 bg-white p-3">
                            <div className="text-sm font-semibold">If asked, say this</div>
                            <ul className="mt-2 list-disc pl-5 text-sm text-black/80">
                              {workerWorkspace.auditNarrative.map((a) => (
                                <li key={a}>{a}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ) : null}

                      {/* Proof Pack tab */}
                      {decisionTab === "proof" ? (
                        <div className="mt-4 grid gap-3">
                          <div className="rounded-md border border-black/10 bg-white p-3">
                            <div className="text-sm font-semibold">Proof Pack</div>
                            <div className="mt-1 text-xs text-black/60">
                              Check items off as you store them. The confidence score moves with this.
                            </div>

                            <div className="mt-3 grid gap-2">
                              {workerWorkspace.proofPack.map((p) => (
                                <div key={p.label} className="flex items-start justify-between gap-3 rounded-md border border-black/10 bg-white p-3">
                                  <label className="flex items-start gap-3">
                                    <input
                                      type="checkbox"
                                      checked={!!proofPackState[p.label]}
                                      onChange={(e) =>
                                        setProofPackState((prev) => ({
                                          ...prev,
                                          [p.label]: e.target.checked,
                                        }))
                                      }
                                      className="mt-1"
                                    />
                                    <div className="grid gap-1">
                                      <div className="text-sm font-semibold">
                                        {p.label}{" "}
                                        <span className="ml-2 rounded-full border border-black/10 bg-white px-2 py-0.5 text-xs text-black/60">
                                          {p.required ? "required" : "optional"}
                                        </span>
                                      </div>
                                      <div className="text-xs text-black/60">Accept: {p.accept.join(", ")} • Cadence: {p.cadence}</div>
                                    </div>
                                  </label>

                                  <div className="text-xs text-black/60">
                                    Status:{" "}
                                    <span className="font-semibold">{proofPackState[p.label] ? "done" : "missing"}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {/* Memo tab */}
                      {decisionTab === "memo" ? (
                        <div className="mt-4 grid gap-3">
                          <div className="rounded-md border border-black/10 bg-white p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="grid gap-1">
                                <div className="text-sm font-semibold">Memo</div>
                                <div className="text-xs text-black/60">
                                  Auto-generated from intake + decision + proof pack status.
                                </div>
                              </div>

                              <Button type="button" variant="outline" className="rounded-md" onClick={saveMemoVersion} title="Save this memo version">
                                <span className="inline-flex items-center gap-2">
                                  <FileText className="h-4 w-4" aria-hidden="true" />
                                  Save version
                                </span>
                              </Button>
                            </div>

                            <div className="mt-3 rounded-md border border-black/10 bg-white p-3">
                              <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs text-black/80">{memoText}</pre>
                            </div>

                            <div className="mt-3">
                              <div className="text-sm font-semibold">Saved memo versions</div>
                              <div className="mt-2 grid gap-2">
                                {memoVersions.length === 0 ? (
                                  <div className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black/70">
                                    No saved memos yet.
                                  </div>
                                ) : (
                                  memoVersions.slice(0, 5).map((m) => (
                                    <div key={m.id} className="rounded-md border border-black/10 bg-white p-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="grid gap-1">
                                          <div className="text-sm font-semibold">{m.topic}</div>
                                          <div className="text-xs text-black/60">
                                            {new Date(m.created_at).toLocaleString()} • {m.decision} • {m.confidence}/100
                                          </div>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          className="rounded-md"
                                          onClick={() => setMemoText(m.text)}
                                          title="Load this version into the memo viewer"
                                        >
                                          Load
                                        </Button>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>

                {/* Elections + Threshold Radar */}
                <Card className={cn(cardBase, "bg-white")}>
                  <CardHeader>
                    <CardTitle className="text-base" style={{ color: BRAND.brown }}>
                      Elections + Threshold Radar
                    </CardTitle>
                    <CardDescription>
                      A guided board of decisions and deadlines that can cost money if missed.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="grid gap-3">
                    <div className="rounded-lg border border-black/10 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Watchlist</div>
                          <div className="text-xs text-black/60">Elections • Thresholds • Deadlines</div>
                        </div>
                        <div className="inline-flex items-center gap-2 text-xs text-black/60">
                          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                          Smart triggers
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3">
                        {watchlist.length === 0 ? (
                          <div className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black/70">
                            No watchlist items triggered yet.
                          </div>
                        ) : (
                          watchlist.map((w) => (
                            <div key={w.key} className="rounded-md border border-black/10 bg-white p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="grid gap-1">
                                  <div className="text-sm font-semibold">{w.title}</div>
                                  <div className="text-xs text-black/60">
                                    <span className="font-semibold">Trigger:</span> {w.trigger}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {w.tags.map((t) => (
                                    <Badge key={t} variant="outline" className="rounded-full">
                                      {t}
                                    </Badge>
                                  ))}
                                </div>
                              </div>

                              <div className="mt-2 text-sm text-black/80">
                                <span className="font-semibold">What happens if missed:</span> {w.consequence}
                              </div>

                              <div className="mt-3 grid gap-2">
                                <div className="text-sm font-semibold">Readiness checklist</div>
                                <ul className="list-disc pl-5 text-sm text-black/80">
                                  {w.readiness.map((r) => (
                                    <li key={r}>{r}</li>
                                  ))}
                                </ul>

                                <div className="text-sm font-semibold">Decision prompt</div>
                                <div className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm">{w.decisionPrompt}</div>

                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-md"
                                    onClick={() => {
                                      const ics = makeIcs(profile, calendar);
                                      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
                                      downloadBlob(`BTBB_Quarterly_Decision_Calendar_${nowStamp()}.ics`, blob);
                                    }}
                                    title="Download an ICS calendar file"
                                  >
                                    Add to calendar (ICS)
                                  </Button>

                                  <Button type="button" variant="outline" className="rounded-md" onClick={goQuestions} title="Jump to your question set">
                                    Add questions to my list
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Question Set */}
                <div ref={questionsRef} />
                <Card className={cn(cardBase, "bg-white")}>
                  <CardHeader>
                    <CardTitle className="text-base" style={{ color: BRAND.brown }}>
                      Your Question Set
                    </CardTitle>
                    <CardDescription>
                      Prioritized checklist, grouped by topic. Built from your intake and warning triggers.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="grid gap-3">
                    {questions.length === 0 ? (
                      <div className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black/70">
                        Build your profile first.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {(() => {
                          const groups: Record<string, Question[]> = {};
                          for (const q of questions) {
                            if (!groups[q.group]) groups[q.group] = [];
                            groups[q.group].push(q);
                          }
                          const names = Object.keys(groups).sort();
                          return names.map((name) => (
                            <div key={name} className="rounded-md border border-black/10 bg-white p-3">
                              <div className="text-sm font-semibold">{name}</div>
                              <div className="mt-2 grid gap-2">
                                {groups[name].map((q) => (
                                  <div key={q.id} className="rounded-md border border-black/10 bg-white p-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="grid gap-1">
                                        <div className="text-sm font-semibold">{q.prompt}</div>
                                        <div className="text-xs text-black/60">Why: {q.why}</div>
                                        <div className="text-xs text-black/60">Proof: {q.proof.join(" • ")}</div>
                                      </div>
                                      <div className="rounded-full border border-black/10 bg-white px-2 py-1 text-xs text-black/60">
                                        P{q.priority}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Calendar */}
                <div ref={calendarRef} />
                <Card className={cn(cardBase, "bg-white")}>
                  <CardHeader>
                    <CardTitle className="text-base" style={{ color: BRAND.brown }}>
                      Quarterly Decision Calendar
                    </CardTitle>
                    <CardDescription>
                      Actions + key estimated tax dates. Built from your intake and triggers.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="grid gap-3">
                    {calendar.length === 0 ? (
                      <div className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-black/70">
                        Build your profile first.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {(["Q1", "Q2", "Q3", "Q4"] as const).map((qtr) => {
                          const items = calendar.filter((c) => c.quarter === qtr);
                          if (items.length === 0) return null;
                          return (
                            <div key={qtr} className="rounded-md border border-black/10 bg-white p-3">
                              <div className="text-sm font-semibold">{qtr}</div>
                              <div className="mt-2 grid gap-2">
                                {items.map((it) => (
                                  <div key={it.id} className="rounded-md border border-black/10 bg-white p-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="grid gap-1">
                                        <div className="text-sm font-semibold">{it.title}</div>
                                        <div className="text-xs text-black/60">Why: {it.why}</div>
                                        <div className="text-xs text-black/60">Proof: {it.proof.join(" • ")}</div>
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {it.tags.slice(0, 4).map((t) => (
                                          <Badge key={t} variant="outline" className="rounded-full">
                                            {t}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Panel hint */}
                <div className="rounded-md border border-black/10 bg-white px-3 py-2 text-xs text-black/70">
                  Panel: <span className="font-semibold">{activePanel}</span>
                </div>

                {uiErr ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {uiErr}
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </div>
      </Card>
    </main>
  );
}
