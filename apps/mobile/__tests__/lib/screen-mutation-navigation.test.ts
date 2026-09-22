import { act, renderHook } from "@testing-library/react-native";
import { useNewListController } from "@/lib/controllers/lists";

let mockFocused = true;
let mockPathname = "/lists/new";
const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn() };
const mockCreate = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
  useLocalSearchParams: () => ({}),
}));
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    jest.requireActual("react").useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]);
  },
}));
jest.mock("@/lib/use-api", () => ({ useServices: () => ({ holidays: { create: mockCreate } }) }));
jest.mock("@/lib/analytics", () => ({ useAnalytics: () => jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused = true;
  mockPathname = "/lists/new";
  mockCreate.mockResolvedValue({ id: 1 });
});

it("returns to the list after a save on the current screen", async () => {
  const { result } = renderHook(useNewListController);
  act(() => result.current.updateField("name", "Christmas"));
  await act(async () => result.current.handleSubmit());
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

it.each(["unmount", "blur and return", "route change"])("does not navigate after %s while saving", async (transition) => {
  let resolve!: (value: { id: number }) => void;
  mockCreate.mockReturnValue(new Promise((done) => { resolve = done; }));
  const { result, rerender, unmount } = renderHook(useNewListController);
  act(() => result.current.updateField("name", "Christmas"));
  let pending!: Promise<void>;
  act(() => { pending = result.current.handleSubmit(); });
  if (transition === "unmount") unmount();
  else if (transition === "route change") {
    mockPathname = "/lists/other";
    rerender({});
  } else {
    mockFocused = false;
    rerender({});
    mockFocused = true;
    rerender({});
  }
  await act(async () => { resolve({ id: 1 }); await pending; });
  expect(mockRouter.back).not.toHaveBeenCalled();
});
