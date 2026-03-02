import type { CreatePersonRequest } from "@niftygifty/types";

export interface PersonFormValues {
  name: string;
  relationship: string;
  email: string;
  notes: string;
}

function trim(value: string): string {
  return value.trim();
}

function trimOrUndefined(value: string): string | undefined {
  const trimmed = trim(value);
  return trimmed.length > 0 ? trimmed : undefined;
}

// For create, omit blank optional fields.
export function buildCreatePersonPayload(values: PersonFormValues): CreatePersonRequest["person"] {
  return {
    name: trim(values.name),
    relationship: trimOrUndefined(values.relationship),
    email: trimOrUndefined(values.email),
    notes: trimOrUndefined(values.notes),
  };
}

// For update, send empty strings for cleared optional fields so backend can clear values.
export function buildUpdatePersonPayload(
  values: PersonFormValues
): Partial<CreatePersonRequest["person"]> {
  return {
    name: trim(values.name),
    relationship: trim(values.relationship),
    email: trim(values.email),
    notes: trim(values.notes),
  };
}
