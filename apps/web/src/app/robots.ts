import type { MetadataRoute } from "next";

const DISALLOWED_APP_ROUTES = [
  "/api/",
  "/dashboard",
  "/holidays",
  "/people",
  "/settings",
  "/billing",
  "/gifts",
];

const PUBLIC_AI_ROUTES = ["/", "/business/signup", "/integrations", "/login", "/signup", "/support"];

const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "Claude-Web",
  "Anthropic-AI",
  "PerplexityBot",
  "Google-Extended",
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.length ? process.env.NEXT_PUBLIC_APP_URL : "https://listygifty.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED_APP_ROUTES,
      },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: PUBLIC_AI_ROUTES,
        disallow: DISALLOWED_APP_ROUTES,
      })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
