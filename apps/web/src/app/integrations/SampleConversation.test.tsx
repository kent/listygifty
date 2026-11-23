import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SampleConversation } from "./SampleConversation";
import { conversations } from "./conversations";

function renderExample(reducedMotion: boolean) {
  const observe = vi.fn();
  let enterViewport: () => void = () => { throw new Error("Observer was not created"); };
  vi.stubGlobal("IntersectionObserver", class {
    observe = observe;
    disconnect = vi.fn();
    constructor(callback: IntersectionObserverCallback) {
      enterViewport = () => {
        callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      };
    }
  });
  vi.stubGlobal("matchMedia", () => ({
    matches: reducedMotion, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  render(<SampleConversation assistant="ChatGPT" turns={conversations.chatgpt} />);
  return { observe, enterViewport, panel: screen.getByRole("figure") };
}

afterEach(() => vi.unstubAllGlobals());

describe("sample conversation playback", () => {
  it("plays on entry, pauses, resumes, and can replay after the last message", () => {
    const { enterViewport, panel } = renderExample(false);
    act(enterViewport);
    expect(panel.getAttribute("data-playback")).toBe("playing");
    fireEvent.click(screen.getByRole("button", { name: "Pause ChatGPT conversation" }));
    expect(panel.getAttribute("data-playback")).toBe("paused");
    fireEvent.click(screen.getByRole("button", { name: "Resume ChatGPT conversation" }));
    fireEvent.animationEnd(screen.getAllByRole("listitem")[3]);
    expect(panel.getAttribute("data-playback")).toBe("finished");
    fireEvent.click(screen.getByRole("button", { name: "Replay ChatGPT conversation" }));
    expect(panel.getAttribute("data-playback")).toBe("playing");
  });

  it("renders the whole transcript without starting playback when motion is reduced", () => {
    const { observe, panel } = renderExample(true);
    expect(observe).not.toHaveBeenCalled();
    expect(panel.getAttribute("data-playback")).toBe("idle");
    expect(screen.queryByRole("button")).toBeNull();
    for (const text of conversations.chatgpt) {
      expect(screen.getByText(text)).toBeDefined();
    }
  });
});
