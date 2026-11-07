import { apiClient } from "@/lib/api-client";
import type {
  ExchangeParticipant,
  CreateExchangeParticipantRequest,
  UpdateExchangeParticipantRequest,
  NudgeExchangeParticipantRequest,
  NudgeExchangeParticipantResponse,
} from "@niftygifty/types";

class ExchangeParticipantsService {
  async getAll(exchangeId: number): Promise<ExchangeParticipant[]> {
    return apiClient.get<ExchangeParticipant[]>(
      `/gift_exchanges/${exchangeId}/exchange_participants`
    );
  }

  async getById(exchangeId: number, participantId: number): Promise<ExchangeParticipant> {
    return apiClient.get<ExchangeParticipant>(
      `/gift_exchanges/${exchangeId}/exchange_participants/${participantId}`
    );
  }

  async create(
    exchangeId: number,
    data: CreateExchangeParticipantRequest["exchange_participant"]
  ): Promise<ExchangeParticipant> {
    return apiClient.post<ExchangeParticipant>(
      `/gift_exchanges/${exchangeId}/exchange_participants`,
      { exchange_participant: data }
    );
  }

  async update(
    exchangeId: number,
    participantId: number,
    data: UpdateExchangeParticipantRequest["exchange_participant"]
  ): Promise<ExchangeParticipant> {
    return apiClient.patch<ExchangeParticipant>(
      `/gift_exchanges/${exchangeId}/exchange_participants/${participantId}`,
      { exchange_participant: data }
    );
  }

  async delete(exchangeId: number, participantId: number): Promise<void> {
    return apiClient.delete(
      `/gift_exchanges/${exchangeId}/exchange_participants/${participantId}`
    );
  }

  async resendInvite(exchangeId: number, participantId: number): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>(
      `/gift_exchanges/${exchangeId}/exchange_participants/${participantId}/resend_invite`
    );
  }

  async nudge(
    exchangeId: number,
    participantId: number,
    details: NudgeExchangeParticipantRequest["exchange_participant"]
  ): Promise<NudgeExchangeParticipantResponse> {
    return apiClient.post<NudgeExchangeParticipantResponse>(
      `/gift_exchanges/${exchangeId}/exchange_participants/${participantId}/nudge`,
      { exchange_participant: details }
    );
  }
}

export const exchangeParticipantsService = new ExchangeParticipantsService();
