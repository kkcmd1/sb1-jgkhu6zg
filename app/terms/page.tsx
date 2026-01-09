import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-xl font-semibold text-[#6B4A2E]">Terms of Use</div>
      <div className="mt-2 text-sm text-gray-700">
        Effective date: 2026-01-08
      </div>

      <div className="mt-4 space-y-3 text-sm text-gray-700">
        <p>
          This app provides planning tools and educational templates. It does not
          provide legal, tax, or financial advice.
        </p>
        <p>
          You are responsible for the accuracy of anything you enter and for any
          decisions you make using the content.
        </p>
        <p>
          Do not upload sensitive personal data you would not want stored in a
          database.
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
