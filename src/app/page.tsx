import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import JuntoRotatingBadge from "@/components/JuntoRotatingBadge";

export const revalidate = 0;

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6 py-8 lg:px-8 lg:py-12">
      {/* side-by-side: logo left, content right */}
      <div className="flex flex-1 flex-col-reverse gap-10 lg:flex-row lg:items-center lg:gap-16 xl:gap-20">
        {/* LEFT — rotating badge */}
        <div className="flex shrink-0 justify-center lg:w-[42%] lg:justify-start">
          <div className="relative">
            {/* ambient glow behind badge */}
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-3xl lg:h-[520px] lg:w-[520px]"
              style={{
                background:
                  "radial-gradient(closest-side, var(--border) 0%, transparent 68%)",
              }}
              aria-hidden
            />
            {/* responsive sizes: 200 on mobile, 320 on desktop */}
            <div className="relative lg:hidden">
              <JuntoRotatingBadge size={204} duration={20} />
            </div>
            <div className="relative hidden lg:block">
              <JuntoRotatingBadge size={340} duration={22} />
            </div>
          </div>
        </div>

        {/* RIGHT — content */}
        <div className="flex w-full max-w-md flex-col lg:ml-auto">
          <div className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
            <span className="size-1.5 rounded-full bg-foreground/15" aria-hidden />
            Junto
          </div>

          <h1 className="mt-6 text-[44px] font-semibold leading-[0.96] tracking-[-0.03em] lg:text-[52px]">
            Sign up.
            <br />
            Show up.
          </h1>
          <p className="mt-4 max-w-[32ch] text-[17px] leading-[1.55] text-muted lg:text-[18px]">
            Set up an event, define the jobs, share one link. Junto handles the
            slots, the signups, and the reminders — without the bloat.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/create"
              className="flex h-[52px] items-center justify-center rounded-2xl bg-accent text-accent-fg text-[16px] font-semibold tracking-[-0.01em] transition active:scale-[0.99] lg:h-[54px] lg:text-[17px]"
            >
              Create an event
            </Link>
            <Link
              href={user ? "/me" : "/recover"}
              className="flex h-[46px] items-center justify-center rounded-2xl border border-border bg-card text-[14.5px] font-medium text-foreground/80 transition hover:bg-card/80 active:scale-[0.99]"
            >
              {user ? "Your events" : "Sign in"}
            </Link>
          </div>

          <p className="mt-6 hidden text-[11px] font-medium uppercase tracking-[0.16em] text-muted/45 lg:block">
            Junto • Junto • Junto
          </p>
        </div>
      </div>

      {/* mobile caption + footer */}
      <p className="mt-10 text-center text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted/45 lg:hidden">
        Junto • Junto • Junto
      </p>
      <footer className="mt-6 border-t border-border/50 pt-6 pb-2 text-center text-[12.5px] leading-none text-muted/70 lg:mt-8">
        Free during beta · No account required to create
      </footer>
    </main>
  );
}
