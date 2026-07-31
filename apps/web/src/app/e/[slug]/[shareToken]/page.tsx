import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { JoinExchangeCard } from "@/components/exchanges/JoinExchangeCard";
import { invitationDescription } from "@/lib/exchange-invitation";
import { absoluteUrl } from "@/lib/seo";
import { getExchangeJoinPreview } from "@/services/exchange-join-preview.server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string; shareToken: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, shareToken } = await params;
  const details = await getExchangeJoinPreview(shareToken);
  const canonicalPath = details
    ? `/e/${details.exchange.slug}/${shareToken}`
    : `/e/${slug}/${shareToken}`;

  if (!details) {
    return {
      title: "Gift exchange invitation",
      description: "Open your Listy Gifty gift exchange invitation.",
      robots: { index: false, follow: true },
    };
  }

  const title = `Join ${details.exchange.name}`;
  const description = invitationDescription(details);
  const imagePath = `${canonicalPath}/opengraph-image`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    robots: { index: false, follow: true },
    openGraph: {
      type: "website",
      url: absoluteUrl(canonicalPath),
      siteName: "Listy Gifty",
      title,
      description,
      images: [{
        url: imagePath,
        width: 1200,
        height: 630,
        alt: `Invitation to join ${details.exchange.name}`,
      }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imagePath],
    },
  };
}

export default async function SharedExchangeJoinPage({ params }: PageProps) {
  const { slug, shareToken } = await params;
  const details = await getExchangeJoinPreview(shareToken);

  if (details && slug !== details.exchange.slug) {
    permanentRedirect(`/e/${details.exchange.slug}/${shareToken}`);
  }

  return <JoinExchangeCard shareToken={shareToken} details={details} />;
}
