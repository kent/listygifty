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
      notes: "",
    });

    expect(payload).toEqual({
      name: "Marie",
      email: "marie@gifts.com",
      relationship: undefined,
      birthday: undefined,
      notes: undefined,
    });
  });

  it("buildUpdatePersonPayload keeps empty strings for cleared fields", () => {
    const payload = buildUpdatePersonPayload({
      name: "  Marie  ",
      relationship: "   ",
      email: "",
      birthday: "1991-03-14",
      notes: "  updated note  ",
    });

    expect(payload).toEqual({
      name: "Marie",
      relationship: "",
      email: "",
      birthday: "1991-03-14",
      notes: "updated note",
    });
  });
});
