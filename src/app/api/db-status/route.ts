import { getDatabaseStatus, getDatabaseEnvSummary, pingPrimary, pingSecondary } from "@/db";
import { getPrimaryPooledUrl, getPrimaryUnpooledUrl, getSecondaryPooledUrl, getSecondaryUnpooledUrl } from "@/db/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/db-status — diagnostic for multi-DB failover.
 * No secrets exposed (URLs are masked). Shows which DB is active and whether
 * secondary is configured correctly.
 */
export async function GET() {
  const envSummary = getDatabaseEnvSummary();
  const status = await getDatabaseStatus().catch(() => ({
    primary: { configured: false, reachable: false, urlPreview: null },
    secondary: { configured: false, reachable: false, urlPreview: null },
    active: "none" as const,
  }));

  // Extra detailed ping (separate pooled/unpooled)
  const primaryPooledReachable = await pingPrimary().catch(() => false);
  const secondaryReachable = await pingSecondary().catch(() => false);

  const primaryPooled = getPrimaryPooledUrl();
  const primaryUnpooled = getPrimaryUnpooledUrl();
  const secondaryPooled = getSecondaryPooledUrl();
  const secondaryUnpooled = getSecondaryUnpooledUrl();

  return Response.json(
    {
      ok: true,
      timestamp: new Date().toISOString(),
      env: {
        primary: {
          pooled: Boolean(primaryPooled),
          unpooled: Boolean(primaryUnpooled),
          pooledHost: primaryPooled ? maskHost(primaryPooled) : null,
          unpooledHost: primaryUnpooled ? maskHost(primaryUnpooled) : null,
        },
        secondary: {
          configured: Boolean(secondaryPooled || secondaryUnpooled),
          pooled: Boolean(secondaryPooled),
          unpooled: Boolean(secondaryUnpooled),
          pooledHost: secondaryPooled ? maskHost(secondaryPooled) : null,
          unpooledHost: secondaryUnpooled ? maskHost(secondaryUnpooled) : null,
        },
        // Raw check for Vercel debugging — which prefixed keys are actually present?
        vercelEnvCheck: {
          BGMISTORE_DATABASE_URL: Boolean(process.env.BGMISTORE_DATABASE_URL),
          BGMISTORE_DATABASE_URL_UNPOOLED: Boolean(process.env.BGMISTORE_DATABASE_URL_UNPOOLED),
          BGMISTORE_POSTGRES_URL: Boolean(process.env.BGMISTORE_POSTGRES_URL),
          BGMISTORE_POSTGRES_PRISMA_URL: Boolean(process.env.BGMISTORE_POSTGRES_PRISMA_URL),
          BGMISTORE_POSTGRES_URL_NON_POOLING: Boolean(process.env.BGMISTORE_POSTGRES_URL_NON_POOLING),
          DATABASE2_DATABASE_URL: Boolean(process.env.DATABASE2_DATABASE_URL),
          DATABASE2_DATABASE_URL_UNPOOLED: Boolean(process.env.DATABASE2_DATABASE_URL_UNPOOLED),
          DATABASE2_POSTGRES_URL: Boolean(process.env.DATABASE2_POSTGRES_URL),
          DATABASE2_POSTGRES_PRISMA_URL: Boolean(process.env.DATABASE2_POSTGRES_PRISMA_URL),
          DATABASE2_POSTGRES_URL_NON_POOLING: Boolean(process.env.DATABASE2_POSTGRES_URL_NON_POOLING),
          DATABASE_URL: Boolean(process.env.DATABASE_URL),
        },
      },
      connectivity: {
        primaryPooledReachable,
        secondaryReachable,
        active: status.active,
        primary: status.primary,
        secondary: status.secondary,
      },
      summary: envSummary,
      failover: {
        enabled: Boolean((primaryPooled || primaryUnpooled) && (secondaryPooled || secondaryUnpooled)),
        mode: (primaryPooled || primaryUnpooled) && (secondaryPooled || secondaryUnpooled)
          ? "primary (BGMISTORE_*) → secondary (DATABASE2_*) on connection/timeout/quota"
          : primaryPooled || primaryUnpooled
            ? "single DB — no failover (secondary not configured)"
            : "no DB configured",
      },
      hint: !secondaryPooled && !secondaryUnpooled
        ? "Secondary NOT configured — add DATABASE2_* vars in Vercel → Settings → Environment Variables → Redeploy. Then /api/db-status should show secondary.pooled=true and active=primary or secondary."
        : primaryPooledReachable
          ? "Primary is UP — app is serving from primary (BGMISTORE_*). If primary goes down, it will auto-switch to secondary."
          : secondaryReachable
            ? "Primary is DOWN but secondary is UP — app is serving from secondary (DATABASE2_*). Failover is working!"
            : "Both databases are unreachable — check connection strings and Neon project status.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function maskHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}
