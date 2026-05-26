import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Listy Gifty",
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
};

export default function GivingPledgePage() {
  redirect("/");
}
