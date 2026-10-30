import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import NewExchangePage from "./page";

const mocks = vi.hoisted(() => ({ push: vi.fn(), create: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: null, signOut: vi.fn() }),
}));
vi.mock("@/components/layout", () => ({ AppHeader: () => null }));
// Radix's checkbox needs ResizeObserver, which jsdom doesn't have.
vi.mock("@/components/ui/checkbox", () => ({ Checkbox: () => null }));
vi.mock("@/services", () => ({ giftExchangesService: { create: mocks.create } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function submit() {
  render(<NewExchangePage />);
  fireEvent.submit(screen.getByLabelText("Exchange Name *").closest("form") as HTMLFormElement);
}

beforeEach(() => {
  mocks.push.mockReset();
  mocks.create.mockReset();
});

describe("creating an exchange", () => {
  it("says why when the budget doesn't add up", async () => {
    const message = "Budget max must be greater than or equal to minimum budget";
    mocks.create.mockRejectedValue(new ApiError(422, { errors: [message] }));
    submit();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("lists every problem the API found", async () => {
    mocks.create.mockRejectedValue(new ApiError(422, { errors: ["Name can't be blank", "Budget min must be greater than or equal to 0"] }));
    submit();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Name can't be blank, Budget min must be greater than or equal to 0"));
  });

  it("doesn't print raw server errors", async () => {
    mocks.create.mockRejectedValue(new ApiError(500, { error: "PG::Error" }));
    submit();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The server hit a snag. Try again in a moment."));
  });

  it("opens the exchange once it's created", async () => {
    mocks.create.mockResolvedValue({ name: "Family Christmas", slug: "family-christmas" });
    submit();

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/exchanges/family-christmas"));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
