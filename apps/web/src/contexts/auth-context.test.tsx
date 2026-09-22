import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillingStatus } from "@niftygifty/types";
import { deferred } from "@/test/deferred";
import { AuthProvider, useAuth } from "./auth-context";

const mocks = vi.hoisted(() => ({
  user: { id: "user_a" } as { id: string } | null,
  getStatus: vi.fn<() => Promise<BillingStatus>>(),
  getToken: vi.fn().mockResolvedValue("token"),
  clerk: { signOut: vi.fn().mockResolvedValue(undefined) },
  router: { push: vi.fn() },
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: mocks.getToken, isLoaded: true }),
  useUser: () => ({ user: mocks.user, isLoaded: true }),
  useClerk: () => mocks.clerk,
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@/lib/api-client", () => ({ apiClient: { setTokenGetter: vi.fn() } }));
vi.mock("@/services", () => ({
  billingService: { getStatus: mocks.getStatus },
  mapClerkUser: (user: { id: string } | null) => user && { clerk_user_id: user.id },
}));

const premium = { subscription_plan: "premium", subscription_status: "active", can_create_gift: true, gifts_remaining: null } as BillingStatus;
const free = { subscription_plan: "free", subscription_status: "free", can_create_gift: true, gifts_remaining: 20 } as BillingStatus;

beforeEach(() => {
  mocks.user = { id: "user_a" };
  mocks.getStatus.mockReset();
});

describe("billing state isolation", () => {
  it("does not show another account's billing data during an account switch", () => {
    const { result, rerender } = renderHook(useAuth, { wrapper: AuthProvider });
    act(() => result.current.hydrateBillingStatus(premium));
    expect(result.current.isPremium).toBe(true);
    mocks.user = { id: "user_b" };
    rerender();
    expect(result.current.billingStatus).toBeNull();
    expect(result.current.isPremium).toBe(false);
  });

  it("ignores billing responses from a previous account", async () => {
    const old = deferred<BillingStatus>();
    mocks.getStatus.mockReturnValue(old.promise);
    const { result, rerender } = renderHook(useAuth, { wrapper: AuthProvider });
    let refresh!: Promise<void>;
    act(() => { refresh = result.current.refreshBillingStatus(); });
    mocks.user = { id: "user_b" };
    rerender();
    await act(async () => { old.resolve(premium); await refresh; });
    expect(result.current.billingStatus).toBeNull();
  });

  it("keeps the latest billing refresh when replies arrive out of order", async () => {
    const old = deferred<BillingStatus>();
    const latest = deferred<BillingStatus>();
    mocks.getStatus.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => { first = result.current.refreshBillingStatus(); second = result.current.refreshBillingStatus(); });
    await act(async () => { latest.resolve(premium); await second; });
    await act(async () => { old.resolve(free); await first; });
    expect(result.current.billingStatus).toEqual(premium);
  });

  it("does not overwrite fresh bootstrap billing with an older refresh", async () => {
    const old = deferred<BillingStatus>();
    mocks.getStatus.mockReturnValue(old.promise);
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    let refresh!: Promise<void>;
    act(() => { refresh = result.current.refreshBillingStatus(); });
    act(() => result.current.hydrateBillingStatus(premium));
    await act(async () => { old.resolve(free); await refresh; });
    expect(result.current.billingStatus).toEqual(premium);
  });

  it("does not restore billing while sign-out completes", async () => {
    const old = deferred<BillingStatus>();
    mocks.getStatus.mockReturnValue(old.promise);
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    let refresh!: Promise<void>;
    act(() => { refresh = result.current.refreshBillingStatus(); });
    await act(() => result.current.signOut());
    await act(async () => { old.resolve(premium); await refresh; });
    expect(result.current.billingStatus).toBeNull();
  });

  it("ignores a previous account's saved hydration callback", () => {
    const { result, rerender } = renderHook(useAuth, { wrapper: AuthProvider });
    const oldHydrate = result.current.hydrateBillingStatus;
    mocks.user = { id: "user_b" };
    rerender();
    act(() => result.current.hydrateBillingStatus(premium));
    act(() => oldHydrate(free));
    expect(result.current.billingStatus).toEqual(premium);
  });
});
