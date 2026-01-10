"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const [msg, setMsg] = useState("Finishing sign-in…");

  useEffect(() => {
    (async () => {
      const err = sp.get("error_description") || sp.get("error");
      const code = sp.get("code");

      if (err) {
        setMsg(`Sign-in failed: ${err}`);
        return;
      }

      if (!code) {
        setMsg("Missing code from Google.");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setMsg(`Session error: ${error.message}`);
        return;
      }

      setMsg("Signed in. Returning…");

      setTimeout(() => {
        try {
          window.close();
        } catch {}
        router.replace("/chapters");
      }, 250);
    })();
  }, [sp, router]);

  return (
    <div className="rounded-xl border bg-white p-4 text-sm text-gray-700">
      {msg}
    </div>
  );
}
