import { NextResponse, type NextRequest } from "next/server";
import { requireOwnerApi, requireScopeApi } from "@/lib/auth";
import { deleteStaffMember, listStaff, updateStaffMember, upsertStaffMember } from "@/lib/staff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

/**
 * Team & Roles management.
 *
 * GET    — any staff role can view the team list (the admin panel shows it).
 * POST   — owner only: add a member (email + role), or re-role an existing one.
 * PATCH  — owner only: change role, suspend / reactivate, rename.
 * DELETE — owner only: remove access permanently.
 */
export async function GET(request: NextRequest) {
  const guard = await requireScopeApi(request, "users");
  if (guard.error) return guard.error;

  const staff = await listStaff();
  return NextResponse.json({ ok: true, staff }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  const guard = await requireOwnerApi(request);
  if (guard.error) return guard.error;

  try {
    const body = await request.json();
    const result = await upsertStaffMember({
      email: String(body.email ?? ""),
      role: String(body.role ?? ""),
      name: body.name ? String(body.name) : null,
      addedBy: guard.session.email,
    });
    if (result.error || !result.member) {
      return NextResponse.json({ ok: false, error: result.error ?? "Could not add member." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, member: result.member }, { status: 201, headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireOwnerApi(request);
  if (guard.error) return guard.error;

  try {
    const body = await request.json();
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ ok: false, error: "Missing member id." }, { status: 400 });

    const result = await updateStaffMember(id, {
      ...(body.role !== undefined ? { role: String(body.role) } : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
      ...(body.name !== undefined ? { name: body.name ? String(body.name) : null } : {}),
    });
    if (result.error || !result.member) {
      return NextResponse.json({ ok: false, error: result.error ?? "Could not update member." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, member: result.member }, { headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireOwnerApi(request);
  if (guard.error) return guard.error;

  try {
    const body = await request.json();
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ ok: false, error: "Missing member id." }, { status: 400 });

    const result = await deleteStaffMember(id);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
}
