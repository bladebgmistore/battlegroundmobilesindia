import { NextResponse, type NextRequest } from "next/server";
import { requireAdminScope } from "@/lib/admin-auth";
import { createRewardItem, deleteRewardItem, listRewardItems, parseRewardInput, updateRewardItem } from "@/lib/rewards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Staff: every points store item, including inactive ones. */
export async function GET(request: NextRequest) {
  if (!(await requireAdminScope(request, "referrals"))) return json({ error: "Unauthorized" }, 401);
  const items = await listRewardItems({ activeOnly: false });
  if (!items) return json({ error: "Database offline." }, 503);
  return json({ ok: true, items });
}

/** Create a points store item. */
export async function POST(request: NextRequest) {
  if (!(await requireAdminScope(request, "referrals"))) return json({ error: "Unauthorized" }, 401);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseRewardInput(body, false);
  if (parsed.error || !parsed.value) return json({ error: parsed.error ?? "Invalid reward." }, 400);

  try {
    const item = await createRewardItem(parsed.value);
    if (!item) return json({ error: "Database offline." }, 503);
    return json({ ok: true, item }, 201);
  } catch (error) {
    console.error("Create reward failed:", error);
    return json({ error: "Could not save this reward." }, 500);
  }
}

/** Edit a points store item (only the supplied fields change). */
export async function PATCH(request: NextRequest) {
  if (!(await requireAdminScope(request, "referrals"))) return json({ error: "Unauthorized" }, 401);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id ?? "");
  if (!id) return json({ error: "Missing reward id." }, 400);

  const parsed = parseRewardInput(body, true);
  if (parsed.error || !parsed.value) return json({ error: parsed.error ?? "Invalid reward." }, 400);

  try {
    const item = await updateRewardItem(id, parsed.value);
    if (item === "not_found") return json({ error: "Reward not found." }, 404);
    if (!item) return json({ error: "Database offline." }, 503);
    return json({ ok: true, item });
  } catch (error) {
    console.error("Update reward failed:", error);
    return json({ error: "Could not update this reward." }, 500);
  }
}

/** Remove a points store item. Past redemptions keep their own snapshot of the reward. */
export async function DELETE(request: NextRequest) {
  if (!(await requireAdminScope(request, "referrals"))) return json({ error: "Unauthorized" }, 401);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id ?? "");
  if (!id) return json({ error: "Missing reward id." }, 400);

  try {
    const removed = await deleteRewardItem(id);
    if (removed === null) return json({ error: "Database offline." }, 503);
    if (!removed) return json({ error: "Reward not found." }, 404);
    return json({ ok: true });
  } catch (error) {
    console.error("Delete reward failed:", error);
    return json({ error: "Could not delete this reward." }, 500);
  }
}
