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
    let alive = true;

    (async () => {
      // If Google sent us back here with an auth code, finish the PKCE exchange.
      const sp = new URLSearchParams(window.location.search);
      const oauthErr = sp.get("error_description") || sp.get("error");
      const code = sp.get("code");

      if (!alive) return;

      if (oauthErr) {
        setErr(`Sign-in failed: ${oauthErr}`);
        setBusy(false);
        return;
      }

      if (code) {
        setBusy(true);
        setErr("");

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!alive) return;

        if (error) {
          setErr(`Session error: ${error.message}`);
          setBusy(false);
          return;
        }

        router.replace("/chapters");
        router.refresh();
        return;
      }

      // Normal load: already signed in?
      const { data } = await supabase.auth.getSession();
      if (!alive) return;

      if (data.session) {
        router.replace("/chapters");
        router.refresh();
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function signInPassword() {
    setBusy(true);
    setErr("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    router.replace("/chapters");
    router.refresh();
  }

  async function signUpPassword() {
    setBusy(true);
    setErr("");

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    // If email confirmation is off, you'll get a session right away.
    if (data.session) {
      router.replace("/chapters");
      router.refresh();
      return;
    }

    setErr("Check your email for a confirmation link, then sign in.");
    setBusy(false);
  }

  async function signInGoogleSameTab() {
    setBusy(true);
    setErr("");

    // Return to /auth so this same page can exchange the code.
    const redirectTo = `${window.location.origin}/auth`;

    // Get provider URL without auto-redirect, then navigate in this tab.
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
      setErr("No OAuth URL returned.");
      setBusy(false);
      return;
    }

    window.location.assign(url);
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-white/90 p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-[#6B4A2E]">Sign in</h1>

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
          autoComplete="email"
          inputMode="email"
        />

        <label className="mt-3 block text-xs font-semibold text-[#6B4A2E]">Password</label>
        <input
          className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="••••••••"
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
        onClick={signInGoogleSameTab}
        disabled={busy}
        className="mt-4 w-full rounded-md bg-[#1C6F66] px-4 py-3 text-white disabled:opacity-60"
      >
        {busy ? "Opening Google…" : "Continue with Google"}
      </button>
    </div>
  );
}
