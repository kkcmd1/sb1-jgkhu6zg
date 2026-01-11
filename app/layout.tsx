import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import BottomTabs from "../components/BottomTabs";

export const metadata = {
  title: "Broke to Better Biz",
  description: "Turn hustle into a solid plan you can repeat.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#FAF7F2] text-[#2B2B2B]">
        {/* App-wide transparent background */}
        <div
          className="pointer-events-none fixed inset-0 -z-10 opacity-10"
          style={{
            backgroundImage: "url(/assets/web-app-background.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
        {/* Soft overlay so text stays readable */}
        <div className="pointer-events-none fixed inset-0 -z-10 bg-white/70" />

        <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
            <Link href="/" className="flex items-center gap-3">
              <img
                src="/assets/btbb-logo.png"
                alt="Broke to Better Biz"
                width={34}
                height={34}
                style={{ width: 34, height: 34 }}
              />
              <div className="leading-tight">
                <div className="text-lg font-semibold tracking-tight text-[#6B4A2E]">
                  Broke to Better Biz
                </div>
                <div className="text-xs text-[#6B4A2E]/70">Web app</div>
              </div>
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-md px-4 py-4 pb-24">{children}</div>

        <BottomTabs />
      </body>
    </html>
  );
}
