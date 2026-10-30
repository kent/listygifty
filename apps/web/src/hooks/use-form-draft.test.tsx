import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearFormDrafts, useFormDraft } from "./use-form-draft";

function Draft({ value, restore }: { value: string; restore: (draft: string) => void }) {
  useFormDraft("test", value, restore);
  return null;
}

beforeEach(() => window.sessionStorage.clear());

describe("useFormDraft", () => {
  it("restores what was saved, and doesn't overwrite it with the blank form first", () => {
    window.sessionStorage.setItem("form-draft:test", JSON.stringify("saved"));
    const restore = vi.fn();
    render(<Draft value="" restore={restore} />);

    expect(restore).toHaveBeenCalledWith("saved");
    expect(window.sessionStorage.getItem("form-draft:test")).toBe(JSON.stringify("saved"));
  });

  it("ignores a damaged draft", () => {
    window.sessionStorage.setItem("form-draft:test", "{not json");
    const restore = vi.fn();
    render(<Draft value="" restore={restore} />);

    expect(restore).not.toHaveBeenCalled();
  });

  it("clears only form drafts on sign-out", () => {
    window.sessionStorage.setItem("form-draft:test", "1");
    window.sessionStorage.setItem("other", "1");
    clearFormDrafts();

    expect(window.sessionStorage.getItem("form-draft:test")).toBeNull();
    expect(window.sessionStorage.getItem("other")).toBe("1");
  });
});
