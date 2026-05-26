"use client";

import { CreditCard, Sparkles, Crown, Zap, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BillingSection() {
  return (
    <section className="space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full" />
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
            <CreditCard className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Billing</h2>
            <p className="text-slate-400 text-sm">
              Manage your subscription and payment methods
            </p>
          </div>
        </div>
      </div>

      {/* Coming Soon Card */}
      <div className="relative rounded-2xl border border-slate-800/50 bg-slate-900/30 backdrop-blur-xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        
        <div className="relative py-12 px-6">
          <div className="text-center max-w-md mx-auto">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-6 relative">
              <Crown className="h-10 w-10 text-amber-400" />
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
            </div>
            
            <h3 className="text-xl font-bold text-white mb-3">Premium Coming Soon</h3>
            <p className="text-slate-400 text-sm mb-8">
              Unlock powerful features to supercharge your gift planning experience.
              Be the first to know when we launch!
            </p>

            {/* Feature Preview */}
            <div className="grid gap-3 text-left mb-8">
              {[
                "Unlimited gift lists & recipients",
                "Advanced gift idea organization",
                "Budget tracking & analytics",
                "Collaborative planning",
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/30 border border-slate-700/50">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                    <Check className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                  <span className="text-sm text-slate-300">{feature}</span>
                </div>
              ))}
            </div>

            <Button
              disabled
              className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-lg shadow-amber-500/25 disabled:opacity-60 w-full"
            >
              <Zap className="mr-2 h-4 w-4" />
              Notify Me When Available
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
