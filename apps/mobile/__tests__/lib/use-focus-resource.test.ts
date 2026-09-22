import { act, renderHook } from "@testing-library/react-native";
import { useFocusResource } from "@/lib/controllers/use-focus-resource";

let mockFocused = true;
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = jest.requireActual("react");
    React.useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]);
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("focused screen requests", () => {
  beforeEach(() => { mockFocused = true; });

  it("settles both loading indicators when refresh supersedes initial loading", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const load = jest.fn().mockReturnValueOnce(first.promise).mockReturnValue(second.promise);
    const { result } = renderHook(() => useFocusResource({ load, initialValue: "", errorMessage: "Failed" }));
    act(() => result.current.refresh());
    await act(async () => second.resolve("fresh"));
    expect(result.current.data).toBe("fresh");
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
    await act(async () => first.resolve("stale"));
    expect(result.current.data).toBe("fresh");
  });

  it("does not restore obsolete data when a resource key changes", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const load = jest.fn().mockReturnValueOnce(first.promise).mockReturnValue(second.promise);
    const { result, rerender } = renderHook(({ key }: { key: number }) => useFocusResource({ key, load, initialValue: "", errorMessage: "Failed" }), { initialProps: { key: 1 } });
    rerender({ key: 2 });
    await act(async () => first.resolve("stale"));
    expect(result.current.data).toBe("");
    await act(async () => second.resolve("fresh"));
    expect(result.current.data).toBe("fresh");
  });

  it("keeps local mutation results when an older fetch completes", async () => {
    const pending = deferred<string>();
    const { result } = renderHook(() => useFocusResource({ load: () => pending.promise, initialValue: "", errorMessage: "Failed" }));
    act(() => result.current.setData("saved"));
    await act(async () => pending.resolve("old"));
    expect(result.current.data).toBe("saved");
    expect(result.current.loading).toBe(false);
  });

  it("ignores a completion after the screen loses focus", async () => {
    const pending = deferred<string>();
    const { result, rerender } = renderHook(() => useFocusResource({ load: () => pending.promise, initialValue: "", errorMessage: "Failed" }));
    mockFocused = false;
    rerender({});
    await act(async () => pending.resolve("old"));
    expect(result.current.data).toBe("");
  });

  it("ignores mutation callbacks retained from an obsolete resource", async () => {
    const { result, rerender } = renderHook(({ key }: { key: number }) => useFocusResource({ key, load: async () => `resource-${key}`, initialValue: "", errorMessage: "Failed" }), { initialProps: { key: 1 } });
    await act(async () => {});
    const oldSetData = result.current.setData;
    rerender({ key: 2 });
    await act(async () => {});
    act(() => oldSetData("old mutation"));
    expect(result.current.data).toBe("resource-2");
  });
});
