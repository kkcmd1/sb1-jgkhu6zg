"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/chapters");
    });
  }, [router]);

  async function signInPassword() {
    setBusy(true);
    setErr("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    router.replace("/chapters");
  }

  async function signUpPassword() {
    setBusy(true);
    setErr("");

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    const { data } = await supabase.auth.getSession();
    if (data.session) router.replace("/chapters");
    setBusy(false);
  }

  async function signInGooglePopup() {
    setBusy(true);
    setErr("");

    const redirectTo = `${window.location.origin}/auth/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true
      }
    });

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    const url = data?.url;
    if (!url) {
      setErr("No OAuth URL returned.");
      setBusy(false);
      return;
    }

    const popup = window.open(
      url,
      "btbb_google_oauth",
      "width=520,height=680,left=120,top=80,noopener,noreferrer"
    );

    if (!popup) {
      setErr("Popup blocked. Allow popups for this preview domain.");
      setBusy(false);
      return;
    }

    const started = Date.now();
    const timer = window.setInterval(async () => {
      const { data: s } = await supabase.auth.getSession();

      if (s.session) {
        window.clearInterval(timer);
        try {
          popup.close();
        } catch {}
        router.replace("/chapters");
        return;
      }

      if (Date.now() - started > 90_000) {
        window.clearInterval(timer);
        setErr("Timed out. Re-check Supabase redirect URLs + Google OAuth client.");
        setBusy(false);
      }
    }, 800);
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-white/90 p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-[#6B4A2E]">Sign in</h1>

      <div className="mt-3 rounded-md border bg-white p-3 text-xs text-gray-700">
        Callback used here:
        <div className="mt-2 rounded border bg-white p-2 font-mono">
          {typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "…"}
        </div>
      </div>

      {err ? (
        <div className="mt-3 rounded-md border border-red-200 bg-white p-3 text-sm text-gray-800">
          {err}
        </div>
      ) : null}

      <div className="mt-5 rounded-xl border bg-white p-4">
        <div className="text-sm font-semibold text-[#6B4A2E]">Email + password</div>

        <label className="mt-3 block text-xs font-semibold text-[#6B4A2E]">Email</label>
        <input
          className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
        />

        <label className="mt-3 block text-xs font-semibold text-[#6B4A2E]">Password</label>
        <input
          className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="••••••••"
        />

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={signInPassword}
            disabled={busy || !email || !password}
            className="rounded-md bg-[#1C6F66] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Working…" : "Sign in"}
          </button>

          <button
            onClick={signUpPassword}
            disabled={busy || !email || !password}
            className="rounded-md border bg-white px-4 py-3 text-sm font-semibold text-[#6B4A2E] hover:bg-[#F3EEE6] disabled:opacity-60"
          >
            {busy ? "Working…" : "Create account"}
          </button>
        </div>
      </div>

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
