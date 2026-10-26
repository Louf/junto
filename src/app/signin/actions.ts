"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/env";
import { callerKey, hit, retryMessage } from "@/lib/rateLimit";
import { safeNext } from "@/lib/next";

const emailSchema = z.string().email();
/** Supabase's code length is a project setting (6 by default, up to 10). */
const codeSchema = z.string().regex(/^\d{6,10}$/);

export type SendState =
  | { ok: true; email: string }
  | { ok: false; error: string }
  | null;

/**
 * Emails a sign-in code, plus a link for anyone who'd rather tap. New emails
 * get an account on the spot — there's no separate sign-up.
 */
export async function sendSignInCode(
  _prev: SendState,
  formData: FormData,
): Promise<SendState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!emailSchema.safeParse(email).success) {
    return { ok: false, error: "That email doesn't look right" };
  }

  const limited = await hit(await callerKey("signin"), 5, 600);
  if (!limited.ok) {
    return {
      ok: false,
      error: `Too many codes requested. ${retryMessage(limited.retryAfterSeconds)}`,
    };
  }

  const next = safeNext(String(formData.get("next") ?? ""));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, email };
}

export type VerifyState = { ok: false; error: string } | null;

/**
 * Checks the typed code and signs in on this device. Unlike the emailed link,
 * this works whichever app the email was opened in — the link often opens in
 * a mail app's own browser and signs that in instead.
 */
export async function verifySignInCode(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("code") ?? "").replace(/\s+/g, "");
  if (!emailSchema.safeParse(email).success) {
    return { ok: false, error: "That email doesn't look right" };
  }
  if (!codeSchema.safeParse(token).success) {
    return { ok: false, error: "Enter the code from the email" };
  }

  // Guessing codes is the thing to stop here.
  const limited = await hit(await callerKey("signin-verify"), 10, 600);
  if (!limited.ok) {
    return {
      ok: false,
      error: `Too many attempts. ${retryMessage(limited.retryAfterSeconds)}`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    return { ok: false, error: "That code didn't work. Check it, or send a new one." };
  }

  // Attach events created with this email before the account existed.
  try {
    await supabase.rpc("claim_events_by_email");
  } catch {
    // best-effort
  }

  redirect(safeNext(String(formData.get("next") ?? "")));
}
