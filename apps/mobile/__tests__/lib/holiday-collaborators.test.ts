import type { HolidayCollaborator } from "@niftygifty/types";
import {
  getHolidayCollaboratorInitials,
  getHolidayCollaboratorName,
} from "@/lib/holiday-collaborators";

function buildCollaborator(overrides: Partial<HolidayCollaborator>): HolidayCollaborator {
  return {
    user_id: 1,
    email: "person@example.com",
    first_name: null,
    last_name: null,
    image_url: null,
    role: "collaborator",
    ...overrides,
  };
}

describe("holiday-collaborators helpers", () => {
  it("prefers first + last name when available", () => {
    const collaborator = buildCollaborator({
      first_name: "Kent",
      last_name: "Fenwick",
      email: "kent@example.com",
    });

    expect(getHolidayCollaboratorName(collaborator)).toBe("Kent Fenwick");
    expect(getHolidayCollaboratorInitials(collaborator)).toBe("KF");
  });

  it("falls back to email for normal accounts", () => {
    const collaborator = buildCollaborator({
      first_name: null,
      last_name: null,
      email: "marie@gifts.com",
    });

    expect(getHolidayCollaboratorName(collaborator)).toBe("marie@gifts.com");
    expect(getHolidayCollaboratorInitials(collaborator)).toBe("M");
  });

  it("uses anonymous fallback for clerk shadow emails", () => {
    const collaborator = buildCollaborator({
      first_name: null,
      last_name: null,
      email: "abc123@clerk.user",
    });

    expect(getHolidayCollaboratorName(collaborator)).toBe("Anonymous user");
    expect(getHolidayCollaboratorInitials(collaborator)).toBe("?");
  });
});
