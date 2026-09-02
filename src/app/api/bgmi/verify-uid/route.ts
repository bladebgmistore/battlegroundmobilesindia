import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * BGMI UID → In-Game Name (IGN) verification.
 *
 * Providers (tried in order, each with a hard timeout + try/catch):
 *  1. BGMI_UID_API_URL env template, e.g. "https://your-api.com/lookup?uid={uid}"
 *     (response is scanned for a username-like field).
 *  2. Rooter public bazaar endpoint (no API key required) — the same lookup
 *     Rooter's own BGMI top-up storefront uses via UniPin.
 *
 * Successful lookups are cached in-memory for 10 minutes to keep the
 * checkout snappy and to avoid hammering upstream providers.
 */

type LookupResult = { verified: boolean; playerName?: string; error?: string };

type CacheEntry = { result: LookupResult; expires: number };
type G = typeof globalThis & {
  __bgmiUidCache?: Map<string, CacheEntry>;
  __bgmiRooterToken?: { token: string; expires: number };
};
const g = globalThis as G;
const cache = (g.__bgmiUidCache ??= new Map());

const UID_PATTERN = /^\d{8,12}$/;
const CACHE_TTL = 10 * 60 * 1000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractName(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const keys = ["username", "playerName", "player_name", "nickname", "nickName", "name", "ign"];
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 120);
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const nested = extractName(value);
      if (nested) return nested;
    }
  }
  return null;
}

async function lookupViaCustomApi(uid: string): Promise<string | null> {
  const template = process.env.BGMI_UID_API_URL;
  if (!template) return null;
  const response = await fetchWithTimeout(
    template.replace("{uid}", encodeURIComponent(uid)),
    {
      headers: {
        Accept: "application/json",
        ...(process.env.BGMI_UID_API_KEY ? { "X-Api-Key": process.env.BGMI_UID_API_KEY } : {}),
      },
    },
    6000,
  );
  if (!response?.ok) return null;
  try {
    return extractName(await response.json());
  } catch {
    return null;
  }
}

async function getRooterToken(): Promise<string | null> {
  if (g.__bgmiRooterToken && g.__bgmiRooterToken.expires > Date.now()) {
    return g.__bgmiRooterToken.token;
  }
  const response = await fetchWithTimeout(
    "https://www.rooter.gg/",
    { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Accept: "text/html" } },
    6000,
  );
  if (!response) return null;
  try {
    const cookies = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""];
    for (const cookie of cookies) {
      const match = cookie.match(/user_auth=([^;]+)/);
      if (!match) continue;
      const parsed = JSON.parse(decodeURIComponent(match[1])) as { accessToken?: string };
      if (parsed.accessToken) {
        g.__bgmiRooterToken = { token: parsed.accessToken, expires: Date.now() + 20 * 60 * 1000 };
        return parsed.accessToken;
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function lookupViaRooter(uid: string): Promise<LookupResult | null> {
  const token = await getRooterToken();
  if (!token) return null;
  const response = await fetchWithTimeout(
    `https://bazaar.rooter.io/order/getUnipinUsername?gameCode=BGMI_IN&id=${encodeURIComponent(uid)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Device-Type": "web",
        "App-Version": "1.0.0",
        "Device-Id": "bgmi-store-web",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        Accept: "application/json",
      },
    },
    8000,
  );
  if (!response) return null;
  try {
    const data = (await response.json()) as {
      transaction?: string;
      unipinRes?: { username?: string };
      message?: string;
    };
    if (data.transaction === "SUCCESS" && data.unipinRes?.username) {
      return { verified: true, playerName: data.unipinRes.username };
    }
    if (data.transaction && data.transaction !== "SUCCESS") {
      return { verified: false, error: "No BGMI player found for this UID. Please double-check your Character ID." };
    }
  } catch {
    return null;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const uid = (request.nextUrl.searchParams.get("uid") ?? "").trim();

    if (!UID_PATTERN.test(uid)) {
      return Response.json(
        { verified: false, error: "Enter a valid BGMI UID (8-12 digits)." },
        { status: 400 },
      );
    }

    const cached = cache.get(uid);
    if (cached && cached.expires > Date.now()) {
      return Response.json(cached.result, { headers: { "Cache-Control": "private, max-age=300" } });
    }

    let result: LookupResult | null = null;

    const customName = await lookupViaCustomApi(uid);
    if (customName) result = { verified: true, playerName: customName };

    if (!result) result = await lookupViaRooter(uid);

    if (!result) {
      // Upstream unavailable — accept the UID so checkout is never blocked.
      result = {
        verified: false,
        error: "Verification service is busy right now. Your UID format looks valid — you can continue.",
      };
      return Response.json(result, { status: 200 });
    }

    if (result.verified) cache.set(uid, { result, expires: Date.now() + CACHE_TTL });
    return Response.json(result, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return Response.json(
      { verified: false, error: "Could not verify UID right now. Please try again." },
      { status: 200 },
    );
  }
}
