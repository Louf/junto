import Link from "next/link";
import { HeaderActions } from "@/components/HeaderActions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreateForm } from "./CreateForm";

export default async function CreatePage() {
  // Signed in: the event goes straight into the account, no email step.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 pt-8 pb-14">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[15px] text-muted active:opacity-60"
        >
          ← Back
        </Link>
        <HeaderActions />
      </div>
      <h1 className="mt-4 text-[32px] font-semibold leading-tight tracking-[-0.015em]">
        New event
      </h1>
      <p className="mt-1 text-[15px] text-muted">
        {user
          ? "Takes about a minute."
          : "Takes about a minute. No account needed."}
      </p>
      <div className="mt-8">
        <CreateForm signedInEmail={user?.email ?? null} />
      </div>
    </main>
  );
}
