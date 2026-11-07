import type { Metadata } from "next";
import Link from "next/link";
import { BellRing } from "lucide-react";
import { NUDGE_TEXT_FROM_NUMBER } from "@niftygifty/types";
import { createPageMetadata } from "@/lib/seo";

// The public explanation of Listy Gifty's texts. Carriers' toll-free
// verification points reviewers here as proof of how people agree to get
// texts, so it has to match what the nudge dialog really does.
export const metadata: Metadata = createPageMetadata({
  title: "Text Messages",
  description: "The one kind of text Listy Gifty sends, how people agree to get it, and how to stop it.",
  path: "/sms",
  keywords: ["Listy Gifty texts", "Listy Gifty SMS", "gift exchange reminder text"],
});

const LINK_CLASS = "font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400";
const SAMPLE_TEXT =
  "Listy Gifty: Kent saved you a spot in Family Secret Santa. Join before names are drawn: https://listygifty.com/join/exchange/6Ry2kQ\n\nMsg & data rates may apply. Reply HELP for help, STOP to opt out.";

export default function SmsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 md:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">Text messages from Listy Gifty</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          Listy Gifty is a gift planning app run by Ewakened Inc. in Mississauga, Ontario. We send one kind of text.
          This page explains what it is, who gets it, and how to stop it.
        </p>
      </div>

      <div className="space-y-10 text-slate-700 dark:text-slate-300">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">What we text</h2>
          <p>
            People use Listy Gifty to run gift exchanges, like a Secret Santa with family or coworkers. The organizer
            invites everyone by email. If someone hasn&apos;t answered, the organizer can send them a reminder, which we
            call a nudge.
          </p>
          <p>
            A nudge always goes out by email. It goes out by text too only when the organizer adds the person&apos;s
            mobile number and confirms the person said it&apos;s OK to text them. We don&apos;t send marketing texts, and
            we don&apos;t text anyone for any other reason.
          </p>
          <figure className="space-y-2">
            <figcaption className="text-sm font-medium text-slate-900 dark:text-white">What the text says</figcaption>
            <p className="max-w-md whitespace-pre-line rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-900 dark:bg-slate-800 dark:text-slate-100">
              {SAMPLE_TEXT}
            </p>
          </figure>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">How someone agrees to get texts</h2>
          <p>
            The organizer is someone the person knows, like a family member, friend or coworker, who invited them to
            the exchange. Before adding a number, the organizer asks the person, in person, by phone or in a message,
            something like this:
          </p>
          <blockquote className="max-w-2xl border-l-4 border-violet-300 pl-4 italic dark:border-violet-700">
            &ldquo;Is it OK if Listy Gifty texts you a reminder with the link to join our gift exchange? It&apos;s at
            most one text a day, only until you join or say no. Message and data rates may apply. You can reply HELP
            for help or STOP to stop the texts. Their terms are at listygifty.com/terms and their privacy policy is at
            listygifty.com/privacy-policy.&rdquo;
          </blockquote>
          <p>
            Only if the person says yes does the organizer go ahead. Then, in Listy Gifty, the organizer:
          </p>
          <ol className="list-decimal space-y-2 pl-6">
            <li>Opens the gift exchange and clicks Nudge next to the person who hasn&apos;t joined.</li>
            <li>Enters the person&apos;s mobile number.</li>
            <li>
              Checks the box that says the person said it&apos;s OK to text them about this exchange. If the box
              isn&apos;t checked, Listy Gifty doesn&apos;t send a text.
            </li>
          </ol>
          <p>
            We record when the organizer confirmed it. If the number changes, the organizer has to confirm again before
            we text the new number. The first text says who it&apos;s from and who invited them, and explains HELP and
            STOP, so the person knows what they agreed to and how to stop it.
          </p>
          <figure className="space-y-2">
            <figcaption className="text-sm font-medium text-slate-900 dark:text-white">What the organizer sees</figcaption>
            <NudgeFormPreview />
          </figure>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">How often</h2>
          <p>
            At most one text a day per person, and only while their invitation is open. Once they join, say no, or the
            names are drawn, the texts stop. Organizers can only send so many nudges a day. Message frequency varies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Stopping texts and getting help</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Reply <strong>STOP</strong> to any Listy Gifty text to stop all texts from us. You&apos;ll get one message
              confirming it, and nothing after that.
            </li>
            <li>
              Reply <strong>START</strong> to get them again.
            </li>
            <li>
              Reply <strong>HELP</strong> for help, or email{" "}
              <a href="mailto:support@listygifty.com" className={LINK_CLASS}>
                support@listygifty.com
              </a>
              .
            </li>
          </ul>
          <p>Message and data rates may apply. Carriers aren&apos;t liable for delayed or undelivered messages.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Your number</h2>
          <p>
            We use the number only to send these reminders. We don&apos;t sell it, and we don&apos;t share it, or your
            agreement to get texts, with anyone for their marketing. Texts are sent through our messaging provider,
            Twilio. Our{" "}
            <Link href="/privacy-policy" className={LINK_CLASS}>
              privacy policy
            </Link>{" "}
            has the details.
          </p>
          <p>
            Texts to Canadian numbers come from (289) 379-7875. Texts to US numbers come from (844) 651-4420.
          </p>
        </section>
      </div>
    </main>
  );
}

// A picture of the nudge dialog, drawn with plain markup so it can't drift
// into a working form on a public page.
function NudgeFormPreview() {
  return (
    <div
      aria-label="The Nudge dialog, with a mobile number filled in and the consent box checked"
      role="img"
      className="max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <BellRing className="h-4 w-4" aria-hidden="true" />
          Nudge Ana
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          We&apos;ll send Ana their invite link again. Add their mobile number to text it too.
        </p>
      </div>
      <PreviewField label="Email" value="ana@example.com" />
      <div className="space-y-1">
        <PreviewField label="Mobile number (optional)" value="(416) 555-0123" />
        <p className="text-xs text-slate-600 dark:text-slate-400">
          The text comes from Listy Gifty at {NUDGE_TEXT_FROM_NUMBER}. They can reply STOP to opt out.
        </p>
      </div>
      <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
        <span className="mt-0.5 grid size-4 shrink-0 place-content-center rounded-[4px] bg-violet-600 text-[10px] leading-none text-white">
          ✓
        </span>
        Ana said it&apos;s OK to text them about this exchange.
      </div>
      <div className="flex justify-end">
        <span className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white">Send nudge</span>
      </div>
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
      <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
        {value}
      </p>
    </div>
  );
}
