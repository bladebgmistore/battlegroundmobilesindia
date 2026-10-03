import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy URL — the admin panel now lives at /admin. */
export default function Page() {
  redirect("/admin");
}
