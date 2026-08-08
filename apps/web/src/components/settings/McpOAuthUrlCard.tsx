"use client";

import Link from "next/link";
import { CheckCircle2, Copy, ExternalLink, Plug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MCP_SERVER_URL } from "@/lib/mcp";

export function McpOAuthUrlCard() {
  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(MCP_SERVER_URL);
      toast.success("MCP OAuth URL copied");
    } catch {
      toast.error("Could not copy the MCP OAuth URL");
    }
  };

  return (
    <section
      aria-labelledby="mcp-oauth-url-heading"
      data-testid="mcp-oauth-url-card"
      className="overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-white/90 to-blue-500/10 shadow-lg shadow-cyan-950/5 dark:via-slate-900/90 dark:shadow-black/20"
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:p-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
          <Plug className="h-6 w-6 text-white" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 id="mcp-oauth-url-heading" className="text-lg font-bold text-slate-900 dark:text-white">
              Your MCP OAuth URL
            </h2>
            <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
              OAuth 2.1
            </span>
          </div>

          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            Paste this exact server URL into an OAuth-capable MCP client. It opens Listy Gifty sign-in and limits access to your account and the permissions you approve.
          </p>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-950/80">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Server URL
            </span>
            <div className="mt-2 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-slate-950 px-3 py-2.5 font-mono text-sm font-semibold text-cyan-300">
                {MCP_SERVER_URL}
              </code>
              <Button
                type="button"
                variant="outline"
                onClick={copyUrl}
                aria-label="Copy MCP OAuth URL"
                className="w-full shrink-0 border-cyan-300 text-cyan-800 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-200 dark:hover:bg-cyan-950 sm:w-auto"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copy URL
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Secure sign-in; no password sharing
            </span>
            <Link
              href="/integrations"
              className="inline-flex items-center gap-1.5 font-semibold text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200"
            >
              Setup instructions
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
