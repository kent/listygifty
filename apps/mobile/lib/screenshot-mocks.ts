import type {
  ExchangeExclusion,
  ExchangeParticipant,
  GiftExchange,
  Holiday,
  Person,
} from "@niftygifty/types";
import {
  exchangeInvitesService,
  giftStatusesService,
  giftsService,
  wishlistItemsService,
} from "@/lib/api";

const nowIso = "2026-03-03T00:00:00.000Z";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let peopleStore: Person[] = [
  {
    id: 101,
    name: "Alex Parker",
    email: "alex.parker@gifts.com",
    relationship: "partner",
    age: null,
    gender: null,
    birthday: "1991-06-12",
    milestone_label: null,
    milestone_date: null,
    notes: "Loves practical gifts and travel gear.",
    default_shipping_address_id: null,
    default_shipping_address: null,
    gift_count: 6,
    user_id: 1,
    is_mine: true,
    is_shared: false,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 102,
    name: "Sam Lee",
    email: "sam.lee@gifts.com",
    relationship: "friend",
    age: null,
    gender: null,
    birthday: "1990-05-27",
    milestone_label: null,
    milestone_date: null,
    notes: "Coffee fan and home decor enthusiast.",
    default_shipping_address_id: null,
    default_shipping_address: null,
    gift_count: 4,
    user_id: 1,
    is_mine: true,
    is_shared: false,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 103,
    name: "Nina Rivera",
    email: "nina.rivera@gifts.com",
    relationship: "parent",
    age: null,
    gender: null,
    birthday: "1968-05-26",
    milestone_label: null,
    milestone_date: null,
    notes: "Prefers books and wellness experiences.",
    default_shipping_address_id: null,
    default_shipping_address: null,
    gift_count: 8,
    user_id: 1,
    is_mine: true,
    is_shared: true,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 104,
    name: "Chris Nolan",
    email: "chris.nolan@studio.com",
    relationship: "coworker",
    age: null,
    gender: null,
    birthday: null,
    milestone_label: "Work anniversary",
    milestone_date: "2026-06-10",
    notes: "Likes desk accessories and tea.",
    default_shipping_address_id: null,
    default_shipping_address: null,
    gift_count: 3,
    user_id: 1,
    is_mine: true,
    is_shared: false,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 105,
    name: "Jordan Kim",
    email: "jordan.kim@gifts.com",
    relationship: "best-friend",
    age: null,
    gender: null,
    birthday: null,
    milestone_label: null,
    milestone_date: null,
    notes: "Outdoor and camping gear.",
    default_shipping_address_id: null,
    default_shipping_address: null,
    gift_count: 5,
    user_id: 1,
    is_mine: true,
    is_shared: false,
    created_at: nowIso,
    updated_at: nowIso,
  },
];

let holidaysStore: Holiday[] = [
  {
    id: 201,
    name: "Birthday Bash 2026",
    date: "2026-06-12",
    icon: "cake",
    is_template: false,
    completed: false,
    archived: false,
    share_token: "review-birthday-2026",
    is_owner: true,
    role: "owner",
    collaborator_count: 2,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 202,
    name: "Mother's Day 2026",
    date: "2026-05-10",
    icon: "heart-handshake",
    is_template: false,
    completed: false,
    archived: false,
    share_token: "review-mothers-day-2026",
    is_owner: true,
    role: "owner",
    collaborator_count: 1,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 203,
    name: "Holiday Season 2026",
    date: "2026-12-25",
    icon: "gift",
    is_template: false,
    completed: false,
    archived: false,
    share_token: "review-holiday-season-2026",
    is_owner: true,
    role: "owner",
    collaborator_count: 4,
    created_at: nowIso,
    updated_at: nowIso,
  },
];

let exchangesStore: GiftExchange[] = [
  {
    id: 301,
    name: "Family Secret Santa",
    exchange_date: "2026-12-20",
    status: "active",
    budget_min: "30.0",
    budget_max: "75.0",
    user_id: 1,
    is_owner: true,
    participant_count: 8,
    accepted_count: 7,
    can_start: true,
    my_participant: null,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 302,
    name: "Design Team Gift Swap",
    exchange_date: "2026-11-14",
    status: "inviting",
    budget_min: "20.0",
    budget_max: "40.0",
    user_id: 7,
    is_owner: false,
    participant_count: 6,
    accepted_count: 4,
    can_start: false,
    my_participant: null,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 303,
    name: "Neighbors Winter Exchange",
    exchange_date: "2026-12-08",
    status: "completed",
    budget_min: "15.0",
    budget_max: "30.0",
    user_id: 1,
    is_owner: true,
    participant_count: 10,
    accepted_count: 10,
    can_start: false,
    my_participant: null,
    created_at: nowIso,
    updated_at: nowIso,
  },
];

let nextPersonId = 200;
let nextExchangeId = 400;
let nextExchangeParticipantId = 500;
let nextExchangeExclusionId = 600;
let exchangeExclusionsStore: ExchangeExclusion[] = [];

export const screenshotProfile = {
  firstName: "Marie",
  lastName: "Reviewer",
  email: "marie@gifts.com",
};

export const screenshotServices = {
  holidays: {
    async getAll() {
      return clone(holidaysStore);
    },
    async update(id: number, data: Partial<Holiday>) {
      holidaysStore = holidaysStore.map((holiday) =>
        holiday.id === id
          ? {
              ...holiday,
              ...data,
              updated_at: nowIso,
            }
          : holiday
      );
      return clone(holidaysStore.find((holiday) => holiday.id === id) as Holiday);
    },
  },
  people: {
    async getAll() {
      return clone(peopleStore);
    },
    async create(data: Partial<Person>) {
      const person: Person = {
        id: nextPersonId++,
        name: data.name || "New Person",
        email: data.email || null,
        relationship: data.relationship || null,
        age: null,
        gender: null,
        birthday: data.birthday || null,
        milestone_label: data.milestone_label || null,
        milestone_date: data.milestone_date || null,
        notes: data.notes || null,
        default_shipping_address_id: null,
        default_shipping_address: null,
        gift_count: 0,
        user_id: 1,
        is_mine: true,
        is_shared: false,
        created_at: nowIso,
        updated_at: nowIso,
      };
      peopleStore = [person, ...peopleStore];
      return clone(person);
    },
    async update(id: number, data: Partial<Person>) {
      peopleStore = peopleStore.map((person) =>
        person.id === id
          ? {
              ...person,
              ...data,
              updated_at: nowIso,
            }
          : person
      );
      return clone(peopleStore.find((person) => person.id === id) as Person);
    },
    async delete(id: number) {
      peopleStore = peopleStore.filter((person) => person.id !== id);
    },
  },
  giftExchanges: {
    async getAll() {
      return clone(exchangesStore);
    },
    async create(data: Partial<GiftExchange>) {
      const exchange: GiftExchange = {
        id: nextExchangeId++,
        name: data.name || "New Exchange",
        exchange_date: data.exchange_date ?? null,
        status: "draft",
        budget_min: data.budget_min ?? null,
        budget_max: data.budget_max ?? null,
        user_id: 1,
        is_owner: true,
        participant_count: 0,
        accepted_count: 0,
        can_start: false,
        my_participant: null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      exchangesStore = [exchange, ...exchangesStore];
      return clone(exchange);
    },
    async start(id: number) {
      exchangesStore = exchangesStore.map((exchange) =>
        exchange.id === id
          ? {
              ...exchange,
              status: "active",
              can_start: false,
              updated_at: nowIso,
            }
          : exchange
      );
      return clone(exchangesStore.find((exchange) => exchange.id === id) as GiftExchange);
    },
  },
  exchangeParticipants: {
    async create(exchangeId: number, data: Partial<ExchangeParticipant>) {
      const participant: ExchangeParticipant = {
        id: nextExchangeParticipantId++,
        gift_exchange_id: exchangeId,
        user_id: null,
        name: data.name || "New Participant",
        email: data.email || "participant@example.com",
        status: "invited",
        display_name: data.name || "New Participant",
        has_user: false,
        wishlist_count: 0,
        invite_token: "review-invite-token",
        matched_participant_id: null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      exchangesStore = exchangesStore.map((exchange) =>
        exchange.id === exchangeId
          ? {
              ...exchange,
              status: exchange.status === "draft" ? "inviting" : exchange.status,
              participant_count: exchange.participant_count + 1,
              updated_at: nowIso,
            }
          : exchange
      );
      return clone(participant);
    },
  },
  exchangeExclusions: {
    async getAll(exchangeId: number) {
      return clone(
        exchangeExclusionsStore.filter((exclusion) => exclusion.gift_exchange_id === exchangeId)
      );
    },
    async create(exchangeId: number, data: Partial<ExchangeExclusion>) {
      const exchange = exchangesStore.find((item) => item.id === exchangeId);
      const participants =
        (exchange as (GiftExchange & { exchange_participants?: ExchangeParticipant[] }) | undefined)
          ?.exchange_participants ?? [];
      const participantA = participants.find(
        (participant) => participant.id === data.participant_a_id
      );
      const participantB = participants.find(
        (participant) => participant.id === data.participant_b_id
      );
      const exclusion: ExchangeExclusion = {
        id: nextExchangeExclusionId++,
        gift_exchange_id: exchangeId,
        participant_a_id: data.participant_a_id || 0,
        participant_b_id: data.participant_b_id || 0,
        participant_a: {
          id: data.participant_a_id || 0,
          name: participantA?.display_name || participantA?.name || "Participant 1",
        },
        participant_b: {
          id: data.participant_b_id || 0,
          name: participantB?.display_name || participantB?.name || "Participant 2",
        },
        created_at: nowIso,
        updated_at: nowIso,
      };
      exchangeExclusionsStore = [...exchangeExclusionsStore, exclusion];
      return clone(exclusion);
    },
    async delete(_exchangeId: number, exclusionId: number) {
      exchangeExclusionsStore = exchangeExclusionsStore.filter(
        (exclusion) => exclusion.id !== exclusionId
      );
    },
  },
  gifts: giftsService,
  giftStatuses: giftStatusesService,
  wishlistItems: wishlistItemsService,
  exchangeInvites: exchangeInvitesService,
} as const;
