import type { MetadataRoute } from "next";
import {
  AI_CRAWLER_USER_AGENTS,
  PRIVATE_CRAWL_DISALLOW_ROUTES,
  PUBLIC_STATIC_TEXT_ROUTES,
  getSiteUrl,
} from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();
  const allow = ["/", ...PUBLIC_STATIC_TEXT_ROUTES];

  return {
    rules: [
      {
        userAgent: "*",
        allow,
        disallow: [...PRIVATE_CRAWL_DISALLOW_ROUTES],
      },
      ...AI_CRAWLER_USER_AGENTS.map((userAgent) => ({
        userAgent,
        allow,
        disallow: [...PRIVATE_CRAWL_DISALLOW_ROUTES],
      })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
