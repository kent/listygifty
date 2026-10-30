import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { GiftSuggestion } from "@niftygifty/types";
import { darkOnlyClasses } from "@/test/dark-only";
import { GiftSuggestionsTab } from "./gift-suggestions-tab";

const mocks = vi.hoisted(() => ({ auth: { isPremium: true }, generate: vi.fn() }));

vi.mock("@/contexts/auth-context", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/services", () => ({ giftSuggestionsService: { generate: mocks.generate } }));

const suggestion = {
  id: 1,
  name: "Lego set",
  description: "Something to build",
  approximate_price: "$40",
  holiday: { name: "Christmas", date: "2026-12-25" },
} as unknown as GiftSuggestion;

function renderTab(suggestions: GiftSuggestion[] = []) {
  render(
    <GiftSuggestionsTab
      personId={1}
      personName="Alex"
      suggestions={suggestions}
      onSuggestionsChange={vi.fn()}
    />
  );
}

beforeEach(() => {
  mocks.auth = { isPremium: true };
  mocks.generate.mockReset();
});

describe("gift ideas tab in the light theme", () => {
  it("uses no dark-only colours on the upgrade card", () => {
    mocks.auth = { isPremium: false };
    renderTab();
    expect(screen.getByText("Gift Idea Generator")).toBeTruthy();
    expect(darkOnlyClasses(document.body)).toEqual([]);
  });

  it("uses no dark-only colours when empty", () => {
    renderTab();
    expect(screen.getByText(/No suggestions yet/)).toBeTruthy();
    expect(darkOnlyClasses(document.body)).toEqual([]);
  });

  it("uses no dark-only colours on a suggestion", () => {
    renderTab([suggestion]);
    expect(screen.getByText("Lego set")).toBeTruthy();
    expect(darkOnlyClasses(document.body)).toEqual([]);
  });

  it("uses no dark-only colours on the error message", async () => {
    mocks.generate.mockRejectedValue(new Error("Nope"));
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Generate Ideas" }));
    await screen.findByText("Failed to generate suggestions. Please try again.");
    expect(darkOnlyClasses(document.body)).toEqual([]);
  });
});
