import { db } from "@/db";
import { customerMessages } from "@/db/schema";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim().slice(0, 100);
    const whatsapp = String(body.whatsapp ?? "").trim().slice(0, 24);
    const message = String(body.message ?? "").trim().slice(0, 2000);
    if (!name || !whatsapp || !message) {
      return Response.json({ error: "Please complete all fields." }, { status: 400 });
    }
    try {
      await db.insert(customerMessages).values({ name, whatsapp, message });
    } catch {
      // Still acknowledge the message even if DB is offline.
      return Response.json({ ok: true, saved: false }, { status: 201 });
    }
    return Response.json({ ok: true, saved: true }, { status: 201 });
  } catch {
    return Response.json({ error: "Message could not be sent. Please use WhatsApp." }, { status: 500 });
  }
}
