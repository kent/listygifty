import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ExchangesError from "./error";

describe("the exchanges error boundary", () => {
  const crash = new Error("Cannot read properties of undefined (reading 'slug')");

  it("doesn't show people the raw error", () => {
    render(<ExchangesError error={crash} reset={vi.fn()} />);

    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.queryByText(crash.message)).toBeNull();
    expect(screen.getByText("We couldn't load this page. Try again in a moment.")).toBeTruthy();
  });

  it("offers a retry", () => {
    const reset = vi.fn();
    render(<ExchangesError error={crash} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});
