import { NextResponse, type NextRequest } from "next/server";
import { requireScopeApi } from "@/lib/auth";
import { listUsers } from "@/lib/google-users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Staff-only: every Google account that has signed in. */
export async function GET(request: NextRequest) {
  const guard = await requireScopeApi(request, "users");
  if (guard.error) return guard.error;

  const users = await listUsers(300);
  return NextResponse.json({ ok: true, users }, { headers: { "Cache-Control": "no-store" } });
}
