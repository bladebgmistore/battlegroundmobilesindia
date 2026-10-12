/**
 * Validate a post-authentication destination. Only same-site relative paths are
 * accepted; absolute URLs, protocol-relative URLs and backslash variants fall
 * back to the dashboard so auth can never be used as an open redirect.
 */
export function safeAuthRedirect(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const base = new URL("https://store.invalid");
    const target = new URL(value, base);
    if (target.origin !== base.origin) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
