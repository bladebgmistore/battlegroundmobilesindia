import { redirect } from "next/navigation";
import AuthView from "@/components/auth-view";
import { getSession } from "@/lib/auth";
import { safeAuthRedirect } from "@/lib/auth-redirect";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create Account | Battleground Mobile India Store",
  description: "Create your BGMI Store player account securely with Google Sign-In.",
  robots: { index: false, follow: false },
};

type SignupSearchParams = {
  next?: string;
  redirect?: string;
  returnTo?: string;
  callbackUrl?: string;
  error?: string;
  signedout?: string;
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<SignupSearchParams> }) {
  const params = await searchParams;
  const session = await getSession();
  const target = safeAuthRedirect(params.next ?? params.redirect ?? params.returnTo ?? params.callbackUrl);

  if (session) redirect(target);

  return (
    <AuthView
      mode="signup"
      next={target}
      error={params.error}
      signedOut={params.signedout === "1"}
    />
  );
}
