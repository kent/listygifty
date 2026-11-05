import type { Metadata } from "next";
import Link from "next/link";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Terms of Service",
  description: "The terms for using Listy Gifty, including accounts, shared lists, gift exchanges, and connected assistants.",
  path: "/terms",
  keywords: ["Listy Gifty terms", "Listy Gifty terms of service"],
});

const lastUpdated = "November 5, 2026";

const linkClass = "font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400";

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 md:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">Terms of Service</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Last updated: {lastUpdated}</p>
      </div>

      <div className="space-y-8 text-slate-700 dark:text-slate-300">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Using Listy Gifty</h2>
          <p>
            Listy Gifty helps you plan gifts, keep wishlists, and run gift exchanges with the people in your life. By
            creating an account or using the service, you agree to these terms and to our{" "}
            <Link href="/privacy-policy" className={linkClass}>
              Privacy Policy
            </Link>
            .
          </p>
          <p>You must be at least 13 years old to use Listy Gifty.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Your Account</h2>
          <p>
            Keep your sign-in details secure. You are responsible for what happens in your account, including actions
            taken by tools you connect to it. Tell us at support@listygifty.com if you think someone else has access.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Your Content</h2>
          <p>
            Your gift lists, wishlists, people, notes, and other content stay yours. You give us permission to store,
            process, and display that content only as needed to run Listy Gifty for you and the people you share it
            with.
          </p>
          <p>
            Only add information about other people that you have a reasonable right to use, such as names and gift
            ideas for friends and family.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Sharing, Wishlists, and Gift Exchanges</h2>
          <p>
            When you share a Gift List, invite someone to a workspace, or join a gift exchange, the people you share
            with can see the content you shared. Anyone with a wishlist share link or an exchange join link can open it,
            so only send those links to people you trust.
          </p>
          <p>
            When you invite people to a gift exchange or draw names, Listy Gifty emails them on your behalf. Only invite
            people who would expect to hear from you.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Connected Assistants and Integrations</h2>
          <p>
            You can connect assistants such as ChatGPT and Claude to your account. A connected assistant can read and
            change your Listy Gifty data within the permissions you approve, and it acts on your instructions. Check what
            an assistant does for you, because assistants can make mistakes.
          </p>
          <p>
            You can disconnect an assistant at any time from your Listy Gifty settings or from the assistant itself. The
            assistant&apos;s own terms and privacy policy apply to your use of that assistant.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Paid Plans</h2>
          <p>
            Some features need a paid plan. The price and billing terms are shown before you pay, and payments are
            processed by our payment provider. You can manage or cancel a paid plan from your billing settings.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Acceptable Use</h2>
          <p>Do not use Listy Gifty to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Send spam or messages people did not ask for.</li>
            <li>Harass, threaten, or harm anyone.</li>
            <li>Break the law or infringe someone else&apos;s rights.</li>
            <li>Access accounts or data that are not yours, or disrupt the service.</li>
            <li>Scrape the service or overload it with automated requests.</li>
          </ul>
          <p>We may suspend or close accounts that break these rules.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">The Service</h2>
          <p>
            We work to keep Listy Gifty available and your data safe, but the service is provided as is, without
            warranties of any kind. We may change, add, or remove features over time.
          </p>
          <p>
            To the extent the law allows, Listy Gifty is not liable for indirect or consequential losses, or for lost
            data, gifts, or purchases. Our total liability for any claim is limited to the amount you paid us in the 12
            months before the claim.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Ending Your Account</h2>
          <p>
            You can delete your account at any time from the Profile screen in the Listy Gifty mobile app, or by emailing
            support@listygifty.com. Deleting your account removes your content, except where we must keep records to
            meet legal obligations.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Changes to These Terms</h2>
          <p>
            We may update these terms. When we do, we will change the date above. If you keep using Listy Gifty after
            an update, the new terms apply.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Contact</h2>
          <p>
            Questions about these terms can be sent to{" "}
            <a href="mailto:support@listygifty.com" className={linkClass}>
              support@listygifty.com
            </a>
            . For product help, visit{" "}
            <Link href="/support" className={linkClass}>
              /support
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
