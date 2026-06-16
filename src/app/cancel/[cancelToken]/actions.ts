"use server";

import { revalidatePath } from "next/cache";
import { supabaseService } from "@/lib/supabase/service";

export async function releaseSlot(token: string) {
  const supa = supabaseService();
  const { data: signup } = await supa
    .from("signups")
    .select("id, job:jobs(event:events(slug))")
    .eq("cancel_token", token)
    .maybeSingle();
  if (!signup) return { ok: false, error: "Already cancelled" } as const;
  const { error } = await supa
    .from("signups")
    .delete()
    .eq("cancel_token", token);
  if (error) return { ok: false, error: error.message } as const;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slug = (signup as any).job?.event?.slug;
  if (slug) revalidatePath(`/e/${slug}`);
  return { ok: true } as const;
}
