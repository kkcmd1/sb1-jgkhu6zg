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

  async function signInGoogle() {
    setBusy(true);
    setErr("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
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

      <button
        onClick={signInGoogle}
        disabled={busy}
        className="w-full rounded-md bg-[#1C6F66] px-4 py-3 text-white disabled:opacity-60"
      >
        {busy ? "Opening Google…" : "Continue with Google"}
      </button>
    </div>
  );
}
