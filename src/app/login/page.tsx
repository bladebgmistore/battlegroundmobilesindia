import { redirect } from "next/navigation";
import AuthView from "@/components/auth-view";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Player Sign In | Battleground Mobile India Store",
  description: "Sign in to your BGMI Store player account with Google or your mobile number OTP.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; signedout?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();

  // Already signed in — proceed to next destination or dashboard
  if (session) {
    const target = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/dashboard";
    redirect(target);
  }

  return (
    <AuthView
      mode="login"
      next={params.next?.startsWith("/") ? params.next : "/dashboard"}
      error={params.error}
      signedOut={params.signedout === "1"}
    />
  );
}
