import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import NewGiftScreen from "@/app/(tabs)/lists/gifts/new";

const mockCreate = jest.fn();
const mockStatuses = jest.fn();
const mockLists = jest.fn();
const mockRouter = { push: jest.fn(), back: jest.fn() };
let mockParams: { holiday_id?: string } = { holiday_id: "5" };

jest.mock("expo-router", () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual("react").useEffect(effect, [effect]),
}));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock("@/lib/controllers", () => ({ useNewGiftController: jest.requireActual("@/lib/controllers/lists").useNewGiftController }));
jest.mock("@/lib/use-api", () => ({ useServices: () => ({
  gifts: { create: mockCreate }, giftStatuses: { getAll: mockStatuses }, holidays: { getAll: mockLists },
}) }));
jest.mock("@/lib/analytics", () => ({ useAnalytics: () => jest.fn() }));
jest.mock("expo-clipboard", () => ({ getStringAsync: jest.fn() }));
jest.mock("@/components/PersonPicker", () => ({
  PersonPicker: ({ label, selectedIds, onSelectionChange }: { label: string; selectedIds: number[]; onSelectionChange: (ids: number[]) => void }) => {
    const { Text, TouchableOpacity } = jest.requireActual("react-native");
    return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={() => onSelectionChange([7])}><Text>{label}: {selectedIds.join(",")}</Text></TouchableOpacity>;
  },
}));

async function enterDetails(name = "Book") {
  fireEvent.changeText(screen.getByLabelText("Gift name"), name);
  fireEvent.press(screen.getByRole("button", { name: "Next" }));
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { holiday_id: "5" };
  mockCreate.mockReset().mockResolvedValue({ id: 10 });
  mockStatuses.mockReset().mockResolvedValue([{ id: 1, name: "Idea" }, { id: 2, name: "Purchased" }]);
  mockLists.mockResolvedValue([{ id: 5, name: "Christmas", date: null }]);
});

describe("quick gift capture screen", () => {
  it("lets the user type and advance without waiting for statuses or lists", async () => {
    mockParams = {};
    mockStatuses.mockReturnValue(new Promise(() => {}));
    mockLists.mockReturnValue(new Promise(() => {}));
    render(<NewGiftScreen />);
    expect(screen.queryByText("Status")).toBeNull();
    expect(screen.queryByText("List *")).toBeNull();
    fireEvent.changeText(screen.getByLabelText("Gift name"), "  ");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await enterDetails();
    expect(screen.getByText("Who is it for?: ")).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Add Gift" })).toBeDisabled();
  });

  it("saves with just a name and sensible defaults", async () => {
    render(<NewGiftScreen />);
    await enterDetails("  Book  ");
    expect(screen.queryByPlaceholderText("https://...")).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Add Gift" }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: "Book", holiday_id: 5, gift_status_id: 1 }));
  });

  it("retains all values across Back and saves collapsed advanced fields", async () => {
    render(<NewGiftScreen />);
    await enterDetails();
    fireEvent.press(screen.getByRole("button", { name: "Who is it for?" }));
    fireEvent.press(screen.getByRole("radio", { name: "Purchased" }));
    fireEvent.press(screen.getByRole("button", { name: /Advanced/ }));
    fireEvent.changeText(screen.getByPlaceholderText("Optional notes about the gift"), "Hardcover");
    fireEvent.changeText(screen.getByPlaceholderText("0.00"), "24.50");
    fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Gift name").props.value).toBe("Book");
    await enterDetails("Better book");
    fireEvent.press(screen.getByRole("button", { name: /Advanced/ }));
    fireEvent.press(screen.getByRole("button", { name: "Add Gift" }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: "Better book", recipient_ids: [7], gift_status_id: 2, description: "Hardcover", cost: 24.5 })));
  });

  it("returns to an empty name for another gift and keeps recipient and status", async () => {
    render(<NewGiftScreen />);
    await enterDetails();
    fireEvent.press(screen.getByRole("button", { name: "Who is it for?" }));
    fireEvent.press(screen.getByRole("radio", { name: "Purchased" }));
    fireEvent.press(screen.getByRole("button", { name: "Save & Add Another" }));
    await waitFor(() => expect(screen.getByLabelText("Gift name").props.value).toBe(""));
    await enterDetails("Game");
    expect(screen.getByText("Who is it for?: 7")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Purchased" }).props.accessibilityState.selected).toBe(true);
    expect(screen.queryByPlaceholderText("0.00")).toBeNull();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it("preserves the draft after a failed save, then retries", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    mockCreate.mockRejectedValueOnce(new Error("offline"));
    render(<NewGiftScreen />);
    await enterDetails();
    fireEvent.press(screen.getByRole("button", { name: "Add Gift" }));
    await screen.findByText("Failed to create gift");
    expect(mockRouter.back).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole("button", { name: "Add Gift" }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
    consoleError.mockRestore();
  });

  it("reveals invalid advanced cost without losing the draft", async () => {
    render(<NewGiftScreen />);
    await enterDetails();
    fireEvent.press(screen.getByRole("button", { name: /Advanced/ }));
    fireEvent.changeText(screen.getByPlaceholderText("0.00"), "-5");
    fireEvent.press(screen.getByRole("button", { name: /Advanced/ }));
    fireEvent.press(screen.getByRole("button", { name: "Add Gift" }));
    expect(await screen.findByText("Cost must be a valid number of zero or more")).toBeTruthy();
    expect(screen.getByPlaceholderText("0.00").props.value).toBe("-5");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("does not create duplicates on repeated taps", async () => {
    let resolve!: (gift: { id: number }) => void;
    mockCreate.mockReturnValue(new Promise((res) => { resolve = res; }));
    render(<NewGiftScreen />);
    await enterDetails();
    const add = screen.getByRole("button", { name: "Add Gift" });
    fireEvent.press(add);
    fireEvent.press(add);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ id: 10 }));
  });
});
