type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  inflight?: Promise<T>;
};

const resourceCache = new Map<string, CacheEntry<unknown>>();

export async function readCachedResource<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = resourceCache.get(key) as CacheEntry<T> | undefined;

  if (existing?.value !== undefined && existing.expiresAt > now) {
    return existing.value;
  }

  if (existing?.inflight) {
    return existing.inflight;
  }

  const inflight = fetcher()
    .then((value) => {
      resourceCache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
      return value;
    })
    .catch((error) => {
      if (existing) {
        resourceCache.set(key, existing);
      } else {
        resourceCache.delete(key);
      }
      throw error;
    });

  resourceCache.set(key, {
    value: existing?.value,
    expiresAt: existing?.expiresAt ?? 0,
    inflight,
  });

  return inflight;
}

export function peekCachedResource<T>(key: string): T | undefined {
  const existing = resourceCache.get(key) as CacheEntry<T> | undefined;

  if (!existing || existing.value === undefined) {
    return undefined;
  }

  if (existing.expiresAt <= Date.now()) {
    return undefined;
  }

  return existing.value;
}

export function primeCachedResource<T>(key: string, value: T, ttlMs: number): void {
  resourceCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function prefetchCachedResource<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): void {
  void readCachedResource(key, ttlMs, fetcher).catch(() => undefined);
}

export function invalidateCachedResources(
  matcher: string | RegExp | ((key: string) => boolean)
): void {
  const match =
    typeof matcher === "function"
      ? matcher
      : typeof matcher === "string"
        ? (key: string) => key.startsWith(matcher)
        : (key: string) => matcher.test(key);

  for (const key of resourceCache.keys()) {
    if (match(key)) {
      resourceCache.delete(key);
    }
  }
}

export function clearCachedResources(): void {
  resourceCache.clear();
}
