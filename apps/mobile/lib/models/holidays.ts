import type { CreateHolidayRequest, HolidayCollaborator } from "@niftygifty/types";
import { trim, trimOrUndefined } from "./inputs";

export type HolidayListTemplateKey = "christmas" | "birthdays" | "teachers" | "in-laws";

export interface HolidayFormValues {
  name: string;
  date: string;
}

export interface HolidayListTemplate {
  key: HolidayListTemplateKey;
  label: string;
  description: string;
}

export const EMPTY_HOLIDAY_FORM_VALUES: HolidayFormValues = {
  name: "",
  date: "",
};

export const HOLIDAY_LIST_TEMPLATES: HolidayListTemplate[] = [
  {
    key: "christmas",
    label: "Christmas",
    description: "Family and friend gifts",
  },
  {
    key: "birthdays",
    label: "Birthdays",
    description: "Year-round ideas",
  },
  {
    key: "teachers",
    label: "Teachers",
    description: "School thank-yous",
  },
  {
    key: "in-laws",
    label: "In-laws",
    description: "Shared family planning",
  },
];

function padDatePart(value: number): string {
  return value.toString().padStart(2, "0");
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

function getNextAnnualDate(month: number, day: number, now: Date): string {
  let year = now.getFullYear();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const candidate = new Date(year, month - 1, day);

  if (candidate < today) {
    year += 1;
  }

  return toIsoDate(year, month, day);
}

function getYearFromIsoDate(date: string): string {
  return date.split("-")[0] || new Date().getFullYear().toString();
}

export function buildHolidayTemplateFormValues(
  key: HolidayListTemplateKey,
  now: Date = new Date()
): HolidayFormValues {
  if (key === "christmas") {
    const date = getNextAnnualDate(12, 25, now);
    return {
      name: `Christmas ${getYearFromIsoDate(date)}`,
      date,
    };
  }

  if (key === "teachers") {
    const date = getNextAnnualDate(6, 15, now);
    return {
      name: `Teacher Gifts ${getYearFromIsoDate(date)}`,
      date,
    };
  }

  if (key === "in-laws") {
    const date = getNextAnnualDate(12, 25, now);
    return {
      name: `In-Laws Christmas ${getYearFromIsoDate(date)}`,
      date,
    };
  }

  return {
    name: `Birthdays ${now.getFullYear()}`,
    date: "",
  };
}

export function buildCreateHolidayPayload(
  values: HolidayFormValues,
  fallbackDate?: string
): CreateHolidayRequest["holiday"] {
  return {
    name: trim(values.name),
    date: trimOrUndefined(values.date) || fallbackDate || undefined,
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
