import { NextResponse, type NextRequest } from "next/server";
import { requireAdminScope } from "@/lib/admin-auth";
import { createProof, deleteProof, listAllProofs, parseProofInput, updateProof } from "@/lib/proofs";
import { isUuid } from "@/lib/referrals";
import { isUniqueViolation } from "@/lib/sql-rows";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Staff (owner / admin / manager): every proof, including hidden ones. */
export async function GET(request: NextRequest) {
  if (!(await requireAdminScope(request, "proofs"))) return json({ error: "Unauthorized" }, 401);
  const proofs = await listAllProofs();
  if (!proofs) return json({ error: "Database offline." }, 503);
  return json({ ok: true, proofs });
}

/** Publish a new customer proof — visible on /proofs immediately. */
export async function POST(request: NextRequest) {
  if (!(await requireAdminScope(request, "proofs"))) return json({ error: "Unauthorized" }, 401);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseProofInput(body, false);
  if (parsed.error || !parsed.value) return json({ error: parsed.error ?? "Invalid proof." }, 400);

  try {
    const proof = await createProof(parsed.value);
    if (!proof) return json({ error: "Database offline." }, 503);
    return json({ ok: true, proof }, 201);
  } catch (error) {
    // Order id already taken — a plain-language message beats a generic 500.
    if (isUniqueViolation(error)) {
      return json({ error: `Order ID ${String(parsed.value?.orderCode ?? "")} is already used by another proof.` }, 409);
    }
    console.error("Create proof failed:", error);
    return json({ error: "Could not save this proof." }, 500);
  }
}

/** Edit a proof (only the supplied fields change). */
export async function PATCH(request: NextRequest) {
  if (!(await requireAdminScope(request, "proofs"))) return json({ error: "Unauthorized" }, 401);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id ?? "");
  if (!isUuid(id)) return json({ error: "Missing proof id." }, 400);

  const parsed = parseProofInput(body, true);
  if (parsed.error || !parsed.value) return json({ error: parsed.error ?? "Invalid proof." }, 400);

  try {
    const proof = await updateProof(id, parsed.value);
    if (proof === "not_found") return json({ error: "Proof not found." }, 404);
    if (!proof) return json({ error: "Database offline." }, 503);
    return json({ ok: true, proof });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return json({ error: `Order ID ${String(parsed.value.orderCode ?? "")} is already used by another proof.` }, 409);
    }
    console.error("Update proof failed:", error);
    return json({ error: "Could not update this proof." }, 500);
  }
}

/** Remove a proof permanently. */
export async function DELETE(request: NextRequest) {
  if (!(await requireAdminScope(request, "proofs"))) return json({ error: "Unauthorized" }, 401);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id ?? "");
  if (!isUuid(id)) return json({ error: "Missing proof id." }, 400);

  try {
    const removed = await deleteProof(id);
    if (removed === null) return json({ error: "Database offline." }, 503);
    if (!removed) return json({ error: "Proof not found." }, 404);
    return json({ ok: true });
  } catch (error) {
    console.error("Delete proof failed:", error);
    return json({ error: "Could not delete this proof." }, 500);
  }
}
