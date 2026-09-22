import type { Resource, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import type { ApiClient } from "../client.js";
import type {
  Holiday,
  Gift,
  GiftStatus,
  Person,
  BillingStatus,
} from "../types.js";

function upcomingHolidays(holidays: Holiday[]): Holiday[] {
  const today = new Date().toISOString().slice(0, 10);
  return holidays
    .filter((holiday) => !holiday.archived && !!holiday.date && holiday.date >= today)
    .sort((left, right) => left.date!.localeCompare(right.date!));
}

export const mcpResources: Resource[] = [
  {
    uri: "niftygifty://dashboard/overview",
    name: "Dashboard Overview",
    description: "Current user's gift planning summary including upcoming holidays and pending gifts",
    mimeType: "application/json",
  },
  {
    uri: "niftygifty://holidays/upcoming",
    name: "Upcoming Holidays",
    description: "Holidays sorted by date with gift counts and completion status",
    mimeType: "application/json",
  },
  {
    uri: "niftygifty://gifts/pending",
    name: "Pending Gifts",
    description: "All gifts that haven't been completed yet",
    mimeType: "application/json",
  },
  {
    uri: "niftygifty://people/frequent",
    name: "Frequent Gift Recipients",
    description: "People who receive gifts most often",
    mimeType: "application/json",
  },
  {
    uri: "niftygifty://billing/status",
    name: "Subscription Status",
    description: "Current subscription plan, gift limits, and usage",
    mimeType: "application/json",
  },
];

export async function handleResourceRead(
  client: ApiClient,
  uri: string
): Promise<ReadResourceResult> {
  try {
    let content: unknown;

    switch (uri) {
      case "niftygifty://dashboard/overview": {
        // Fetch holidays, count pending gifts
        const holidays = await client.get<Holiday[]>("/holidays");
        const billingStatus = await client.get<BillingStatus>("/billing/status");

        content = {
          upcoming_holidays: upcomingHolidays(holidays).slice(0, 5),
          total_holidays: holidays.filter((h) => !h.archived).length,
          subscription: {
            plan: billingStatus.subscription_plan,
            status: billingStatus.subscription_status,
            gift_count: billingStatus.gift_count,
            gifts_remaining: billingStatus.gifts_remaining,
          },
        };
        break;
      }

      case "niftygifty://holidays/upcoming": {
        const holidays = await client.get<Holiday[]>("/holidays");
        content = upcomingHolidays(holidays);
        break;
      }

      case "niftygifty://gifts/pending": {
        const [gifts, statuses] = await Promise.all([
          client.get<Gift[]>("/gifts"),
          client.get<GiftStatus[]>("/gift_statuses"),
        ]);
        const finalPosition = Math.max(...statuses.map((status) => status.position));
        const completeIds = new Set(statuses.filter((status) => status.position === finalPosition).map((status) => status.id));
        const pendingGifts = gifts.filter((gift) => {
          if (statuses.length > 1) return !completeIds.has(gift.gift_status_id);
          // Match the shared package's fallback for legacy/incomplete status data.
          return !/complete|delivered|done|received|shipped|wrapped/i.test(gift.gift_status?.name || "");
        });
        content = pendingGifts;
        break;
      }

      case "niftygifty://people/frequent": {
        const people = await client.get<Person[]>("/people");
        // Sort by gift count descending
        const frequentPeople = [...people]
          .sort((a, b) => (b.gift_count || 0) - (a.gift_count || 0))
          .slice(0, 10);
        content = frequentPeople;
        break;
      }

      case "niftygifty://billing/status": {
        const billingStatus = await client.get<BillingStatus>("/billing/status");
        content = billingStatus;
        break;
      }

      default:
        throw new Error(`Unknown resource URI: ${uri}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(content, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: `Error reading resource: ${message}`,
        },
      ],
    };
  }
}
