import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support",
  description: "Support and status information for Listy Gifty.",
  alternates: {
    canonical: "/support",
  },
};

const lastUpdated = "March 2, 2026";

export default function SupportPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 md:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">Support</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Last updated: {lastUpdated}</p>
      </div>

      <div className="space-y-8 text-slate-700 dark:text-slate-300">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">How To Reach Us</h2>
          <p>
            For account help, billing questions, or technical support, email{" "}
            <a
              href="mailto:support@listygifty.com"
              className="font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400"
            >
              support@listygifty.com
            </a>
            .
          </p>
          <p>Include your account email and a short description of the issue so we can help quickly.</p>
        </section>

        <section id="status" className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">System Status</h2>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40">
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">All core systems operational</p>
            <p className="mt-1 text-emerald-700 dark:text-emerald-400">
              Authentication, list management, and API services are currently available.
            </p>
            <p className="mt-2 text-emerald-700 dark:text-emerald-400">
              Direct status page:{" "}
              <Link href="/status" className="font-medium underline-offset-2 hover:underline">
                /status
              </Link>
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Helpful Links</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <Link href="/signup" className="font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400">
                Create account
              </Link>
            </li>
            <li>
              <Link href="/login" className="font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400">
                Sign in
              </Link>
            </li>
            <li>
              <Link
                href="/privacy-policy"
                className="font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400"
              >
                Privacy policy
              </Link>
            </li>
            <li>
              <Link href="/status" className="font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400">
                System status
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
