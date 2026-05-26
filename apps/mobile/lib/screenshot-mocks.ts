import type {
  ExchangeExclusion,
  ExchangeParticipant,
  GiftExchange,
  GiftExchangeWithParticipants,
  Holiday,
  Person,
  WishlistItem,
} from "@niftygifty/types";
import {
  exchangeInvitesService,
  giftStatusesService,
  giftsService,
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
    can_start: false,
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

let exchangeParticipantsStore: Record<number, ExchangeParticipant[]> = {
  301: [
    {
      id: 401,
      gift_exchange_id: 301,
      user_id: 1,
      name: "Marie Reviewer",
      email: "marie@gifts.com",
      status: "accepted",
      display_name: "Marie",
      has_user: true,
      wishlist_count: 3,
      invite_token: "review-marie-301",
      matched_participant_id: 402,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 402,
      gift_exchange_id: 301,
      user_id: null,
      name: "Sam Lee",
      email: "sam.lee@gifts.com",
      status: "accepted",
      display_name: "Sam Lee",
      has_user: true,
      wishlist_count: 3,
      invite_token: "review-sam-301",
      matched_participant_id: 403,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 403,
      gift_exchange_id: 301,
      user_id: null,
      name: "Nina Rivera",
      email: "nina.rivera@gifts.com",
      status: "accepted",
      display_name: "Nina Rivera",
      has_user: true,
      wishlist_count: 2,
      invite_token: "review-nina-301",
      matched_participant_id: 404,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 404,
      gift_exchange_id: 301,
      user_id: null,
      name: "Alex Parker",
      email: "alex.parker@gifts.com",
      status: "accepted",
      display_name: "Alex Parker",
      has_user: true,
      wishlist_count: 2,
      invite_token: "review-alex-301",
      matched_participant_id: 405,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 405,
      gift_exchange_id: 301,
      user_id: null,
      name: "Jordan Kim",
      email: "jordan.kim@gifts.com",
      status: "accepted",
      display_name: "Jordan Kim",
      has_user: true,
      wishlist_count: 1,
      invite_token: "review-jordan-301",
      matched_participant_id: 406,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 406,
      gift_exchange_id: 301,
      user_id: null,
      name: "Priya Shah",
      email: "priya.shah@gifts.com",
      status: "accepted",
      display_name: "Priya Shah",
      has_user: true,
      wishlist_count: 2,
      invite_token: "review-priya-301",
      matched_participant_id: 407,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 407,
      gift_exchange_id: 301,
      user_id: null,
      name: "Theo Morgan",
      email: "theo.morgan@gifts.com",
      status: "accepted",
      display_name: "Theo Morgan",
      has_user: true,
      wishlist_count: 1,
      invite_token: "review-theo-301",
      matched_participant_id: 408,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 408,
      gift_exchange_id: 301,
      user_id: null,
      name: "Riley Chen",
      email: "riley.chen@gifts.com",
      status: "invited",
      display_name: "Riley Chen",
      has_user: false,
      wishlist_count: 0,
      invite_token: "review-riley-301",
      matched_participant_id: 401,
      created_at: nowIso,
      updated_at: nowIso,
    },
  ],
  302: [
    {
      id: 421,
      gift_exchange_id: 302,
      user_id: 1,
      name: "Marie Reviewer",
      email: "marie@gifts.com",
      status: "accepted",
      display_name: "Marie",
      has_user: true,
      wishlist_count: 2,
      invite_token: "review-marie-302",
      matched_participant_id: null,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 422,
      gift_exchange_id: 302,
      user_id: null,
      name: "Chris Nolan",
      email: "chris.nolan@studio.com",
      status: "accepted",
      display_name: "Chris Nolan",
      has_user: true,
      wishlist_count: 1,
      invite_token: "review-chris-302",
      matched_participant_id: null,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 423,
      gift_exchange_id: 302,
      user_id: null,
      name: "Ava Brooks",
      email: "ava.brooks@studio.com",
      status: "accepted",
      display_name: "Ava Brooks",
      has_user: true,
      wishlist_count: 1,
      invite_token: "review-ava-302",
      matched_participant_id: null,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 424,
      gift_exchange_id: 302,
      user_id: null,
      name: "Morgan Hart",
      email: "morgan.hart@studio.com",
      status: "accepted",
      display_name: "Morgan Hart",
      has_user: true,
      wishlist_count: 0,
      invite_token: "review-morgan-302",
      matched_participant_id: null,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 425,
      gift_exchange_id: 302,
      user_id: null,
      name: "Luis Ortega",
      email: "luis.ortega@studio.com",
      status: "invited",
      display_name: "Luis Ortega",
      has_user: false,
      wishlist_count: 0,
      invite_token: "review-luis-302",
      matched_participant_id: null,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 426,
      gift_exchange_id: 302,
      user_id: null,
      name: "Eden Fox",
      email: "eden.fox@studio.com",
      status: "invited",
      display_name: "Eden Fox",
      has_user: false,
      wishlist_count: 0,
      invite_token: "review-eden-302",
      matched_participant_id: null,
      created_at: nowIso,
      updated_at: nowIso,
    },
  ],
  303: [
    {
      id: 441,
      gift_exchange_id: 303,
      user_id: 1,
      name: "Marie Reviewer",
      email: "marie@gifts.com",
      status: "accepted",
      display_name: "Marie",
      has_user: true,
      wishlist_count: 2,
      invite_token: "review-marie-303",
      matched_participant_id: 442,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 442,
      gift_exchange_id: 303,
      user_id: null,
      name: "Kai Bennett",
      email: "kai.bennett@gifts.com",
      status: "accepted",
      display_name: "Kai Bennett",
      has_user: true,
      wishlist_count: 2,
      invite_token: "review-kai-303",
      matched_participant_id: 441,
      created_at: nowIso,
      updated_at: nowIso,
    },
  ],
};

let wishlistItemsStore: Record<number, WishlistItem[]> = {
  401: [
    {
      id: 701,
      exchange_participant_id: 401,
      name: "Travel coffee mug",
      description: "Leakproof and easy to pack.",
      link: "https://listygifty.com/example/travel-mug",
      price: "32.00",
      photo_url: null,
      has_photo: false,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 702,
      exchange_participant_id: 401,
      name: "Weekend packing cubes",
      description: "Neutral colors preferred.",
      link: null,
      price: "28.00",
      photo_url: null,
      has_photo: false,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 703,
      exchange_participant_id: 401,
      name: "Bookstore gift card",
      description: "Any local bookstore works.",
      link: null,
      price: "25.00",
      photo_url: null,
      has_photo: false,
      created_at: nowIso,
      updated_at: nowIso,
    },
  ],
  402: [
    {
      id: 711,
      exchange_participant_id: 402,
      name: "Ceramic pour-over set",
      description: "White or slate, no glass carafe.",
      link: "https://listygifty.com/example/pour-over",
      price: "48.00",
      photo_url: null,
      has_photo: false,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 712,
      exchange_participant_id: 402,
      name: "Home office plant",
      description: "Low maintenance for indirect light.",
      link: null,
      price: "30.00",
      photo_url: null,
      has_photo: false,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 713,
      exchange_participant_id: 402,
      name: "Wool desk mat",
      description: "Warm gray if available.",
      link: null,
      price: "42.00",
      photo_url: null,
      has_photo: false,
      created_at: nowIso,
      updated_at: nowIso,
    },
  ],
};

let nextPersonId = 200;
let nextExchangeId = 400;
let nextExchangeParticipantId = 500;
let nextExchangeExclusionId = 600;
let nextWishlistItemId = 800;
let exchangeExclusionsStore: ExchangeExclusion[] = [];

function getExchangeParticipants(exchangeId: number): ExchangeParticipant[] {
  return exchangeParticipantsStore[exchangeId] ?? [];
}

function getParticipantWishlist(participantId: number): WishlistItem[] {
  return wishlistItemsStore[participantId] ?? [];
}

function withMatchedParticipant(
  participant: ExchangeParticipant,
  participants: ExchangeParticipant[]
): ExchangeParticipant {
  const matchedParticipant = participants.find(
    (item) => item.id === participant.matched_participant_id
  );

  if (!matchedParticipant) {
    return participant;
  }

  return {
    ...participant,
    matched_participant: {
      ...matchedParticipant,
      wishlist_items: getParticipantWishlist(matchedParticipant.id),
    },
  };
}

function getExchangeParticipantsWithMatches(exchangeId: number): ExchangeParticipant[] {
  const participants = getExchangeParticipants(exchangeId);
  return participants.map((participant) => withMatchedParticipant(participant, participants));
}

function buildExchangeSummary(exchange: GiftExchange): GiftExchange {
  const participants = getExchangeParticipantsWithMatches(exchange.id);
  const myParticipant = participants.find((participant) => participant.user_id === 1) ?? null;

  if (participants.length === 0) {
    return exchange;
  }

  return {
    ...exchange,
    accepted_count: participants.filter((participant) => participant.status === "accepted").length,
    my_participant: myParticipant,
    participant_count: participants.length,
  };
}

function buildExchangeWithParticipants(exchange: GiftExchange): GiftExchangeWithParticipants {
  const summary = buildExchangeSummary(exchange);
  const participants = getExchangeParticipantsWithMatches(exchange.id);

  return {
    ...summary,
    exchange_participants: participants,
  };
}

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
      return clone(exchangesStore.map(buildExchangeSummary));
    },
    async getById(id: number) {
      const exchange = exchangesStore.find((item) => item.id === id);

      if (!exchange) {
        throw new Error("Exchange not found");
      }

      return clone(buildExchangeWithParticipants(exchange));
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
      const exchange = exchangesStore.find((item) => item.id === id);

      if (!exchange) {
        throw new Error("Exchange not found");
      }

      return clone(buildExchangeWithParticipants(exchange));
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
      exchangeParticipantsStore = {
        ...exchangeParticipantsStore,
        [exchangeId]: [...getExchangeParticipants(exchangeId), participant],
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
      const participants = getExchangeParticipants(exchangeId);
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
  wishlistItems: {
    async getAll(_exchangeId: number, participantId: number) {
      return clone(getParticipantWishlist(participantId));
    },
    async getById(_exchangeId: number, participantId: number, itemId: number) {
      const item = getParticipantWishlist(participantId).find(
        (wishlistItem) => wishlistItem.id === itemId
      );

      if (!item) {
        throw new Error("Wishlist item not found");
      }

      return clone(item);
    },
    async create(_exchangeId: number, participantId: number, data: Partial<WishlistItem>) {
      const item: WishlistItem = {
        id: nextWishlistItemId++,
        exchange_participant_id: participantId,
        name: data.name || "New wish",
        description: data.description ?? null,
        link: data.link ?? null,
        price: data.price ?? null,
        photo_url: data.photo_url ?? null,
        has_photo: data.has_photo ?? Boolean(data.photo_url),
        created_at: nowIso,
        updated_at: nowIso,
      };
      wishlistItemsStore = {
        ...wishlistItemsStore,
        [participantId]: [item, ...getParticipantWishlist(participantId)],
      };
      exchangeParticipantsStore = {
        ...exchangeParticipantsStore,
        ...Object.fromEntries(
          Object.entries(exchangeParticipantsStore).map(([exchangeId, participants]) => [
            exchangeId,
            participants.map((participant) =>
              participant.id === participantId
                ? {
                    ...participant,
                    wishlist_count: getParticipantWishlist(participantId).length,
                    updated_at: nowIso,
                  }
                : participant
            ),
          ])
        ),
      };
      return clone(item);
    },
    async update(
      _exchangeId: number,
      participantId: number,
      itemId: number,
      data: Partial<WishlistItem>
    ) {
      wishlistItemsStore = {
        ...wishlistItemsStore,
        [participantId]: getParticipantWishlist(participantId).map((item) =>
          item.id === itemId ? { ...item, ...data, updated_at: nowIso } : item
        ),
      };
      const item = getParticipantWishlist(participantId).find(
        (wishlistItem) => wishlistItem.id === itemId
      );

      if (!item) {
        throw new Error("Wishlist item not found");
      }

      return clone(item);
    },
    async delete(_exchangeId: number, participantId: number, itemId: number) {
      wishlistItemsStore = {
        ...wishlistItemsStore,
        [participantId]: getParticipantWishlist(participantId).filter((item) => item.id !== itemId),
      };
    },
    async uploadPhoto(_exchangeId: number, participantId: number, itemId: number, _formData: FormData) {
      wishlistItemsStore = {
        ...wishlistItemsStore,
        [participantId]: getParticipantWishlist(participantId).map((item) =>
          item.id === itemId
            ? {
                ...item,
                has_photo: true,
                photo_url: "screenshot-photo",
                updated_at: nowIso,
              }
            : item
        ),
      };
      const item = getParticipantWishlist(participantId).find(
        (wishlistItem) => wishlistItem.id === itemId
      );

      if (!item) {
        throw new Error("Wishlist item not found");
      }

      return clone(item);
    },
  },
  exchangeInvites: exchangeInvitesService,
} as const;
