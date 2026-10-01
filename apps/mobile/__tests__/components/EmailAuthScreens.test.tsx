import { fireEvent, render } from "@testing-library/react-native";
import LoginScreen from "@/app/auth/login";
import SignUpScreen from "@/app/auth/signup";
import { AuthCodeForm } from "@/components/AuthCodeForm";

it.each([LoginScreen, SignUpScreen])("offers email codes without social or password controls", (Screen) => {
  const screen = render(<Screen />);
  expect(screen.getByLabelText("Email address")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Email me a code" })).toBeTruthy();
  expect(screen.queryByPlaceholderText("Password")).toBeNull();
  expect(screen.queryByText("Continue with Google")).toBeNull();
  expect(screen.queryByText("Continue with Apple")).toBeNull();
});

it("normalizes pasted verification codes and explains the resend cooldown", () => {
  const onChangeCode = jest.fn();
  const screen = render(<AuthCodeForm email="review@example.com" code="" error="" loading={false} resendSeconds={30}
    onChangeCode={onChangeCode} onVerify={jest.fn()} onResend={jest.fn()} onBack={jest.fn()} />);
  fireEvent.changeText(screen.getByLabelText("Verification code"), "123 456");
  expect(onChangeCode).toHaveBeenCalledWith("123456");
  expect(screen.getByRole("button", { name: "Resend code in 30s" }).props.accessibilityState.disabled).toBe(true);
});
