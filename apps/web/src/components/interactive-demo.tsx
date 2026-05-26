'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DemoSlideshow } from './demo-slideshow';
import { BRAND_NAME } from '@/lib/brand';

const demoSteps = [
  {
    number: 1,
    title: "Add People",
    description: "Import family, friends, coworkers",
    icon: "👥"
  },
  {
    number: 2, 
    title: "Plan Gifts",
    description: "Track ideas, set budgets, compare options",
    icon: "🎁"
  },
  {
    number: 3,
    title: "Stay Balanced", 
    description: "Our tools ensure fair spending",
    icon: "⚖️"
  }
];

export function InteractiveDemo() {
  const [showSlideshow, setShowSlideshow] = useState(false);

  return (
    <>
      <section className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Try {BRAND_NAME} in{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
              60 Seconds
            </span>
          </h2>
          <p className="text-lg text-slate-400 mb-12 max-w-2xl mx-auto">
            See how easy gift planning can be with our 3-step interactive walkthrough.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {demoSteps.map((step) => (
              <div 
                key={step.number}
                className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all duration-300"
              >
                <div className="text-4xl mb-4">{step.icon}</div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-bold text-sm mb-3 mx-auto">
                  {step.number}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-slate-400 text-sm">{step.description}</p>
              </div>
            ))}
          </div>

          <Button
            size="lg"
            onClick={() => setShowSlideshow(true)}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-lg px-8 py-6 h-auto shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-300"
          >
            Try It Yourself
            <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h6m2 5.5V19c0-1.657-1.343-3-3-3H6c-1.657 0-3 1.343-3 3v2.5M12 12.5V12" />
            </svg>
          </Button>
        </div>
      </section>

      {showSlideshow && (
        <DemoSlideshow onClose={() => setShowSlideshow(false)} />
      )}
    </>
  );
}
