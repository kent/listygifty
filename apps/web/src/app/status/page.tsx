import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "System Status",
  description: "Current service status for Listy Gifty.",
  alternates: {
    canonical: "/status",
  },
};

const lastUpdated = "March 2, 2026";

export default function StatusPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 md:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">System Status</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Last updated: {lastUpdated}</p>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/40">
        <p className="font-semibold text-emerald-800 dark:text-emerald-300">All systems operational</p>
        <p className="mt-1 text-emerald-700 dark:text-emerald-400">
          Web, API, authentication, and mobile backend services are currently available.
        </p>
      </div>

      <p className="mt-8 text-slate-700 dark:text-slate-300">
        Need help with your account? Visit{" "}
        <Link href="/support" className="font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400">
          support
        </Link>
        .
      </p>
    </main>
  );
}
