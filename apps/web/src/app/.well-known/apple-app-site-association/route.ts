import { APPLE_APP_SITE_ASSOCIATION } from "@/lib/apple-app-site-association";

export const dynamic = "force-static";

export function GET() {
  return Response.json(APPLE_APP_SITE_ASSOCIATION, {
    headers: {
      "content-type": "application/json",
    },
  });
}
