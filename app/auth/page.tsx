"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isWebContainer = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.location.hostname.includes("webcontainer.io");
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/chapters");
    });
  }, [router]);

  async function signInPassword() {
    setBusy(true);
    setErr("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

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

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    // If email confirmations are enabled, user must confirm first.
    // If not enabled, session exists right away.
    const { data } = await supabase.auth.getSession();
    if (data.session) router.replace("/chapters");
    setBusy(false);
  }

  async function signInGoogle() {
    setBusy(true);
    setErr("");

    // Google OAuth redirects break inside WebContainer preview.
    // Use this button on a stable deployed URL.
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      setErr(error.message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#6B4A2E]">Sign in</h1>

      {err ? (
        <div className="rounded-md border border-red-200 bg-white p-3 text-sm text-[#374151]">
          {err}
        </div>
      ) : null}

      {isWebContainer ? (
        <div className="rounded-md border bg-white p-3 text-sm text-gray-700">
          Google sign-in redirects do not work inside StackBlitz preview. Use email + password here.
          Use Google sign-in after deploying (Netlify/Vercel/custom domain).
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-semibold text-[#6B4A2E]">Email + password</div>

        <label className="mt-3 block text-xs font-semibold text-[#6B4A2E]">Email</label>
        <input
          className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          autoComplete="email"
        />

        <label className="mt-3 block text-xs font-semibold text-[#6B4A2E]">Password</label>
        <input
          className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          type="password"
          autoComplete="current-password"
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
        onClick={signInGoogle}
        disabled={busy || isWebContainer}
        className="w-full rounded-md bg-[#1C6F66] px-4 py-3 text-white disabled:opacity-60"
      >
        {isWebContainer ? "Google sign-in (deploy to use)" : busy ? "Opening Google…" : "Continue with Google"}
      </button>
    </div>
  );
}
