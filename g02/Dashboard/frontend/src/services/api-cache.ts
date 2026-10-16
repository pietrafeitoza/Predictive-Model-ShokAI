// Client-side response cache for authenticated GET requests.
//
// The dashboard data only changes when a prediction import runs or a model status is changed, so
// repeating the same GET on navigation is wasteful (the predictions payload alone is a few MB).
// Responses are kept in memory for the session and, for small payloads, mirrored into
// sessionStorage so a page reload stays fast. Mutations and sign-out clear the cache.

const DEFAULT_TTL_MS = 60_000;
const STORAGE_PREFIX = 'shokai:api:';
const STORAGE_MAX_CHARS = 150_000;

interface CacheEntry {
  body: unknown;
  expiresAt: number;
}

const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

// Keep the raw access token out of sessionStorage keys.
function tokenScope(accessToken: string): string {
  let hash = 0;
  for (let index = 0; index < accessToken.length; index += 1) {
    hash = (hash * 31 + accessToken.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export function createCacheKey(method: string, path: string, accessToken: string): string {
  return `${tokenScope(accessToken)}:${method} ${path}`;
}

export function readCache(key: string): unknown | undefined {
  const cached = memory.get(key);
  if (cached) {
    if (cached.expiresAt > Date.now()) return cached.body;
    memory.delete(key);
  }

  if (!hasStorage()) return undefined;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as CacheEntry;
    if (entry.expiresAt > Date.now()) {
      memory.set(key, entry);
      return entry.body;
    }
    window.sessionStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // A malformed cache entry must never break a request.
  }

  return undefined;
}

export function writeCache(key: string, body: unknown, ttlMs = DEFAULT_TTL_MS): void {
  const entry: CacheEntry = { body, expiresAt: Date.now() + ttlMs };
  memory.set(key, entry);

  if (!hasStorage()) return;

  try {
    const serialized = JSON.stringify(entry);
    if (serialized.length <= STORAGE_MAX_CHARS) {
      window.sessionStorage.setItem(STORAGE_PREFIX + key, serialized);
    }
  } catch {
    // Quota or serialization errors are non-fatal.
  }
}

export function readInflight<T>(key: string): Promise<T> | undefined {
  return inflight.get(key) as Promise<T> | undefined;
}

export function writeInflight<T>(key: string, promise: Promise<T>): void {
  inflight.set(key, promise as Promise<unknown>);
}

export function clearInflight(key: string): void {
  inflight.delete(key);
}

export function clearApiCache(): void {
  memory.clear();
  inflight.clear();

  if (!hasStorage()) return;

  try {
    const keys: string[] = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage errors while clearing.
  }
}
