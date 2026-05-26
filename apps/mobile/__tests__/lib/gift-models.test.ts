import type { Gift, GiftStatus, Holiday, Person } from "@niftygifty/types";
import {
  buildCreateGiftPayload,
  buildGiftFormValues,
  buildRepeatGiftCaptureValues,
  filterGifts,
  getNextGiftStatus,
  giftFormHasChanges,
  sortGiftStatuses,
} from "@/lib/models";

function buildHoliday(overrides: Partial<Holiday> = {}): Holiday {
  return {
    id: overrides.id || 1,
    name: overrides.name || "Holiday",
    date: "2026-12-25",
    icon: null,
    is_template: false,
    completed: false,
    archived: false,
    share_token: null,
    is_owner: true,
    role: "owner",
    collaborator_count: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function buildStatus(overrides: Partial<GiftStatus> = {}): GiftStatus {
  return {
    id: overrides.id || 1,
    name: overrides.name || "Ideas",
    position: overrides.position || 1,
    color: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function buildPerson(overrides: Partial<Person> = {}): Person {
  return {
    id: overrides.id || 1,
    name: overrides.name || "Person",
    email: overrides.email || null,
    relationship: overrides.relationship || null,
    age: null,
    gender: null,
    notes: overrides.notes || null,
    default_shipping_address_id: null,
    default_shipping_address: null,
    gift_count: 0,
    user_id: 1,
    is_mine: true,
    is_shared: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function buildGift(overrides: Partial<Gift> = {}): Gift {
  const holiday = buildHoliday({ id: 7 });
  const giftStatus = buildStatus({ id: 3, name: "Purchased" });
  const recipient = buildPerson({ id: 10, name: "Marie" });
  const giver = buildPerson({ id: 11, name: "Kent" });

  return {
    id: overrides.id || 1,
    name: overrides.name || "Nintendo Switch",
    description: overrides.description ?? "OLED model",
    link: overrides.link ?? "https://example.com/switch",
    cost: overrides.cost ?? "299.99",
    holiday_id: holiday.id,
    gift_status_id: giftStatus.id,
    position: 1,
    gift_status: giftStatus,
    holiday,
    recipients: overrides.recipients || [recipient],
    givers: overrides.givers || [giver],
    gift_recipients: [],
    created_by: null,
    is_mine: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("gift model helpers", () => {
  it("buildCreateGiftPayload trims optional values and preserves relationships", () => {
    const payload = buildCreateGiftPayload(
      7,
      {
        name: "  Nintendo Switch  ",
        description: "  OLED model  ",
        link: "  example.com/switch  ",
        cost: " 299.99 ",
        giftStatusId: 3,
        recipientIds: [10],
        giverIds: [11],
      },
      3
    );

    expect(payload).toEqual({
      holiday_id: 7,
      name: "Nintendo Switch",
      description: "OLED model",
      link: "https://example.com/switch",
      cost: 299.99,
      gift_status_id: 3,
      recipient_ids: [10],
      giver_ids: [11],
    });
  });

  it("treats reordered relationships as unchanged when detecting edits", () => {
    const gift = buildGift({
      recipients: [buildPerson({ id: 2, name: "Alice" }), buildPerson({ id: 1, name: "Bob" })],
      givers: [buildPerson({ id: 5, name: "Sam" }), buildPerson({ id: 4, name: "Lee" })],
    });

    const form = buildGiftFormValues(gift);
    form.recipientIds = [1, 2];
    form.giverIds = [4, 5];

    expect(giftFormHasChanges(gift, form)).toBe(false);
  });

  it("clears gift details but keeps capture context for repeat entry", () => {
    const nextForm = buildRepeatGiftCaptureValues({
      name: "Puzzle",
      description: "1000 pieces",
      link: "https://example.com/puzzle",
      cost: "19.99",
      giftStatusId: 3,
      recipientIds: [10],
      giverIds: [11],
    });

    expect(nextForm).toEqual({
      name: "",
      description: "",
      link: "",
      cost: "",
      giftStatusId: 3,
      recipientIds: [10],
      giverIds: [11],
    });
  });

  it("filters gifts by search text and selected statuses", () => {
    const gifts = [
      buildGift({ id: 1, name: "Switch", recipients: [buildPerson({ id: 1, name: "Marie" })] }),
      buildGift({
        id: 2,
        name: "Coffee Beans",
        gift_status_id: 9,
        recipients: [buildPerson({ id: 2, name: "Alex" })],
      }),
    ];

    expect(
      filterGifts(gifts, {
        search: "marie",
        statusIds: [],
      }).map((gift) => gift.id)
    ).toEqual([1]);

    expect(
      filterGifts(gifts, {
        search: "",
        statusIds: [9],
      }).map((gift) => gift.id)
    ).toEqual([2]);
  });

  it("sorts gift statuses by position and name", () => {
    const statuses = [
      buildStatus({ id: 2, name: "Wrapped", position: 3 }),
      buildStatus({ id: 1, name: "Purchased", position: 2 }),
      buildStatus({ id: 3, name: "Idea", position: 1 }),
    ];

    expect(sortGiftStatuses(statuses).map((status) => status.name)).toEqual([
      "Idea",
      "Purchased",
      "Wrapped",
    ]);
  });

  it("finds the next gift status for quick status changes", () => {
    const statuses = [
      buildStatus({ id: 1, name: "Idea", position: 1 }),
      buildStatus({ id: 2, name: "Purchased", position: 2 }),
      buildStatus({ id: 3, name: "Wrapped", position: 3 }),
    ];

    expect(getNextGiftStatus(buildGift({ gift_status_id: 1 }), statuses)?.name).toBe(
      "Purchased"
    );
    expect(getNextGiftStatus(buildGift({ gift_status_id: 3 }), statuses)).toBeNull();
  });
});
