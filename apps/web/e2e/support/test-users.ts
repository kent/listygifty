import path from "node:path";

export type E2EUser = {
  role: "owner" | "participant-1" | "participant-2" | "participant-3" | "participant-4";
  firstName: string;
  lastName: string;
  email: string;
};

export const E2E_USERS: E2EUser[] = [
  {
    role: "owner",
    firstName: "Olivia",
    lastName: "Organizer",
    email: "listygifty.e2e+clerk_test_owner@example.com",
  },
  {
    role: "participant-1",
    firstName: "Parker",
    lastName: "Participant",
    email: "listygifty.e2e+clerk_test_p1@example.com",
  },
  {
    role: "participant-2",
    firstName: "Quinn",
    lastName: "Participant",
    email: "listygifty.e2e+clerk_test_p2@example.com",
  },
  {
    role: "participant-3",
    firstName: "Riley",
    lastName: "Participant",
    email: "listygifty.e2e+clerk_test_p3@example.com",
  },
  {
    role: "participant-4",
    firstName: "Sage",
    lastName: "Participant",
    email: "listygifty.e2e+clerk_test_p4@example.com",
  },
];

export function authStatePath(role: E2EUser["role"]): string {
  return path.resolve(__dirname, `../../playwright/.clerk/${role}.json`);
}
