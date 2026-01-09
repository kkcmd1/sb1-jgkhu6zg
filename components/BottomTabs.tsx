"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string };

const TABS: Tab[] = [
  { href: "/chapters", label: "Chapters" },
  { href: "/plan", label: "My Plan" },
  { href: "/prompts", label: "Prompts" },
  { href: "/progress", label: "Progress" },
  { href: "/settings", label: "Settings" },
];

export default function BottomTabs() {
  const pathname = usePathname() || "/";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-2 py-2">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={[
                "flex-1 rounded-lg px-2 py-2 text-center text-xs font-medium",
                active ? "bg-[#1C6F66] text-white" : "text-[#6B4A2E] hover:bg-[#F3EEE6]",
              ].join(" ")}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
