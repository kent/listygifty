import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Business Gift Planning for Teams",
  description:
    "Create a business gifting workspace for employee holiday boxes, new-hire kits, milestone gifts, recipient imports, and fulfillment-ready CSV exports.",
  path: "/business/signup",
  keywords: [
    "business gift planning",
    "employee gifting software",
    "corporate gift tracker",
    "new hire gift kits",
    "holiday boxes for employees",
  ],
});

export default function BusinessSignupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
