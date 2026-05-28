jest.mock("@/lib/api", () => ({
  exchangeInvitesService: {},
  giftStatusesService: {},
  giftsService: {},
}));

import { screenshotServices } from "@/lib/screenshot-mocks";

describe("screenshot mocks", () => {
  it("seeds an active exchange with a reviewer match and participant list", async () => {
    const exchange = await screenshotServices.giftExchanges.getById(301);

    expect(exchange.name).toBe("Family Secret Santa");
    expect(exchange.exchange_participants).toHaveLength(8);
    expect(exchange.my_participant?.display_name).toBe("Marie");
    expect(exchange.my_participant?.matched_participant?.display_name).toBe("Sam Lee");
  });

  it("seeds wishlist items for the screenshot match reveal", async () => {
    const items = await screenshotServices.wishlistItems.getAll(301, 402);

    expect(items).toHaveLength(3);
    expect(items[0]?.name).toBe("Ceramic pour-over set");
  });

  it("seeds list detail dependencies without calling live services", async () => {
    const [holiday, gifts, statuses, collaborators] = await Promise.all([
      screenshotServices.holidays.getById(201),
      screenshotServices.gifts.getAll({ holidayId: 201 }),
      screenshotServices.giftStatuses.getAll(),
      screenshotServices.holidays.getCollaborators(201),
    ]);

    expect(holiday.name).toBe("Birthday Bash 2026");
    expect(gifts[0]?.name).toBe("Noise-cancelling headphones");
    expect(gifts[0]?.gift_status.name).toBe("Idea");
    expect(statuses.map((status) => status.name)).toContain("Purchased");
    expect(collaborators).toHaveLength(2);
  });

  it("seeds public exchange invite details", async () => {
    const invite = await screenshotServices.exchangeInvites.getByToken("review-riley-301");

    expect(invite.exchange.name).toBe("Family Secret Santa");
    expect(invite.participant.email).toBe("riley.chen@gifts.com");
    expect(invite.participant.status).toBe("invited");
  });
});
