import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-md px-6 pt-20 pb-12 text-center">
      <h1 className="text-[26px] font-semibold tracking-tight">
        Couldn&rsquo;t sign you in
      </h1>
      <p className="mt-2 text-muted text-[15px]">
        {reason
          ? `Reason: ${decodeURIComponent(reason)}`
          : "The magic link may have expired or already been used."}
      </p>
      <Link
        href="/signin"
        className="mt-8 inline-flex h-12 items-center rounded-2xl bg-accent text-accent-fg px-6 text-[15px] font-semibold"
      >
        Try again
      </Link>
    </main>
  );
}
