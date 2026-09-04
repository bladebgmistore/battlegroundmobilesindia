import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Tiny file-backed demo store.
 *
 * Used ONLY when there is no DATABASE_URL (e.g. the local preview) so that
 * customer accounts, sessions, password-reset OTPs and orders survive a
 * dev-server restart. In production (DATABASE_URL set) the Postgres database
 * is always used and this store is never consulted for real data.
 *
 * The file lives in the OS temp dir so it is never committed to git.
 */

type StoreFile = Record<string, Record<string, unknown>>;

let cache: StoreFile | null = null;
let filePath: string | null = null;

function getPath(): string {
  if (!filePath) {
    filePath = process.env.DEMO_STORE_FILE ?? join(tmpdir(), "bgmi-demo-store.json");
  }
  return filePath;
}

function load(): StoreFile {
  if (cache) return cache;
  try {
    const raw = readFileSync(getPath(), "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    cache = parsed;
  } catch {
    cache = {};
  }
  return cache;
}

function persist(): void {
  try {
    writeFileSync(getPath(), JSON.stringify(cache ?? {}));
  } catch {
    // Directory not writable or busy — the in-memory copy still works for the current process.
  }
}

export function demoGet<T>(collection: string, key: string): T | undefined {
  const store = load();
  return store[collection]?.[key] as T | undefined;
}

export function demoSet(collection: string, key: string, value: unknown): void {
  const store = load();
  if (!store[collection]) store[collection] = {};
  store[collection][key] = value;
  persist();
}

export function demoDelete(collection: string, key: string): void {
  const store = load();
  if (store[collection]) {
    delete store[collection][key];
    persist();
  }
}

export function demoValues<T>(collection: string): T[] {
  const store = load();
  const col = store[collection];
  return col ? Object.values(col) as T[] : [];
}

export function demoClear(collection?: string): void {
  const store = load();
  if (collection) {
    delete store[collection];
  } else {
    cache = {};
    persist();
  }
}

export function hasDemoStoreFile(): boolean {
  return existsSync(getPath());
}
