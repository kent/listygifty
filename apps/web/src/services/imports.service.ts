import { apiClient } from "@/lib/api-client";
import type { ImportGiftsResult, ImportPeopleResult } from "@niftygifty/types";

class ImportsService {
  async importPeople(file: File, ownerId?: number): Promise<ImportPeopleResult> {
    const formData = new FormData();
    formData.append("file", file);
    if (ownerId !== undefined) {
      formData.append("owner_id", String(ownerId));
    }
    return apiClient.postFormData<ImportPeopleResult>("/imports/people", formData);
  }

  async importGifts(file: File, holidayId: number): Promise<ImportGiftsResult> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("holiday_id", String(holidayId));
    return apiClient.postFormData<ImportGiftsResult>("/imports/gifts", formData);
  }
}

export const importsService = new ImportsService();
