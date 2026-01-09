import { supabase } from "@/lib/supabase/client";

export async function createProfileIfMissing() {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) return { ok: false, error: userErr.message };
  const user = userRes.user;
  if (!user) return { ok: false, error: "No signed-in user." };

  const { data: existing, error: selectErr } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (selectErr) return { ok: false, error: selectErr.message };
  if (existing?.id) return { ok: true, created: false };

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    "";

  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ||
    (user.user_metadata?.picture as string | undefined) ||
    "";

  const { error: insertErr } = await supabase.from("user_profiles").insert({
    id: user.id,
    email: user.email ?? "",
    full_name: fullName,
    avatar_url: avatarUrl,
    onboarding_completed: false,
  });

  if (insertErr) return { ok: false, error: insertErr.message };
  return { ok: true, created: true };
}
