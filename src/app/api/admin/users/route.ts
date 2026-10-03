import { NextResponse, type NextRequest } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { listUsers } from "@/lib/google-users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Owner-only: every Google account that has signed in. */
export async function GET(request: NextRequest) {
  const guard = await requireOwnerApi(request);
  if (guard.error) return guard.error;

  const users = await listUsers(300);
  return NextResponse.json({ ok: true, users }, { headers: { "Cache-Control": "no-store" } });
}
