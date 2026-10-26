import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeMenu } from "@/components/ThemeMenu";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/next";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in — Junto" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);

  // Already signed in — nothing to do here.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next);

  return (
    <main className="mx-auto w-full max-w-md px-6 pt-8 pb-14">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[15px] text-muted active:opacity-60"
        >
          ← Back
        </Link>
        <ThemeMenu />
      </div>
      <h1 className="mt-4 text-[32px] font-semibold leading-tight tracking-tight">
        Sign in
      </h1>
      <p className="mt-1 text-[15px] leading-relaxed text-muted">
        Keep all your events in one place. No password — we&rsquo;ll email you a
        code. New here? This creates your account.
      </p>
      <SignInForm next={next} />
    </main>
  );
}
