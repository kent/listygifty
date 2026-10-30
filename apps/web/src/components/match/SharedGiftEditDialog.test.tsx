import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Gift, Person } from "@niftygifty/types";
import { giftsService } from "@/services";
import { darkOnlyClasses } from "@/test/dark-only";
import { SharedGiftEditDialog } from "./SharedGiftEditDialog";
import { skipTopLayerCheck } from "./skip-top-layer-check";

vi.mock("@/services", () => ({
  giftsService: { update: vi.fn() },
  peopleService: { create: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const people = [{ id: 7, name: "Alex" }, { id: 8, name: "Sam" }, { id: 9, name: "Priya" }] as Person[];
const gift = {
  id: 1,
  name: "Lego set",
  description: "The big one",
  link: "https://example.com/lego",
  cost: "40.00",
  gift_status: { name: "Idea" },
  recipients: [{ id: 7 }, { id: 8 }],
  givers: [{ id: 7 }],
} as unknown as Gift;

// Radix Popover and cmdk measure and scroll; jsdom implements neither.
beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
beforeEach(skipTopLayerCheck);

function renderDialog(overrides: Partial<Gift> = {}) {
  render(
    <SharedGiftEditDialog
      gift={{ ...gift, ...overrides }}
      people={people}
      open
      onOpenChange={vi.fn()}
      onGiftUpdated={vi.fn()}
      onPersonCreated={vi.fn()}
    />
  );
}

// MatchWorkspace never opens this dialog from inside. It sets a gift and `open`
// follows from that, so Radix's onOpenChange does not fire on the way in.
function openLikeTheParent(openGift: Gift = gift) {
  const props = { people, onOpenChange: vi.fn(), onGiftUpdated: vi.fn(), onPersonCreated: vi.fn() };
  const view = render(<SharedGiftEditDialog {...props} gift={null} open={false} />);
  view.rerender(<SharedGiftEditDialog {...props} gift={openGift} open />);
  return { ...view, props };
}

const To = "To (Recipients)";
const From = "From (Givers)";

function pickerCell(picker: string) {
  return within(screen.getByRole("combobox", { name: picker }).parentElement!);
}

function chosen(picker: string) {
  return pickerCell(picker)
    .queryAllByRole("button", { name: /^Remove / })
    .map((chip) => chip.getAttribute("aria-label"));
}

function pick(picker: string, personName: string) {
  fireEvent.click(screen.getByRole("combobox", { name: picker }));
  fireEvent.click(screen.getByRole("option", { name: personName }));
}

describe("shared gift dialog", () => {
  it("names both people pickers from their visible labels", () => {
    renderDialog();
    expect(screen.getByRole("combobox", { name: "To (Recipients)" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "From (Givers)" })).toBeTruthy();
  });

  it("connects every label to a control", () => {
    renderDialog();
    const labels = [...screen.getByRole("dialog").querySelectorAll("label")];
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label.control).toBeTruthy();
    }
  });

  it("shows no em dash when a gift has no cost", () => {
    renderDialog({ cost: null } as Partial<Gift>);
    expect(screen.getByRole("dialog").textContent).not.toContain("—");
  });

  it("uses no dark-only colours", () => {
    renderDialog();
    expect(darkOnlyClasses(document.body)).toEqual([]);
  });

  describe("opened through the prop, as MatchWorkspace does", () => {
    it("shows the gift's existing recipients and givers", () => {
      openLikeTheParent();
      expect(chosen(To)).toEqual(["Remove Alex", "Remove Sam"]);
      expect(chosen(From)).toEqual(["Remove Alex"]);
    });

    it("keeps the existing recipients when one more is picked", async () => {
      vi.mocked(giftsService.update).mockResolvedValue(gift);
      openLikeTheParent();
      pick(To, "Priya");
      await waitFor(() => expect(giftsService.update).toHaveBeenCalled());
      expect(giftsService.update).toHaveBeenCalledExactlyOnceWith(1, { recipient_ids: [7, 8, 9] });
    });

    it("keeps the existing givers when one more is picked", async () => {
      vi.mocked(giftsService.update).mockResolvedValue(gift);
      openLikeTheParent();
      pick(From, "Sam");
      await waitFor(() => expect(giftsService.update).toHaveBeenCalled());
      expect(giftsService.update).toHaveBeenCalledExactlyOnceWith(1, { giver_ids: [7, 8] });
    });

    it("only drops the person who was removed", async () => {
      vi.mocked(giftsService.update).mockResolvedValue(gift);
      openLikeTheParent();
      fireEvent.click(pickerCell(To).getByRole("button", { name: "Remove Sam" }));
      await waitFor(() => expect(giftsService.update).toHaveBeenCalled());
      expect(giftsService.update).toHaveBeenCalledExactlyOnceWith(1, { recipient_ids: [7] });
    });

    it("keeps a recipient the people list doesn't include", async () => {
      vi.mocked(giftsService.update).mockResolvedValue(gift);
      openLikeTheParent({ ...gift, recipients: [{ id: 7 }, { id: 99 }] } as unknown as Gift);
      pick(To, "Priya");
      await waitFor(() => expect(giftsService.update).toHaveBeenCalled());
      expect(giftsService.update).toHaveBeenCalledExactlyOnceWith(1, { recipient_ids: [7, 99, 9] });
    });

    it("loads each gift's own people when the parent switches gifts", () => {
      const other = { ...gift, id: 2, recipients: [{ id: 9 }], givers: [{ id: 8 }] } as unknown as Gift;
      const { rerender, props } = openLikeTheParent();
      expect(chosen(To)).toEqual(["Remove Alex", "Remove Sam"]);

      rerender(<SharedGiftEditDialog {...props} gift={other} open />);
      expect(chosen(To)).toEqual(["Remove Priya"]);
      expect(chosen(From)).toEqual(["Remove Sam"]);
    });

    it("reloads from the gift when it is closed and opened again", async () => {
      vi.mocked(giftsService.update).mockResolvedValue(gift);
      const { rerender, props } = openLikeTheParent();
      pick(To, "Priya");
      await waitFor(() => expect(giftsService.update).toHaveBeenCalled());

      rerender(<SharedGiftEditDialog {...props} gift={null} open={false} />);
      const saved = { ...gift, recipients: [{ id: 7 }, { id: 9 }] } as unknown as Gift;
      rerender(<SharedGiftEditDialog {...props} gift={saved} open />);
      expect(chosen(To)).toEqual(["Remove Alex", "Remove Priya"]);
    });

    it("shows the read-only details straight from the gift", () => {
      openLikeTheParent();
      const dialog = within(screen.getByRole("dialog"));
      expect(dialog.getByText("Lego set")).toBeTruthy();
      expect(dialog.getByText("The big one")).toBeTruthy();
      expect(dialog.getByText("$40")).toBeTruthy();
      expect(dialog.getByText("Idea")).toBeTruthy();
      expect(dialog.getByRole("link", { name: "View link" }).getAttribute("href")).toBe("https://example.com/lego");
    });
  });
});
