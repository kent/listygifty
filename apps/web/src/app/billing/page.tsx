"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { billingService } from "@/services";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import {
  Gift,
  Sparkles,
  Check,
  Crown,
  ArrowLeft,
  Loader2,
  Calendar,
  Infinity,
  Ticket,
  Heart,
  Building2,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { BillingStatus, BillingPlan } from "@niftygifty/types";
import { BILLING_PLANS, FREE_GIFT_LIMIT } from "@niftygifty/types";
import { ApiError } from "@/lib/api-client";
import { captureWebEvent } from "@/lib/analytics";
import { DEFAULT_BUSINESS_USE_CASE } from "@/lib/business-use-cases";

// Christmas confetti colors
const CHRISTMAS_COLORS = ["#ff0000", "#00ff00", "#ffffff", "#ffd700", "#ff6b6b", "#4ade80"];

function fireChristmasConfetti() {
  const duration = 4000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const interval = setInterval(function () {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);

    // Confetti from both sides
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: CHRISTMAS_COLORS,
      shapes: ["circle", "square"],
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: CHRISTMAS_COLORS,
      shapes: ["circle", "square"],
    });
  }, 250);

  // Big burst in the middle
  confetti({
    particleCount: 150,
    spread: 100,
    origin: { x: 0.5, y: 0.5 },
    colors: CHRISTMAS_COLORS,
    shapes: ["circle", "square"],
    zIndex: 9999,
  });
}

function playSantaSound() {
  // Create audio context for the ho-ho-ho sound
  const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  
  const playHo = (startTime: number, frequency: number) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
    gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.15);
    gainNode.gain.linearRampToValueAtTime(0, startTime + 0.3);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.3);
  };

  // Play "Ho Ho Ho" with descending pitches
  const now = audioContext.currentTime;
  playHo(now, 200);        // Ho
  playHo(now + 0.35, 180); // Ho
  playHo(now + 0.7, 160);  // Ho (lower)
  
  // Add some jingle bells
  const playBell = (startTime: number) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800 + Math.random() * 400;
    oscillator.type = "sine";
    
    gainNode.gain.setValueAtTime(0.1, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.2);
  };

  // Jingle bells effect
  for (let i = 0; i < 8; i++) {
    playBell(now + 1 + i * 0.1);
  }
}

export default function BillingPage() {
  const { isAuthenticated, refreshBillingStatus } = useAuth();
  const searchParams = useSearchParams();
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<BillingPlan | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [showCouponInput, setShowCouponInput] = useState(false);
  const couponInputRef = useRef<HTMLInputElement>(null);

  const canceled = searchParams.get("canceled");

  const refreshStatus = useCallback(async () => {
    try {
      const status = await billingService.getStatus();
      setBillingStatus(status);
      await refreshBillingStatus();
    } catch {
      // Ignore errors
    }
  }, [refreshBillingStatus]);

  useEffect(() => {
    if (canceled) {
      toast.info("Checkout canceled", {
        description: "No worries, you can upgrade anytime.",
      });
    }
  }, [canceled]);

  useEffect(() => {
    if (isAuthenticated) {
      billingService
        .getStatus()
        .then(setBillingStatus)
        .catch(() => toast.error("Failed to load billing status"))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const handleCheckout = async (plan: BillingPlan) => {
    setCheckoutLoading(plan);
    try {
      await billingService.checkout(plan);
    } catch {
      toast.error("Failed to start checkout");
      setCheckoutLoading(null);
    }
  };

  const handleRedeemCoupon = async () => {
    if (!couponCode.trim()) return;

    setCouponLoading(true);
    try {
      const response = await billingService.redeemCoupon(couponCode);
      
      if (response.animation === "christmas") {
        // Fire the celebration!
        fireChristmasConfetti();
        playSantaSound();
        
        toast.success(response.message, {
          description: "You now have unlimited gift tracking!",
          duration: 5000,
        });
      }
      
      // Refresh billing status
      await refreshStatus();
      setCouponCode("");
      setShowCouponInput(false);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error("Invalid coupon code", {
          description: "Please check your code and try again.",
        });
      } else {
        toast.error("Something went wrong");
      }
    } finally {
      setCouponLoading(false);
    }
  };

  const isPremium = billingStatus?.subscription_status === "active";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-violet-950/20">
      {/* Decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-violet-500/5 to-transparent rounded-full" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-5xl">
        {/* Back button */}
        <Link
          href="/holidays"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to holidays
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm mb-6">
            <Sparkles className="w-4 h-4" />
            One dollar for each day of December before Christmas
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 text-transparent bg-clip-text">
            Listy Gifty Premium
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Track unlimited gifts for everyone on your list. Just{" "}
            <span className="text-violet-400 font-semibold">$0.068 CAD/day</span>
            —less than a penny per day.
          </p>
        </div>

        {/* Current status card */}
        {billingStatus && (
          <div className="mb-10 p-6 rounded-2xl bg-card/50 backdrop-blur border border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-xl ${isPremium ? "bg-gradient-to-br from-amber-500 to-orange-600" : "bg-muted"}`}
                >
                  {isPremium ? (
                    <Crown className="w-6 h-6 text-white" />
                  ) : (
                    <Gift className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">
                      {isPremium ? "Premium Member" : "Free Plan"}
                    </h3>
                    <Badge
                      variant={isPremium ? "default" : "secondary"}
                      className={isPremium ? "bg-gradient-to-r from-amber-500 to-orange-600 border-0" : ""}
                    >
                      {isPremium ? "Active" : "Free"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isPremium ? (
                      <>
                        Expires{" "}
                        {new Date(billingStatus.subscription_expires_at!).toLocaleDateString(
                          "en-CA",
                          { year: "numeric", month: "long", day: "numeric" }
                        )}
                      </>
                    ) : (
                      <>
                        {billingStatus.gift_count} of {FREE_GIFT_LIMIT} free gifts used
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-center">
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {billingStatus.gift_count}
                  </div>
                  <div className="text-xs text-muted-foreground">Gifts tracked</div>
                </div>
                <div className="w-px h-10 bg-border" />
                <div>
                  <div className="text-2xl font-bold text-foreground flex items-center gap-1">
                    {isPremium ? (
                      <Infinity className="w-6 h-6 text-violet-400" />
                    ) : (
                      billingStatus.gifts_remaining
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">Remaining</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Pricing cards */}
            <div className="grid gap-6 mb-12 md:grid-cols-2 lg:grid-cols-3">
              {/* Yearly plan */}
              <PricingCard
                plan={BILLING_PLANS.yearly}
                isPremium={isPremium}
                loading={checkoutLoading === "yearly"}
                onSelect={() => handleCheckout("yearly")}
              />

              {/* Two year plan */}
              <PricingCard
                plan={BILLING_PLANS.two_year}
                isPremium={isPremium}
                loading={checkoutLoading === "two_year"}
                onSelect={() => handleCheckout("two_year")}
                featured
              />

              <TeamsPlanCard />
            </div>

            {/* Features */}
            <div className="rounded-2xl bg-card/30 backdrop-blur border border-border/50 p-8">
              <h3 className="text-xl font-semibold mb-6 text-center">
                Everything you need for stress-free gifting
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  "Unlimited gift tracking",
                  "Multiple gift lists & events",
                  "Gift status management",
                  "Cost tracking & budgets",
                  "Recipient organization",
                  "Drag & drop reordering",
                  "Links to products",
                  "Notes & descriptions",
                  "Priority support",
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div className="p-1 rounded-full bg-violet-500/20">
                      <Check className="w-4 h-4 text-violet-400" />
                    </div>
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coupon Code Section */}
            {!isPremium && (
              <div className="mt-8 text-center">
                {!showCouponInput ? (
                  <button
                    onClick={() => {
                      setShowCouponInput(true);
                      setTimeout(() => couponInputRef.current?.focus(), 100);
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2"
                  >
                    <Ticket className="w-4 h-4" />
                    Do you have a coupon code?
                  </button>
                ) : (
                  <div className="max-w-sm mx-auto animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex gap-2">
                      <Input
                        ref={couponInputRef}
                        placeholder="Enter coupon code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRedeemCoupon();
                          if (e.key === "Escape") {
                            setShowCouponInput(false);
                            setCouponCode("");
                          }
                        }}
                        className="text-center font-mono tracking-wider uppercase"
                        disabled={couponLoading}
                      />
                      <Button
                        onClick={handleRedeemCoupon}
                        disabled={couponLoading || !couponCode.trim()}
                        className="bg-gradient-to-r from-red-500 to-green-500 hover:from-red-600 hover:to-green-600 text-white border-0"
                      >
                        {couponLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Redeem"
                        )}
                      </Button>
                    </div>
                    <button
                      onClick={() => {
                        setShowCouponInput(false);
                        setCouponCode("");
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground mt-2"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Charity notice */}
            <div className="mt-12 flex items-center justify-center gap-2 text-rose-400">
              <Heart className="w-4 h-4 fill-current" />
              <span className="text-sm font-medium">
                10% of all proceeds go to Sick Kids Hospital
              </span>
            </div>

            {/* FAQ */}
            <div className="mt-6 text-center text-sm text-muted-foreground">
              <p>
                Questions? Contact us at{" "}
                <a
                  href="mailto:support@listygifty.com"
                  className="text-violet-400 hover:underline"
                >
                  support@listygifty.com
                </a>
              </p>
              <p className="mt-2">
                Prices in Canadian dollars (CAD). Secure payment via Stripe.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface PricingCardProps {
  plan: (typeof BILLING_PLANS)[keyof typeof BILLING_PLANS];
  isPremium: boolean;
  loading: boolean;
  onSelect: () => void;
  featured?: boolean;
}

function PricingCard({ plan, isPremium, loading, onSelect, featured }: PricingCardProps) {
  return (
    <div
      className={`relative rounded-2xl p-6 transition-all ${
        featured
          ? "bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-pink-500/20 border-2 border-violet-500/30 shadow-lg shadow-violet-500/10"
          : "bg-card/50 backdrop-blur border border-border/50"
      }`}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-gradient-to-r from-violet-500 to-fuchsia-500 border-0 text-white shadow-lg">
            Best Value
          </Badge>
        </div>
      )}

      <div className="text-center mb-6">
        <h3 className="text-lg font-medium text-muted-foreground mb-2">{plan.name}</h3>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold">${plan.price}</span>
          <span className="text-muted-foreground">CAD</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          ${plan.pricePerDay.toFixed(3)}/day
        </p>
        {plan.savings && (
          <Badge variant="secondary" className="mt-2 bg-emerald-500/20 text-emerald-400 border-0">
            Save ${plan.savings}
          </Badge>
        )}
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="w-4 h-4 text-violet-400" />
          <span>
            {plan.years === 1 ? "1 year" : "2 years"} of unlimited gifts
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Gift className="w-4 h-4 text-violet-400" />
          <span>All premium features included</span>
        </div>
      </div>

      <Button
        onClick={onSelect}
        disabled={loading || isPremium}
        className={`w-full ${
          featured
            ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white border-0"
            : ""
        }`}
        size="lg"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPremium ? (
          "Already Premium"
        ) : (
          "Get Premium"
        )}
      </Button>
    </div>
  );
}

function TeamsPlanCard() {
  return (
    <div className="relative rounded-2xl border-2 border-cyan-500/30 bg-card/50 p-6 backdrop-blur transition-all shadow-lg shadow-cyan-500/5">
      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
        <Badge className="border-0 bg-cyan-500 text-slate-950 shadow-lg">
          Teams Pilot
        </Badge>
      </div>

      <div className="mb-6 text-center">
        <h3 className="mb-2 text-lg font-medium text-muted-foreground">Listy Gifty Teams</h3>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold">Custom</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          For employee gifting workflows
        </p>
      </div>

      <div className="mb-6 space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <Building2 className="h-4 w-4 text-cyan-400" />
          <span>Business workspaces and company profile</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Users className="h-4 w-4 text-cyan-400" />
          <span>Multi-admin setup for HR and ops</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Gift className="h-4 w-4 text-cyan-400" />
          <span>CSV imports, addresses, reports, and handoff exports</span>
        </div>
      </div>

      <Link
        href={DEFAULT_BUSINESS_USE_CASE.href}
        onClick={() =>
          captureWebEvent("teams_plan_started", {
            source: "billing",
          })
        }
      >
        <Button className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400" size="lg">
          Start Team Setup
        </Button>
      </Link>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Pilot onboarding for holiday boxes, onboarding kits, and milestones.
      </p>
    </div>
  );
}
