import { act, renderHook } from "@testing-library/react-native";
import { useLoginController, useSignupController } from "@/lib/controllers/auth";

const mockSetActive = jest.fn();
const mockSignIn = {
  create: jest.fn(), prepareFirstFactor: jest.fn(), prepareSecondFactor: jest.fn(),
  attemptFirstFactor: jest.fn(), attemptSecondFactor: jest.fn(),
};
const mockSignUp = { create: jest.fn(), prepareEmailAddressVerification: jest.fn(), attemptEmailAddressVerification: jest.fn() };
jest.mock("@clerk/clerk-expo", () => ({
  useSignIn: () => ({ isLoaded: true, signIn: mockSignIn, setActive: mockSetActive }),
  useSignUp: () => ({ isLoaded: true, signUp: mockSignUp, setActive: mockSetActive }),
  useSSO: () => ({ startSSOFlow: jest.fn() }),
  useSignInWithApple: () => ({ startAppleAuthenticationFlow: jest.fn() }),
}));
jest.mock("expo-web-browser", () => ({ maybeCompleteAuthSession: jest.fn(), warmUpAsync: jest.fn(), coolDownAsync: jest.fn() }));
jest.mock("@/lib/clerk-sso", () => ({ getClerkRedirectUrl: () => "niftygifty://", shouldUseNativeAppleAuth: () => false }));
beforeEach(() => jest.clearAllMocks());

it("finishes password sign-in when Clerk requires email verification", async () => {
  const pending = { ...mockSignIn, status: "needs_second_factor", supportedSecondFactors: [{ strategy: "email_code", emailAddressId: "email_1" }] };
  mockSignIn.create.mockResolvedValue(pending);
  mockSignIn.attemptSecondFactor.mockResolvedValue({ status: "complete", createdSessionId: "session_1" });
  const { result } = renderHook(useLoginController);
  act(() => { result.current.setEmail(" alice@example.com "); result.current.setPassword("test password"); });
  await act(async () => result.current.handlePasswordSignIn());
  expect(result.current.verification).toBe("email_second");
  expect(mockSignIn.prepareSecondFactor).toHaveBeenCalledWith({ strategy: "email_code", emailAddressId: "email_1" });
  expect(mockSetActive).not.toHaveBeenCalled();
  act(() => result.current.setCode("123456"));
  await act(async () => result.current.handleVerify());
  expect(mockSetActive).toHaveBeenCalledWith({ session: "session_1" });
});

it("supports email-code sign-in for an account without a password", async () => {
  mockSignIn.create.mockResolvedValue({ ...mockSignIn, status: "needs_first_factor", supportedFirstFactors: [{ strategy: "email_code", emailAddressId: "email_1" }] });
  const { result } = renderHook(useLoginController);
  act(() => result.current.setEmail(" alice@example.com "));
  await act(async () => result.current.handleEmailCodeSignIn());
  expect(mockSignIn.create).toHaveBeenCalledWith({ identifier: "alice@example.com" });
  expect(result.current.verification).toBe("email_first");
  mockSignIn.attemptFirstFactor.mockRejectedValue({ errors: [{ message: "That code has expired." }] });
  act(() => result.current.setCode("123456"));
  await act(async () => result.current.handleVerify());
  expect(result.current.error).toBe("That code has expired.");
  expect(result.current.verification).toBe("email_first");
});

it("does not silently stop at an unsupported verification step", async () => {
  mockSignIn.create.mockResolvedValue({ status: "needs_new_password" });
  const { result } = renderHook(useLoginController);
  await act(async () => result.current.handlePasswordSignIn());
  expect(result.current.error).toContain("another sign-in method");
});

it("sends the required name fields during signup and offers verification recovery", async () => {
  mockSignUp.create.mockResolvedValue({ status: "missing_requirements" });
  const { result } = renderHook(useSignupController);
  act(() => {
    result.current.setFirstName(" Alex "); result.current.setLastName(" Parker ");
    result.current.setEmail(" alex@example.com "); result.current.setPassword("test password");
  });
  await act(async () => result.current.handlePasswordSignUp());
  expect(mockSignUp.create).toHaveBeenCalledWith({ firstName: "Alex", lastName: "Parker", emailAddress: "alex@example.com", password: "test password" });
  expect(result.current.pendingVerification).toBe(true);
  await act(async () => result.current.handleResendCode());
  expect(mockSignUp.prepareEmailAddressVerification).toHaveBeenCalledTimes(2);
  act(() => result.current.cancelVerification());
  expect(result.current.pendingVerification).toBe(false);
  expect(result.current.firstName).toBe(" Alex ");
});
