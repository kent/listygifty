import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@/components/analytics";
import { Providers } from "@/components/providers";
import { JsonLd } from "@/components/json-ld";
import { Footer } from "@/components/layout";
import { BRAND_NAME } from "@/lib/brand";
import {
  BASE_KEYWORDS,
  DEFAULT_OG_IMAGE,
  DEFAULT_SEO_DESCRIPTION,
  getSiteUrl,
} from "@/lib/seo";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const baseUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: `${BRAND_NAME}: Gift Planning for Families, Exchanges, and Teams`,
    template: `%s | ${BRAND_NAME}`,
  },
  description: DEFAULT_SEO_DESCRIPTION,
  applicationName: BRAND_NAME,
  generator: "Next.js",
  keywords: BASE_KEYWORDS,
  referrer: "origin-when-cross-origin",
  creator: BRAND_NAME,
  publisher: BRAND_NAME,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  category: "productivity",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: BRAND_NAME,
    title: `${BRAND_NAME}: Gift Planning for Families, Exchanges, and Teams`,
    description: DEFAULT_SEO_DESCRIPTION,
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
    title: `${BRAND_NAME}: Gift Planning for Families, Exchanges, and Teams`,
    description: DEFAULT_SEO_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  robots: {
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
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#8b5cf6" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            "@id": `${baseUrl}/#organization`,
            name: BRAND_NAME,
            url: baseUrl,
            logo: `${baseUrl}/icon-512.png`,
            email: "support@listygifty.com",
            description:
              `${BRAND_NAME} helps families, friend groups, and teams organize thoughtful gifts, exchanges, wishlists, budgets, and reminders.`,
            contactPoint: {
              "@type": "ContactPoint",
              contactType: "customer support",
              email: "support@listygifty.com",
              url: `${baseUrl}/support`,
            },
          }}
        />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebSite",
            "@id": `${baseUrl}/#website`,
            name: BRAND_NAME,
            url: baseUrl,
            publisher: {
              "@id": `${baseUrl}/#organization`,
            },
            inLanguage: "en-US",
            description: DEFAULT_SEO_DESCRIPTION,
          }}
        />
        <Providers>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
          <Toaster />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
