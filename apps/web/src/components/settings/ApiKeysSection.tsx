"use client";

import { useState, useEffect, useCallback } from "react";
import { apiKeysService } from "@/services/api-keys.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Code2,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  Key,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type { ApiKey } from "@niftygifty/types";

export function ApiKeysSection() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadApiKeys = useCallback(async () => {
    try {
      const keys = await apiKeysService.getAll();
      setApiKeys(keys);
    } catch {
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for the API key");
      return;
    }

    setCreating(true);
    try {
      const response = await apiKeysService.create({
        name: newKeyName.trim(),
        scopes: ["read", "write"],
      });
      setApiKeys((prev) => [response.api_key, ...prev]);
      setNewlyCreatedKey(response.raw_key);
      setNewKeyName("");
      toast.success("API key created successfully");
    } catch {
      toast.error("Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: number) => {
    setDeleting(id);
    try {
      await apiKeysService.revoke(id);
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
      toast.success("API key revoked");
    } catch {
      toast.error("Failed to revoke API key");
    } finally {
      setDeleting(null);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setNewlyCreatedKey(null);
      setNewKeyName("");
    }
    setDialogOpen(open);
  };

  return (
    <section className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-fuchsia-500 rounded-full" />
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
            <Code2 className="h-5 w-5 text-violet-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">API Keys</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Manage API keys for MCP servers and integrations
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white border-0"
              >
                <Plus className="h-4 w-4 mr-1" />
                New Key
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              {newlyCreatedKey ? (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-emerald-500" />
                      API Key Created
                    </DialogTitle>
                    <DialogDescription>
                      Copy your API key now. You won&apos;t be able to see it again!
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg font-mono text-sm break-all">
                      <span className="flex-1">{newlyCreatedKey}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(newlyCreatedKey)}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-amber-800 dark:text-amber-200">
                        Store this key securely. It provides full access to your NiftyGifty account.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => handleDialogClose(false)}>Done</Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Create API Key</DialogTitle>
                    <DialogDescription>
                      Create a new API key for use with Claude Desktop, ChatGPT, or other MCP-compatible tools.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="keyName">Key Name</Label>
                      <Input
                        id="keyName"
                        placeholder="e.g., Claude Desktop, My MacBook"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                      />
                      <p className="text-xs text-slate-500">
                        Give it a descriptive name so you remember what it&apos;s for
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => handleDialogClose(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreate}
                      disabled={creating || !newKeyName.trim()}
                      className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                    >
                      {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create Key
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* MCP Instructions */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/30 backdrop-blur-xl overflow-hidden p-6">
        <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-3">
          Use with Claude Desktop
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Add this to your Claude Desktop config file:
        </p>
        <div className="relative group">
          <pre className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs overflow-x-auto">
            <code className="text-slate-700 dark:text-slate-300">{`{
  "mcpServers": {
    "niftygifty": {
      "command": "npx",
      "args": ["@niftygifty/mcp-server"],
      "env": {
        "NIFTYGIFTY_API_URL": "https://api.niftygifty.com",
        "NIFTYGIFTY_API_KEY": "your_api_key_here"
      }
    }
  }
}`}</code>
          </pre>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() =>
              handleCopy(`{
  "mcpServers": {
    "niftygifty": {
      "command": "npx",
      "args": ["@niftygifty/mcp-server"],
      "env": {
        "NIFTYGIFTY_API_URL": "https://api.niftygifty.com",
        "NIFTYGIFTY_API_KEY": "your_api_key_here"
      }
    }
  }
}`)
            }
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* API Keys List */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Your API Keys
          </h3>
        </div>

        {apiKeys.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
            <Key className="h-10 w-10 mx-auto text-slate-400 mb-3" />
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              No API keys yet. Create one to get started with MCP integrations.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create API Key
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/30 backdrop-blur-xl overflow-hidden">
            <div className="divide-y divide-slate-200 dark:divide-slate-800/50">
              {apiKeys.map((key) => (
                <div key={key.id} className="p-4 flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                    <Key className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white">
                      {key.name}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="font-mono">{key.key_prefix}...</span>
                      {key.last_used_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last used{" "}
                          {new Date(key.last_used_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        disabled={deleting === key.id}
                      >
                        {deleting === key.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to revoke &quot;{key.name}&quot;? Any
                          applications using this key will stop working immediately.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRevoke(key.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Revoke Key
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
