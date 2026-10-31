import { Alert } from "react-native";
import { act, renderHook } from "@testing-library/react-native";
import { useDeleteAccountController } from "@/lib/controllers/account";

const mockDelete = jest.fn();
const mockClearCache = jest.fn();
const mockSignOut = jest.fn();
const mockReplace = jest.fn();

jest.mock("@/lib/api", () => ({
  accountService: { delete: () => mockDelete() },
  clearCachedResources: () => mockClearCache(),
}));
jest.mock("@clerk/clerk-expo", () => ({ useAuth: () => ({ signOut: mockSignOut }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));

function apiError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

function alertButton(label: string) {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] ?? [];
  const button = buttons.find((item) => item.text === label);
  if (!button) throw new Error(`No ${label} button`);
  return button;
}

async function confirmDeletion(result: { current: ReturnType<typeof useDeleteAccountController> }) {
  act(() => result.current.confirm());
  await act(async () => { await alertButton("Delete Account").onPress?.(); });
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  mockDelete.mockResolvedValue({});
  mockSignOut.mockResolvedValue(undefined);
});

it("asks once more before deleting and does nothing on Cancel", () => {
  const { result } = renderHook(useDeleteAccountController);

  act(() => result.current.confirm());

  expect(Alert.alert).toHaveBeenCalledTimes(1);
  expect(alertButton("Delete Account").style).toBe("destructive");
  expect(alertButton("Cancel").style).toBe("cancel");
  expect(mockDelete).not.toHaveBeenCalled();
});

it("deletes, signs out, and returns to the auth screen", async () => {
  const { result } = renderHook(useDeleteAccountController);

  await confirmDeletion(result);

  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect(mockClearCache).toHaveBeenCalledTimes(1);
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith("/auth/login");
  expect(result.current.visible).toBe(false);
});

it("still reaches the auth screen when Clerk refuses to end a session it already deleted", async () => {
  mockSignOut.mockRejectedValue(new Error("Session not found"));
  const { result } = renderHook(useDeleteAccountController);

  await confirmDeletion(result);

  expect(mockReplace).toHaveBeenCalledWith("/auth/login");
  expect(result.current.error).toBe("");
});

it("stays signed in with a plain error when the server fails", async () => {
  mockDelete.mockRejectedValue(apiError(502, "We could not delete your account."));
  const { result } = renderHook(useDeleteAccountController);

  await confirmDeletion(result);

  expect(result.current.error).toBe("We couldn't delete your account. The server hit a snag. Try again in a moment.");
  expect(result.current.deleting).toBe(false);
  expect(mockSignOut).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

it("shows the server's own reason when an admin account is refused", async () => {
  mockDelete.mockRejectedValue(apiError(422, "Admin accounts can't be deleted in the app."));
  const { result } = renderHook(useDeleteAccountController);

  await confirmDeletion(result);

  expect(result.current.error).toBe("We couldn't delete your account. Admin accounts can't be deleted in the app.");
});

it("explains a dropped connection and lets the person try again", async () => {
  mockDelete.mockRejectedValueOnce(new Error("Network request failed"));
  const { result } = renderHook(useDeleteAccountController);

  await confirmDeletion(result);
  expect(result.current.error).toContain("Check your connection");

  await confirmDeletion(result);

  expect(mockDelete).toHaveBeenCalledTimes(2);
  expect(result.current.error).toBe("");
  expect(mockReplace).toHaveBeenCalledWith("/auth/login");
});

it("ignores a second tap while the first is running", async () => {
  let finish: (value?: unknown) => void = () => undefined;
  mockDelete.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const { result } = renderHook(useDeleteAccountController);
  act(() => result.current.confirm());
  const onPress = alertButton("Delete Account").onPress;

  await act(async () => { void onPress?.(); void onPress?.(); });
  expect(mockDelete).toHaveBeenCalledTimes(1);
  expect(result.current.deleting).toBe(true);

  await act(async () => { finish(); });
});

it("cannot be closed while a deletion is running", async () => {
  let finish: (value?: unknown) => void = () => undefined;
  mockDelete.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const { result } = renderHook(useDeleteAccountController);
  act(() => result.current.open());
  act(() => result.current.confirm());

  await act(async () => { void alertButton("Delete Account").onPress?.(); });
  act(() => result.current.close());

  expect(result.current.visible).toBe(true);
  await act(async () => { finish(); });
});

it("opens clean after an earlier error", async () => {
  mockDelete.mockRejectedValue(apiError(502, "Nope"));
  const { result } = renderHook(useDeleteAccountController);
  await confirmDeletion(result);
  expect(result.current.error).not.toBe("");

  act(() => result.current.close());
  act(() => result.current.open());

  expect(result.current.visible).toBe(true);
  expect(result.current.error).toBe("");
});

it("uses no em dashes in anything it shows", async () => {
  mockDelete.mockRejectedValue(apiError(502, "Nope"));
  const { result } = renderHook(useDeleteAccountController);

  await confirmDeletion(result);

  const shown = JSON.stringify([jest.mocked(Alert.alert).mock.calls, result.current.error]);
  expect(shown).not.toMatch(/[–—]/);
});
