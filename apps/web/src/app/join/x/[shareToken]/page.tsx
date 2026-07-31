import { permanentRedirect } from "next/navigation";
import { JoinExchangeCard } from "@/components/exchanges/JoinExchangeCard";
import { getExchangeJoinPreview } from "@/services/exchange-join-preview.server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Gift exchange invitation",
  description: "Open your Listy Gifty gift exchange invitation.",
  robots: { index: false, follow: true },
};

export default async function LegacySharedExchangeJoinPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const details = await getExchangeJoinPreview(shareToken);

  if (details) {
    permanentRedirect(`/e/${details.exchange.slug}/${shareToken}`);
  }

  return <JoinExchangeCard shareToken={shareToken} details={null} />;
}
