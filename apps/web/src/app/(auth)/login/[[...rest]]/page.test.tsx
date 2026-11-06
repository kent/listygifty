import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

type Attempt = { id?: string | null; identifier?: string | null };

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  signIn: { id: null, identifier: null } as Attempt,
}));

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@clerk/nextjs", () => ({ useSignIn: () => ({ signIn: mocks.signIn }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams({ redirect_url: "/oauth/authorize?request_token=abc" }),
}));
vi.mock("@/services", () => ({
  AUTH_ROUTES: { signIn: "/login", signUp: "/signup", afterSignIn: "/dashboard" },
}));

const DEMO_PATH = "/login/demo?redirect_url=%2Foauth%2Fauthorize%3Frequest_token%3Dabc&email=demo%40listygifty.com";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signIn = { id: null, identifier: null };
});

function typeIntoSignIn(rerender: (ui: React.ReactElement) => void, attempt: Attempt) {
  mocks.signIn = attempt;
  rerender(<LoginPage />);
}

describe("login page", () => {
  it("sends someone who types the demo email into the regular form to the demo sign-in", () => {
    const { rerender } = render(<LoginPage />);

    typeIntoSignIn(rerender, { id: "sia_1", identifier: " Demo@ListyGifty.com " });

    expect(mocks.replace).toHaveBeenCalledWith(DEMO_PATH);
  });

  it("leaves other emails to the regular sign-in", () => {
    const { rerender } = render(<LoginPage />);

    typeIntoSignIn(rerender, { id: "sia_1", identifier: "kent@example.com" });

    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("ignores a demo attempt left over from before the page loaded", () => {
    mocks.signIn = { id: "sia_old", identifier: "demo@listygifty.com" };
    const { rerender } = render(<LoginPage />);

    rerender(<LoginPage />);

    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("links to the demo sign-in and keeps where the reviewer was going", () => {
    render(<LoginPage />);

    const link = screen.getByRole("link", { name: "Reviewing Listy Gifty? Use the demo account" });
    expect(link.getAttribute("href")).toBe("/login/demo?redirect_url=%2Foauth%2Fauthorize%3Frequest_token%3Dabc");
  });
});
