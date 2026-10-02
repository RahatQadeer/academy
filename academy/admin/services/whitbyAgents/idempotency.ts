import "server-only";

// In-memory idempotency cache. A client sends a stable `actionId` for a given
// user gesture; if the same id arrives again (e.g. a retry after a timed-out
// response), we return the already-computed result instead of running the
// mutation twice. This is INSTANCE-LOCAL and does not survive a server restart
// or span multiple instances — durable, cross-instance idempotency would need a
// Postgres/Redis-backed table (deferred until a migration is allowed).

type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();
const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 1_000;

function sweep(now: number): void {
  for (const [key, entry] of store) {
    if (entry.expires <= now) store.delete(key);
  }
}

/**
 * Run `fn` at most once per `key` within the TTL window. Only results that pass
 * `shouldCache` are remembered, so transient failures (auth errors, timeouts)
 * are never cached and will re-run on retry.
 */
export async function withIdempotency<T>(
  key: string | undefined,
  fn: () => Promise<T>,
  shouldCache: (value: T) => boolean = () => true,
): Promise<T> {
  if (!key) return fn();

  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) {
    return hit.value as T;
  }

  const value = await fn();

  if (shouldCache(value)) {
    if (store.size >= MAX_ENTRIES) sweep(now);
    store.set(key, { value, expires: now + TTL_MS });
  }

  return value;
}
