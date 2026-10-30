import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Gift, MatchArrangement, Person } from "@niftygifty/types";
import { giftsService } from "@/services";
import { darkOnlyClasses } from "@/test/dark-only";
import { MatchWorkspace } from "./MatchWorkspace";
import { skipTopLayerCheck } from "./skip-top-layer-check";

vi.mock("@/services", () => ({
  giftsService: { update: vi.fn() },
  peopleService: { create: vi.fn() },
  matchArrangementsService: { create: vi.fn(), update: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const people = [
  { id: 7, name: "Alex" },
  { id: 8, name: "Sam" },
  { id: 9, name: "Priya" },
] as Person[];

const sharedGift = {
  id: 1,
  name: "Board game",
  description: null,
  link: null,
  cost: "40.00",
  gift_status: { name: "Idea" },
  recipients: [{ id: 7, name: "Alex" }, { id: 8, name: "Sam" }],
  givers: [{ id: 9, name: "Priya" }],
} as unknown as Gift;

const arrangement = {
  id: 3,
  person_ids: [7, 8],
  slots: [],
  groupings: [],
} as unknown as MatchArrangement;

// Radix Popover and cmdk measure and scroll; jsdom implements neither.
beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
beforeEach(skipTopLayerCheck);

function renderWorkspace(gifts: Gift[] = [sharedGift], current: MatchArrangement = arrangement) {
  render(
    <MatchWorkspace
      holidayId={1}
      gifts={gifts}
      people={people}
      statuses={[]}
      arrangement={current}
      onArrangementChange={vi.fn()}
      onGiftsChange={vi.fn()}
      onPeopleChange={vi.fn()}
    />
  );
}

function giftFor(id: number, name: string, person: Person) {
  return { ...sharedGift, id, name, recipients: [person], givers: [] } as unknown as Gift;
}

const [alex, sam] = people;

// A shared gift, plus a gift and a group both placed in a slot and left in the pool.
const everyGift = [
  sharedGift,
  giftFor(2, "Lego", alex),
  giftFor(3, "Socks", sam),
  giftFor(4, "Mug", sam),
  giftFor(5, "Book", alex),
  giftFor(6, "Pen", alex),
  giftFor(10, "Scarf", alex),
];

const fullArrangement = {
  ...arrangement,
  slots: [
    { id: 1, person_id: 7, gift_id: 2, group_key: null, row_index: 0 },
    { id: 2, person_id: 8, gift_id: null, group_key: "placed", row_index: 0 },
  ],
  groupings: [
    { id: "placed", label: "Sam bundle", person_id: 8, gift_ids: [3, 4] },
    { id: "pooled", label: "Alex bundle", person_id: 7, gift_ids: [5, 6] },
  ],
} as unknown as MatchArrangement;

// Drop targets, drag states and the drag overlay only exist mid-drag, and hover
// classes never reach the DOM check, so read the classes from the source as well.
function classesInSource(file: string) {
  return readFileSync(join(__dirname, `${file}.tsx`), "utf8")
    .split(/[\s"'`]+/)
    .map((token) => token.replace(/^hover:/, ""));
}

// darkOnlyClasses stops at -400 for some hues. Any pale accent fails on white.
const PALE_ACCENT = /^text-(violet|fuchsia|amber|red)-[1-4]00$/;

describe("in the light Apple theme", () => {
  it("uses no dark-only colours with every kind of item on screen", () => {
    renderWorkspace(everyGift, fullArrangement);
    expect(screen.getByText("Scarf")).toBeTruthy();
    expect(screen.getByText("Sam bundle")).toBeTruthy();
    expect(darkOnlyClasses(document.body)).toEqual([]);
  });

  it("uses no dark-only colours before two people are chosen", () => {
    renderWorkspace([], { ...arrangement, person_ids: [7] } as MatchArrangement);
    expect(screen.getByText("Select at least 2 people to start matching gifts")).toBeTruthy();
    expect(darkOnlyClasses(document.body)).toEqual([]);
  });

  it("uses no dark-only colours in the manage group dialog", () => {
    renderWorkspace(everyGift, fullArrangement);
    fireEvent.click(screen.getByText("Sam bundle"));
    expect(within(screen.getByRole("dialog")).getByText("Socks")).toBeTruthy();
    expect(darkOnlyClasses(document.body)).toEqual([]);
  });

  it("uses no dark-only colours in the add gift dialog", () => {
    renderWorkspace(everyGift, fullArrangement);
    fireEvent.click(screen.getByRole("button", { name: "+ Add Gift for Alex" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(darkOnlyClasses(document.body)).toEqual([]);
  });

  it.each(["MatchWorkspace", "DroppableSlot", "DraggableGift", "GroupManageModal"])(
    "%s has no dark-only colour in any state",
    (file) => {
      const classes = classesInSource(file);
      const holder = document.createElement("div");
      holder.append(Object.assign(document.createElement("div"), { className: classes.join(" ") }));

      expect(darkOnlyClasses(holder)).toEqual([]);
      expect(classes.filter((name) => PALE_ACCENT.test(name))).toEqual([]);
    }
  );
});

describe("editing a shared gift from the workspace", () => {
  it("opens with the gift's people and keeps them on save", async () => {
    vi.mocked(giftsService.update).mockResolvedValue(sharedGift);
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: /Board game/ }));

    const toPicker = screen.getByRole("combobox", { name: "To (Recipients)" });
    const fromPicker = screen.getByRole("combobox", { name: "From (Givers)" });
    expect(within(toPicker.parentElement!).getByRole("button", { name: "Remove Alex" })).toBeTruthy();
    expect(within(toPicker.parentElement!).getByRole("button", { name: "Remove Sam" })).toBeTruthy();
    expect(within(fromPicker.parentElement!).getByRole("button", { name: "Remove Priya" })).toBeTruthy();

    fireEvent.click(toPicker);
    fireEvent.click(screen.getByRole("option", { name: "Priya" }));

    await waitFor(() => expect(giftsService.update).toHaveBeenCalled());
    expect(giftsService.update).toHaveBeenCalledExactlyOnceWith(1, { recipient_ids: [7, 8, 9] });
  });
});
