"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/service";
import { newToken } from "@/lib/ids";
import { sendSignupConfirmation } from "@/lib/email";
import { appUrl } from "@/lib/env";

const schema = z.object({
  job_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  email: z.string().email(),
  note: z.string().max(500).optional().nullable(),
});

export type SignupState =
  | { ok: true }
  | { ok: false; error: string };

export async function claimSlot(
  _prev: SignupState | null,
  formData: FormData,
): Promise<SignupState> {
  const raw = {
    job_id: String(formData.get("job_id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    note: String(formData.get("note") ?? "").trim() || null,
  };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supa = supabaseService();

  // Capacity check + event lookup.
  const { data: job, error: jobErr } = await supa
    .from("jobs")
    .select("*, event:events(slug, name), signups:signups(id)")
    .eq("id", parsed.data.job_id)
    .maybeSingle();
  if (jobErr || !job) return { ok: false, error: "Job not found" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j = job as any;
  if ((j.signups?.length ?? 0) >= j.capacity) {
    return { ok: false, error: "This job is already full" };
  }

  const cancel_token = newToken();
  const { error: insErr } = await supa.from("signups").insert({
    job_id: parsed.data.job_id,
    name: parsed.data.name,
    email: parsed.data.email,
    note: parsed.data.note,
    cancel_token,
  });
  if (insErr) {
    if (insErr.code === "23505") {
      return { ok: false, error: "You've already signed up for this job" };
    }
    return { ok: false, error: insErr.message };
  }

  const slug = j.event.slug;
  const shareUrl = `${appUrl()}/e/${slug}`;
  const cancelUrl = `${appUrl()}/cancel/${cancel_token}`;

  sendSignupConfirmation({
    to: parsed.data.email,
    participantName: parsed.data.name,
    eventName: j.event.name,
    jobTitle: j.title,
    shareUrl,
    cancelUrl,
  }).catch((e) => console.error("signup email failed", e));

  revalidatePath(`/e/${slug}`);
  return { ok: true };
}

// =====================
// Fund contributions
// =====================

const pledgeSchema = z.object({
  fund_id: z.string().uuid(),
  name: z.string().min(1, "Add your name").max(120),
  // Optional, but the only way to reach this person if the event is called
  // off after they've sent money.
  email: z.string().email("That email doesn't look right").nullable(),
  amount_cents: z
    .number()
    .int()
    .min(1, "Add the amount you sent")
    .max(100_000_00),
});

export type PledgeState = { ok: true } | { ok: false; error: string };

/**
 * Records that someone says they sent money. Junto has no way to verify this —
 * the organizer confirms it from the manage page once it lands.
 */
export async function pledgeContribution(
  _prev: PledgeState | null,
  formData: FormData,
): Promise<PledgeState> {
  const parsed = pledgeSchema.safeParse({
    fund_id: String(formData.get("fund_id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase() || null,
    amount_cents: Number(formData.get("amount_cents") ?? 0),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supa = supabaseService();

  const { data: fund, error: fundErr } = await supa
    .from("funds")
    .select("id, event:events(slug)")
    .eq("id", parsed.data.fund_id)
    .maybeSingle();
  if (fundErr || !fund) return { ok: false, error: "Fund not found" };

  const { error: insErr } = await supa.from("contributions").insert({
    fund_id: parsed.data.fund_id,
    name: parsed.data.name,
    email: parsed.data.email,
    amount_cents: parsed.data.amount_cents,
  });
  if (insErr) return { ok: false, error: "Could not record that payment" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slug = (fund as any).event?.slug as string | undefined;
  if (slug) revalidatePath(`/e/${slug}`);

  return { ok: true };
}
