import { act, renderHook } from "@testing-library/react-native";
import { demoServices } from "@/lib/demo-services";
import { startDemo, endDemo, isDemoMode, useDemoMode } from "@/lib/demo-mode";
import { apiClient, configureApiSession } from "@/lib/api";
import { useServices } from "@/lib/use-api";
import type { ExchangeParticipant } from "@niftygifty/types";

beforeEach(() => startDemo());
afterEach(() => endDemo());

it("supports editing sample lists, people, gifts, and statuses", async () => {
  const list = await demoServices.holidays.create({ name: "Review gifts" });
  const person = await demoServices.people.create({ name: "Sample friend" });
  const gift = await demoServices.gifts.create({ name: "A book", holiday_id: list.id, recipient_ids: [person.id], gift_status_id: 1 });
  await demoServices.gifts.update(gift.id, { gift_status_id: 3 });
  const saved = await demoServices.gifts.getById(gift.id);
  expect(saved.recipients[0].name).toBe("Sample friend");
  expect(saved.gift_status.name).toBe("Purchased");
  await demoServices.holidays.delete(list.id);
  expect(await demoServices.gifts.getAll({ holidayId: list.id })).toEqual([]);
});

it("draws unique non-self matches and respects exclusions", async () => {
  const exchange = await demoServices.giftExchanges.create({ name: "Demo draw" });
  const participants: ExchangeParticipant[] = [];
  for (const name of ["Alex", "Sam", "Riley"]) {
    participants.push(await demoServices.exchangeParticipants.create(exchange.id, { name, email: `${name.toLowerCase()}@example.com` }));
  }
  await demoServices.exchangeExclusions.create(exchange.id, { participant_a_id: participants[0].id, participant_b_id: participants[1].id });
  const drawn = await demoServices.giftExchanges.start(exchange.id);
  expect(drawn.status).toBe("active");
  const receivers = drawn.exchange_participants.map((p) => p.matched_participant_id);
  expect(new Set(receivers).size).toBe(4);
  expect(drawn.exchange_participants.every((p) => p.id !== p.matched_participant_id)).toBe(true);
  expect(drawn.exchange_participants.find((p) => p.id === participants[0].id)?.matched_participant_id).not.toBe(participants[1].id);
  expect(drawn.my_participant?.matched_participant).toBeTruthy();
});

it("reports an impossible draw without changing the exchange", async () => {
  const exchange = await demoServices.giftExchanges.create({ name: "Blocked draw" });
  const other = await demoServices.exchangeParticipants.create(exchange.id, { name: "Alex" });
  await demoServices.exchangeExclusions.create(exchange.id, { participant_a_id: exchange.my_participant!.id, participant_b_id: other.id });
  await expect(demoServices.giftExchanges.start(exchange.id)).rejects.toThrow("prevent a complete draw");
  expect((await demoServices.giftExchanges.getById(exchange.id)).status).toBe("inviting");
});

it("resets demo edits on exit and re-entry", async () => {
  await demoServices.holidays.create({ name: "Temporary demo list" });
  endDemo(); startDemo();
  expect((await demoServices.holidays.getAll()).some((list) => list.name === "Temporary demo list")).toBe(false);
});

it("updates subscribed screens and swaps services when leaving the demo", () => {
  const mode = renderHook(useDemoMode);
  const services = renderHook(useServices);
  expect(mode.result.current).toBe(true);
  expect(services.result.current).toBe(demoServices);
  act(() => endDemo());
  expect(mode.result.current).toBe(false);
  expect(services.result.current).not.toBe(demoServices);
});

it("blocks live API access in demo even when a real session was configured", async () => {
  const token = jest.fn().mockResolvedValue("real-session-token");
  configureApiSession("real-user", token);
  expect(isDemoMode()).toBe(true);
  await expect(apiClient.post("/holidays", { holiday: { name: "Must stay local" } })).rejects.toThrow("Demo mode uses sample data");
  expect(token).not.toHaveBeenCalled();
});
