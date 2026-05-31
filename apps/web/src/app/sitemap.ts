import type { MetadataRoute } from "next";
import { PUBLIC_MARKETING_PAGES, SEO_LAST_MODIFIED, absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_MARKETING_PAGES.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: new Date(SEO_LAST_MODIFIED),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
