import { buildAndroidAssetLinks } from "@/lib/android-asset-links";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(buildAndroidAssetLinks(), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/json",
    },
  });
}
