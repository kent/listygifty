import { beforeEach, describe, expect, it } from "vitest";
import { inviteeSignUpValues, rememberInvitee } from "./invite-signup";

beforeEach(() => sessionStorage.clear());

describe("inviteeSignUpValues", () => {
  it("is empty for someone who didn't come from an invite", () => {
    expect(inviteeSignUpValues()).toBeUndefined();
  });

  it("fills in the email and name the invite already knows", () => {
    rememberInvitee({ name: "Nana Fenn Smith", email: "nana@example.com" });
    expect(inviteeSignUpValues()).toEqual({ emailAddress: "nana@example.com", firstName: "Nana", lastName: "Fenn Smith" });
  });

  it("copes with a single name", () => {
    rememberInvitee({ name: "Nana", email: "nana@example.com" });
    expect(inviteeSignUpValues()).toEqual({ emailAddress: "nana@example.com", firstName: "Nana" });
  });

  it("doesn't use an email address as a name", () => {
    rememberInvitee({ name: "nana@example.com", email: "nana@example.com" });
    expect(inviteeSignUpValues()).toEqual({ emailAddress: "nana@example.com" });
  });
});
