import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseService } from "@/lib/supabase/service";
import { signOut } from "./actions";

export const revalidate = 0;

export default async function MePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/recover");

  // Best-effort claim of any pre-account events.
  try {
    await supabase.rpc("claim_events_by_email");
  } catch {
    // ignore
  }

  // Service client to fetch events tied to this user OR creator_email.
  const supa = supabaseService();
  const { data: events } = await supa
    .from("events")
    .select("id, name, slug, event_at, edit_token, banner_path")
    .or(`creator_user_id.eq.${user.id},creator_email.eq.${user.email}`)
    .order("event_at", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (events ?? []) as any[];

  return (
    <main className="mx-auto w-full max-w-md px-6 pt-8 pb-14">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
            Signed in
          </div>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">
            Your events
          </h1>
          <p className="mt-1 text-[14px] text-muted">{user.email}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="text-[13px] text-muted hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {list.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border p-6 text-center">
            <p className="text-muted">
              No events yet. Create your first one.
            </p>
          </div>
        ) : (
          list.map((e) => (
            <Link
              key={e.id}
              href={`/manage/${e.edit_token}`}
              className="rounded-2xl bg-card border border-border p-4 flex items-center justify-between gap-3 active:scale-[0.99] transition"
            >
              <div className="min-w-0">
                <div className="text-[13px] text-muted">
                  {format(new Date(e.event_at), "EEE, MMM d · h:mm a")}
                </div>
                <div className="text-[17px] font-semibold truncate">
                  {e.name}
                </div>
              </div>
              <span className="text-muted">›</span>
            </Link>
          ))
        )}
        <Link
          href="/create"
          className="mt-2 h-12 flex items-center justify-center rounded-2xl bg-accent text-accent-fg text-[15px] font-semibold active:scale-[0.98] transition"
        >
          + New event
        </Link>
      </div>
    </main>
  );
}
