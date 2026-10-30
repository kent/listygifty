import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 max-w-md w-full">
        <CardContent className="py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/10 mx-auto mb-4">
            <Compass className="h-8 w-8 text-violet-500 dark:text-violet-400" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Page not found</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            This page may have moved, or the link might be mistyped.
          </p>
          <Button asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
