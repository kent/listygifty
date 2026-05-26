"use client";

import { useState } from "react";
import { giftSuggestionsService } from "@/services";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Loader2,
  Plus,
  X,
  DollarSign,
  Calendar,
  Crown,
  Wand2,
} from "lucide-react";
import { ApiError } from "@/lib/api-client";
import type { GiftSuggestion } from "@niftygifty/types";
import Link from "next/link";

interface GiftSuggestionsTabProps {
  personId: number;
  personName: string;
  suggestions: GiftSuggestion[];
  onSuggestionsChange: (suggestions: GiftSuggestion[]) => void;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function SuggestionCard({
  suggestion,
  onAccept,
  onDiscard,
  isAccepting,
  isDiscarding,
}: {
  suggestion: GiftSuggestion;
  onAccept: () => void;
  onDiscard: () => void;
  isAccepting: boolean;
  isDiscarding: boolean;
}) {
  const disabled = isAccepting || isDiscarding;

  return (
    <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-white">{suggestion.name}</h4>
            {suggestion.description && (
              <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                {suggestion.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3">
          {suggestion.approximate_price && (
            <span className="text-sm text-emerald-400 flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              {suggestion.approximate_price.replace("$", "")}
            </span>
          )}
          {suggestion.holiday && (
            <Badge
              variant="secondary"
              className="bg-slate-700/50 text-slate-300 border-0"
            >
              <Calendar className="h-3 w-3 mr-1" />
              {suggestion.holiday.name}
              {suggestion.holiday.date && ` · ${formatDate(suggestion.holiday.date)}`}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800">
          <Button
            size="sm"
            onClick={onAccept}
            disabled={disabled}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {isAccepting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Add to Gifts
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDiscard}
            disabled={disabled}
            className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
          >
            {isDiscarding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <X className="h-4 w-4 mr-1" />
                Discard
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PremiumUpsell() {
  return (
    <Card className="border-violet-500/30 bg-gradient-to-br from-violet-950/50 to-fuchsia-950/30">
      <CardContent className="py-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
            <Crown className="h-8 w-8 text-violet-400" />
          </div>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">
          Gift Idea Generator
        </h3>
        <p className="text-slate-400 mb-6 max-w-md mx-auto">
          Brainstorm ideas from age, relationship, occasion, and gift history,
          then save the strongest options to the gift list.
        </p>
        <Link href="/billing">
          <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700">
            <Sparkles className="h-4 w-4 mr-2" />
            Upgrade for Ideas
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export function GiftSuggestionsTab({
  personId,
  personName,
  suggestions,
  onSuggestionsChange,
}: GiftSuggestionsTabProps) {
  const { isPremium } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [discardingId, setDiscardingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const newSuggestions = await giftSuggestionsService.generate(personId);
      onSuggestionsChange([...newSuggestions, ...suggestions]);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to generate suggestions. Please try again.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = async (id: number) => {
    setAcceptingId(id);
    setError(null);

    try {
      await giftSuggestionsService.accept(id);
      onSuggestionsChange(suggestions.filter((s) => s.id !== id));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to add gift. Please try again.");
      }
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDiscard = async (id: number) => {
    setDiscardingId(id);
    setError(null);

    try {
      await giftSuggestionsService.discard(id);
      onSuggestionsChange(suggestions.filter((s) => s.id !== id));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to discard suggestion. Please try again.");
      }
    } finally {
      setDiscardingId(null);
    }
  };

  if (!isPremium) {
    return <PremiumUpsell />;
  }

  return (
    <div className="space-y-4">
      {/* Generate Button */}
      <Card className="border-slate-800 bg-slate-900/30">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-medium text-white">Idea Generator</h3>
              <p className="text-sm text-slate-400">
                Brainstorm gift ideas for {personName}, then add the useful ones
                to the list.
              </p>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full justify-center bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 sm:w-auto"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Ideas
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="border-red-500/30 bg-red-950/20">
          <CardContent className="p-4 text-red-400 text-sm">{error}</CardContent>
        </Card>
      )}

      {/* Suggestions List */}
      {suggestions.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/30">
          <CardContent className="py-8 text-center">
            <Sparkles className="h-10 w-10 mx-auto text-slate-600 mb-3" />
            <p className="text-slate-500">
              No suggestions yet. Click &quot;Generate Ideas&quot; to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onAccept={() => handleAccept(suggestion.id)}
              onDiscard={() => handleDiscard(suggestion.id)}
              isAccepting={acceptingId === suggestion.id}
              isDiscarding={discardingId === suggestion.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
