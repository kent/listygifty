"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Settings error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Something went wrong
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            We couldn&apos;t load your settings. Please try again.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} className="bg-violet-600 hover:bg-violet-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try again
          </Button>
          <Button
            variant="outline"
            asChild
            className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

