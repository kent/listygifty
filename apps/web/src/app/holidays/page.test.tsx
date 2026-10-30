import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import HolidaysPage from "./page";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  create: vi.fn(),
  search: "section=new",
  setData: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock("@/services", () => ({ holidaysService: { create: mocks.create } }));
vi.mock("@/hooks", () => ({
  useWorkspaceData: () => ({
    data: { holidays: [], templates: [] },
    setData: mocks.setData,
    error: null,
    user: null,
    signOut: vi.fn(),
  }),
}));
vi.mock("@/components/layout", () => ({ AppHeader: () => null }));
vi.mock("@/components/holidays", () => ({ HolidaysNav: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  mocks.push.mockReset();
  mocks.setData.mockReset();
  mocks.search = "section=new";
  mocks.create.mockReset().mockResolvedValue({ id: 42, name: "Mom's Birthday" });
});

describe("creating a gift list", () => {
  it("opens the new list after the custom form is submitted", async () => {
    render(<HolidaysPage />);
    fireEvent.click(screen.getByRole("button", { name: /Custom Holiday/ }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Mom's Birthday" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-12-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/holidays/42"));
    expect(toast.success).toHaveBeenCalledWith('Created "Mom\'s Birthday"');
  });

  it("opens the new list after a one-tap suggestion from the empty state", async () => {
    mocks.search = "";
    render(<HolidaysPage />);
    const suggestion = await screen.findByRole("button", { name: /Coming up/ });
    fireEvent.click(suggestion);

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/holidays/42"));
    expect(toast.success).toHaveBeenCalled();
  });

  describe("when the list can't be created", () => {
    function submitCustomForm() {
      render(<HolidaysPage />);
      fireEvent.click(screen.getByRole("button", { name: /Custom Holiday/ }));
      fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Mom's Birthday" } });
      fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-12-01" } });
      fireEvent.click(screen.getByRole("button", { name: "Create" }));
    }

    it("shows what went wrong in a toast", async () => {
      mocks.create.mockRejectedValue(new ApiError(0, { error: "Request timeout after 30000ms" }));
      submitCustomForm();

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't reach the server. Check your connection and try again."));
      expect(mocks.push).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("keeps the form and what was typed so it can be tried again", async () => {
      mocks.create.mockRejectedValue(new ApiError(422, { errors: ["Name is too long"] }));
      submitCustomForm();

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Name is too long"));
      expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Mom's Birthday");
      await waitFor(() => expect((screen.getByRole("button", { name: "Create" }) as HTMLButtonElement).disabled).toBe(false));
    });

    it("shows a toast for a one-tap suggestion too", async () => {
      mocks.search = "";
      mocks.create.mockRejectedValue(new ApiError(503, undefined));
      render(<HolidaysPage />);
      fireEvent.click(await screen.findByRole("button", { name: /Coming up/ }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The server hit a snag. Try again in a moment."));
      expect(mocks.push).not.toHaveBeenCalled();
    });
  });
});
