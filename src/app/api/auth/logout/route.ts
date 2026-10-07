import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** JSON sign-out — now delegates to Clerk. */
export async function POST(_request: NextRequest) {
  return NextResponse.json({ ok: true, redirect: "/sign-in" });
}

export async function GET(_request: NextRequest) {
  return NextResponse.json({ ok: true, redirect: "/sign-in" });
}
