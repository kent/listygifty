import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import { McpOAuthUrlCard } from "@/components/McpOAuthUrlCard";
import { MCP_SERVER_URL } from "@/lib/mcp";
import { darkColors, lightColors } from "@/lib/theme";

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
}));

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string): number {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("McpOAuthUrlCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the ordinary MCP OAuth URL as selectable text", () => {
    render(<McpOAuthUrlCard />);

    expect(screen.getByText("Your MCP OAuth URL")).toBeTruthy();
    expect(screen.getByText("OAuth 2.1")).toBeTruthy();
    expect(screen.getByText(MCP_SERVER_URL)).toBeTruthy();
    expect(screen.getByTestId("mcp-oauth-url").props.selectable).toBe(true);
    expect(screen.getByRole("button", { name: "Copy MCP OAuth URL" })).toBeTruthy();
  });

  it("copies the exact URL and confirms the action", async () => {
    render(<McpOAuthUrlCard />);

    fireEvent.press(screen.getByRole("button", { name: "Copy MCP OAuth URL" }));

    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith(MCP_SERVER_URL));
    expect(screen.getByText("URL copied")).toBeTruthy();
    expect(screen.getByRole("button", { name: "MCP OAuth URL copied" })).toBeTruthy();
  });

  it("offers a selectable fallback when clipboard access fails", async () => {
    jest.mocked(Clipboard.setStringAsync).mockRejectedValueOnce(new Error("clipboard unavailable"));
    render(<McpOAuthUrlCard />);

    fireEvent.press(screen.getByRole("button", { name: "Copy MCP OAuth URL" }));

    await waitFor(() => expect(screen.getByText("Copy failed — try again")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Copy MCP OAuth URL failed. Try again" })).toBeTruthy();
    expect(screen.getByTestId("mcp-oauth-url").props.selectable).toBe(true);
  });

  it.each([
    [lightColors.infoText, lightColors.surface],
    [lightColors.infoText, lightColors.infoLight],
    [darkColors.infoText, darkColors.surface],
    [darkColors.infoText, darkColors.infoLight],
  ])("keeps URL and badge text at WCAG AA contrast (%s on %s)", (foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});
