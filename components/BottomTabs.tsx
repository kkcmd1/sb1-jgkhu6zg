"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  Landmark,
  Sparkles,
  LineChart,
  Settings,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BRAND = {
  teal: "#1C6F66",
  brown: "#6B4A2E",
  gold: "#E8B765",
};

type Tab = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const TABS: Tab[] = [
  { href: "/chapters", label: "Chapters", Icon: BookOpen },
  { href: "/plan", label: "My Plan", Icon: ClipboardList },
  { href: "/tax-planning", label: "Tax", Icon: Landmark },
  { href: "/biz-strategy", label: "Biz Strategy", Icon: Briefcase },
  { href: "/prompts", label: "Prompts", Icon: Sparkles },
  { href: "/progress", label: "Progress", Icon: LineChart },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export default function BottomTabs() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname?.startsWith(href + "/"));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-white/90 backdrop-blur"
      role="navigation"
      aria-label="Bottom navigation"
    >
      <div className="mx-auto w-full max-w-6xl px-2">
        <div className="grid grid-cols-7 gap-1 py-2">
          {TABS.map((t) => {
            const active = isActive(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-label={t.label}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl px-1 py-2",
                  "transition",
                  active ? "bg-black/5" : "hover:bg-black/5"
                )}
              >
                <t.Icon
                  className={cn("h-5 w-5", active ? "opacity-100" : "opacity-70")}
                  // lucide icons don’t take `title` prop reliably in TS
                />
                <span
                  className={cn(
                    "mt-1 text-[11px] leading-none",
                    active ? "font-semibold" : "font-medium"
                  )}
                  style={{ color: active ? BRAND.teal : BRAND.brown }}
                >
                  {t.label}
                </span>
                {active ? (
                  <span
                    className="mt-1 h-[3px] w-10 rounded-full"
                    style={{ backgroundColor: BRAND.gold }}
                    aria-hidden="true"
                  />
                ) : (
                  <span className="mt-1 h-[3px] w-10 rounded-full bg-transparent" aria-hidden="true" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
