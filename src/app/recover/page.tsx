import { redirect } from "next/navigation";

/** The old "find my events" address, kept so existing links still land. */
export default function RecoverPage() {
  redirect("/signin");
}
