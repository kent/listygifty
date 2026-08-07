import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authorize MCP Connection | Listy Gifty",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function OAuthAuthorizeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
