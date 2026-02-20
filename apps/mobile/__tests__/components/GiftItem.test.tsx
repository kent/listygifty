import { render, screen } from "@testing-library/react-native";
import { GiftItem } from "@/components/GiftItem";
import type { Gift } from "@niftygifty/types";

const mockGiftStatus = {
  id: 1,
  name: "Idea",
  position: 1,
  color: null,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const mockHoliday = {
  id: 1,
  name: "Christmas 2025",
  date: "2025-12-25",
  icon: null,
  is_template: false,
  completed: false,
  archived: false,
  share_token: null,
  is_owner: true,
  role: "owner" as const,
  collaborator_count: 0,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const mockGift = {
  id: 1,
  name: "Nintendo Switch",
  description: "Gaming console",
  link: "https://nintendo.com",
  cost: "299.99",
  holiday_id: 1,
  gift_status_id: 1,
  position: 1,
  gift_status: mockGiftStatus,
  holiday: mockHoliday,
  recipients: [],
  givers: [],
  created_by: null,
  is_mine: true,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
} as unknown as Gift;

describe("GiftItem", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the gift name", () => {
    render(<GiftItem item={mockGift} />);
    expect(screen.getByText("Nintendo Switch")).toBeTruthy();
  });

  it("renders the description", () => {
    render(<GiftItem item={mockGift} />);
    expect(screen.getByText("Gaming console")).toBeTruthy();
  });

  it("renders the formatted cost", () => {
    render(<GiftItem item={mockGift} />);
    expect(screen.getByText("$299.99")).toBeTruthy();
  });

  it("renders the status badge", () => {
    render(<GiftItem item={mockGift} />);
    expect(screen.getByText("Idea")).toBeTruthy();
  });

  it("renders link button when link is present", () => {
    render(<GiftItem item={mockGift} />);
    expect(screen.getByText("Link")).toBeTruthy();
  });

  it("does not show link button when no link", () => {
    const giftWithoutLink = { ...mockGift, link: null };
    render(<GiftItem item={giftWithoutLink} />);
    expect(screen.queryByText("Link")).toBeNull();
  });

  it("handles null cost gracefully", () => {
    const giftWithoutCost = { ...mockGift, cost: null };
    render(<GiftItem item={giftWithoutCost} />);
    expect(screen.getByText("Nintendo Switch")).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it("handles null description gracefully", () => {
    const giftWithoutDescription = { ...mockGift, description: null };
    render(<GiftItem item={giftWithoutDescription} />);
    expect(screen.getByText("Nintendo Switch")).toBeTruthy();
    expect(screen.queryByText("Gaming console")).toBeNull();
  });

  it("displays recipients when present", () => {
    const giftWithRecipients = {
      ...mockGift,
      recipients: [
        {
          id: 1,
          name: "John",
          email: "john@example.com",
          notes: null,
          relationship: null,
          age: null,
          gender: null,
          gift_count: 0,
          user_id: 1,
          is_mine: true,
          is_shared: false,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      ],
    } as Gift;
    render(<GiftItem item={giftWithRecipients} />);
    expect(screen.getByText("For: John")).toBeTruthy();
  });
});
