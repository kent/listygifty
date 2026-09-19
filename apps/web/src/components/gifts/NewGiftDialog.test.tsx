import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Gift, GiftStatus, Person } from "@niftygifty/types";
import { NewGiftDialog } from "./NewGiftDialog";
import { giftsService } from "@/services";

vi.mock("@/services", () => ({ giftsService: { create: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("./PeopleCell", () => ({
  PeopleCell: ({ id, selectedIds, onChange }: { id: string; selectedIds: number[]; onChange: (ids: number[]) => void }) => (
    <select id={id} value={selectedIds[0] ?? ""} onChange={(event) => onChange(event.target.value ? [Number(event.target.value)] : [])}>
      <option value="">Choose people (optional)</option><option value="7">Alex</option><option value="8">Sam</option>
    </select>
  ),
}));

const created = { id: 10, name: "Book" } as Gift;
const props = {
  open: true, onOpenChange: vi.fn(), holidayId: 5,
  statuses: [{ id: 1, name: "Idea" }, { id: 2, name: "Purchased" }] as GiftStatus[],
  people: [{ id: 7, name: "Alex" }] as Person[],
  onGiftCreated: vi.fn(), onPersonCreated: vi.fn(),
};

function enterDetails(name = "Book") {
  fireEvent.change(screen.getByLabelText("Gift name"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
}

beforeEach(() => { vi.mocked(giftsService.create).mockReset().mockResolvedValue(created); });

describe("quick gift capture", () => {
  it("opens with only the name, rejects whitespace, and advances without creating a placeholder", () => {
    render(<NewGiftDialog {...props} />);
    expect(screen.getByLabelText("Gift name")).toBe(document.activeElement);
    expect(screen.queryByText("Who is it for?")).toBeNull();
    fireEvent.change(screen.getByLabelText("Gift name"), { target: { value: "   " } });
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
    enterDetails();
    expect(screen.getByText("Who is it for?")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Advanced/ }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("textbox", { name: "Notes" })).toBeNull();
    expect(giftsService.create).not.toHaveBeenCalled();
  });

  it("saves a name-only idea with the default list and status", async () => {
    render(<NewGiftDialog {...props} position={3} />);
    enterDetails("  Book  ");
    fireEvent.click(screen.getByRole("button", { name: "Add Gift" }));
    await waitFor(() => expect(props.onGiftCreated).toHaveBeenCalledWith(created));
    expect(giftsService.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Book", holiday_id: 5, gift_status_id: 1, position: 3, recipient_ids: [] }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("preserves recipient, status, and advanced values when going back and saves them", async () => {
    render(<NewGiftDialog {...props} />);
    enterDetails();
    fireEvent.change(screen.getByLabelText("Who is it for?"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Purchased" }));
    fireEvent.click(screen.getByRole("button", { name: /Advanced/ }));
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Hardcover" } });
    fireEvent.change(screen.getByLabelText("Link"), { target: { value: "example.com/book" } });
    fireEvent.change(screen.getByLabelText("Cost"), { target: { value: "24.50" } });
    fireEvent.change(screen.getByLabelText("From (Givers)"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect((screen.getByLabelText("Gift name") as HTMLInputElement).value).toBe("Book");
    enterDetails("Better book");
    fireEvent.click(screen.getByRole("button", { name: /Advanced/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add Gift" }));
    await waitFor(() => expect(giftsService.create).toHaveBeenCalledWith(expect.objectContaining({
      name: "Better book", recipient_ids: [7], giver_ids: [8], gift_status_id: 2,
      description: "Hardcover", link: "https://example.com/book", cost: 24.5,
    })));
  });

  it("starts the next gift with a blank focused name and retains recipient and status", async () => {
    render(<NewGiftDialog {...props} initialRecipientIds={[7]} defaultStatusId={2} />);
    enterDetails();
    fireEvent.click(screen.getByRole("button", { name: "Save & Add Another" }));
    await waitFor(() => expect(screen.getByLabelText("Gift name")).toBe(document.activeElement));
    expect((screen.getByLabelText("Gift name") as HTMLInputElement).value).toBe("");
    enterDetails("Game");
    expect((screen.getByLabelText("Who is it for?") as HTMLSelectElement).value).toBe("7");
    expect(screen.getByRole("button", { name: "Purchased" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Advanced/ }).getAttribute("aria-expanded")).toBe("false");
  });

  it("prevents duplicate saves while a request is pending", async () => {
    let resolve!: (gift: Gift) => void;
    vi.mocked(giftsService.create).mockReturnValue(new Promise((res) => { resolve = res; }));
    render(<NewGiftDialog {...props} />);
    enterDetails();
    fireEvent.click(screen.getByRole("button", { name: "Add Gift" }));
    fireEvent.click(screen.getByRole("button", { name: "Save & Add Another" }));
    expect(giftsService.create).toHaveBeenCalledTimes(1);
    await act(async () => resolve(created));
  });

  it("keeps the draft after a failed save and lets the user retry", async () => {
    vi.mocked(giftsService.create).mockRejectedValueOnce(new Error("offline"));
    render(<NewGiftDialog {...props} />);
    enterDetails();
    fireEvent.click(screen.getByRole("button", { name: "Add Gift" }));
    await screen.findByRole("alert");
    expect(props.onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add Gift" }));
    await waitFor(() => expect(props.onGiftCreated).toHaveBeenCalledWith(created));
  });

  it("cancels without creating and resets the draft when reopened", () => {
    const view = render(<NewGiftDialog {...props} />);
    fireEvent.change(screen.getByLabelText("Gift name"), { target: { value: "Unfinished" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(giftsService.create).not.toHaveBeenCalled();
    view.rerender(<NewGiftDialog {...props} open={false} />);
    view.rerender(<NewGiftDialog {...props} />);
    expect((screen.getByLabelText("Gift name") as HTMLInputElement).value).toBe("");
  });

  it("reveals invalid cost even if Advanced was collapsed", async () => {
    render(<NewGiftDialog {...props} />);
    enterDetails();
    fireEvent.click(screen.getByRole("button", { name: /Advanced/ }));
    fireEvent.change(screen.getByLabelText("Cost"), { target: { value: "oops" } });
    fireEvent.click(screen.getByRole("button", { name: /Advanced/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add Gift" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Advanced/ }).getAttribute("aria-expanded")).toBe("true");
    expect(giftsService.create).not.toHaveBeenCalled();
  });
});
