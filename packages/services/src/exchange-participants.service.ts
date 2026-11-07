import type { ApiClient } from "@niftygifty/api-client";
import type {
  CreateExchangeParticipantRequest,
  ExchangeParticipant,
  NudgeExchangeParticipantRequest,
  NudgeExchangeParticipantResponse,
} from "@niftygifty/types";

export interface ExchangeParticipantsService {
  resendInvite(exchangeId: number, participantId: number): Promise<void>;
  nudge(
    exchangeId: number,
    participantId: number,
    details?: NudgeExchangeParticipantRequest["exchange_participant"]
  ): Promise<NudgeExchangeParticipantResponse>;
  create(
    exchangeId: number,
    data: CreateExchangeParticipantRequest["exchange_participant"]
  ): Promise<ExchangeParticipant>;
}

export function createExchangeParticipantsService(
  client: ApiClient
): ExchangeParticipantsService {
  return {
    async resendInvite(exchangeId, participantId) {
      await client.post(`/gift_exchanges/${exchangeId}/exchange_participants/${participantId}/resend_invite`);
    },
    nudge(exchangeId, participantId, details) {
      return client.post<NudgeExchangeParticipantResponse>(
        `/gift_exchanges/${exchangeId}/exchange_participants/${participantId}/nudge`,
        details ? { exchange_participant: details } : {}
      );
    },
    create(exchangeId, data) {
      return client.post<ExchangeParticipant>(
        `/gift_exchanges/${exchangeId}/exchange_participants`,
        { exchange_participant: data }
      );
    },
  };
}
