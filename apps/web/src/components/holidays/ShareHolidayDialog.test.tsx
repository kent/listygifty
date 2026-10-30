import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Holiday, HolidayCollaborator } from "@niftygifty/types";
import { darkOnlyClasses } from "@/test/dark-only";
import { ShareHolidayDialog } from "./ShareHolidayDialog";

const mocks = vi.hoisted(() => ({ getShareLink: vi.fn(), getCollaborators: vi.fn() }));

vi.mock("@/services", () => ({ holidaysService: mocks }));

const holiday = { id: 3, name: "Christmas" } as Holiday;
const collaborators = [
  { user_id: 1, email: "kent@example.com", first_name: "Kent", last_name: null, image_url: null, role: "owner" },
  { user_id: 2, email: "sam@example.com", first_name: "Sam", last_name: null, image_url: null, role: "collaborator" },
] as HolidayCollaborator[];

async function openDialog() {
  render(<ShareHolidayDialog holiday={holiday} />);
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  await screen.findByText("Sam");
}

beforeEach(() => {
  mocks.getShareLink.mockReset().mockResolvedValue({ share_url: "https://listygifty.test/join/abc" });
  mocks.getCollaborators.mockReset().mockResolvedValue(collaborators);
});

describe("share gift list dialog", () => {
  it("connects the Share Link label to the link", async () => {
    await openDialog();
    const link = screen.getByLabelText("Share Link") as HTMLInputElement;
    expect(link.value).toBe("https://listygifty.test/join/abc");
  });

  it("names its icon buttons", async () => {
    await openDialog();
    expect(screen.getByRole("button", { name: "Copy share link" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Regenerate share link" })).toBeTruthy();
  });

  it("says who each Remove button acts on", async () => {
    await openDialog();
    expect(screen.getByRole("button", { name: "Remove Sam" })).toBeTruthy();
  });

  it("uses no dark-only colours", async () => {
    await openDialog();
    expect(darkOnlyClasses(document.body)).toEqual([]);
  });
});
