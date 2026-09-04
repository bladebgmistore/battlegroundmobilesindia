import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Tiny file-backed demo store.
 *
 * Used ONLY when there is no DATABASE_URL (e.g. the local preview) so that
 * customer accounts, sessions and password-reset OTPs survive a dev-server
 * restart. In production (DATABASE_URL set) the Postgres database is always
 * used and this store is never consulted for real data.
 *
 * The file lives in the OS temp dir so it is never committed to git.
 */

type Collection = "users" | "otp" | "sessions";
type StoreFile = Record<Collection, Record<string, unknown>>;

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
    const parsed = JSON.parse(raw) as Partial<StoreFile>;
    cache = {
      users: parsed.users ?? {},
      otp: parsed.otp ?? {},
      sessions: parsed.sessions ?? {},
    };
  } catch {
    cache = { users: {}, otp: {}, sessions: {} };
  }
  return cache;
}

function persist(): void {
  try {
    writeFileSync(getPath(), JSON.stringify(cache ?? { users: {}, otp: {}, sessions: {} }));
  } catch {
    // Directory not writable or busy — the in-memory copy still works for the current process.
  }
}

export function demoGet<T>(collection: Collection, key: string): T | undefined {
  const store = load();
  return (store[collection] as Record<string, T>)[key];
}

export function demoSet(collection: Collection, key: string, value: unknown): void {
  const store = load();
  (store[collection] as Record<string, unknown>)[key] = value;
  persist();
}

export function demoDelete(collection: Collection, key: string): void {
  const store = load();
  delete (store[collection] as Record<string, unknown>)[key];
  persist();
}

export function demoValues<T>(collection: Collection): T[] {
  const store = load();
  return Object.values(store[collection] as Record<string, T>);
}

export function demoClear(collection?: Collection): void {
  const store = load();
  if (collection) {
    store[collection] = {};
  } else {
    store.users = {};
    store.otp = {};
    store.sessions = {};
  }
  persist();
}

export function hasDemoStoreFile(): boolean {
  return existsSync(getPath());
}
