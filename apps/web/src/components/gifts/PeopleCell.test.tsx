import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Person } from "@niftygifty/types";
import { PeopleCell } from "./PeopleCell";

vi.mock("@/services", () => ({ peopleService: { create: vi.fn() } }));

const people = [{ id: 7, name: "Alex" }, { id: 8, name: "Sam" }] as Person[];

// Radix Popover and cmdk measure and scroll; jsdom implements neither.
beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});

describe("PeopleCell", () => {
  it("does not nest the remove control inside the combobox", () => {
    render(<PeopleCell selectedIds={[7]} people={people} onChange={vi.fn()} aria-label="To" />);
    const remove = screen.getByRole("button", { name: "Remove Alex" });
    expect(remove.tagName).toBe("BUTTON");
    expect(remove.closest('[role="combobox"]')).toBeNull();
    expect(screen.getByRole("combobox").querySelector('button, [role="button"]')).toBeNull();
  });

  it("removes one person without opening the list", () => {
    const onChange = vi.fn();
    render(<PeopleCell selectedIds={[7, 8]} people={people} onChange={onChange} aria-label="To" />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Alex" }));
    expect(onChange).toHaveBeenCalledWith([8]);
    expect(screen.getByRole("combobox").getAttribute("aria-expanded")).toBe("false");
  });

  it("takes its name from aria-label and announces who is selected as its value", () => {
    render(<PeopleCell selectedIds={[7, 8]} people={people} onChange={vi.fn()} aria-label="To: recipients of Lego set" />);
    const combobox = screen.getByRole("combobox", { name: "To: recipients of Lego set" });
    expect(combobox.textContent).toContain("Alex, Sam");
  });

  it("announces the placeholder as its value when nobody is selected", () => {
    render(<PeopleCell selectedIds={[]} people={people} onChange={vi.fn()} placeholder="Choose people" aria-label="To" />);
    expect(screen.getByRole("combobox").textContent).toContain("Choose people");
  });

  it("takes its name from a visible label, as NewGiftDialog does", () => {
    render(<>
      <label htmlFor="recipients">Who is it for?</label>
      <PeopleCell id="recipients" selectedIds={[]} people={people} onChange={vi.fn()} />
    </>);
    expect(screen.getByRole("combobox", { name: "Who is it for?" }).id).toBe("recipients");
  });

  it("opens the list from the combobox and toggles a person", () => {
    const onChange = vi.fn();
    render(<PeopleCell selectedIds={[]} people={people} onChange={onChange} aria-label="To" />);
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Sam" }));
    expect(onChange).toHaveBeenCalledWith([8]);
  });

  it("disables both the combobox and the remove controls inside a disabled fieldset", () => {
    render(<fieldset disabled><PeopleCell selectedIds={[7]} people={people} onChange={vi.fn()} aria-label="To" /></fieldset>);
    expect((screen.getByRole("combobox") as HTMLButtonElement).matches(":disabled")).toBe(true);
    expect((screen.getByRole("button", { name: "Remove Alex" }) as HTMLButtonElement).matches(":disabled")).toBe(true);
  });
});
