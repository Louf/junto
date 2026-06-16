import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import { CancelView } from "./CancelView";

export const revalidate = 0;

export default async function CancelPage({
  params,
}: {
  params: Promise<{ cancelToken: string }>;
}) {
  const { cancelToken } = await params;
  const supa = supabaseService();
  const { data } = await supa
    .from("signups")
    .select("id, name, job:jobs(title, event:events(name, slug))")
    .eq("cancel_token", cancelToken)
    .maybeSingle();
  if (!data) notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;

  return (
    <main className="mx-auto w-full max-w-md px-6 pt-16 pb-12">
      <CancelView
        token={cancelToken}
        signupName={d.name}
        jobTitle={d.job?.title ?? "(deleted job)"}
        eventName={d.job?.event?.name ?? ""}
        eventSlug={d.job?.event?.slug ?? ""}
      />
    </main>
  );
}
