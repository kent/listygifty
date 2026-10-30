import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CurrencyCell } from "./CurrencyCell";

const label = "Edit cost of Lego set";

describe("CurrencyCell", () => {
  it("is a named button that includes the current amount", () => {
    render(<CurrencyCell value="24.5" onChange={vi.fn()} aria-label={label} />);
    const button = screen.getByRole("button", { name: `${label}: $24.50` });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
  });

  it("names the button with text, not an attribute, so it can't shadow a form field's label", () => {
    render(<CurrencyCell value="24.5" onChange={vi.fn()} aria-label={label} />);
    expect(screen.getByRole("button").hasAttribute("aria-label")).toBe(false);
  });

  it("is still named when there is no amount, so it isn't an empty button", () => {
    render(<CurrencyCell value={null} onChange={vi.fn()} aria-label={label} />);
    expect(screen.getByRole("button", { name: label })).toBeTruthy();
  });

  it("opens a named input and saves on Enter, returning focus to the cell", () => {
    const onChange = vi.fn();
    render(<CurrencyCell value="24.5" onChange={onChange} aria-label={label} />);
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox", { name: label });
    fireEvent.change(input, { target: { value: "30" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("30");
    expect(document.activeElement).toBe(screen.getByRole("button"));
  });

  it("cancels on Escape and returns focus to the cell", () => {
    const onChange = vi.fn();
    render(<CurrencyCell value="24.5" onChange={onChange} aria-label={label} />);
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button"));
  });
});
