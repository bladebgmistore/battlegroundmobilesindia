/**
 * Checkout authentication guard.
 *
 * Verifies whether the current visitor is signed in before allowing them to
 * proceed to checkout. Unauthenticated visitors are smoothly routed to
 * `/login` with the return URL preserved so they land right back on checkout
 * after signing in.
 */

export async function checkUserLoggedIn(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return Boolean(data?.authenticated && data?.user);
  } catch {
    return false;
  }
}

export async function navigateToCheckout(
  router: { push: (url: string) => void },
  checkoutUrl: string,
): Promise<void> {
  const isLoggedIn = await checkUserLoggedIn();
  if (isLoggedIn) {
    router.push(checkoutUrl);
  } else {
    router.push(`/login?next=${encodeURIComponent(checkoutUrl)}`);
  }
}
