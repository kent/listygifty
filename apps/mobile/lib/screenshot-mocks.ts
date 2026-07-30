import type {
  AcceptInviteResponse,
  ExchangeExclusion,
  ExchangeInviteDetails,
  ExchangeParticipant,
  Gift,
  GiftExchange,
  GiftExchangeWithParticipants,
  GiftStatus,
  Holiday,
  HolidayCollaborator,
  Person,
  ShareLinkResponse,
  WishlistItem,
} from "@niftygifty/types";

const nowIso = "2026-03-03T00:00:00.000Z";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let giftStatusesStore: GiftStatus[] = [
  {
    id: 1,
    name: "Idea",
    position: 1,
    color: "#2563eb",
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 2,
    name: "Researching",
    position: 2,
    color: "#7c3aed",
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 3,
    name: "Purchased",
    position: 3,
    color: "#16a34a",
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 4,
    name: "Wrapped",
    position: 4,
    color: "#dc2626",
    created_at: nowIso,
    updated_at: nowIso,
  },
];

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

const holidayTemplatesStore: Holiday[] = [
  {
    id: 901,
    name: "Birthday",
    date: null,
    icon: "cake",
    is_template: true,
    completed: false,
    archived: false,
    share_token: null,
    is_owner: true,
    role: "owner",
    collaborator_count: 0,
    created_at: nowIso,
    updated_at: nowIso,
  },
  {
    id: 902,
    name: "Holiday",
    date: null,
    icon: "gift",
    is_template: true,
    completed: false,
    archived: false,
    share_token: null,
    is_owner: true,
    role: "owner",
    collaborator_count: 0,
    created_at: nowIso,
    updated_at: nowIso,
  },
];

let holidayCollaboratorsStore: Record<number, HolidayCollaborator[]> = {
  201: [
    {
      user_id: 1,
      email: "marie@gifts.com",
      first_name: "Marie",
      last_name: "Reviewer",
      image_url: null,
      role: "owner",
    },
    {
      user_id: 2,
      email: "alex.parker@gifts.com",
      first_name: "Alex",
      last_name: "Parker",
      image_url: null,
      role: "collaborator",
    },
  ],
  202: [
    {
      user_id: 1,
      email: "marie@gifts.com",
      first_name: "Marie",
      last_name: "Reviewer",
      image_url: null,
      role: "owner",
    },
  ],
  203: [
    {
      user_id: 1,
      email: "marie@gifts.com",
      first_name: "Marie",
      last_name: "Reviewer",
      image_url: null,
      role: "owner",
    },
    {
      user_id: 3,
      email: "sam.lee@gifts.com",
      first_name: "Sam",
      last_name: "Lee",
      image_url: null,
      role: "collaborator",
    },
    {
      user_id: 4,
      email: "nina.rivera@gifts.com",
      first_name: "Nina",
      last_name: "Rivera",
      image_url: null,
      role: "collaborator",
    },
    {
      user_id: 5,
      email: "jordan.kim@gifts.com",
      first_name: "Jordan",
      last_name: "Kim",
      image_url: null,
      role: "collaborator",
    },
  ],
};

const screenshotGiftCreator = {
  id: 1,
  email: "marie@gifts.com",
  first_name: "Marie",
  last_name: "Reviewer",
  safe_name: "Marie Reviewer",
};

function getHolidayById(id: number): Holiday {
  const holiday = holidaysStore.find((item) => item.id === id);
  if (!holiday) {
    throw new Error("Holiday not found");
  }
  return holiday;
}

function getGiftStatusById(id: number): GiftStatus {
  return giftStatusesStore.find((status) => status.id === id) ?? giftStatusesStore[0];
}

function getPeopleByIds(ids: number[] | undefined): Person[] {
  if (!ids || ids.length === 0) {
    return [];
  }

  return peopleStore.filter((person) => ids.includes(person.id));
}

function buildGiftRecipientLinks(giftId: number, recipients: Person[]): Gift["gift_recipients"] {
  return recipients.map((person, index) => ({
    id: giftId * 10 + index,
    person_id: person.id,
    shipping_address_id: null,
    person,
    shipping_address: null,
    created_at: nowIso,
    updated_at: nowIso,
  }));
}

function buildGift(
  id: number,
  data: {
    name: string;
    description?: string | null;
    link?: string | null;
    cost?: string | null;
    holidayId: number;
    statusId: number;
    position: number;
    recipientIds?: number[];
    giverIds?: number[];
  }
): Gift {
  const recipients = getPeopleByIds(data.recipientIds);
  const givers = getPeopleByIds(data.giverIds);
  return {
    id,
    name: data.name,
    description: data.description ?? null,
    link: data.link ?? null,
    cost: data.cost ?? null,
    holiday_id: data.holidayId,
    gift_status_id: data.statusId,
    position: data.position,
    gift_status: getGiftStatusById(data.statusId),
    holiday: getHolidayById(data.holidayId),
    recipients,
    givers,
    gift_recipients: buildGiftRecipientLinks(id, recipients),
    created_by: screenshotGiftCreator,
    is_mine: true,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

let giftsStore: Gift[] = [
  buildGift(501, {
    name: "Noise-cancelling headphones",
    description: "Comfortable over-ear pair for Alex's commute.",
    link: "https://listygifty.com/example/headphones",
    cost: "149.00",
    holidayId: 201,
    statusId: 1,
    position: 1,
    recipientIds: [101],
    giverIds: [102],
  }),
  buildGift(502, {
    name: "Custom photo book",
    description: "Use the summer trip photos and leave space for notes.",
    link: null,
    cost: "42.00",
    holidayId: 201,
    statusId: 2,
    position: 2,
    recipientIds: [101],
    giverIds: [103],
  }),
  buildGift(503, {
    name: "Wellness spa voucher",
    description: "Downtown location, no expiry if available.",
    link: "https://listygifty.com/example/spa",
    cost: "95.00",
    holidayId: 202,
    statusId: 3,
    position: 1,
    recipientIds: [103],
    giverIds: [101],
  }),
  buildGift(504, {
    name: "Insulated camp mug set",
    description: "Two-pack for winter trail days.",
    link: "https://listygifty.com/example/camp-mugs",
    cost: "38.00",
    holidayId: 203,
    statusId: 1,
    position: 1,
    recipientIds: [105],
    giverIds: [101],
  }),
  buildGift(505, {
    name: "Desk tea sampler",
    description: "Caffeine-free options for the office.",
    link: null,
    cost: "24.00",
    holidayId: 203,
    statusId: 4,
    position: 2,
    recipientIds: [104],
    giverIds: [102],
  }),
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
let nextHolidayId = 250;
let nextGiftId = 550;
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

function formatGiftCost(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return value.toFixed(2);
  }

  return value;
}

function normalizeGift(gift: Gift): Gift {
  const recipients = getPeopleByIds(gift.recipients.map((recipient) => recipient.id));
  const givers = getPeopleByIds(gift.givers.map((giver) => giver.id));

  return {
    ...gift,
    gift_status: getGiftStatusById(gift.gift_status_id),
    holiday: getHolidayById(gift.holiday_id),
    recipients,
    givers,
    gift_recipients: buildGiftRecipientLinks(gift.id, recipients),
  };
}

function getGiftById(id: number): Gift {
  const gift = giftsStore.find((item) => item.id === id);
  if (!gift) {
    throw new Error("Gift not found");
  }

  return normalizeGift(gift);
}

function getGifts(options?: { holidayId?: number }): Gift[] {
  const holidayId = options?.holidayId;
  return giftsStore
    .filter((gift) => !holidayId || gift.holiday_id === holidayId)
    .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name))
    .map(normalizeGift);
}

type GiftMutationData = Omit<Partial<Gift>, "cost"> & {
  cost?: string | number | null;
  giver_ids?: number[];
  recipient_ids?: number[];
};

function applyGiftMutation(gift: Gift, data: GiftMutationData): Gift {
  const recipientIds = Array.isArray(data.recipient_ids)
    ? data.recipient_ids
    : gift.recipients.map((recipient) => recipient.id);
  const giverIds = Array.isArray(data.giver_ids)
    ? data.giver_ids
    : gift.givers.map((giver) => giver.id);
  const holidayId = data.holiday_id ?? gift.holiday_id;
  const statusId = data.gift_status_id ?? gift.gift_status_id;
  const recipients = getPeopleByIds(recipientIds);
  const givers = getPeopleByIds(giverIds);

  return {
    ...gift,
    ...data,
    description: data.description === undefined ? gift.description : data.description,
    link: data.link === undefined ? gift.link : data.link,
    cost: data.cost === undefined ? gift.cost : formatGiftCost(data.cost),
    holiday_id: holidayId,
    gift_status_id: statusId,
    gift_status: getGiftStatusById(statusId),
    holiday: getHolidayById(holidayId),
    recipients,
    givers,
    gift_recipients: buildGiftRecipientLinks(gift.id, recipients),
    updated_at: nowIso,
  };
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
    async getTemplates() {
      return clone(holidayTemplatesStore);
    },
    async getById(id: number) {
      return clone(getHolidayById(id));
    },
    async create(data: Partial<Holiday>) {
      const holiday: Holiday = {
        id: nextHolidayId++,
        name: data.name || "New Gift List",
        date: data.date ?? null,
        icon: data.icon ?? "gift",
        is_template: false,
        completed: data.completed ?? false,
        archived: data.archived ?? false,
        share_token: `review-list-${nextHolidayId}`,
        is_owner: true,
        role: "owner",
        collaborator_count: 1,
        created_at: nowIso,
        updated_at: nowIso,
      };
      holidaysStore = [holiday, ...holidaysStore];
      holidayCollaboratorsStore = {
        ...holidayCollaboratorsStore,
        [holiday.id]: [
          {
            user_id: 1,
            email: "marie@gifts.com",
            first_name: "Marie",
            last_name: "Reviewer",
            image_url: null,
            role: "owner",
          },
        ],
      };
      return clone(holiday);
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
    async delete(id: number) {
      holidaysStore = holidaysStore.filter((holiday) => holiday.id !== id);
      giftsStore = giftsStore.filter((gift) => gift.holiday_id !== id);
      delete holidayCollaboratorsStore[id];
    },
    async getShareLink(id: number): Promise<ShareLinkResponse> {
      const holiday = getHolidayById(id);
      const shareToken = holiday.share_token || `review-list-${id}`;
      return clone({
        share_token: shareToken,
        share_url: `https://listygifty.com/lists/join/${shareToken}`,
      });
    },
    async regenerateShareLink(id: number): Promise<ShareLinkResponse> {
      const shareToken = `review-list-${id}-fresh`;
      holidaysStore = holidaysStore.map((holiday) =>
        holiday.id === id ? { ...holiday, share_token: shareToken, updated_at: nowIso } : holiday
      );
      return clone({
        share_token: shareToken,
        share_url: `https://listygifty.com/lists/join/${shareToken}`,
      });
    },
    async join(shareToken: string) {
      const holiday = holidaysStore.find((item) => item.share_token === shareToken);
      if (!holiday) {
        throw new Error("Holiday share link not found");
      }
      return clone({ ...holiday, is_owner: false, role: "collaborator" as const });
    },
    async leave(id: number) {
      holidaysStore = holidaysStore.filter((holiday) => holiday.id !== id || holiday.is_owner);
    },
    async getCollaborators(id: number) {
      return clone(holidayCollaboratorsStore[id] ?? []);
    },
    async removeCollaborator(holidayId: number, userId: number) {
      holidayCollaboratorsStore = {
        ...holidayCollaboratorsStore,
        [holidayId]: (holidayCollaboratorsStore[holidayId] ?? []).filter(
          (collaborator) => collaborator.user_id !== userId
        ),
      };
      holidaysStore = holidaysStore.map((holiday) =>
        holiday.id === holidayId
          ? {
              ...holiday,
              collaborator_count: holidayCollaboratorsStore[holidayId]?.length ?? 0,
              updated_at: nowIso,
            }
          : holiday
      );
    },
  },
  people: {
    async getAll() {
      return clone(peopleStore);
    },
    async getById(id: number) {
      const person = peopleStore.find((item) => item.id === id);
      if (!person) {
        throw new Error("Person not found");
      }
      return clone(person);
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
    async create(data: Partial<GiftExchange> & { include_creator?: boolean }) {
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
      if (data.include_creator !== false) {
        const participant: ExchangeParticipant = {
          id: nextExchangeParticipantId++,
          gift_exchange_id: exchange.id,
          user_id: 1,
          name: `${screenshotProfile.firstName} ${screenshotProfile.lastName}`,
          email: screenshotProfile.email,
          status: "accepted",
          display_name: screenshotProfile.firstName,
          has_user: true,
          wishlist_count: 0,
          invite_token: `creator-${exchange.id}`,
          matched_participant_id: null,
          created_at: nowIso,
          updated_at: nowIso,
        };
        exchangeParticipantsStore = {
          ...exchangeParticipantsStore,
          [exchange.id]: [participant],
        };
      }
      return clone(buildExchangeSummary(exchange));
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
  gifts: {
    async getAll(options?: { holidayId?: number }) {
      return clone(getGifts(options));
    },
    async getById(id: number) {
      return clone(getGiftById(id));
    },
    async create(data: GiftMutationData & { holiday_id: number; name: string; gift_status_id: number }) {
      const existingPositions = giftsStore
        .filter((gift) => gift.holiday_id === data.holiday_id)
        .map((gift) => gift.position);
      const position = data.position ?? Math.max(0, ...existingPositions) + 1;
      const gift = buildGift(nextGiftId++, {
        name: data.name || "New Gift",
        description: data.description ?? null,
        link: data.link ?? null,
        cost: formatGiftCost(data.cost),
        holidayId: data.holiday_id,
        statusId: data.gift_status_id,
        position,
        recipientIds: data.recipient_ids,
        giverIds: data.giver_ids,
      });
      giftsStore = [gift, ...giftsStore];
      return clone(normalizeGift(gift));
    },
    async update(id: number, data: GiftMutationData) {
      giftsStore = giftsStore.map((gift) =>
        gift.id === id ? applyGiftMutation(gift, data) : gift
      );
      return clone(getGiftById(id));
    },
    async delete(id: number) {
      giftsStore = giftsStore.filter((gift) => gift.id !== id);
    },
    async reorder(id: number, newPosition: number) {
      const gift = getGiftById(id);
      giftsStore = giftsStore.map((item) =>
        item.id === id ? { ...item, position: newPosition, updated_at: nowIso } : item
      );
      return clone(getGifts({ holidayId: gift.holiday_id }));
    },
    async updateRecipientAddress(giftId: number, recipientId: number, shippingAddressId: number | null) {
      giftsStore = giftsStore.map((gift) =>
        gift.id === giftId
          ? {
              ...gift,
              gift_recipients: gift.gift_recipients.map((recipient) =>
                recipient.person_id === recipientId
                  ? { ...recipient, shipping_address_id: shippingAddressId, updated_at: nowIso }
                  : recipient
              ),
              updated_at: nowIso,
            }
          : gift
      );
      return clone(getGiftById(giftId));
    },
  },
  giftStatuses: {
    async getAll() {
      return clone(giftStatusesStore);
    },
  },
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
  exchangeInvites: {
    async getByToken(token: string): Promise<ExchangeInviteDetails> {
      for (const exchange of exchangesStore) {
        const participant = getExchangeParticipants(exchange.id).find(
          (item) => item.invite_token === token
        );

        if (participant) {
          return clone({
            exchange: {
              id: exchange.id,
              name: exchange.name,
              exchange_date: exchange.exchange_date,
              budget_min: exchange.budget_min,
              budget_max: exchange.budget_max,
              owner_name: exchange.is_owner ? "Marie Reviewer" : "Gift Exchange Host",
            },
            participant: {
              name: participant.name,
              email: participant.email || "",
              status: participant.status,
            },
          });
        }
      }

      throw new Error("Invite not found");
    },
    async accept(token: string): Promise<AcceptInviteResponse> {
      let acceptedParticipant: ExchangeParticipant | null = null;
      let acceptedExchange: GiftExchange | null = null;

      exchangeParticipantsStore = Object.fromEntries(
        Object.entries(exchangeParticipantsStore).map(([exchangeId, participants]) => [
          exchangeId,
          participants.map((participant) => {
            if (participant.invite_token !== token) {
              return participant;
            }

            acceptedParticipant = {
              ...participant,
              user_id: 1,
              status: "accepted",
              has_user: true,
              updated_at: nowIso,
            };
            acceptedExchange = exchangesStore.find(
              (exchange) => exchange.id === Number.parseInt(exchangeId, 10)
            ) ?? null;
            return acceptedParticipant;
          }),
        ])
      );

      if (!acceptedParticipant || !acceptedExchange) {
        throw new Error("Invite not found");
      }

      const exchange = buildExchangeSummary(acceptedExchange);
      return clone({
        message: "Invitation accepted",
        exchange,
        participant: acceptedParticipant,
      });
    },
    async decline(token: string) {
      let found = false;

      exchangeParticipantsStore = Object.fromEntries(
        Object.entries(exchangeParticipantsStore).map(([exchangeId, participants]) => [
          exchangeId,
          participants.map((participant) => {
            if (participant.invite_token !== token) {
              return participant;
            }

            found = true;
            return {
              ...participant,
              status: "declined" as const,
              updated_at: nowIso,
            };
          }),
        ])
      );

      if (!found) {
        throw new Error("Invite not found");
      }

      return clone({ message: "Invitation declined" });
    },
  },
} as const;
