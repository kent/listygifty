import type { Metadata, MetadataRoute } from "next";
import { BRAND_NAME, BRAND_TEAM_NAME } from "@/lib/brand";

export const DEFAULT_SITE_URL = "https://listygifty.com";
export const SEO_LAST_MODIFIED = "2026-05-31";
export const DEFAULT_SEO_DESCRIPTION =
  "Capture gift ideas year-round, organize every recipient and occasion, run gift exchanges, and coordinate family or team gifting from one shared workspace.";
export const DEFAULT_OG_IMAGE = "/og-image.png";

export const BASE_KEYWORDS = [
  "gift planning",
  "gift tracker",
  "gift ideas",
  "gift organizer",
  "gift list app",
  "christmas gift list",
  "holiday gift planning",
  "secret santa app",
  "gift exchange",
  "business gifting",
  "employee gifting",
  "AI gift planning",
];

export const PUBLIC_MARKETING_PAGES = [
  {
    path: "/",
    title: "Listy Gifty: Gift Planning for Families, Exchanges, and Teams",
    description: DEFAULT_SEO_DESCRIPTION,
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: "/business/signup",
    title: "Business Gift Planning for Teams",
    description:
      "Create a business gifting workspace for employee holiday boxes, new-hire kits, milestone gifts, and fulfillment-ready CSV workflows.",
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    path: "/integrations",
    title: "AI Assistant and MCP Integrations",
    description:
      "Connect Listy Gifty to Claude, ChatGPT, and other MCP-compatible assistants with scoped OAuth access to help manage gift planning workflows.",
    changeFrequency: "monthly",
    priority: 0.75,
  },
  {
    path: "/support",
    title: "Support",
    description: "Get account help, billing support, service status, and contact information for Listy Gifty.",
    changeFrequency: "monthly",
    priority: 0.5,
  },
  {
    path: "/privacy-policy",
    title: "Privacy Policy",
    description: "Review how Listy Gifty collects, uses, protects, and shares account and gift planning data.",
    changeFrequency: "yearly",
    priority: 0.4,
  },
  {
    path: "/status",
    title: "System Status",
    description: "Current service status for Listy Gifty web, API, authentication, and mobile backend services.",
    changeFrequency: "daily",
    priority: 0.35,
  },
] satisfies Array<{
  path: string;
  title: string;
  description: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}>;

export const PUBLIC_STATIC_TEXT_ROUTES = [
  "/llms.txt",
  "/llms-full.txt",
  "/index.html.md",
  "/business/signup/index.html.md",
  "/integrations/index.html.md",
  "/support/index.html.md",
  "/privacy-policy/index.html.md",
  "/status/index.html.md",
] as const;

export const PRIVATE_CRAWL_DISALLOW_ROUTES = [
  "/api/",
  "/dashboard",
  "/holidays",
  "/people",
  "/settings",
  "/billing",
  "/gifts",
  "/exchanges",
  "/wishlists",
  "/workspaces",
  "/match",
  "/join",
  "/claim",
  "/w/",
  "/email-preferences",
] as const;

export const AI_CRAWLER_USER_AGENTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Google-Extended",
] as const;

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

export function absoluteUrl(path = "/"): string {
  return new URL(path, `${getSiteUrl()}/`).toString();
}

export function createPageMetadata({
  title,
  description,
  path,
  keywords = [],
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
}): Metadata {
  const canonical = path;
  const fullTitle = title.includes(BRAND_NAME) ? title : `${title} | ${BRAND_NAME}`;

  return {
    title,
    description,
    authors: [{ name: BRAND_TEAM_NAME }],
    creator: BRAND_NAME,
    publisher: BRAND_NAME,
    keywords: [...BASE_KEYWORDS, ...keywords],
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url: absoluteUrl(path),
      siteName: BRAND_NAME,
      title: fullTitle,
      description,
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: `${BRAND_NAME} gift planning workspace preview`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
    robots: noIndex
      ? {
          index: false,
          follow: true,
          googleBot: {
            index: false,
            follow: true,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        },
  };
}
