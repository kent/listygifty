'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { BRAND_NAME } from '@/lib/brand';

interface Slide {
  id: number;
  title: string;
  description: string;
  gradient: string;
  mockup: React.ReactNode;
}

function PeopleMockup() {
  const [hoveredPerson, setHoveredPerson] = useState<string | null>(null);
  
  const people = [
    { id: 'mom', name: 'Sarah (Mom)', initial: 'S', color: 'bg-violet-500' },
    { id: 'dad', name: 'Michael (Dad)', initial: 'M', color: 'bg-fuchsia-500' },
    { id: 'sister', name: 'Emma (Sister)', initial: 'E', color: 'bg-cyan-500' }
  ];

  return (
    <div className="w-full max-w-sm mx-auto bg-slate-800 rounded-lg p-4 border border-slate-600">
      <div className="space-y-3">
        {people.map((person) => (
          <div 
            key={person.id}
            className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg hover:bg-slate-600 transition-all duration-300 cursor-pointer"
            onMouseEnter={() => setHoveredPerson(person.id)}
            onMouseLeave={() => setHoveredPerson(null)}
          >
            <div className={`w-8 h-8 ${person.color} rounded-full flex items-center justify-center text-white text-sm font-bold transition-transform duration-200 ${
              hoveredPerson === person.id ? 'scale-110 shadow-lg' : ''
            }`}>
              {person.initial}
            </div>
            <span className="text-white">{person.name}</span>
            {hoveredPerson === person.id && (
              <div className="ml-auto text-slate-300 text-xs">
                Click to edit →
              </div>
            )}
          </div>
        ))}
        <div className="flex items-center gap-3 p-3 bg-slate-600 rounded-lg opacity-75 hover:opacity-100 hover:bg-slate-600 transition-all duration-300 cursor-pointer">
          <div className="w-8 h-8 bg-slate-500 rounded-full flex items-center justify-center text-slate-300 text-sm">+</div>
          <span className="text-slate-300">Add person...</span>
        </div>
      </div>
    </div>
  );
}

function GiftsMockup() {
  const [hoveredGift, setHoveredGift] = useState<string | null>(null);
  
  const gifts = [
    { id: 'knitting', name: '🧶 Knitting Supplies', price: 45, status: 'ordered', statusColor: 'text-green-400' },
    { id: 'book', name: '📚 Garden Planning Book', price: 28, status: 'suggestion', statusColor: 'text-amber-400' },
    { id: 'tea', name: '🍵 Herbal Tea Set', price: 35, status: 'considering', statusColor: 'text-blue-400' }
  ];

  return (
    <div className="w-full max-w-sm mx-auto bg-slate-800 rounded-lg p-4 border border-slate-600">
      <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-500 rounded-full flex items-center justify-center text-white text-sm font-bold">S</div>
          <div>
            <div className="text-white text-sm">Sarah (Mom)</div>
            <div className="text-slate-400 text-xs">{gifts.length} gifts planned</div>
          </div>
        </div>
        <div className="text-violet-400 text-sm font-semibold">$108</div>
      </div>
      
      <div className="space-y-2">
        {gifts.map((gift) => (
          <div 
            key={gift.id}
            className="p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-all duration-300 cursor-pointer"
            onMouseEnter={() => setHoveredGift(gift.id)}
            onMouseLeave={() => setHoveredGift(null)}
          >
            <div className="flex items-center justify-between">
              <div className="text-white text-sm mb-1">{gift.name}</div>
              <div className={`text-sm transition-transform duration-200 ${
                hoveredGift === gift.id ? 'scale-110' : ''
              } ${gift.statusColor}`}>
                ${gift.price}
              </div>
            </div>
            <div className={`text-xs ${gift.statusColor}`}>
              {gift.status === 'suggestion' && '💡 Idea based on interests'}
              {gift.status === 'ordered' && '✅ Ordered from Amazon'}
              {gift.status === 'considering' && '🤔 Added to wishlist'}
            </div>
          </div>
        ))}
        
        <div className="p-3 bg-slate-600/50 rounded-lg hover:bg-slate-600 transition-all duration-300 cursor-pointer opacity-75 hover:opacity-100">
          <div className="text-slate-300 text-sm">+ Add gift idea...</div>
          <div className="text-slate-400 text-xs">Capture ideas as they come up</div>
        </div>
      </div>
    </div>
  );
}

function BalanceMockup() {
  const [animateProgress, setAnimateProgress] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setAnimateProgress(true), 500);
    return () => clearTimeout(timer);
  }, []);
  
  const people = [
    { name: 'Sarah', initial: 'S', color: 'bg-violet-500', amount: 108, percentage: 83 },
    { name: 'Michael', initial: 'M', color: 'bg-fuchsia-500', amount: 125, percentage: 96 },
    { name: 'Emma', initial: 'E', color: 'bg-cyan-500', amount: 92, percentage: 71 }
  ];

  return (
    <div className="w-full max-w-sm mx-auto bg-slate-800 rounded-lg p-4 border border-slate-600">
      <div className="text-center mb-4">
        <div className="text-white text-lg font-bold mb-2">Spending Balance</div>
        <div className="text-slate-400 text-sm">Christmas 2024</div>
      </div>
      <div className="space-y-4">
        {people.map((person) => (
          <div key={person.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 ${person.color} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                {person.initial}
              </div>
              <span className="text-white text-sm">{person.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-slate-600 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r from-cyan-400 to-violet-500 rounded-full transition-all duration-1000 ease-out ${
                    animateProgress ? '' : 'w-0'
                  }`}
                  style={{ width: animateProgress ? `${person.percentage}%` : '0%' }}
                />
              </div>
              <span className="text-cyan-400 text-sm w-8 text-right">${person.amount}</span>
            </div>
          </div>
        ))}
        <div className="text-center text-green-400 text-xs mt-4 border-t border-slate-700 pt-3">
          ✅ Well balanced! Everyone within $35 range
        </div>
      </div>
    </div>
  );
}

const slides: Slide[] = [
  {
    id: 1,
    title: "Add Your People",
    description: "Start by adding family members, friends, and anyone you buy gifts for. Each person gets their own profile.",
    gradient: "from-violet-500 to-fuchsia-500",
    mockup: <PeopleMockup />
  },
  {
    id: 2,
    title: "Plan Your Gifts", 
    description: "Add gift ideas, set budgets, and keep options tied to each person's interests and past gifts.",
    gradient: "from-amber-500 to-orange-500",
    mockup: <GiftsMockup />
  },
  {
    id: 3,
    title: "Stay Balanced",
    description: "See spending comparisons at a glance. Our balance tools help ensure everyone feels equally loved.",
    gradient: "from-cyan-500 to-blue-500",
    mockup: <BalanceMockup />
  }
];

interface DemoSlideshowProps {
  onClose: () => void;
}

export function DemoSlideshow({ onClose }: DemoSlideshowProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying) return;
    
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 7000);

    return () => clearInterval(timer);
  }, [isPlaying]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsPlaying(false);
  };

  const currentSlideData = slides[currentSlide];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <span className="text-white font-semibold">{BRAND_NAME} Interactive Demo</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsPlaying(!isPlaying)}
            className="text-slate-300 hover:text-white"
          >
            {isPlaying ? '⏸️ Pause' : '▶️ Play'}
          </Button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="text-slate-300 hover:text-white hover:bg-slate-800"
        >
          ✕ Close
        </Button>
      </div>

      <div className="px-4 mb-8">
        <div className="flex gap-1">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 flex-1 rounded cursor-pointer transition-colors duration-300 ${
                index === currentSlide 
                  ? 'bg-violet-600' 
                  : index < currentSlide 
                    ? 'bg-violet-600/60' 
                    : 'bg-slate-700 hover:bg-slate-600'
              }`}
              onClick={() => goToSlide(index)}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-2">
          <span>Step {currentSlide + 1} of {slides.length}</span>
          <span>Click bars to jump to step</span>
        </div>
      </div>

      <div className="flex-1 px-4 pb-8">
        <div className={`relative h-full rounded-3xl bg-gradient-to-br ${currentSlideData.gradient} p-8 overflow-hidden`}>
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center h-full text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">
              {currentSlideData.title}
            </h2>
            
            <div className="mb-8 transform hover:scale-105 transition-transform duration-300">
              {currentSlideData.mockup}
            </div>
            
            <p className="text-xl text-white/90 mb-8 max-w-lg leading-relaxed">
              {currentSlideData.description}
            </p>

            <div className="flex gap-4">
              <Button
                onClick={currentSlide === slides.length - 1 ? onClose : nextSlide}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 px-6 py-3 text-lg"
              >
                {currentSlide === slides.length - 1 ? 'Start Free Account' : 'Continue Demo'}
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
              
              {currentSlide > 0 && (
                <Button
                  onClick={prevSlide}
                  variant="ghost"
                  className="text-white/80 hover:text-white hover:bg-white/10"
                >
                  ← Previous
                </Button>
              )}
            </div>
            
            <div className="mt-6 text-white/60 text-sm">
              <span className="inline-block animate-pulse mr-2">💡</span>
              Try hovering over elements in the preview above
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
