import {
  buildCreatePersonPayload,
  buildUpdatePersonPayload,
} from "@/lib/people-form";

describe("people-form helpers", () => {
  it("buildCreatePersonPayload trims values and omits blank optional fields", () => {
    const payload = buildCreatePersonPayload({
      name: "  Marie  ",
      relationship: "  ",
      email: " marie@gifts.com ",
      birthday: " ",
      milestoneLabel: " ",
      milestoneDate: " ",
      notes: "",
    });

    expect(payload).toEqual({
      name: "Marie",
      email: "marie@gifts.com",
      relationship: undefined,
      birthday: undefined,
      milestone_label: undefined,
      milestone_date: undefined,
      notes: undefined,
    });
  });

  it("buildUpdatePersonPayload keeps empty strings for cleared fields", () => {
    const payload = buildUpdatePersonPayload({
      name: "  Marie  ",
      relationship: "   ",
      email: "",
      birthday: "1991-03-14",
      milestoneLabel: " Work anniversary ",
      milestoneDate: "2026-09-01",
      notes: "  updated note  ",
    });

    expect(payload).toEqual({
      name: "Marie",
      relationship: "",
      email: "",
      birthday: "1991-03-14",
      milestone_label: "Work anniversary",
      milestone_date: "2026-09-01",
      notes: "updated note",
    });
  });
});
