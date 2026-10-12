import { redirect } from "next/navigation";
import AuthView from "@/components/auth-view";
import { getSession } from "@/lib/auth";
import { safeAuthRedirect } from "@/lib/auth-redirect";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Player Sign In | Battleground Mobile India Store",
  description: "Sign in to your BGMI Store player account securely with Google.",
  robots: { index: false, follow: false },
};

type LoginSearchParams = {
  next?: string;
  redirect?: string;
  returnTo?: string;
  callbackUrl?: string;
  error?: string;
  signedout?: string;
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<LoginSearchParams> }) {
  const params = await searchParams;
  const session = await getSession();
  const target = safeAuthRedirect(params.next ?? params.redirect ?? params.returnTo ?? params.callbackUrl);

  if (session) redirect(target);

  return (
    <AuthView
      next={target}
      error={params.error}
      signedOut={params.signedout === "1"}
    />
  );
}
