import Link from "next/link";
import { CreateForm } from "./CreateForm";

export default function CreatePage() {
  return (
    <main className="mx-auto w-full max-w-md px-6 pt-8 pb-14">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-[15px] text-muted active:opacity-60"
      >
        ← Back
      </Link>
      <h1 className="mt-4 text-[32px] font-semibold leading-tight tracking-tight">
        New event
      </h1>
      <p className="mt-1 text-[15px] text-muted">
        Takes about a minute. No account needed.
      </p>
      <div className="mt-8">
        <CreateForm />
      </div>
    </main>
  );
}
