import { toCalendarDate } from "@/lib/dates";

/**
 * Regional holidays utility
 * Detects user's locale/region and suggests relevant upcoming holidays
 */

interface HolidayDefinition {
  name: string;
  icon: string;
  month: number;
  day: number | ((year: number) => number); // Fixed day or function for variable dates
  regions: string[]; // Which regions celebrate this holiday
}

type Region =
  | "north_america"
  | "latin_america"
  | "india"
  | "europe"
  | "east_asia"
  | "oceania"
  | "middle_east"
  | "global";

// Map browser locales/timezones to regions
const LOCALE_TO_REGION: Record<string, Region> = {
  // North America
  "en-US": "north_america",
  "en-CA": "north_america",
  "fr-CA": "north_america",

  // Latin America
  "es-MX": "latin_america",
  "es-AR": "latin_america",
  "es-CO": "latin_america",
  "es-CL": "latin_america",
  "es-PE": "latin_america",
  "pt-BR": "latin_america",

  // India
  "en-IN": "india",
  "hi-IN": "india",
  "bn-IN": "india",
  "ta-IN": "india",

  // Europe
  "en-GB": "europe",
  "de-DE": "europe",
  "fr-FR": "europe",
  "es-ES": "europe",
  "it-IT": "europe",
  "nl-NL": "europe",
  "pl-PL": "europe",
  "sv-SE": "europe",
  "da-DK": "europe",
  "no-NO": "europe",
  "fi-FI": "europe",

  // East Asia
  "zh-CN": "east_asia",
  "zh-TW": "east_asia",
  "ja-JP": "east_asia",
  "ko-KR": "east_asia",

  // Oceania
  "en-AU": "oceania",
  "en-NZ": "oceania",

  // Middle East
  "ar-SA": "middle_east",
  "ar-AE": "middle_east",
  "he-IL": "middle_east",
};

const TIMEZONE_TO_REGION: Record<string, Region> = {
  // North America
  "America/New_York": "north_america",
  "America/Chicago": "north_america",
  "America/Denver": "north_america",
  "America/Los_Angeles": "north_america",
  "America/Toronto": "north_america",
  "America/Vancouver": "north_america",

  // Latin America
  "America/Mexico_City": "latin_america",
  "America/Bogota": "latin_america",
  "America/Lima": "latin_america",
  "America/Santiago": "latin_america",
  "America/Buenos_Aires": "latin_america",
  "America/Sao_Paulo": "latin_america",

  // India
  "Asia/Kolkata": "india",
  "Asia/Calcutta": "india",

  // Europe
  "Europe/London": "europe",
  "Europe/Paris": "europe",
  "Europe/Berlin": "europe",
  "Europe/Rome": "europe",
  "Europe/Madrid": "europe",
  "Europe/Amsterdam": "europe",
  "Europe/Stockholm": "europe",

  // East Asia
  "Asia/Tokyo": "east_asia",
  "Asia/Shanghai": "east_asia",
  "Asia/Hong_Kong": "east_asia",
  "Asia/Seoul": "east_asia",
  "Asia/Taipei": "east_asia",

  // Oceania
  "Australia/Sydney": "oceania",
  "Australia/Melbourne": "oceania",
  "Pacific/Auckland": "oceania",

  // Middle East
  "Asia/Dubai": "middle_east",
  "Asia/Riyadh": "middle_east",
  "Asia/Jerusalem": "middle_east",
};

// Calculate Easter Sunday (Western) using Anonymous Gregorian algorithm
function getEasterDate(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

// Get nth weekday of month (e.g., 2nd Sunday of May for Mother's Day)
function getNthWeekday(year: number, month: number, weekday: number, n: number): number {
  const firstDay = new Date(year, month - 1, 1);
  let day = 1 + ((weekday - firstDay.getDay() + 7) % 7);
  day += (n - 1) * 7;
  return day;
}

// Comprehensive holiday database
const HOLIDAY_DATABASE: HolidayDefinition[] = [
  // Global holidays
  { name: "New Year's Day", icon: "party-popper", month: 1, day: 1, regions: ["global"] },
  { name: "Valentine's Day", icon: "heart", month: 2, day: 14, regions: ["global"] },

  // North America specific
  { name: "Super Bowl", icon: "party-popper", month: 2, day: (y) => getNthWeekday(y, 2, 0, 2), regions: ["north_america"] },
  { name: "Presidents' Day", icon: "star", month: 2, day: (y) => getNthWeekday(y, 2, 1, 3), regions: ["north_america"] },
  { name: "St. Patrick's Day", icon: "party-popper", month: 3, day: 17, regions: ["north_america", "europe"] },
  { name: "Easter", icon: "egg", month: 0, day: (y) => { const e = getEasterDate(y); return e.month === 3 ? e.day : 0; }, regions: ["north_america", "europe", "latin_america", "oceania"] },
  { name: "Mother's Day (US/CA)", icon: "heart-handshake", month: 5, day: (y) => getNthWeekday(y, 5, 0, 2), regions: ["north_america"] },
  { name: "Memorial Day", icon: "star", month: 5, day: (y) => { const lastDay = new Date(y, 5, 0).getDate(); return lastDay - ((new Date(y, 4, lastDay).getDay() + 7) % 7); }, regions: ["north_america"] },
  { name: "Father's Day", icon: "user", month: 6, day: (y) => getNthWeekday(y, 6, 0, 3), regions: ["north_america", "europe"] },
  { name: "Canada Day", icon: "party-popper", month: 7, day: 1, regions: ["north_america"] },
  { name: "Independence Day", icon: "party-popper", month: 7, day: 4, regions: ["north_america"] },
  { name: "Labor Day", icon: "star", month: 9, day: (y) => getNthWeekday(y, 9, 1, 1), regions: ["north_america"] },
  { name: "Halloween", icon: "party-popper", month: 10, day: 31, regions: ["north_america"] },
  { name: "Thanksgiving (US)", icon: "thanksgiving", month: 11, day: (y) => getNthWeekday(y, 11, 4, 4), regions: ["north_america"] },
  { name: "Thanksgiving (Canada)", icon: "thanksgiving", month: 10, day: (y) => getNthWeekday(y, 10, 1, 2), regions: ["north_america"] },
  { name: "Black Friday", icon: "gift", month: 11, day: (y) => getNthWeekday(y, 11, 4, 4) + 1, regions: ["north_america"] },
  { name: "Christmas", icon: "christmas", month: 12, day: 25, regions: ["north_america", "europe", "latin_america", "oceania"] },
  { name: "Boxing Day", icon: "gift", month: 12, day: 26, regions: ["north_america", "europe", "oceania"] },

  // Latin America specific
  { name: "Carnaval", icon: "party-popper", month: 2, day: (y) => { const e = getEasterDate(y); return e.month === 3 ? e.day - 47 : e.day + 14; }, regions: ["latin_america"] },
  { name: "Cinco de Mayo", icon: "party-popper", month: 5, day: 5, regions: ["latin_america", "north_america"] },
  { name: "Dia de los Muertos", icon: "party-popper", month: 11, day: 2, regions: ["latin_america"] },
  { name: "Las Posadas", icon: "christmas", month: 12, day: 16, regions: ["latin_america"] },

  // India specific
  { name: "Republic Day", icon: "star", month: 1, day: 26, regions: ["india"] },
  { name: "Holi", icon: "party-popper", month: 3, day: 14, regions: ["india"] }, // Approximate
  { name: "Independence Day (India)", icon: "star", month: 8, day: 15, regions: ["india"] },
  { name: "Raksha Bandhan", icon: "heart", month: 8, day: 19, regions: ["india"] }, // Approximate
  { name: "Ganesh Chaturthi", icon: "party-popper", month: 9, day: 7, regions: ["india"] }, // Approximate
  { name: "Navratri", icon: "party-popper", month: 10, day: 3, regions: ["india"] }, // Approximate
  { name: "Dussehra", icon: "party-popper", month: 10, day: 12, regions: ["india"] }, // Approximate
  { name: "Karwa Chauth", icon: "moon", month: 10, day: 20, regions: ["india"] }, // Approximate
  { name: "Diwali", icon: "flame", month: 10, day: 31, regions: ["india"] }, // Approximate - varies each year
  { name: "Bhai Dooj", icon: "heart", month: 11, day: 3, regions: ["india"] }, // Approximate

  // Europe specific
  { name: "Epiphany", icon: "star", month: 1, day: 6, regions: ["europe", "latin_america"] },
  { name: "Shrove Tuesday", icon: "party-popper", month: 2, day: (y) => { const e = getEasterDate(y); return e.day - 47; }, regions: ["europe"] },
  { name: "Mother's Day (UK)", icon: "heart-handshake", month: 3, day: (y) => { const e = getEasterDate(y); return e.day - 21; }, regions: ["europe"] },
  { name: "May Day", icon: "party-popper", month: 5, day: 1, regions: ["europe"] },
  { name: "Midsummer", icon: "party-popper", month: 6, day: 21, regions: ["europe"] },
  { name: "Oktoberfest", icon: "party-popper", month: 9, day: 21, regions: ["europe"] },
  { name: "Guy Fawkes Night", icon: "party-popper", month: 11, day: 5, regions: ["europe"] },
  { name: "St. Nicholas Day", icon: "gift", month: 12, day: 6, regions: ["europe"] },

  // East Asia specific
  { name: "Chinese New Year", icon: "party-popper", month: 1, day: 29, regions: ["east_asia"] }, // Approximate - varies
  { name: "Lantern Festival", icon: "party-popper", month: 2, day: 12, regions: ["east_asia"] }, // Approximate
  { name: "Children's Day (Japan)", icon: "party-popper", month: 5, day: 5, regions: ["east_asia"] },
  { name: "Dragon Boat Festival", icon: "party-popper", month: 6, day: 10, regions: ["east_asia"] }, // Approximate
  { name: "Tanabata", icon: "star", month: 7, day: 7, regions: ["east_asia"] },
  { name: "Obon", icon: "party-popper", month: 8, day: 15, regions: ["east_asia"] },
  { name: "Mid-Autumn Festival", icon: "moon", month: 9, day: 17, regions: ["east_asia"] }, // Approximate
  { name: "Chuseok", icon: "moon", month: 9, day: 17, regions: ["east_asia"] }, // Approximate
  { name: "Double Ninth Festival", icon: "party-popper", month: 10, day: 11, regions: ["east_asia"] }, // Approximate

  // Oceania specific
  { name: "Australia Day", icon: "party-popper", month: 1, day: 26, regions: ["oceania"] },
  { name: "Anzac Day", icon: "star", month: 4, day: 25, regions: ["oceania"] },
  { name: "Waitangi Day", icon: "party-popper", month: 2, day: 6, regions: ["oceania"] },

  // Middle East specific
  { name: "Hanukkah", icon: "candle", month: 12, day: 14, regions: ["middle_east", "north_america", "europe"] }, // Approximate
  { name: "Purim", icon: "party-popper", month: 3, day: 14, regions: ["middle_east"] }, // Approximate
  { name: "Passover", icon: "party-popper", month: 4, day: 13, regions: ["middle_east"] }, // Approximate
  { name: "Eid al-Fitr", icon: "moon", month: 4, day: 10, regions: ["middle_east", "india"] }, // Approximate - varies each year
  { name: "Eid al-Adha", icon: "moon", month: 6, day: 17, regions: ["middle_east", "india"] }, // Approximate - varies each year

  // Universal personal occasions (always show these)
  { name: "Birthday", icon: "birthday", month: 0, day: 0, regions: ["global"] },
  { name: "Anniversary", icon: "calendar-heart", month: 0, day: 0, regions: ["global"] },
  { name: "Wedding", icon: "calendar-heart", month: 0, day: 0, regions: ["global"] },
  { name: "Graduation", icon: "graduation-cap", month: 0, day: 0, regions: ["global"] },
  { name: "Baby Shower", icon: "gift", month: 0, day: 0, regions: ["global"] },
];

export interface UpcomingHoliday {
  name: string;
  date: string; // ISO date string
  icon: string;
  displayDate: string;
  daysUntil: number;
  isPersonal?: boolean; // For birthday, anniversary, etc.
}

/**
 * Detect user's region from browser locale and timezone
 */
export function detectUserRegion(): Region {
  // Try to get region from browser locale
  const locale = navigator.language || "en-US";
  if (LOCALE_TO_REGION[locale]) {
    return LOCALE_TO_REGION[locale];
  }

  // Fall back to timezone
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONE_TO_REGION[timezone]) {
      return TIMEZONE_TO_REGION[timezone];
    }
  } catch {
    // Ignore timezone detection errors
  }

  // Default to North America if we can't detect
  return "north_america";
}

/**
 * Get the user's country name for display purposes
 */
export function getRegionDisplayName(region: Region): string {
  const names: Record<Region, string> = {
    north_america: "North America",
    latin_america: "Latin America",
    india: "India",
    europe: "Europe",
    east_asia: "East Asia",
    oceania: "Oceania",
    middle_east: "Middle East",
    global: "Worldwide",
  };
  return names[region];
}

/**
 * Get upcoming holidays for a specific region
 */
export function getUpcomingHolidaysForRegion(region: Region, maxResults: number = 8): UpcomingHoliday[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();
  const upcoming: UpcomingHoliday[] = [];

  // Check this year and next year
  for (const year of [currentYear, currentYear + 1]) {
    for (const holiday of HOLIDAY_DATABASE) {
      // Skip personal occasions (birthday, anniversary, etc.) - these have month=0
      if (holiday.month === 0) continue;

      // Check if this holiday applies to the user's region
      if (!holiday.regions.includes(region) && !holiday.regions.includes("global")) {
        continue;
      }

      // Calculate the date
      let day: number;
      if (typeof holiday.day === "function") {
        day = holiday.day(year);
        if (day <= 0) continue; // Skip if date calculation failed
      } else {
        day = holiday.day;
      }

      // Handle Easter special case (month is returned from function)
      let month = holiday.month;
      if (holiday.name === "Easter") {
        const easter = getEasterDate(year);
        month = easter.month;
        day = easter.day;
      }

      const date = new Date(year, month - 1, day);
      if (date <= today) continue;

      const daysUntil = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      upcoming.push({
        name: holiday.name,
        date: toCalendarDate(date),
        icon: holiday.icon,
        displayDate: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: date.getFullYear() !== currentYear ? "numeric" : undefined,
        }),
        daysUntil,
      });
    }
  }

  // Sort by date and deduplicate by name (keep earliest)
  const seen = new Set<string>();
  return upcoming
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((h) => {
      if (seen.has(h.name)) return false;
      seen.add(h.name);
      return true;
    })
    .slice(0, maxResults);
}

/**
 * Get personal occasion suggestions (always relevant regardless of region)
 */
export function getPersonalOccasions(): Array<{ name: string; icon: string }> {
  return HOLIDAY_DATABASE
    .filter((h) => h.month === 0) // Personal occasions have month=0
    .map((h) => ({ name: h.name, icon: h.icon }));
}

/**
 * Format "days until" in a friendly way
 */
export function formatDaysUntil(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  if (days < 14) return "Next week";
  if (days < 30) return `In ${Math.floor(days / 7)} weeks`;
  if (days < 60) return "Next month";
  return `In ${Math.floor(days / 30)} months`;
}
