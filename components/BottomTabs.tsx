"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string };

const TABS: Tab[] = [
  { href: "/chapters", label: "Chapters" },
  { href: "/plan", label: "My Plan" },
  { href: "/tax-planning", label: "Tax" },
  { href: "/prompts", label: "Prompts" },
  { href: "/progress", label: "Progress" },
  { href: "/settings", label: "Settings" },
];

export default function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                active ? "text-[#1C6F66]" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
