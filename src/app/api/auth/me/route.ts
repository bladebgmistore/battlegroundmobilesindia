import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/user-store";

export const dynamic = "force-dynamic";

/** Current Google-authenticated customer (used by the header and checkout). */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ authenticated: false, user: null });

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      whatsapp: user.whatsapp,
      picture: user.avatarUrl,
      role: user.role,
      isOwner: user.role === "owner",
    },
  });
}
