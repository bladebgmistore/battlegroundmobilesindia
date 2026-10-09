import { listPublicProofs } from "@/lib/proofs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public Customer Proofs feed for /proofs.
 * Returns only ACTIVE proofs (hidden ones stay admin-only) — newest
 * deliveries first. Never cached, so an admin publish is visible instantly.
 */
export async function GET() {
  try {
    const proofs = await listPublicProofs();
    if (!proofs) {
      return Response.json({ ok: false, error: "Database is offline, please try again later.", proofs: [] }, { status: 503 });
    }
    return Response.json({ ok: true, proofs, databaseOnline: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Public proofs feed failed:", error);
    return Response.json({ ok: false, error: "Could not load proofs right now.", proofs: [] }, { status: 500 });
  }
}
