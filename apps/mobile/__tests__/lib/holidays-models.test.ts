import {
  buildCreateHolidayPayload,
  buildHolidayTemplateFormValues,
  HOLIDAY_LIST_TEMPLATES,
} from "@/lib/models";

describe("holiday model helpers", () => {
  it("omits blank dates when building create payloads", () => {
    expect(
      buildCreateHolidayPayload({
        name: "  Birthday Ideas  ",
        date: " ",
      })
    ).toEqual({
      name: "Birthday Ideas",
      date: undefined,
    });
  });

  it("keeps explicit list dates", () => {
    expect(
      buildCreateHolidayPayload({
        name: "Christmas",
        date: "2026-12-25",
      })
    ).toEqual({
      name: "Christmas",
      date: "2026-12-25",
    });
  });

  it("includes the launch checklist list templates", () => {
    expect(HOLIDAY_LIST_TEMPLATES.map((template) => template.key)).toEqual([
      "christmas",
      "birthdays",
      "teachers",
      "in-laws",
    ]);
  });

  it("builds dated annual templates for the next relevant calendar date", () => {
    expect(buildHolidayTemplateFormValues("christmas", new Date(2026, 4, 26))).toEqual({
      name: "Christmas 2026",
      date: "2026-12-25",
    });
    expect(buildHolidayTemplateFormValues("christmas", new Date(2026, 11, 26))).toEqual({
      name: "Christmas 2027",
      date: "2027-12-25",
    });
    expect(buildHolidayTemplateFormValues("teachers", new Date(2026, 6, 1))).toEqual({
      name: "Teacher Gifts 2027",
      date: "2027-06-15",
    });
  });

  it("builds birthdays as an undated evergreen list", () => {
    expect(buildHolidayTemplateFormValues("birthdays", new Date(2026, 4, 26))).toEqual({
      name: "Birthdays 2026",
      date: "",
    });
  });
});
