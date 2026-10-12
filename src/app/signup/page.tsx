import { redirect } from "next/navigation";
import AuthView from "@/components/auth-view";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create Account | Battleground Mobile India Store",
  description: "Register a new BGMI Store player account with Google or mobile OTP.",
  robots: { index: false, follow: false },
};

export default async function SignupPage({
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
      mode="signup"
      next={params.next?.startsWith("/") ? params.next : "/dashboard"}
      error={params.error}
      signedOut={params.signedout === "1"}
    />
  );
}
