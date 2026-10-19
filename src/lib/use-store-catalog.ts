"use client";

import { useCallback, useEffect, useState } from "react";
import type { Category, Product, StorePage, UcPackageItem } from "@/lib/store-data";

/**
 * Shared public-catalog client.
 *
 * The header, footer, homepage, category pages, accounts page, UC page and
 * checkout all need the same `/api/store` payload. Before this hook each one
 * fired its own request and interpreted the result differently — a failed
 * request in the header could hide the navigation while the page body still
 * showed products. One module-level cache + one in-flight promise keeps every
 * component on the same snapshot and keeps the request count to one.
 */
export type PublicCatalog = {
  categories: Category[];
  products: Product[];
  ucPackages: UcPackageItem[];
  pages: StorePage[];
  settings: Record<string, string>;
  databaseOnline: boolean;
  degraded?: boolean;
  warnings?: string[];
  demoCatalog?: boolean;
};

const EMPTY_SETTINGS: Record<string, string> = { whatsapp_enabled: "false" };

/** Short TTL: admin publishes must appear almost immediately. */
const CACHE_TTL_MS = 4_000;

let cache: { data: PublicCatalog; at: number } | null = null;
let inflight: Promise<PublicCatalog | null> | null = null;

export function invalidateStoreCatalog(): void {
  cache = null;
  inflight = null;
}

function normalize(payload: Record<string, unknown> | null): PublicCatalog | null {
  if (!payload || typeof payload !== "object") return null;
  return {
    categories: Array.isArray(payload.categories) ? (payload.categories as Category[]) : [],
    products: Array.isArray(payload.products) ? (payload.products as Product[]) : [],
    ucPackages: Array.isArray(payload.ucPackages) ? (payload.ucPackages as UcPackageItem[]) : [],
    pages: Array.isArray(payload.pages) ? (payload.pages as StorePage[]) : [],
    settings:
      payload.settings && typeof payload.settings === "object"
        ? (payload.settings as Record<string, string>)
        : EMPTY_SETTINGS,
    databaseOnline: payload.databaseOnline !== false,
    degraded: payload.degraded === true,
    warnings: Array.isArray(payload.warnings) ? (payload.warnings as string[]) : [],
    demoCatalog: payload.demoCatalog === true,
  };
}

export async function fetchStoreCatalog(force = false): Promise<PublicCatalog | null> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  if (!force && inflight) return inflight;

  const request = fetch(`/api/store?t=${Date.now()}`, { cache: "no-store" })
    .then(async (response) => {
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      // The API only returns a non-2xx status when *every* catalog section
      // failed, so there is no usable payload to cache — surface the error
      // state instead of rendering an empty store as if the admin deleted it.
      if (!response.ok) return null;
      const data = normalize(payload);
      if (data) cache = { data, at: Date.now() };
      return data;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });

  inflight = request;
  return request;
}

export function useStoreCatalog() {
  const [data, setData] = useState<PublicCatalog | null>(cache?.data ?? null);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState(false);

  const load = useCallback(async (force = false) => {
    if (force) setLoading(true);
    const next = await fetchStoreCatalog(force);
    // Keep the last good snapshot when a refresh fails: a transient API error
    // must not blank a catalog that was rendering a second earlier. The error
    // flag still lets each page show a retry affordance.
    if (next) setData(next);
    setError(next === null);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    let alive = true;
    fetchStoreCatalog()
      .then((next) => {
        if (!alive) return;
        if (next) setData(next);
        setError(next === null);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return {
    data,
    categories: data?.categories ?? [],
    products: data?.products ?? [],
    ucPackages: data?.ucPackages ?? [],
    pages: data?.pages ?? [],
    settings: data?.settings ?? EMPTY_SETTINGS,
    databaseOnline: data?.databaseOnline ?? false,
    degraded: data?.degraded ?? false,
    loading,
    error,
    refresh: () => load(true),
  };
}
