import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { TrackedLink } from "@/components/tracked-link";
import { Button } from "@/components/ui/button";
import { MCP_SERVER_URL } from "@/lib/mcp";
import { createPageMetadata } from "@/lib/seo";
import { AUTH_ROUTES } from "@/services";

import { SampleConversation } from "./SampleConversation";
import { conversations } from "./conversations";
import sherwayTrip from "./sherway-trip.json";

const chatGptListing = "https://chatgpt.com/plugins/plugin_asdk_app_6aece563192c8191922c4988bb7b9e20";
const claudeConnectors = "https://claude.ai/customize/connectors";
const textLink = "font-semibold underline decoration-1 underline-offset-4 hover:decoration-2";
const serverUrl = <code className="select-all break-all font-sans font-semibold">{MCP_SERVER_URL}</code>;

export const metadata: Metadata = createPageMetadata({
  title: "Use Listy Gifty with ChatGPT, Claude, and other AI tools",
  description: "Connect your AI assistant to Listy Gifty. Save wishlist ideas, check gift lists, and look up your Secret Santa match in a conversation.",
  path: "/integrations",
  keywords: ["ChatGPT gift planner", "Claude gift planning", "Runner MCP", "wishlist app"],
});

function SetupCard({ id, title, children }: { id: keyof typeof conversations; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 sm:p-8">
      <div className="mb-5 flex items-center gap-3">
        <Image src={`/integrations/logos/${id}.png`} alt="" width={44} height={44} className="shrink-0 rounded-xl" />
        <h3 id={`${id}-title`} className="text-2xl font-bold tracking-tight">{title}</h3>
      </div>
      <ol className="list-decimal space-y-3 pl-5 leading-relaxed marker:font-semibold marker:text-violet-700 dark:marker:text-violet-300 [&>li]:pl-1">
        {children}
      </ol>
      <SampleConversation assistant={title} turns={conversations[id]} />
      {id === "chatgpt" && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold underline underline-offset-4">Read the full Sherway shopping trip</summary>
          <ol id="sherway-trip" aria-label="Example trip to CF Sherway Gardens" className="mt-4 scroll-mt-5 space-y-4">
            {sherwayTrip.map(scene => (
              <li key={scene.title} className="space-y-1 text-sm leading-relaxed">
                <h4 className="font-semibold">{scene.title}</h4>
                <p><strong>You</strong> · {scene.question}</p>
                <p className="text-xs text-slate-600 dark:text-indigo-200">Listy Gifty · {scene.activity}</p>
                <p><strong>ChatGPT</strong> · {scene.reply}</p>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <Image src="/listygifty-logo.png" alt="" width={36} height={36} className="rounded-lg" />
          Listy Gifty
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost"><Link href={AUTH_ROUTES.signIn}>Sign in</Link></Button>
          <Button asChild>
            <TrackedLink href={AUTH_ROUTES.signUp} analyticsEvent="integration_cta_clicked" analyticsProperties={{ location: "header", destination: "signup" }}>
              Sign up
            </TrackedLink>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <section className="grid items-center gap-8 border-b border-slate-200 py-12 dark:border-slate-700 sm:py-16 md:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">Use Listy Gifty with your AI assistant</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-700 dark:text-slate-300">
              Save an idea to your wishlist while you’re chatting, check what you’ve planned for someone, or find out who you drew for Secret Santa.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Button asChild size="lg">
                <TrackedLink href={chatGptListing} analyticsEvent="integration_cta_clicked" analyticsProperties={{ location: "hero", destination: "chatgpt" }}>
                  Open in ChatGPT <ArrowUpRight aria-hidden="true" />
                </TrackedLink>
              </Button>
              <TrackedLink href="#connect" analyticsEvent="integration_how_to_connect_clicked" analyticsProperties={{ location: "hero", destination: "connect_section" }} className={`inline-flex items-center gap-1 ${textLink}`}>
                Setup instructions <ArrowDown size={16} aria-hidden="true" />
              </TrackedLink>
            </div>
          </div>
          <figure className="rounded-2xl border border-violet-200 bg-violet-50 p-6 dark:border-violet-700 dark:bg-violet-950 sm:p-8">
            <figcaption className="mb-4 text-sm font-semibold text-violet-800 dark:text-violet-200">Try this after connecting</figcaption>
            <blockquote className="text-2xl font-medium leading-snug tracking-tight sm:text-3xl">“{conversations.chatgpt[0]}”</blockquote>
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Swap in the name of someone on your gift list.</p>
          </figure>
        </section>

        <section id="connect" aria-labelledby="setup-title" className="scroll-mt-6 pt-10 sm:pt-14">
          <h2 id="setup-title" className="text-3xl font-bold tracking-tight">Choose your assistant</h2>
          <p className="mb-6 mt-3 text-slate-700 dark:text-slate-300">Sign in to the Listy Gifty account that holds your lists when your assistant asks you to connect.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <SetupCard id="chatgpt" title="ChatGPT">
              <li>Open the <a className={textLink} href={chatGptListing}>Listy Gifty plugin</a> in ChatGPT and select <strong>Install plugin</strong>.</li>
              <li>Select <strong>Connect</strong> if prompted. Sign in to Listy Gifty, review the permissions, and approve access.</li>
              <li>In a chat, type <strong>@</strong>, choose <strong>Listy Gifty</strong>, and ask about one of your lists.</li>
            </SetupCard>
            <SetupCard id="claude" title="Claude">
              <li>Open <a className={textLink} href={claudeConnectors}>Customize → Connectors</a>. Select <strong>Add</strong> and choose a custom web connector.</li>
              <li>Name it <strong>Listy Gifty</strong> and paste {serverUrl} into the server URL field.</li>
              <li>Choose <strong>Sign in now</strong> and, if asked for an OAuth client, <strong>Register automatically</strong>. Finish adding the connector and approve access in Listy Gifty.</li>
              <li>In a chat, open <strong>+ → Connectors</strong> and enable Listy Gifty. In a managed workspace, an owner may need to add it first.</li>
            </SetupCard>
            <SetupCard id="runner" title="Runner">
              <li>Open <strong>Connected Apps</strong>, find <strong>Custom MCP</strong>, and select <strong>Connect</strong>.</li>
              <li>Use <strong>Listy Gifty</strong> as the name and {serverUrl} as the HTTPS endpoint.</li>
              <li>Choose <strong>Sign in with the provider</strong>, select <strong>Connect server</strong>, and approve access. Open a conversation and ask about a wishlist.</li>
            </SetupCard>
            <SetupCard id="grok-bot" title="Grok Bot">
              <li>In the Grok Bot desktop app, open <strong>Connect apps</strong> and select <strong>Add a custom connector</strong>.</li>
              <li>Name it <strong>Listy Gifty</strong>, choose <strong>Remote HTTPS</strong>, and enter {serverUrl} as the server URL.</li>
              <li>Select <strong>Add plugin</strong>, then <strong>Authenticate</strong> when prompted. Sign in to Listy Gifty and review the permissions.</li>
              <li>In a conversation, type <strong>@</strong> and attach Listy Gifty to your task.</li>
            </SetupCard>
          </div>
        </section>

        <details id="other-tools" className="mt-6 scroll-mt-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 dark:border-slate-700 dark:bg-slate-900">
          <summary className="cursor-pointer font-semibold">Other AI tools</summary>
          <ol className="mt-4 max-w-3xl list-decimal space-y-2 pl-5 leading-relaxed">
            <li>In a tool that supports remote <strong>Model Context Protocol (MCP)</strong> servers with OAuth, open its connector settings and add a server.</li>
            <li>Name it <strong>Listy Gifty</strong>, choose <strong>Streamable HTTP</strong>, and enter {serverUrl}.</li>
            <li>Choose OAuth or browser sign-in, then connect and approve the requested permissions. Enable the connection in your conversation if prompted.</li>
          </ol>
        </details>
        <details className="mt-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 dark:border-slate-700 dark:bg-slate-900">
          <summary className="cursor-pointer font-semibold">Developer details and Claude Code setup</summary>
          <div className="mt-4 max-w-3xl space-y-3 leading-relaxed">
            <p>In Claude Code, run the command below. Then open <code>/mcp</code>, select Listy Gifty, and authenticate.</p>
            <code className="block select-all break-all rounded bg-slate-100 p-3 text-sm dark:bg-slate-800">claude mcp add --transport http listygifty {MCP_SERVER_URL}</code>
            <p>The server supports OAuth discovery, PKCE, and dynamic client registration. Approved read and write permissions determine which tools can access or update your gift lists. Disconnect an assistant in its connector settings.</p>
            <p>For remote MCP clients, the server advertises tools such as <code>list_wishlists</code>, <code>list_gifts</code>, and <code>create_gift</code>. Its <a className={textLink} href={new URL("/.well-known/oauth-protected-resource/mcp", MCP_SERVER_URL).href}>OAuth discovery document</a> lists the supported scopes and authorization server.</p>
            <p>For a custom REST integration, you can <Link className={textLink} href="/settings">manage API keys in Listy Gifty settings</Link>.</p>
          </div>
        </details>
        <p className="mt-6 text-sm">Need a hand connecting? <Link className={textLink} href="/support">Contact Listy Gifty support</Link>.</p>
      </main>
    </div>
  );
}
