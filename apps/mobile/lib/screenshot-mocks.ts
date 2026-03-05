import type { GiftExchange, Holiday, Person } from "@niftygifty/types";
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
    notes: "Loves practical gifts and travel gear.",
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
    notes: "Coffee fan and home decor enthusiast.",
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
    notes: "Prefers books and wellness experiences.",
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
    notes: "Likes desk accessories and tea.",
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
    notes: "Outdoor and camping gear.",
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

const exchangesStore: GiftExchange[] = [
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
        notes: data.notes || null,
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
  },
  gifts: giftsService,
  giftStatuses: giftStatusesService,
  wishlistItems: wishlistItemsService,
  exchangeInvites: exchangeInvitesService,
} as const;
