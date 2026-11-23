import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import IntegrationsPage from "./page";

afterEach(() => window.history.replaceState(null, "", "/integrations"));

function expectAssistant(tab: string, assistant: string) {
  const panel = screen.getByRole("tabpanel", { name: tab });
  expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
  expect(screen.getByRole("tab", { name: tab }).getAttribute("aria-selected")).toBe("true");
  expect(within(panel).getByRole("heading", { name: assistant })).toBeDefined();
  expect(within(panel).getByRole("figure", { name: `Example conversation with ${assistant}` })).toBeDefined();
}

describe("assistant setup tabs", () => {
  it("includes the ChatGPT setup in server-rendered HTML and shows all four logo tabs", () => {
    const html = renderToString(<IntegrationsPage />);
    expect(html).toContain("Install plugin");
    render(<IntegrationsPage />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map(tab => tab.textContent)).toEqual(["OpenAI", "Claude", "Runner", "GrokBot"]);
    for (const tab of tabs) expect(tab.querySelector("img")).not.toBeNull();
    expectAssistant("OpenAI", "ChatGPT");
  });

  it("moves keyboard focus with arrows and opens the focused provider with Enter", async () => {
    render(<IntegrationsPage />);
    const openAI = screen.getByRole("tab", { name: "OpenAI" });
    const claude = screen.getByRole("tab", { name: "Claude" });
    act(() => openAI.focus());
    fireEvent.keyDown(openAI, { key: "ArrowRight" });
    await waitFor(() => expect(document.activeElement).toBe(claude));
    expectAssistant("OpenAI", "ChatGPT");
    fireEvent.keyDown(claude, { key: "Enter" });
    expectAssistant("Claude", "Claude");
  });

  it("opens a linked assistant and keeps the selection in sync with clicks, history and anchors", async () => {
    window.history.replaceState(null, "", "/integrations?campaign=gift#claude");
    render(<IntegrationsPage />);
    expectAssistant("Claude", "Claude");

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Runner" }), { button: 0, ctrlKey: false });
    expect(window.location.hash).toBe("#runner");
    expect(window.location.search).toBe("?campaign=gift");
    expectAssistant("Runner", "Runner");

    act(() => window.history.back());
    await waitFor(() => expectAssistant("Claude", "Claude"));
    act(() => { window.location.hash = "#grok-bot"; });
    await waitFor(() => expectAssistant("GrokBot", "Grok Bot"));
    fireEvent.click(screen.getByRole("link", { name: "Setup instructions" }));
    await waitFor(() => expectAssistant("OpenAI", "ChatGPT"));
    expect(window.location.hash).toBe("#connect");
  });
});
