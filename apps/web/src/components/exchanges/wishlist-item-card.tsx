"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, ExternalLink, Image, Trash2 } from "lucide-react";
import type { WishlistItem } from "@niftygifty/types";

interface WishlistItemCardProps {
  item: WishlistItem;
  onDelete?: (item: WishlistItem) => void;
  readOnly?: boolean;
}

export function WishlistItemCard({ item, onDelete, readOnly = false }: WishlistItemCardProps) {
  return (
    <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {item.photo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.photo_url}
              alt={item.name}
              className="w-16 h-16 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image className="h-6 w-6 text-slate-400 dark:text-slate-600" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="break-words font-semibold text-slate-900 dark:text-white">{item.name}</h3>
            {item.description && (
              <p className="break-words text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{item.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm">
              {item.price && (
                <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                  <DollarSign className="h-3 w-3" />
                  {parseFloat(item.price).toFixed(2)}
                </span>
              )}
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-violet-700 dark:text-violet-400 hover:text-violet-600 dark:hover:text-violet-300"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Link
                </a>
              )}
            </div>
          </div>
          {!readOnly && onDelete && (
            <Button
              size="icon-sm"
              variant="ghost"
              className="size-11 sm:size-8 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              onClick={() => onDelete(item)}
              aria-label={`Remove ${item.name}`}
              title="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
