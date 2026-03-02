import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for Listy Gifty.",
  alternates: {
    canonical: "/privacy-policy",
  },
};

const lastUpdated = "March 2, 2026";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 md:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Last updated: {lastUpdated}</p>
      </div>

      <div className="space-y-8 text-slate-700 dark:text-slate-300">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Overview</h2>
          <p>
            Listy Gifty helps you organize gifts, people, and occasions. This policy explains what information we
            collect, how we use it, and the controls available to you.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Information We Collect</h2>
          <p>
            We collect account information (such as your name and email), content you create in the app (including gift
            lists, people, gifts, and notes), and usage data needed to operate, secure, and improve the service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">How We Use Information</h2>
          <p>We use your information to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Provide core features like planning, tracking, and collaboration.</li>
            <li>Support reminders, status updates, and account security.</li>
            <li>Diagnose issues, prevent abuse, and maintain reliable service.</li>
            <li>Improve product quality and user experience.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Sharing and Access</h2>
          <p>
            Your lists are private by default unless you explicitly share them. If you invite collaborators, those
            collaborators can access the list you shared.
          </p>
          <p>
            For integrations, Listy Gifty uses OAuth with scoped permissions. Connected tools can only access data
            allowed by the granted scope, and access can be revoked at any time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Data Retention and Security</h2>
          <p>
            We retain data as needed to provide the service and meet legal obligations. We apply reasonable technical
            and organizational safeguards to protect account and application data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Children&apos;s Privacy</h2>
          <p>Listy Gifty is not directed to children under 13 and does not knowingly collect data from children under 13.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Contact</h2>
          <p>
            Questions about this policy can be sent to{" "}
            <a
              href="mailto:support@listygifty.com"
              className="font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400"
            >
              support@listygifty.com
            </a>
            .
          </p>
          <p>
            For product support, visit{" "}
            <Link href="/support" className="font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400">
              /support
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Policy Changes</h2>
          <p>We may update this policy over time. Material updates will be reflected by revising the date above.</p>
        </section>
      </div>
    </main>
  );
}
