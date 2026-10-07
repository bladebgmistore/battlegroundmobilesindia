import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign In | Battleground Mobile India Store",
  robots: { index: false, follow: false },
};

/**
 * Legacy /login route — now redirects to Clerk's /sign-in.
 * Keeps old bookmarks and OAuth callbacks working.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; signedout?: string; redirect_url?: string }>;
}) {
  const params = await searchParams;
  const next = params.next || params.redirect_url || "/dashboard";
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  redirect(`/sign-in?redirect_url=${encodeURIComponent(target)}`);
}
