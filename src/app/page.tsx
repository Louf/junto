import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 0;

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pt-16 pb-10">
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted">
          Junto
        </div>
        <h1 className="mt-3 text-[44px] leading-[1.04] font-semibold tracking-tight">
          Sign up.
          <br />
          Show up.
        </h1>
        <p className="mt-5 text-[17px] leading-[1.45] text-muted">
          Set up an event, define the jobs, share one link. Junto handles the
          slots, the signups, and the reminders — without the bloat.
        </p>

        <div className="mt-10 flex flex-col gap-3">
          <Link
            href="/create"
            className="flex h-14 items-center justify-center rounded-2xl bg-accent text-accent-fg text-[17px] font-semibold transition active:scale-[0.98]"
          >
            Create an event
          </Link>
          <Link
            href={user ? "/me" : "/recover"}
            className="flex h-12 items-center justify-center rounded-2xl border border-border text-[15px] text-foreground/80 transition active:scale-[0.98]"
          >
            {user ? "Your events" : "Sign in"}
          </Link>
        </div>
      </div>

      <footer className="pt-12 text-center text-[13px] text-muted">
        Free during beta · No account required to create
      </footer>
    </main>
  );
}
