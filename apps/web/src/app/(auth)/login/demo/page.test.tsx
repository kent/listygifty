import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeRedirect } from "@/lib/safe-redirect";
import DemoSignInPage from "./page";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  signInCreate: vi.fn(),
  setActive: vi.fn(),
  replace: vi.fn(),
  isSignedIn: false,
  redirect: "/oauth/authorize?request_token=abc" as string | null,
  email: null as string | null,
}));

vi.mock("@clerk/nextjs", () => ({
  useSignIn: () => ({ isLoaded: true, signIn: { create: mocks.signInCreate }, setActive: mocks.setActive }),
  useAuth: () => ({ isSignedIn: mocks.isSignedIn }),
  SignOutButton: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () =>
    new URLSearchParams({
      ...(mocks.redirect ? { redirect_url: mocks.redirect } : {}),
      ...(mocks.email ? { email: mocks.email } : {}),
    }),
}));
vi.mock("@/services", () => ({
  AUTH_ROUTES: { signIn: "/login", afterSignIn: "/dashboard" },
  demoSessionService: { create: mocks.create },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isSignedIn = false;
  mocks.redirect = "/oauth/authorize?request_token=abc";
  mocks.email = null;
});

function submit(email: string) {
  render(<DemoSignInPage />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in to demo" }));
}

describe("demo sign-in", () => {
  it("signs in with the demo ticket and goes back to the page that sent them", async () => {
    mocks.create.mockResolvedValue({ ticket: "ticket-1" });
    mocks.signInCreate.mockResolvedValue({ status: "complete", createdSessionId: "sess_1" });

    submit(" demo@listygifty.com ");

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/oauth/authorize?request_token=abc"));
    expect(mocks.create).toHaveBeenCalledWith("demo@listygifty.com");
    expect(mocks.signInCreate).toHaveBeenCalledWith({ strategy: "ticket", ticket: "ticket-1" });
    expect(mocks.setActive).toHaveBeenCalledWith({ session: "sess_1" });
  });

  it("says so when the email isn't the demo account", async () => {
    mocks.create.mockRejectedValue(new Error("That isn't the demo account email."));

    submit("someone@example.com");

    expect((await screen.findByRole("alert")).textContent).toBe("That isn't the demo account email.");
    expect(mocks.signInCreate).not.toHaveBeenCalled();
  });

  it("signs straight in when the regular sign-in form hands over the demo email", async () => {
    mocks.email = "demo@listygifty.com";
    mocks.create.mockResolvedValue({ ticket: "ticket-1" });
    mocks.signInCreate.mockResolvedValue({ status: "complete", createdSessionId: "sess_1" });

    render(<DemoSignInPage />);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/oauth/authorize?request_token=abc"));
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith("demo@listygifty.com");
  });

  it("waits for a click when the handed-over email isn't the demo account", () => {
    mocks.email = "someone@example.com";

    render(<DemoSignInPage />);

    expect(mocks.create).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");
  });

  it("asks someone already signed in to sign out first", () => {
    mocks.isSignedIn = true;
    render(<DemoSignInPage />);

    expect(screen.getByText(/Sign out first/)).toBeTruthy();
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it("only redirects within the site", () => {
    expect(safeRedirect("/holidays")).toBe("/holidays");
    expect(safeRedirect("//evil.test")).toBe("/dashboard");
    expect(safeRedirect("https://evil.test")).toBe("/dashboard");
    expect(safeRedirect("/\\evil.test")).toBe("/dashboard");
    expect(safeRedirect(null)).toBe("/dashboard");
  });
});
