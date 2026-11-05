import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Holiday } from "@niftygifty/types";
import { GiftNotificationsDialog } from "./GiftNotificationsDialog";

const mocks = vi.hoisted(() => ({ updateNotifications: vi.fn(), toastError: vi.fn() }));

vi.mock("@/services", () => ({ holidaysService: { updateNotifications: mocks.updateNotifications } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.toastError } }));

const holiday = { id: 3, name: "Christmas", gift_notifications: "instant", collaborator_count: 2 } as Holiday;

function openDialog(onUpdated = vi.fn(), list: Holiday = holiday) {
  render(<GiftNotificationsDialog holiday={list} onUpdated={onUpdated} />);
  fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
  return onUpdated;
}

beforeEach(() => {
  mocks.updateNotifications.mockReset();
  mocks.toastError.mockReset();
});

describe("new gift emails setting", () => {
  it("shows your current choice", () => {
    openDialog(vi.fn(), { ...holiday, gift_notifications: "daily" });
    expect(screen.getByRole("radio", { name: /Daily summary/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /Right away/ }).getAttribute("aria-checked")).toBe("false");
  });

  it("saves a new choice and hands back the updated list", async () => {
    const updated = { ...holiday, gift_notifications: "off" } as Holiday;
    mocks.updateNotifications.mockResolvedValue(updated);
    const onUpdated = openDialog();

    fireEvent.click(screen.getByRole("radio", { name: /Off/ }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
    expect(mocks.updateNotifications).toHaveBeenCalledWith(3, "off");
  });

  it("does nothing when you pick the choice you already have", () => {
    openDialog();
    fireEvent.click(screen.getByRole("radio", { name: /Right away/ }));
    expect(mocks.updateNotifications).not.toHaveBeenCalled();
  });

  it("says so when saving fails", async () => {
    mocks.updateNotifications.mockRejectedValue(new Error("Network down"));
    const onUpdated = openDialog();

    fireEvent.click(screen.getByRole("radio", { name: /Daily summary/ }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(onUpdated).not.toHaveBeenCalled();
  });
});
