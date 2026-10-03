import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Public endpoint: who am I? Used by the header and client components. */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ authenticated: false, user: null });

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.id,
      name: session.name,
      email: session.email,
      picture: session.picture,
      role: session.role,
      isOwner: session.role === "owner",
    },
  });
}
