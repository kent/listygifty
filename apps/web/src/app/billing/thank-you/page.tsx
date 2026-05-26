"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { Crown, Sparkles, Gift, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CELEBRATION_COLORS = ["#a855f7", "#d946ef", "#ec4899", "#fbbf24", "#34d399"];

function fireCelebration() {
  const duration = 4000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) return clearInterval(interval);

    const particleCount = 50 * (timeLeft / duration);

    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: CELEBRATION_COLORS,
      shapes: ["circle", "square"],
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: CELEBRATION_COLORS,
      shapes: ["circle", "square"],
    });
  }, 250);

  // Big burst in the middle
  confetti({
    particleCount: 150,
    spread: 100,
    origin: { x: 0.5, y: 0.5 },
    colors: CELEBRATION_COLORS,
    shapes: ["circle", "square"],
    zIndex: 9999,
  });
}

export default function ThankYouPage() {
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!hasAnimated.current) {
      hasAnimated.current = true;
      fireCelebration();
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-violet-950/20 flex items-center justify-center">
      {/* Decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-violet-500/5 to-transparent rounded-full" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-2xl text-center">
        {/* Crown icon */}
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 mb-8 shadow-lg shadow-amber-500/30 animate-in zoom-in duration-500">
          <Crown className="w-12 h-12 text-white" />
        </div>

        {/* Main message */}
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 text-transparent bg-clip-text animate-in fade-in slide-in-from-bottom-4 duration-700">
          Welcome to Premium!
        </h1>

        <p className="text-xl text-muted-foreground mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
          Thank you for your support. You now have unlimited gift tracking!
        </p>

        {/* Features unlocked */}
        <div className="bg-card/50 backdrop-blur border border-border/50 rounded-2xl p-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <div className="flex items-center justify-center gap-2 text-violet-400 mb-4">
            <Sparkles className="w-5 h-5" />
            <span className="font-semibold">Features Unlocked</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-violet-400" />
              Unlimited gifts
            </div>
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-violet-400" />
              All holidays
            </div>
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-violet-400" />
              Priority support
            </div>
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-violet-400" />
              Full feature access
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <Button
          asChild
          size="lg"
          className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white border-0 shadow-lg shadow-violet-500/25 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500"
        >
          <Link href="/holidays">
            Start Planning Gifts
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>

        <div className="mt-12 text-sm font-medium text-slate-500 dark:text-slate-400 animate-in fade-in duration-700 delay-700">
          Use Premium across every list, exchange, and gift budget.
        </div>
      </div>
    </div>
  );
}
