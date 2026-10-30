import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { GiftStatus } from "@niftygifty/types";
import { StatusCell } from "./StatusCell";

const statuses = [{ id: 1, name: "Idea" }, { id: 2, name: "Purchased" }] as GiftStatus[];

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});

describe("StatusCell", () => {
  it("passes its name to the select trigger and still shows the status", () => {
    render(<StatusCell value={1} statuses={statuses} onChange={vi.fn()} aria-label="Status of Lego set" />);
    const trigger = screen.getByRole("combobox", { name: "Status of Lego set" });
    expect(trigger.textContent).toContain("Idea");
  });

  it("connects to a visible label through its id", () => {
    render(<>
      <label htmlFor="status">Status</label>
      <StatusCell id="status" value={1} statuses={statuses} onChange={vi.fn()} />
    </>);
    expect(screen.getByRole("combobox", { name: "Status" })).toBeTruthy();
  });
});
