import { render, screen, fireEvent } from "@testing-library/react-native";
import { GiftListCard } from "@/components/GiftListCard";
import type { Holiday } from "@niftygifty/types";

const mockHoliday: Holiday = {
  id: 1,
  name: "Christmas 2025",
  date: "2025-12-25",
  icon: null,
  is_template: false,
  completed: false,
  archived: false,
  share_token: null,
  is_owner: true,
  role: "owner",
  collaborator_count: 0,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

describe("GiftListCard", () => {
  it("renders the holiday name", () => {
    const onPress = jest.fn();
    render(<GiftListCard item={mockHoliday} onPress={onPress} />);

    expect(screen.getByText("Christmas 2025")).toBeTruthy();
  });

  it("renders the formatted date", () => {
    const onPress = jest.fn();
    render(<GiftListCard item={mockHoliday} onPress={onPress} />);

    expect(screen.getByText("Dec 25, 2025")).toBeTruthy();
  });

  it("shows an actionable deadline reminder for soon lists", () => {
    const onPress = jest.fn();
    render(
      <GiftListCard
        item={mockHoliday}
        now={new Date(2025, 11, 20)}
        onPress={onPress}
      />
    );

    expect(screen.getByText("Due in 5 days")).toBeTruthy();
  });

  it("shows overdue reminders for active lists past their date", () => {
    const onPress = jest.fn();
    render(
      <GiftListCard
        item={mockHoliday}
        now={new Date(2025, 11, 26)}
        onPress={onPress}
      />
    );

    expect(screen.getByText("1 day overdue")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    render(<GiftListCard item={mockHoliday} onPress={onPress} />);

    fireEvent.press(screen.getByText("Christmas 2025"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows Done badge when completed", () => {
    const onPress = jest.fn();
    const completedHoliday = { ...mockHoliday, completed: true };
    render(<GiftListCard item={completedHoliday} onPress={onPress} />);

    expect(screen.getByText("Done")).toBeTruthy();
  });

  it("does not show Done badge when not completed", () => {
    const onPress = jest.fn();
    render(<GiftListCard item={mockHoliday} onPress={onPress} />);

    expect(screen.queryByText("Done")).toBeNull();
  });

  it("shows Shared badge when not owner", () => {
    const onPress = jest.fn();
    const sharedHoliday = { ...mockHoliday, is_owner: false };
    render(<GiftListCard item={sharedHoliday} onPress={onPress} />);

    expect(screen.getByText("Shared")).toBeTruthy();
  });

  it("shows collaborator count when present", () => {
    const onPress = jest.fn();
    const holidayWithCollaborators = { ...mockHoliday, collaborator_count: 3 };
    render(<GiftListCard item={holidayWithCollaborators} onPress={onPress} />);

    expect(screen.getByText("3 collaborators")).toBeTruthy();
  });

  it("handles null date gracefully", () => {
    const onPress = jest.fn();
    const holidayWithoutDate = { ...mockHoliday, date: null };
    render(<GiftListCard item={holidayWithoutDate} onPress={onPress} />);

    expect(screen.getByText("Christmas 2025")).toBeTruthy();
    // Should not crash and should not show a date
  });
});
