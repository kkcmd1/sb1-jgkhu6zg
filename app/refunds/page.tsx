import Link from "next/link";

export default function RefundsPage() {
  return (
    <main className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-xl font-semibold text-[#6B4A2E]">Refund Policy</div>
      <div className="mt-2 text-sm text-gray-700">
        Effective date: 2026-01-08
      </div>

      <div className="mt-4 space-y-3 text-sm text-gray-700">
        <p>
          If the app offers paid upgrades in the future, refund rules will be
          shown at checkout.
        </p>
        <p>
          If you believe you were charged in error, use the Settings page to
          contact the owner with the email used to sign in and the date of the
          charge.
        </p>
      </div>

      <div className="mt-6">
        <Link
          href="/"
          className="inline-flex rounded-xl border px-4 py-2 text-sm font-semibold text-[#6B4A2E]"
        >
          Back Home
        </Link>
      </div>
    </main>
  );
}
