"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plug, ExternalLink, Trash2, RefreshCw } from "lucide-react";

interface OAuthClient {
  id: string;
  client_name: string;
  client_id: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
}

export function IntegrationsSection() {
  const [connectedApps, setConnectedApps] = useState<OAuthClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConnectedApps();
  }, []);

  const fetchConnectedApps = async () => {
    try {
      // TODO: Implement API call to fetch connected OAuth apps
      // const response = await fetch("/api/oauth/connections");
      // const data = await response.json();
      // setConnectedApps(data);
      setConnectedApps([]);
    } catch {
      toast.error("Failed to load connected apps");
    } finally {
      setLoading(false);
    }
  };

  const revokeAccess = async (clientId: string) => {
    try {
      // TODO: Implement API call to revoke OAuth access
      // await fetch(`/api/oauth/connections/${clientId}`, { method: "DELETE" });
      setConnectedApps((prev) => prev.filter((app) => app.client_id !== clientId));
      toast.success("Access revoked successfully");
    } catch {
      toast.error("Failed to revoke access");
    }
  };

  const mcpServerUrl = process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/mcp`
    : "https://api.listygifty.com/mcp";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          AI Integrations
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Connect your favorite AI assistants to help you plan perfect gifts.
        </p>
      </div>

      {/* MCP Server Info Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-blue-500/5 dark:from-cyan-500/10 dark:to-blue-500/10 border border-cyan-500/20">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
            <Plug className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Connect Your AI Assistant
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Use this MCP server URL to connect Claude, ChatGPT, or any MCP-compatible AI tool:
            </p>
            <div className="flex items-center gap-3 mb-4">
              <code className="flex-1 px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 text-cyan-400 font-mono text-sm overflow-x-auto">
                {mcpServerUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(mcpServerUrl);
                  toast.success("Copied to clipboard");
                }}
              >
                Copy
              </Button>
            </div>
            <Link
              href="/integrations"
              className="inline-flex items-center gap-2 text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium"
            >
              View setup instructions
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Connect Cards */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Quick Connect
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          {/* Claude */}
          <div className="p-5 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-700 transition-colors">
            <div className="w-10 h-10 mb-3 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </div>
            <h4 className="font-semibold text-slate-900 dark:text-white mb-1">Claude</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Connect via MCP in Claude settings
            </p>
            <a
              href="https://claude.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-medium"
            >
              Open Claude
            </a>
          </div>

          {/* ChatGPT */}
          <div className="p-5 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
            <div className="w-10 h-10 mb-3 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729z"/>
              </svg>
            </div>
            <h4 className="font-semibold text-slate-900 dark:text-white mb-1">ChatGPT</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Add as a plugin or action
            </p>
            <a
              href="https://chat.openai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium"
            >
              Open ChatGPT
            </a>
          </div>

          {/* Other MCP */}
          <div className="p-5 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
            <div className="w-10 h-10 mb-3 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Plug className="w-5 h-5 text-white" />
            </div>
            <h4 className="font-semibold text-slate-900 dark:text-white mb-1">Other MCP Client</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Any MCP-compatible AI tool
            </p>
            <Link
              href="/integrations"
              className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium"
            >
              View docs
            </Link>
          </div>
        </div>
      </div>

      {/* Connected Apps */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Connected Apps
          </h3>
          <Button variant="ghost" size="sm" onClick={fetchConnectedApps} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400" />
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Loading...</p>
          </div>
        ) : connectedApps.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
            <Plug className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-600 dark:text-slate-400 mb-1">No connected apps yet</p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              Connect an AI assistant using the MCP server URL above
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {connectedApps.map((app) => (
              <div
                key={app.id}
                className="p-4 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <Plug className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-white">
                      {app.client_name}
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Scopes: {app.scopes.join(", ")} •{" "}
                      Connected {new Date(app.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeAccess(app.client_id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Note */}
      <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <div>
            <h4 className="font-medium text-green-900 dark:text-green-100 mb-1">
              Secure OAuth 2.1 Authorization
            </h4>
            <p className="text-sm text-green-700 dark:text-green-300">
              AI assistants never see your password. You control what data they can access, and you can revoke access at any time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
