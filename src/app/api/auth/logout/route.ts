import type { NextRequest } from "next/server";
import { clearUserSession } from "@/lib/user-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return clearUserSession(request);
}
