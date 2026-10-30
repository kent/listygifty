import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TextCell } from "./TextCell";

const editButton = () => screen.getByRole("button", { name: "Rename gift: Lego set" });

describe("TextCell", () => {
  it("is a real button, so Tab reaches it and Enter and Space activate it natively", () => {
    render(<TextCell value="Lego set" onChange={vi.fn()} aria-label="Rename gift" />);
    const button = editButton();
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it("opens a named input, focused and ready to type over", () => {
    render(<TextCell value="Lego set" onChange={vi.fn()} aria-label="Rename gift" />);
    fireEvent.click(editButton());
    const input = screen.getByRole("textbox", { name: "Rename gift" }) as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("Lego set");
  });

  it("falls back to a bare label when the cell is empty", () => {
    render(<TextCell value="" onChange={vi.fn()} placeholder="Gift name..." aria-label="Rename gift" />);
    expect(screen.getByRole("button", { name: "Rename gift" })).toBeTruthy();
  });

  it("doesn't let the Enter that saved also press the rename button", () => {
    render(<TextCell value="Lego set" onChange={vi.fn()} aria-label="Rename gift" />);
    fireEvent.click(editButton());

    const notPrevented = fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });

    expect(notPrevented).toBe(false);
  });

  it("saves on Enter and returns focus to the cell", () => {
    const onChange = vi.fn();
    render(<TextCell value="Lego set" onChange={onChange} aria-label="Rename gift" />);
    fireEvent.click(editButton());
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Lego castle" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("Lego castle");
    expect(document.activeElement).toBe(screen.getByRole("button"));
  });

  it("cancels on Escape and returns focus to the cell", () => {
    const onChange = vi.fn();
    render(<TextCell value="Lego set" onChange={onChange} aria-label="Rename gift" />);
    fireEvent.click(editButton());
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Oops" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(editButton());
  });

  it("does not take focus back when the person tabs away", () => {
    render(<>
      <TextCell value="Lego set" onChange={vi.fn()} aria-label="Rename gift" />
      <button>Next control</button>
    </>);
    fireEvent.click(editButton());
    const next = screen.getByRole("button", { name: "Next control" });
    next.focus();
    fireEvent.blur(screen.getByRole("textbox"));
    expect(document.activeElement).toBe(next);
  });

  describe("with a link", () => {
    const props = {
      value: "Lego set",
      onChange: vi.fn(),
      "aria-label": "Rename gift",
      isLink: true,
      linkHref: "https://example.com/lego",
      linkLabel: "Example",
    };

    it("keeps the edit button and the link as separate controls", () => {
      render(<TextCell {...props} />);
      const link = screen.getByRole("link", { name: "Example" });
      expect(link.getAttribute("href")).toBe("https://example.com/lego");
      expect(editButton().contains(link)).toBe(false);
      expect(link.closest("button")).toBeNull();
    });

    it("edits from the button without following the link", () => {
      render(<TextCell {...props} />);
      fireEvent.click(editButton());
      expect(screen.getByRole("textbox", { name: "Rename gift" })).toBeTruthy();
    });

    it("follows the link without entering edit mode", () => {
      const onLinkClick = vi.fn();
      render(<TextCell {...props} onLinkClick={onLinkClick} />);
      fireEvent.click(screen.getByRole("link", { name: "Example" }));
      expect(onLinkClick).toHaveBeenCalled();
      expect(screen.queryByRole("textbox")).toBeNull();
    });
  });
});
