import { fireEvent, render, screen } from "@testing-library/react-native";
import ProfileScreen from "@/app/(tabs)/profile";

let mockDemo = false;
const mockOpen = jest.fn();
let mockSheetVisible = false;

jest.mock("@/components/McpOAuthUrlCard", () => ({ McpOAuthUrlCard: () => null }));
jest.mock("@/lib/controllers", () => ({
  useProfileController: () => ({ displayName: "Alice", email: "alice@example.com", demo: mockDemo, promptSignOut: jest.fn() }),
  useDeleteAccountController: () => ({
    visible: mockSheetVisible, deleting: false, error: "", open: mockOpen, close: jest.fn(), confirm: jest.fn(),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockDemo = false;
  mockSheetVisible = false;
});

describe("ProfileScreen", () => {
  it("offers Delete Account in Settings", () => {
    render(<ProfileScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Delete Account" }));

    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it("explains the deletion in a sheet once it is opened", () => {
    mockSheetVisible = true;

    render(<ProfileScreen />);

    expect(screen.getByRole("header", { name: "Delete Account" })).toBeTruthy();
  });

  it("hides it in the demo, where there is no account to delete", () => {
    mockDemo = true;

    render(<ProfileScreen />);

    expect(screen.queryByRole("button", { name: "Delete Account" })).toBeNull();
    expect(screen.getByText("Exit demo")).toBeTruthy();
  });
});
