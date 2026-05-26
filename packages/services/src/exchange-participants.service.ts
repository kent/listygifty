import type { ApiClient } from "@niftygifty/api-client";
import type {
  CreateExchangeParticipantRequest,
  ExchangeParticipant,
} from "@niftygifty/types";

export interface ExchangeParticipantsService {
  create(
    exchangeId: number,
    data: CreateExchangeParticipantRequest["exchange_participant"]
  ): Promise<ExchangeParticipant>;
}

export function createExchangeParticipantsService(
  client: ApiClient
): ExchangeParticipantsService {
  return {
    create(exchangeId, data) {
      return client.post<ExchangeParticipant>(
        `/gift_exchanges/${exchangeId}/exchange_participants`,
        { exchange_participant: data }
      );
    },
  };
}
