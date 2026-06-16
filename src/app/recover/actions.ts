"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/env";

const schema = z.object({ email: z.string().email() });

export async function sendMagicLink(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
  });
  if (!parsed.success) {
    return { ok: false, error: "That email doesn't look right" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback?next=/me`,
      shouldCreateUser: true,
    },
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
