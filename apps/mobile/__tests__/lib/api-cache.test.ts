import type { AppBootstrapResponse } from "@niftygifty/types";
import {
  apiClient,
  clearCachedResources,
  configureApiSession,
  giftsService,
  giftExchangesService,
  holidaysService,
  peopleService,
  prefetchAppShellData,
} from "@/lib/api";
import { peekCachedResource, primeCachedResource } from "@/lib/resource-cache";

function deferred() {
  let resolve!: (value: AppBootstrapResponse) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<AppBootstrapResponse>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function payload(id: number): AppBootstrapResponse {
  return {
    data: {
      holiday_templates: [],
      holidays: [{ id }],
      people: [],
      gift_statuses: [],
      gift_exchanges: [],
    },
  } as unknown as AppBootstrapResponse;
}

async function settleBootstrap() {
  // Drain the bootstrap's then/catch/finally chain.
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
}

describe("bootstrap cache isolation", () => {
  beforeEach(clearCachedResources);
  afterEach(() => jest.restoreAllMocks());

  it("does not seed a previous session's bootstrap after sign-out", async () => {
    const old = deferred();
    jest.spyOn(apiClient, "get").mockReturnValue(old.promise);
    prefetchAppShellData();
    clearCachedResources();
    old.resolve(payload(1));
    await settleBootstrap();
    expect(peekCachedResource("holidays:list")).toBeUndefined();
  });

  it("does not overwrite a new session's bootstrap with a late response", async () => {
    const old = deferred();
    const current = deferred();
    jest.spyOn(apiClient, "get")
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    prefetchAppShellData();
    clearCachedResources();
    const loading = holidaysService.getAll();
    current.resolve(payload(2));
    expect(await loading).toEqual([{ id: 2 }]);
    old.resolve(payload(1));
    await settleBootstrap();
    expect(await holidaysService.getAll()).toEqual([{ id: 2 }]);
  });

  it("keeps the current bootstrap deduplicated when an obsolete request fails", async () => {
    const old = deferred();
    const current = deferred();
    const get = jest.spyOn(apiClient, "get")
      .mockReturnValueOnce(old.promise)
      .mockReturnValue(current.promise);
    prefetchAppShellData();
    clearCachedResources();
    const holidays = holidaysService.getAll();
    old.reject(new Error("obsolete request failed"));
    await settleBootstrap();
    const people = peopleService.getAll();
    expect(get).toHaveBeenCalledTimes(2);
    current.resolve(payload(2));
    await Promise.all([holidays, people]);
  });

  it("does not expire a fresh bootstrap when an obsolete request fails", async () => {
    const old = deferred();
    const get = jest.spyOn(apiClient, "get")
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue(payload(2));
    prefetchAppShellData();
    clearCachedResources();
    await holidaysService.getAll();
    old.reject(new Error("obsolete request failed"));
    await settleBootstrap();
    prefetchAppShellData();
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe("account cache isolation", () => {
  const token = async () => "token";
  beforeEach(() => { configureApiSession(null, token); clearCachedResources(); });
  afterEach(() => jest.restoreAllMocks());

  it("clears cached resources on direct account switching", () => {
    configureApiSession("first", token);
    primeCachedResource("holidays:list", [{ id: 1 }], 60_000);
    configureApiSession("second", token);
    expect(peekCachedResource("holidays:list")).toBeUndefined();
  });

  it("keeps caches when only the token getter changes for the same account", () => {
    configureApiSession("first", token);
    primeCachedResource("holidays:list", [{ id: 1 }], 60_000);
    configureApiSession("first", async () => "new-token");
    expect(peekCachedResource("holidays:list")).toEqual([{ id: 1 }]);
  });

  it("clears caches and authentication on sign-out", async () => {
    configureApiSession("first", token);
    primeCachedResource("holidays:list", [{ id: 1 }], 60_000);
    configureApiSession(null, token);
    expect(peekCachedResource("holidays:list")).toBeUndefined();
    expect(await apiClient.getAuthHeaders()).not.toHaveProperty("Authorization");
  });

  it("never falls back to a new account's endpoint for an obsolete shell request", async () => {
    configureApiSession("first", token);
    const old = deferred();
    const get = jest.spyOn(apiClient, "get").mockReturnValue(old.promise);
    const loading = holidaysService.getAll();
    const rejected = expect(loading).rejects.toThrow("Session changed");
    configureApiSession("second", token);
    old.resolve(payload(1));
    await rejected;
    expect(get).toHaveBeenCalledTimes(1);
    expect(peekCachedResource("holidays:list")).toBeUndefined();
  });
});

describe("mutation cache invalidation", () => {
  beforeEach(clearCachedResources);
  afterEach(() => jest.restoreAllMocks());

  function seedSummaries() {
    for (const key of ["holidays:list", "holidays:1", "holidays:2", "gifts:list:all", "gifts:1", "people:list"]) {
      primeCachedResource(key, { stale: true }, 60_000);
    }
  }

  function expectFreshSummaries() {
    for (const key of ["holidays:list", "holidays:1", "holidays:2", "gifts:list:all", "gifts:1", "people:list"]) {
      expect(peekCachedResource(key)).toBeUndefined();
    }
  }

  it("invalidates list totals and both holiday details when a gift moves", async () => {
    seedSummaries();
    jest.spyOn(apiClient, "patch").mockResolvedValue({ id: 1, holiday_id: 2 });
    await giftsService.update(1, { holiday_id: 2 });
    expectFreshSummaries();
  });

  it("invalidates holiday totals when deleting a gift without its holiday ID", async () => {
    seedSummaries();
    jest.spyOn(apiClient, "delete").mockResolvedValue({});
    await giftsService.delete(1);
    expectFreshSummaries();
  });

  it("invalidates embedded gift recipients when a person changes", async () => {
    seedSummaries();
    jest.spyOn(apiClient, "patch").mockResolvedValue({ id: 1, name: "Updated" });
    await peopleService.update(1, { name: "Updated" });
    expectFreshSummaries();
  });

  it("invalidates embedded gift recipients when a person is deleted", async () => {
    seedSummaries();
    jest.spyOn(apiClient, "delete").mockResolvedValue({});
    await peopleService.delete(1);
    expectFreshSummaries();
  });
});

describe("live exchange progress", () => {
  beforeEach(clearCachedResources);
  afterEach(() => jest.restoreAllMocks());

  it("refreshes joins and matches even while the old summary is cached", async () => {
    primeCachedResource("gift-exchanges:list", [{ id: 32, accepted_count: 1 }], 60_000);
    primeCachedResource("gift-exchanges:32", { id: 32, status: "inviting" }, 30_000);
    jest.spyOn(apiClient, "get")
      .mockResolvedValueOnce([{ id: 32, accepted_count: 2 }])
      .mockResolvedValueOnce({ id: 32, status: "active" });
    expect(await giftExchangesService.getAll()).toEqual([{ id: 32, accepted_count: 2 }]);
    expect(await giftExchangesService.getById(32)).toEqual({ id: 32, status: "active" });
  });
});
