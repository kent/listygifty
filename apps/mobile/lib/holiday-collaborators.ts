import type { HolidayCollaborator } from "@niftygifty/types";

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
