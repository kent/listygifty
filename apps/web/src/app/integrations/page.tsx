import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { AUTH_ROUTES } from "@/services";

export const metadata: Metadata = {
  title: "AI Integrations | Listy Gifty",
  description:
    "Connect Listy Gifty to Claude, ChatGPT, and other AI assistants. Use the Model Context Protocol (MCP) to let AI help you plan perfect gifts.",
  alternates: {
    canonical: "/integrations",
  },
};

const mcpTools = [
  {
    name: "list_workspaces",
    description: "View all your workspaces (personal, family, business)",
    scope: "read",
  },
  {
    name: "list_holidays",
    description: "See all holidays and occasions in a workspace",
    scope: "read",
  },
  {
    name: "list_gifts",
    description: "Browse gifts for any holiday with status and details",
    scope: "read",
  },
  {
    name: "list_people",
    description: "View all people/contacts in your gift lists",
    scope: "read",
  },
  {
    name: "list_wishlists",
    description: "Access wishlists and gift ideas",
    scope: "read",
  },
  {
    name: "create_holiday",
    description: "Create new holidays or occasions",
    scope: "write",
  },
  {
    name: "create_gift",
    description: "Add new gift ideas to any holiday",
    scope: "write",
  },
  {
    name: "create_person",
    description: "Add new people to your contacts",
    scope: "write",
  },
];

const aiClients = [
  {
    name: "Claude",
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
    ),
    gradient: "from-orange-400 to-orange-600",
    description: "Anthropic's AI assistant with advanced reasoning capabilities",
    steps: [
      "Open Claude and go to MCP connections",
      "Add a new remote MCP server",
      "Enter: https://api.listygifty.com/mcp",
      "Click Connect and authorize with your Listy Gifty account",
    ],
  },
  {
    name: "Claude Code",
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
      </svg>
    ),
    gradient: "from-slate-600 to-slate-800",
    description: "Claude in your terminal for developers and power users",
    steps: [
      "Add Listy Gifty to your MCP config",
      "Server URL: https://api.listygifty.com/mcp",
      "Use OAuth flow to authenticate",
      "Start using Listy Gifty commands in Claude Code",
    ],
  },
  {
    name: "ChatGPT",
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
      </svg>
    ),
    gradient: "from-emerald-500 to-teal-600",
    description: "OpenAI's conversational AI with plugin support",
    steps: [
      "Go to ChatGPT plugins/actions settings",
      "Add Listy Gifty as a connected service",
      "Authorize access to your account",
      "Ask ChatGPT to help with your gift planning",
    ],
  },
];

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/10 dark:bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-violet-500/10 dark:bg-violet-500/20 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      {/* Header */}
      <header className="relative container mx-auto px-4 py-6 z-10">
        <nav className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/listygifty-logo.png"
              alt="Listy Gifty"
              width={44}
              height={44}
              className="rounded-lg"
              priority
            />
            <span className="text-xl font-bold text-slate-900 dark:text-white">Listy Gifty</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              asChild
              className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Link href={AUTH_ROUTES.signIn}>Sign in</Link>
            </Button>
            <Button
              asChild
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25"
            >
              <Link href={AUTH_ROUTES.signUp}>Get Started Free</Link>
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative flex-1 z-10">
        <section className="container mx-auto px-4 pt-12 pb-16 md:pt-20 md:pb-24">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-300 text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Powered by Model Context Protocol (MCP)
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">
              AI-Powered{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 dark:from-cyan-400 via-blue-500 dark:via-blue-400 to-violet-500 dark:to-violet-400">
                Gift Planning
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Connect your favorite AI assistant to Listy Gifty. Let Claude, ChatGPT, or any MCP-compatible tool help you plan perfect gifts through natural conversation.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-lg px-8 py-6 h-auto shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-300"
              >
                <Link href={AUTH_ROUTES.signUp}>
                  Get Started Free
                  <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg px-8 py-6 h-auto"
              >
                <Link href="#connect">How to Connect</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* AI Clients Section */}
        <section id="connect" className="container mx-auto px-4 py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              Connect Your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-500">
                AI Assistant
              </span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Listy Gifty works with any AI that supports the Model Context Protocol. Here&apos;s how to connect the most popular ones.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {aiClients.map((client) => (
              <div
                key={client.name}
                className="p-8 rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-cyan-300 dark:hover:border-cyan-700 transition-all duration-300"
              >
                <div className={`w-16 h-16 mb-6 rounded-xl bg-gradient-to-br ${client.gradient} flex items-center justify-center text-white shadow-lg`}>
                  {client.icon}
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{client.name}</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">{client.description}</p>

                <div className="space-y-3">
                  {client.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-sm font-medium flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-700 dark:text-slate-300">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* MCP Server Info */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto">
            <div className="p-8 md:p-12 rounded-3xl bg-slate-900 dark:bg-slate-800 text-white">
              <h2 className="text-2xl md:text-3xl font-bold mb-6">MCP Server Details</h2>
              <p className="text-slate-300 mb-8">
                Use these details to connect any MCP-compatible AI client to your Listy Gifty account.
              </p>

              <div className="space-y-4 mb-8">
                <div className="p-4 rounded-lg bg-slate-800 dark:bg-slate-700">
                  <div className="text-sm text-slate-400 mb-1">Server URL</div>
                  <code className="text-cyan-400 font-mono">https://api.listygifty.com/mcp</code>
                </div>
                <div className="p-4 rounded-lg bg-slate-800 dark:bg-slate-700">
                  <div className="text-sm text-slate-400 mb-1">OAuth Discovery</div>
                  <code className="text-cyan-400 font-mono">https://api.listygifty.com/.well-known/oauth-protected-resource</code>
                </div>
                <div className="p-4 rounded-lg bg-slate-800 dark:bg-slate-700">
                  <div className="text-sm text-slate-400 mb-1">Transport</div>
                  <code className="text-cyan-400 font-mono">Streamable HTTP (JSON-RPC 2.0)</code>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-sm">OAuth 2.1</span>
                <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-sm">PKCE Required</span>
                <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-sm">Dynamic Registration</span>
              </div>
            </div>
          </div>
        </section>

        {/* Available Tools */}
        <section className="container mx-auto px-4 py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              Available{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-purple-500">
                MCP Tools
              </span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Your AI assistant can use these tools to interact with your Listy Gifty data.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid gap-4">
              {mcpTools.map((tool) => (
                <div
                  key={tool.name}
                  className="p-6 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <code className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-violet-600 dark:text-violet-400 font-mono text-sm">
                      {tool.name}
                    </code>
                    <span className="text-slate-700 dark:text-slate-300">{tool.description}</span>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    tool.scope === "read"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                  }`}>
                    {tool.scope}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto">
            <div className="relative p-10 md:p-14 rounded-3xl bg-gradient-to-br from-slate-100 dark:from-slate-900 to-slate-50 dark:to-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-green-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                    Security & Privacy
                  </h2>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {[
                    { title: "OAuth 2.1 Standard", desc: "Industry-standard authorization with PKCE protection against code interception" },
                    { title: "Scoped Access", desc: "Grant read-only or read-write access. AI only sees what you allow" },
                    { title: "Revoke Anytime", desc: "Disconnect any AI assistant instantly from your settings" },
                    { title: "No Password Sharing", desc: "AI tools never see your password. Only secure tokens" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-1">{item.title}</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Developer Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              For{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-600 to-slate-800 dark:from-slate-300 dark:to-slate-500">
                Developers
              </span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Building your own AI tool or integration? Use our API or MCP server directly.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="p-8 rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">API Keys</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Generate API keys for direct REST API access. Perfect for custom integrations and automation.
              </p>
              <Button asChild variant="outline">
                <Link href="/settings">
                  Manage API Keys
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </Button>
            </div>

            <div className="p-8 rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Dynamic Registration</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Register your MCP client dynamically using RFC 7591. No pre-registration required.
              </p>
              <code className="block p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
                POST /oauth/register
              </code>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="relative max-w-4xl mx-auto text-center p-12 md:p-16 rounded-3xl bg-gradient-to-br from-cyan-600/10 dark:from-cyan-600/20 to-blue-600/10 dark:to-blue-600/20 border border-cyan-500/20 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-20 -right-20 w-60 h-60 bg-cyan-500/10 dark:bg-cyan-500/20 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
                Ready to Connect Your AI?
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 max-w-xl mx-auto">
                Sign up for free and start using AI to plan your perfect gifts today.
              </p>
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-lg px-8 py-6 h-auto shadow-xl"
              >
                <Link href={AUTH_ROUTES.signUp}>
                  Get Started Free
                  <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative container mx-auto px-4 py-12 z-10">
        <div className="border-t border-slate-200 dark:border-slate-800 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/listygifty-logo.png"
                alt="Listy Gifty"
                width={32}
                height={32}
                className="rounded-md"
              />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">Listy Gifty</span>
            </Link>

            <div className="flex items-center gap-6">
              <Link href="/" className="text-sm text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                Home
              </Link>
              <Link href="/giving-pledge" className="text-sm text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                Our Giving Pledge
              </Link>
            </div>

            <p className="text-slate-500 text-sm">
              © {new Date().getFullYear()} Listy Gifty
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
