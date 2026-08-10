import Link from "next/link";
import { AccountLink } from "@/components/AccountLink";
import { JuntoMark } from "@/components/JuntoMark";
import { SampleEventCard } from "@/components/SampleEventCard";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6 py-8 lg:px-8 lg:py-12">
      <div className="flex flex-1 flex-col gap-12 lg:flex-row lg:items-center lg:gap-16 xl:gap-20">
        {/* LEFT — pitch */}
        <div className="flex w-full max-w-md flex-col">
          <div className="inline-flex items-center gap-3">
            <JuntoMark size={36} label={null} animate />
            <span className="text-[20px] font-semibold tracking-[-0.015em]">
              Junto
            </span>
          </div>

          <h1 className="mt-7 text-[44px] font-semibold leading-[0.98] tracking-[-0.015em] lg:text-[52px]">
            Sign up.
            <br />
            Show up.
          </h1>
          <p className="mt-4 max-w-[34ch] text-[17px] leading-[1.55] text-muted lg:text-[18px]">
            Set up an event, define the jobs, share one link. Junto handles the
            slots, the signups, and the reminders — without the bloat.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/create"
              className="flex h-[52px] items-center justify-center rounded-2xl bg-accent text-[16px] font-semibold tracking-[-0.01em] text-accent-fg transition active:scale-[0.99] lg:h-[54px] lg:text-[17px]"
            >
              Create an event
            </Link>
            <AccountLink />
          </div>

          <p className="mt-5 text-[13px] text-muted">
            No account needed to create · Free during beta
          </p>

          <p className="mt-8 max-w-[34ch] text-[13px] leading-[1.5] text-muted/70">
            Built for potlucks, team lunches, class parties, church rotas, and
            anything else that runs on people pitching in.
          </p>
        </div>

        {/* RIGHT — what it actually looks like */}
        <div className="w-full lg:ml-auto lg:max-w-[380px]">
          <SampleEventCard />
        </div>
      </div>

      <footer className="mt-12 border-t border-border/50 pt-6 pb-2 text-center text-[12.5px] leading-none text-muted/70 lg:mt-16">
        Junto — group signups without the bloat
      </footer>
    </main>
  );
}
