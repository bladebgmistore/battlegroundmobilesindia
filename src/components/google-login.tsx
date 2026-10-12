"use client";

import AuthView from "@/components/auth-view";

export default function GoogleLogin({
  next,
  error,
  signedOut,
}: {
  next: string;
  error?: string;
  signedOut?: boolean;
}) {
  return <AuthView mode="login" next={next} error={error} signedOut={signedOut} />;
}
