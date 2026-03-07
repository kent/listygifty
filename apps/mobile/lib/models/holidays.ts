import type { CreateHolidayRequest, HolidayCollaborator } from "@niftygifty/types";
import { trim, trimOrUndefined } from "./inputs";

export interface HolidayFormValues {
  name: string;
  date: string;
}

export const EMPTY_HOLIDAY_FORM_VALUES: HolidayFormValues = {
  name: "",
  date: "",
};

export function buildCreateHolidayPayload(
  values: HolidayFormValues,
  fallbackDate: string
): CreateHolidayRequest["holiday"] {
  return {
    name: trim(values.name),
    date: trimOrUndefined(values.date) || fallbackDate,
  };
}

export function getHolidayCollaboratorName(collaborator: HolidayCollaborator): string {
  if (collaborator.first_name || collaborator.last_name) {
    return [collaborator.first_name, collaborator.last_name].filter(Boolean).join(" ");
  }

  if (collaborator.email.includes("@clerk.user")) {
    return "Anonymous user";
  }

  return collaborator.email;
}

export function getHolidayCollaboratorInitials(collaborator: HolidayCollaborator): string {
  if (collaborator.first_name) {
    const first = collaborator.first_name[0];
    const last = collaborator.last_name?.[0] || "";
    return `${first}${last}`.toUpperCase();
  }

  if (!collaborator.email.includes("@clerk.user")) {
    return collaborator.email[0].toUpperCase();
  }

  return "?";
}
