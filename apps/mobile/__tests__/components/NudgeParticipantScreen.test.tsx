import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import NudgeExchangeParticipantScreen from "@/app/(tabs)/exchanges/[id]/participants/[participantId]/nudge";

const mockGetById = jest.fn();
const mockNudge = jest.fn();
const mockRouter = { push: jest.fn(), back: jest.fn() };

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: "7", participantId: "2" }),
  usePathname: () => "/exchanges/7/participants/2/nudge",
}));
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual("react").useEffect(effect, [effect]),
}));
jest.mock("@clerk/clerk-expo", () => ({ useAuth: () => ({ isSignedIn: true, isLoaded: true }) }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));
jest.mock("@/lib/notifications", () => ({ scheduleExchangeReminder: jest.fn() }));
jest.mock("@/lib/haptics", () => ({ haptics: { success: jest.fn(), error: jest.fn(), light: jest.fn() } }));
jest.mock("@/lib/demo-mode", () => ({ useDemoMode: () => false, isDemoMode: () => false }));
jest.mock("@/lib/controllers", () => ({
  useNudgeExchangeParticipantController: jest.requireActual("@/lib/controllers/exchanges").useNudgeExchangeParticipantController,
}));
jest.mock("@/lib/use-api", () => ({ useServices: () => ({
  giftExchanges: { getById: mockGetById },
  exchangeParticipants: { nudge: mockNudge },
}) }));
jest.mock("@/lib/analytics", () => ({ useAnalytics: () => jest.fn() }));

const ana = {
  id: 2,
  gift_exchange_id: 7,
  user_id: null,
  name: "Ana",
  email: "ana@example.com",
  phone: null,
  status: "invited",
  display_name: "Ana",
  has_user: false,
  wishlist_count: 0,
  can_nudge: true,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetById.mockResolvedValue({ id: 7, name: "Family Secret Santa", status: "inviting", exchange_participants: [ana] });
});

it("emails and texts the invite, then goes back", async () => {
  mockNudge.mockResolvedValue({ participant: { ...ana, can_nudge: false }, emailed: true, text: "sent", text_error: null });
  render(<NudgeExchangeParticipantScreen />);

  expect(await screen.findByText("Nudge Ana")).toBeTruthy();
  expect(screen.getByLabelText("Email").props.value).toBe("ana@example.com");
  expect(screen.getByText(/comes from Listy Gifty at \(289\) 379-7875/)).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText("Mobile number"), "289 379 7875");
  fireEvent.press(screen.getByRole("checkbox", { name: "Ana said it's OK to text them about this exchange." }));
  fireEvent.press(screen.getByRole("button", { name: "Send nudge" }));

  await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
  expect(mockNudge).toHaveBeenCalledWith(7, 2, { email: "ana@example.com", phone: "289 379 7875", text_consent: true });
});

it("won't text until the organizer confirms it's OK", async () => {
  render(<NudgeExchangeParticipantScreen />);

  expect(await screen.findByText("Nudge Ana")).toBeTruthy();
  expect(screen.queryByRole("checkbox")).toBeNull();
  fireEvent.changeText(screen.getByLabelText("Mobile number"), "289 379 7875");
  fireEvent.press(screen.getByRole("button", { name: "Send nudge" }));

  expect(await screen.findByText("Check the box to text them, or clear the number to just email them.")).toBeTruthy();
  expect(mockNudge).not.toHaveBeenCalled();
});

it("remembers that they said texts are OK", async () => {
  mockGetById.mockResolvedValue({
    id: 7,
    name: "Family Secret Santa",
    status: "inviting",
    exchange_participants: [{ ...ana, phone: "+12893797875", text_consent_at: "2026-11-07T15:00:00Z" }],
  });
  mockNudge.mockResolvedValue({ participant: { ...ana, can_nudge: false }, emailed: true, text: "sent", text_error: null });
  render(<NudgeExchangeParticipantScreen />);

  expect((await screen.findByRole("checkbox")).props.accessibilityState).toEqual({ checked: true });
  fireEvent.press(screen.getByRole("button", { name: "Send nudge" }));

  await waitFor(() =>
    expect(mockNudge).toHaveBeenCalledWith(7, 2, { email: "ana@example.com", phone: "(289) 379-7875", text_consent: true })
  );
});

it("tells the organizer when the text didn't go through", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  mockNudge.mockResolvedValue({
    participant: ana, emailed: true, text: "failed", text_error: "That number can't get texts. It may be a landline.",
  });
  render(<NudgeExchangeParticipantScreen />);

  fireEvent.press(await screen.findByRole("button", { name: "Send nudge" }));

  await waitFor(() =>
    expect(alert).toHaveBeenCalledWith("Emailed, but no text", "Ana got the email. That number can't get texts. It may be a landline.")
  );
});

it("shows why a nudge was refused and stays open", async () => {
  mockNudge.mockRejectedValue(new Error("You already nudged Ana today. You can nudge them again tomorrow."));
  render(<NudgeExchangeParticipantScreen />);

  fireEvent.press(await screen.findByRole("button", { name: "Send nudge" }));

  expect(await screen.findByText("You already nudged Ana today. You can nudge them again tomorrow.")).toBeTruthy();
  expect(mockRouter.back).not.toHaveBeenCalled();
});
