import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-xl font-semibold text-[#6B4A2E]">Privacy Policy</div>
      <div className="mt-2 text-sm text-gray-700">
        Effective date: 2026-01-08
      </div>

      <div className="mt-4 space-y-3 text-sm text-gray-700">
        <p>
          Broke to Better Biz stores the information you enter in the app (your
          answers, plans, routines, and progress) so you can access it later.
        </p>
        <p>
          Sign-in uses Google through Supabase authentication. Your account email
          may be stored for login and personalization.
        </p>
        <p>
          App data is stored in Supabase tables tied to your user account. The
          app uses browser storage for session handling.
        </p>
        <p>
          Questions: contact the owner through the Settings page.
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
