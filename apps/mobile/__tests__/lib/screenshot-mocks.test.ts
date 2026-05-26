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
});
