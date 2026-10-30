import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound from "./not-found";

describe("not-found page", () => {
  it("says the page is missing and links back to home", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: /Page not found/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");
  });
});
