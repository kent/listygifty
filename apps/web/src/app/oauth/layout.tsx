import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authorize MCP Connection",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function OAuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
