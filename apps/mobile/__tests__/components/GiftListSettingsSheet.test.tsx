import { fireEvent, render, screen } from "@testing-library/react-native";
import type { GiftListSummary, Holiday } from "@niftygifty/types";
import { GiftListSettingsSheet } from "@/components/GiftListSettingsSheet";

const holiday: Holiday = {
  id: 1,
  name: "Christmas 2026",
  date: "2026-12-25",
  icon: null,
  is_template: false,
  completed: false,
  archived: false,
  share_token: null,
  is_owner: true,
  role: "owner",
  collaborator_count: 2,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const summary: GiftListSummary = {
  totalGifts: 8,
  totalCost: 0,
  pricedGiftCount: 0,
  unpricedGiftCount: 8,
  assignedGiftCount: 4,
  unassignedGiftCount: 4,
  completedGiftCount: 0,
  remainingGiftCount: 8,
  completionPercent: 0,
  statusCounts: [],
};

type Props = Parameters<typeof GiftListSettingsSheet>[0];

function renderSheet(overrides: Partial<Props> = {}) {
  const props: Props = {
    page: "menu",
    holiday,
    summary,
    schedulingReminder: false,
    shareUrl: "https://listygifty.com/join/abc",
    collaborators: [],
    shareLoading: false,
    shareError: null,
    regenerating: false,
    onClose: jest.fn(),
    onBack: jest.fn(),
    onOpenSharing: jest.fn(),
    onScheduleReminder: jest.fn(),
    onRefreshShare: jest.fn(),
    onNativeShare: jest.fn(),
    onRegenerateLink: jest.fn(),
    onRemoveCollaborator: jest.fn(),
    ...overrides,
  };
  render(<GiftListSettingsSheet {...props} />);
  return props;
}

describe("GiftListSettingsSheet", () => {
  it("lists stats first, then notifications, then sharing", () => {
    renderSheet();

    const text = JSON.stringify(screen.toJSON());
    const order = ["Stats", "Notifications", "Sharing"].map((title) => text.indexOf(`"${title}"`));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("shows progress, spend, and recipients in stats", () => {
    renderSheet();

    expect(screen.getByText("Progress")).toBeTruthy();
    expect(screen.getByText("0/8 done")).toBeTruthy();
    expect(screen.getByText("Spend")).toBeTruthy();
    expect(screen.getByText("$0.00")).toBeTruthy();
    expect(screen.getByText("8 missing a price")).toBeTruthy();
    expect(screen.getByText("Recipients")).toBeTruthy();
    expect(screen.getByText("4 open")).toBeTruthy();
  });

  it("schedules a reminder from notifications", () => {
    const { onScheduleReminder } = renderSheet();

    expect(screen.getByText(/Remind me before/)).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Deadline reminder" }));

    expect(onScheduleReminder).toHaveBeenCalledTimes(1);
  });

  it("explains reminders need a date and blocks scheduling without one", () => {
    const { onScheduleReminder } = renderSheet({ holiday: { ...holiday, date: null } });

    expect(screen.getByText("Add a date to this list to get reminders")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Deadline reminder" }));

    expect(onScheduleReminder).not.toHaveBeenCalled();
  });

  it("opens sharing from the collaborators row", () => {
    const { onOpenSharing } = renderSheet();

    fireEvent.press(screen.getByRole("button", { name: "2 collaborators" }));

    expect(onOpenSharing).toHaveBeenCalledTimes(1);
  });

  it("shows the invite link on the sharing page and goes back to settings", () => {
    const { onBack } = renderSheet({ page: "sharing" });

    expect(screen.getByRole("header", { name: "Share List" })).toBeTruthy();
    expect(screen.getByText("https://listygifty.com/join/abc")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Back to list settings" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
