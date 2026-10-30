"use client";

import { Button } from "@/components/ui/button";

export default function ExchangesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Something went wrong</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-4">
          We couldn&apos;t load this page. Try again in a moment.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
