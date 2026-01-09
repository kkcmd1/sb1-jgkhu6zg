"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [msg, setMsg] = useState("Finishing sign-in…");

  useEffect(() => {
    const code = params.get("code");
    const errorDesc = params.get("error_description");
    const error = params.get("error");

    if (error || errorDesc) {
      setMsg(`Sign-in error: ${errorDesc || error || "Unknown error"}`);
      return;
    }

    if (!code) {
      setMsg("Missing sign-in code.");
      return;
    }

    (async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setMsg(`Session error: ${error.message}`);
        return;
      }
      router.replace("/chapters");
    })();
  }, [params, router]);

  return <div className="p-4 text-sm">{msg}</div>;
}
