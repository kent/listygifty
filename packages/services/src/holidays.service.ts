import type { ApiClient } from "@niftygifty/api-client";
import type {
  Holiday,
  CreateHolidayRequest,
  ShareLinkResponse,
  HolidayCollaborator,
  GiftNotificationSetting,
} from "@niftygifty/types";

export interface HolidaysService {
  getAll(): Promise<Holiday[]>;
  getTemplates(): Promise<Holiday[]>;
  getById(id: number): Promise<Holiday>;
  create(data: CreateHolidayRequest["holiday"]): Promise<Holiday>;
  update(id: number, data: Partial<CreateHolidayRequest["holiday"]>): Promise<Holiday>;
  delete(id: number): Promise<void>;
  getShareLink(id: number): Promise<ShareLinkResponse>;
  regenerateShareLink(id: number): Promise<ShareLinkResponse>;
  join(shareToken: string): Promise<Holiday>;
  leave(id: number): Promise<void>;
  getCollaborators(id: number): Promise<HolidayCollaborator[]>;
  removeCollaborator(holidayId: number, userId: number): Promise<void>;
  /** Changes only your own setting for this list. */
  updateNotifications(id: number, giftNotifications: GiftNotificationSetting): Promise<Holiday>;
}

export function createHolidaysService(client: ApiClient): HolidaysService {
  return {
    getAll() {
      return client.get<Holiday[]>("/holidays");
    },

    getTemplates() {
      return client.get<Holiday[]>("/holidays/templates");
    },

    getById(id: number) {
      return client.get<Holiday>(`/holidays/${id}`);
    },

    create(data: CreateHolidayRequest["holiday"]) {
      return client.post<Holiday>("/holidays", { holiday: data });
    },

    update(id: number, data: Partial<CreateHolidayRequest["holiday"]>) {
      return client.patch<Holiday>(`/holidays/${id}`, { holiday: data });
    },

    delete(id: number) {
      return client.delete(`/holidays/${id}`);
    },

    getShareLink(id: number) {
      return client.get<ShareLinkResponse>(`/holidays/${id}/share`);
    },

    regenerateShareLink(id: number) {
      return client.post<ShareLinkResponse>(`/holidays/${id}/share`);
    },

    join(shareToken: string) {
      return client.post<Holiday>("/holidays/join", { share_token: shareToken });
    },

    leave(id: number) {
      return client.delete(`/holidays/${id}/leave`);
    },

    getCollaborators(id: number) {
      return client.get<HolidayCollaborator[]>(`/holidays/${id}/collaborators`);
    },

    removeCollaborator(holidayId: number, userId: number) {
      return client.delete(`/holidays/${holidayId}/collaborators/${userId}`);
    },

    updateNotifications(id: number, giftNotifications: GiftNotificationSetting) {
      return client.patch<Holiday>(`/holidays/${id}/notifications`, { gift_notifications: giftNotifications });
    },
  };
}
