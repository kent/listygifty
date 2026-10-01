import { act, renderHook } from "@testing-library/react-native";
import { useLoginController, useSignupController } from "@/lib/controllers/auth";

const mockSetActive = jest.fn();
let mockLoaded = true;
const mockSignIn = { create: jest.fn(), prepareFirstFactor: jest.fn(), attemptFirstFactor: jest.fn() };
const mockSignUp = { create: jest.fn(), prepareEmailAddressVerification: jest.fn(), attemptEmailAddressVerification: jest.fn() };
jest.mock("@clerk/clerk-expo", () => ({
  useSignIn: () => ({ isLoaded: mockLoaded, signIn: mockSignIn, setActive: mockSetActive }),
  useSignUp: () => ({ isLoaded: mockLoaded, signUp: mockSignUp, setActive: mockSetActive }),
}));
beforeEach(() => {
  jest.resetAllMocks(); jest.useFakeTimers(); mockLoaded = true;
  mockSignIn.create.mockResolvedValue({ status: "needs_first_factor", supportedFirstFactors: [{ strategy: "email_code", emailAddressId: "email_1" }] });
  mockSignUp.create.mockResolvedValue({ status: "missing_requirements", missingFields: [], unverifiedFields: ["email_address"] });
});
afterEach(() => jest.useRealTimers());
async function startLogin() {
  const hook = renderHook(useLoginController);
  act(() => hook.result.current.setEmail(" alice@example.com "));
  await act(async () => hook.result.current.handleEmailCodeSignIn());
  return hook;
}
async function startSignup() {
  const hook = renderHook(useSignupController);
  act(() => {
    hook.result.current.setFirstName(" Alice "); hook.result.current.setLastName(" Parker ");
    hook.result.current.setEmail(" alice@example.com ");
  });
  await act(async () => hook.result.current.handleEmailCodeSignUp());
  return hook;
}
it("emails a code and activates only the verified session, without a password", async () => {
  const { result } = await startLogin();
  expect(mockSignIn.create).toHaveBeenCalledWith({ identifier: "alice@example.com" });
  expect(mockSignIn.prepareFirstFactor).toHaveBeenCalledWith({ strategy: "email_code", emailAddressId: "email_1" });
  expect(result.current.pendingVerification).toBe(true);
  expect(mockSetActive).not.toHaveBeenCalled();
  mockSignIn.attemptFirstFactor.mockResolvedValue({ status: "complete", createdSessionId: "session_1" });
  act(() => result.current.setCode("123456"));
  await act(async () => result.current.handleVerify());
  expect(mockSetActive).toHaveBeenCalledWith({ session: "session_1" });
});
it("keeps the code form usable after a rejected code", async () => {
  const { result } = await startLogin();
  mockSignIn.attemptFirstFactor.mockRejectedValue({ errors: [{ message: "Expired", longMessage: "That code has expired. Request a new code." }] });
  act(() => result.current.setCode("123456"));
  await act(async () => result.current.handleVerify());
  expect(result.current.error).toContain("Request a new code");
  expect(result.current.pendingVerification).toBe(true);
  expect(result.current.loading).toBe(false);
  expect(mockSetActive).not.toHaveBeenCalled();
});
it("waits 30 seconds before resending without creating another sign-in", async () => {
  const { result } = await startLogin();
  await act(async () => result.current.handleResendCode());
  expect(mockSignIn.prepareFirstFactor).toHaveBeenCalledTimes(1);
  act(() => { jest.advanceTimersByTime(30_000); result.current.setCode("123456"); });
  await act(async () => result.current.handleResendCode());
  expect(mockSignIn.prepareFirstFactor).toHaveBeenCalledTimes(2);
  expect(mockSignIn.create).toHaveBeenCalledTimes(1);
  expect(result.current.code).toBe(""); expect(result.current.resendSeconds).toBe(30);
});
it("does not claim a code was sent when email delivery fails", async () => {
  mockSignIn.prepareFirstFactor.mockRejectedValue(new Error("Network unavailable"));
  const { result } = await startLogin();
  expect(result.current.pendingVerification).toBe(false);
  expect(result.current.error).toBe("Network unavailable");
});
it("guides an unknown email to account creation", async () => {
  mockSignIn.create.mockRejectedValue({ errors: [{ code: "form_identifier_not_found" }] });
  const { result } = await startLogin();
  expect(result.current.error).toContain("Create an account");
  expect(mockSignIn.prepareFirstFactor).not.toHaveBeenCalled();
});
it("does not silently switch to a password or provider", async () => {
  mockSignIn.create.mockResolvedValue({ status: "needs_first_factor", supportedFirstFactors: [{ strategy: "password" }] });
  const { result } = await startLogin();
  expect(result.current.error).toContain("Email sign-in is unavailable");
  expect(mockSetActive).not.toHaveBeenCalled();
});
it("validates email and waits for Clerk to load", async () => {
  const { result } = renderHook(useLoginController);
  act(() => result.current.setEmail("not an email"));
  await act(async () => result.current.handleEmailCodeSignIn());
  expect(mockSignIn.create).not.toHaveBeenCalled();
  mockLoaded = false;
  await startLogin();
  expect(mockSignIn.create).not.toHaveBeenCalled();
});
it("prevents repeated taps from creating competing attempts", async () => {
  const { result } = renderHook(useLoginController);
  act(() => result.current.setEmail("alice@example.com"));
  await act(async () => { await Promise.all([result.current.handleEmailCodeSignIn(), result.current.handleEmailCodeSignIn()]); });
  expect(mockSignIn.create).toHaveBeenCalledTimes(1);
});
it("signs up with name and email only, then activates the verified session", async () => {
  const { result } = await startSignup();
  expect(mockSignUp.create).toHaveBeenCalledWith({ firstName: "Alice", lastName: "Parker", emailAddress: "alice@example.com" });
  expect(mockSignUp.prepareEmailAddressVerification).toHaveBeenCalledWith({ strategy: "email_code" });
  expect(result.current.pendingVerification).toBe(true);
  expect(mockSetActive).not.toHaveBeenCalled();
  mockSignUp.attemptEmailAddressVerification.mockResolvedValue({ status: "complete", createdSessionId: "session_new" });
  act(() => result.current.setCode("123456"));
  await act(async () => result.current.handleVerify());
  expect(mockSetActive).toHaveBeenCalledWith({ session: "session_new" });
});
it("resends signup codes and preserves details when returning to the form", async () => {
  const { result } = await startSignup();
  act(() => jest.advanceTimersByTime(30_000));
  await act(async () => result.current.handleResendCode());
  expect(mockSignUp.prepareEmailAddressVerification).toHaveBeenCalledTimes(2);
  act(() => result.current.cancelVerification());
  expect(result.current.pendingVerification).toBe(false);
  expect(result.current.firstName).toBe(" Alice "); expect(result.current.email).toBe(" alice@example.com ");
});
it("reports configuration mismatch before claiming a code was sent", async () => {
  mockSignUp.create.mockResolvedValue({ status: "missing_requirements", missingFields: ["password"] });
  const { result } = await startSignup();
  expect(result.current.pendingVerification).toBe(false);
  expect(result.current.error).toContain("temporarily unavailable");
  expect(mockSignUp.prepareEmailAddressVerification).not.toHaveBeenCalled();
});
it("rejects malformed codes and never activates incomplete signups", async () => {
  const { result } = await startSignup();
  act(() => result.current.setCode("abc123"));
  await act(async () => result.current.handleVerify());
  expect(mockSignUp.attemptEmailAddressVerification).not.toHaveBeenCalled();
  mockSignUp.attemptEmailAddressVerification.mockResolvedValue({ status: "missing_requirements", createdSessionId: null });
  act(() => result.current.setCode("123456"));
  await act(async () => result.current.handleVerify());
  expect(mockSetActive).not.toHaveBeenCalled(); expect(result.current.error).toContain("still needs some details");
});
