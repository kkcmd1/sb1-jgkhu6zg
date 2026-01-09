import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative overflow-hidden rounded-2xl border bg-white/90 p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <img
          src="/assets/btbb-logo.png"
          alt="Broke to Better Biz"
          width={56}
          height={56}
          style={{ width: 56, height: 56 }}
        />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#6B4A2E]">
            Broke to Better Biz
          </h1>
          <p className="mt-1 text-sm text-gray-700">
            Turn hustle into a weekly plan you can repeat.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        <Link
          href="/chapters"
          className="rounded-xl bg-[#1C6F66] px-4 py-3 text-center text-sm font-semibold text-white hover:opacity-95"
        >
          Start here: Chapters →
        </Link>

        <Link
          href="/plan"
          className="rounded-xl border border-[#1C6F66] bg-white px-4 py-3 text-center text-sm font-semibold text-[#1C6F66] hover:bg-[#F0FBF9]"
        >
          Open My Plan →
        </Link>

        <Link
          href="/prompts"
          className="rounded-xl border bg-white px-4 py-3 text-center text-sm font-semibold text-[#6B4A2E] hover:bg-[#F3EEE6]"
        >
          Open Prompt Library →
        </Link>

        <Link
          href="/progress"
          className="rounded-xl border bg-white px-4 py-3 text-center text-sm font-semibold text-[#6B4A2E] hover:bg-[#F3EEE6]"
        >
          View Progress →
        </Link>
      </div>

      <div className="mt-6 rounded-xl bg-white/70 p-4">
        <div className="text-sm font-semibold text-[#6B4A2E]">Tip</div>
        <p className="mt-1 text-sm text-gray-700">
          Sign in on the Settings tab once, then your saves show up across chapters.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-4 text-xs text-gray-600">
        <Link className="underline" href="/privacy">
          Privacy
        </Link>
        <Link className="underline" href="/terms">
          Terms
        </Link>
        <Link className="underline" href="/refunds">
          Refunds
        </Link>
      </div>
    </main>
  );
}
