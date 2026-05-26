"use client";

import { useState } from "react";

interface Gift {
  id: string;
  name: string;
  price: number;
  status: "planned" | "ordered" | "suggestion";
  emoji: string;
}

interface Person {
  id: string;
  name: string;
  initial: string;
  color: string;
  totalSpent: number;
  gifts: Gift[];
}

const demoData: Person[] = [
  {
    id: "mom",
    name: "Mom",
    initial: "M",
    color: "bg-violet-500",
    totalSpent: 125,
    gifts: [
      { id: "1", name: "Knitting Supplies", price: 45, status: "ordered", emoji: "🧶" },
      { id: "2", name: "Garden Book", price: 25, status: "suggestion", emoji: "📚" }
    ]
  },
  {
    id: "dad",
    name: "Dad",
    initial: "D", 
    color: "bg-fuchsia-500",
    totalSpent: 95,
    gifts: [
      { id: "3", name: "History Audiobook", price: 30, status: "planned", emoji: "🎧" },
      { id: "4", name: "Coffee Subscription", price: 65, status: "suggestion", emoji: "☕" }
    ]
  }
];

export function HeroPreview() {
  const [hoveredPerson, setHoveredPerson] = useState<string | null>(null);
  const [hoveredGift, setHoveredGift] = useState<string | null>(null);

  const getStatusIcon = (status: Gift["status"]) => {
    switch (status) {
      case "ordered": return "✅";
      case "planned": return "🛒";
      case "suggestion": return "💡";
    }
  };

  const getStatusColor = (status: Gift["status"]) => {
    switch (status) {
      case "ordered": return "text-green-400";
      case "planned": return "text-blue-400";
      case "suggestion": return "text-amber-400";
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white mb-2">
          🎄 Christmas 2024 Gift List
        </h3>
        <div className="flex items-center justify-center gap-4 text-sm text-slate-400">
          <span>Total: ${demoData.reduce((sum, person) => sum + person.totalSpent, 0)}</span>
          <span>•</span>
          <span>4 gifts planned</span>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all duration-300 shadow-xl shadow-violet-500/10">
        <div className="space-y-4">
          {demoData.map((person) => (
            <div
              key={person.id}
              className="group"
              onMouseEnter={() => setHoveredPerson(person.id)}
              onMouseLeave={() => setHoveredPerson(null)}
            >
              <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-all duration-300 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${person.color} rounded-full flex items-center justify-center text-white font-bold shadow-lg`}>
                    {person.initial}
                  </div>
                  <div>
                    <div className="text-white font-semibold">{person.name}</div>
                    <div className="text-slate-400 text-sm">{person.gifts.length} gifts</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-violet-400">${person.totalSpent}</div>
                  <div className="text-slate-400 text-xs">total budget</div>
                </div>
              </div>

              <div className={`overflow-hidden transition-all duration-300 ${
                hoveredPerson === person.id || person.id === "mom" ? "max-h-96 opacity-100 mt-3" : "max-h-0 opacity-0"
              }`}>
                <div className="space-y-2 ml-4">
                  {person.gifts.map((gift) => (
                    <div
                      key={gift.id}
                      className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredGift(gift.id)}
                      onMouseLeave={() => setHoveredGift(null)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{gift.emoji}</span>
                        <div>
                          <div className="text-white text-sm font-medium">{gift.name}</div>
                          <div className={`text-xs ${getStatusColor(gift.status)}`}>
                            {gift.status === "suggestion" ? "idea" : gift.status}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300 text-sm">${gift.price}</span>
                        <span className={`${getStatusColor(gift.status)} transition-transform duration-200 ${
                          hoveredGift === gift.id ? "scale-125" : ""
                        }`}>
                          {getStatusIcon(gift.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex items-center gap-3 p-3 bg-slate-600/50 rounded-lg hover:bg-slate-600 transition-all duration-300 cursor-pointer opacity-75 hover:opacity-100">
                    <div className="w-6 h-6 bg-slate-500 rounded-full flex items-center justify-center text-slate-300 text-sm">
                      +
                    </div>
                    <span className="text-slate-300 text-sm">Add gift idea...</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-300 text-sm font-medium">Spending Balance</span>
            <span className="text-green-400 text-sm">✅ Well balanced</span>
          </div>
          
          <div className="space-y-2">
            {demoData.map((person) => (
              <div key={person.id} className="flex items-center gap-3">
                <div className={`w-4 h-4 ${person.color} rounded-full`}></div>
                <span className="text-slate-300 text-sm flex-1">{person.name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-slate-600 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-1000"
                      style={{ width: `${(person.totalSpent / 130) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-slate-300 text-sm w-12 text-right">${person.totalSpent}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="text-slate-400 text-xs">
            <span className="inline-block animate-pulse mr-1">👆</span>
            Hover over people and gifts to explore
          </p>
        </div>
      </div>
    </div>
  );
}
