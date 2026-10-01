import { screenshotServices } from "@/lib/screenshot-mocks";

// The demo exercises the same screens with local, mutable sample records.
// Invitations are simulated: no account, network request, or email is created.
export const demoServices = {
  ...screenshotServices,
  giftExchanges: {
    ...screenshotServices.giftExchanges,
    async nudgeMatch(id: number) {
      await screenshotServices.giftExchanges.getById(id);
    },
  },
  exchangeParticipants: {
    ...screenshotServices.exchangeParticipants,
    async create(exchangeId: number, data: Parameters<typeof screenshotServices.exchangeParticipants.create>[1]) {
      return screenshotServices.exchangeParticipants.create(exchangeId, { ...data, status: "accepted" });
    },
    async resendInvite(exchangeId: number, participantId: number) {
      const exchange = await screenshotServices.giftExchanges.getById(exchangeId);
      const participant = exchange.exchange_participants.find((item) => item.id === participantId);
      if (!participant?.invite_token) throw new Error("Sample invitation not found.");
      await screenshotServices.exchangeInvites.accept(participant.invite_token);
    },
  },
};
