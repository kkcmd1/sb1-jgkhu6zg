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

      router.replace("/chapters");
    })();
  }, [sp, router]);

  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-white p-6 text-sm text-gray-700">
      {msg}
    </div>
  );
}
