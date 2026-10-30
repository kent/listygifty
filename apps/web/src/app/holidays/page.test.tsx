import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
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
});
