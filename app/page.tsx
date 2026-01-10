import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative min-h-screen bg-[url('/assets/web-app-background.png')] bg-cover bg-center bg-no-repeat text-[#1C6F66]">
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm"></div>

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-12">
        {/* Header Section */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="/assets/btbb-logo.png"
            alt="Broke to Better Biz"
            width={72}
            height={72}
            className="rounded-full"
          />
          <div>
            <h1 className="text-3xl font-bold text-[#DA8A00] tracking-tight">
              Broke to Better Biz
            </h1>
            <p className="mt-1 text-sm text-[#4B3621]">
              Turn hustle into a weekly plan you can repeat.
            </p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="grid gap-4">
          <Link
            href="/chapters"
            className="rounded-xl bg-[#1C6F66] px-5 py-3 text-center text-sm font-semibold text-white transition hover:opacity-90 shadow-md"
          >
            Start here: Chapters →
          </Link>

          <Link
            href="/plan"
            className="rounded-xl border border-[#1C6F66] bg-white px-5 py-3 text-center text-sm font-semibold text-[#1C6F66] hover:bg-[#F0FBF9] transition"
          >
            Open My Plan →
          </Link>

          <Link
            href="/prompts"
            className="rounded-xl border bg-white px-5 py-3 text-center text-sm font-semibold text-[#6B4A2E] hover:bg-[#F3EEE6] transition"
          >
            Open Prompt Library →
          </Link>

          <Link
            href="/progress"
            className="rounded-xl border bg-white px-5 py-3 text-center text-sm font-semibold text-[#6B4A2E] hover:bg-[#F3EEE6] transition"
          >
            View Progress →
          </Link>
        </div>

        {/* Tip Box */}
        <div className="mt-8 rounded-xl bg-white/80 p-4 shadow-inner">
          <div className="text-sm font-semibold text-[#6B4A2E]">💡 Tip</div>
          <p className="mt-1 text-sm text-gray-700">
            Sign in on the Settings tab once, then your saves show up across chapters.
          </p>
        </div>

        {/* Footer Links */}
        <div className="mt-10 flex flex-wrap justify-center gap-6 text-xs text-gray-600">
          <Link className="underline hover:text-[#DA8A00]" href="/privacy">
            Privacy
          </Link>
          <Link className="underline hover:text-[#DA8A00]" href="/terms">
            Terms
          </Link>
          <Link className="underline hover:text-[#DA8A00]" href="/refunds">
            Refunds
          </Link>
        </div>
      </div>
    </main>
  );
}
