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
      notes: "",
    });

    expect(payload).toEqual({
      name: "Marie",
      email: "marie@gifts.com",
      relationship: undefined,
      notes: undefined,
    });
  });

  it("buildUpdatePersonPayload keeps empty strings for cleared fields", () => {
    const payload = buildUpdatePersonPayload({
      name: "  Marie  ",
      relationship: "   ",
      email: "",
      notes: "  updated note  ",
    });

    expect(payload).toEqual({
      name: "Marie",
      relationship: "",
      email: "",
      notes: "updated note",
    });
  });
});
