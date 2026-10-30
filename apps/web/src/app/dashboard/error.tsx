"use client";

import { useRouter } from "next/navigation";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Something went wrong
          </h1>
          <p className="text-muted-foreground text-sm">
            We couldn&apos;t load your dashboard. Please try again.
          </p>
          {error.digest && (
            <p className="text-muted-foreground text-xs mt-2 font-mono">
              Error ID: {error.digest}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} className="bg-violet-600 hover:bg-violet-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => (router.push("/"))}
          >
            <Home className="w-4 h-4 mr-2" />
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}

