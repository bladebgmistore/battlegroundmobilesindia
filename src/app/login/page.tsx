import { redirect } from "next/navigation";
import GoogleLogin from "@/components/google-login";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign In | Battleground Mobile India Store",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; signedout?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();

  // Already signed in — go straight to the dashboard (or the requested page).
  if (session) {
    const target = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/dashboard";
    redirect(target);
  }

  return (
    <GoogleLogin
      next={params.next?.startsWith("/") ? params.next : "/dashboard"}
      error={params.error}
      signedOut={params.signedout === "1"}
    />
  );
}
