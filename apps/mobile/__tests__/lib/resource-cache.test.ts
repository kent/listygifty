import {
  clearCachedResources,
  invalidateCachedResources,
  peekCachedResource,
  primeCachedResource,
  readCachedResource,
} from "@/lib/resource-cache";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("resource cache request isolation", () => {
  beforeEach(clearCachedResources);

  it("deduplicates concurrent reads and caches the result", async () => {
    const request = deferred<string>();
    const fetcher = jest.fn(() => request.promise);
    const first = readCachedResource("people:list", 1000, fetcher);
    const second = readCachedResource("people:list", 1000, fetcher);
    request.resolve("current");
    expect(await Promise.all([first, second])).toEqual(["current", "current"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(peekCachedResource("people:list")).toBe("current");
  });

  it("does not repopulate the cache with a previous session's response", async () => {
    const request = deferred<string>();
    const pending = readCachedResource("people:list", 1000, () => request.promise);
    clearCachedResources();
    request.resolve("previous user's people");
    await pending;
    expect(peekCachedResource("people:list")).toBeUndefined();
  });

  it("does not overwrite fresh data when an invalidated request finishes later", async () => {
    const request = deferred<string>();
    const pending = readCachedResource("people:list", 1000, () => request.promise);
    invalidateCachedResources("people:");
    await readCachedResource("people:list", 1000, async () => "updated");
    request.resolve("stale");
    await pending;
    expect(peekCachedResource("people:list")).toBe("updated");
  });

  it("preserves data primed while a request was in flight", async () => {
    const request = deferred<string>();
    const pending = readCachedResource("people:list", 1000, () => request.promise);
    primeCachedResource("people:list", "bootstrap", 1000);
    request.resolve("stale");
    await pending;
    expect(peekCachedResource("people:list")).toBe("bootstrap");
  });

  it("does not delete another session's entry when an old request fails", async () => {
    const request = deferred<string>();
    const pending = readCachedResource("people:list", 1000, () => request.promise);
    clearCachedResources();
    primeCachedResource("people:list", "new session", 1000);
    request.reject(new Error("old request failed"));
    await expect(pending).rejects.toThrow("old request failed");
    expect(peekCachedResource("people:list")).toBe("new session");
  });

  it("does not restore an expired entry after invalidation when refresh fails", async () => {
    primeCachedResource("people:list", "expired", -1);
    const request = deferred<string>();
    const pending = readCachedResource("people:list", 1000, () => request.promise);
    invalidateCachedResources("people:");
    primeCachedResource("people:list", "updated", 1000);
    request.reject(new Error("refresh failed"));
    await expect(pending).rejects.toThrow("refresh failed");
    expect(peekCachedResource("people:list")).toBe("updated");
  });
});
