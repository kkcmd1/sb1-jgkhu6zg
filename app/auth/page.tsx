"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/chapters");
    });
  }, [router]);

  async function signInGooglePopup() {
    setBusy(true);
    setErr("");

    const redirectTo = `${window.location.origin}/auth/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    const url = data?.url;
    if (!url) {
      setErr("No Google OAuth URL returned.");
      setBusy(false);
      return;
    }

    const w = window.open(
      url,
      "btbb_google_oauth",
      "width=520,height=680,left=120,top=80,noopener,noreferrer"
    );

    if (!w) {
      setErr("Popup blocked. Allow popups for this preview site, then retry.");
      setBusy(false);
      return;
    }

    const started = Date.now();
    const timer = window.setInterval(async () => {
      const { data: s } = await supabase.auth.getSession();

      if (s.session) {
        window.clearInterval(timer);
        try { w.close(); } catch {}
        router.replace("/chapters");
        return;
      }

      if (Date.now() - started > 90_000) {
        window.clearInterval(timer);
        setErr("Timed out. Re-check Supabase URL Configuration + Google redirect URIs.");
        setBusy(false);
      }
    }, 800);
  }

  return (
    <div className="rounded-xl border bg-white p-6">
      <h1 className="text-2xl font-bold text-[#6B4A2E]">Sign in</h1>

      <div className="mt-3 rounded-md border bg-white p-3 text-sm text-gray-700">
        Current callback:
        <div className="mt-2 rounded border bg-white p-2 text-xs font-mono text-gray-700">
          {typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "…"}
        </div>
      </div>

      {err ? (
        <div className="mt-3 rounded-md border border-red-200 bg-white p-3 text-sm text-gray-800">
          {err}
        </div>
      ) : null}

      <button
        onClick={signInGooglePopup}
        disabled={busy}
        className="mt-4 w-full rounded-md bg-[#1C6F66] px-4 py-3 text-white disabled:opacity-60"
      >
        {busy ? "Opening Google…" : "Continue with Google (popup)"}
      </button>
    </div>
  );
}
