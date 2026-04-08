"use client";

import { CardComponent } from "./card";
import type { SorareCard } from "@/lib/types";
import { CardSkeleton } from "./ui/skeleton";

interface CardGridProps {
  cards: SorareCard[];
  isLoading: boolean;
}

export function CardGrid({ cards, isLoading }: CardGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-zinc-300">No cards found</p>
          <p className="text-sm text-zinc-500">
            Try adjusting your filters
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 content-ready">
      {cards.map((card, i) => (
        <div
          key={card.slug}
          className="card-enter"
          style={{ animationDelay: `${Math.min(i, 20) * 30}ms` }}
        >
          <CardComponent card={card} />
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
          <div className="aspect-[3/4] bg-zinc-800 animate-pulse" />
          <div className="p-2.5 space-y-2">
            <div className="h-3 bg-zinc-800 animate-pulse rounded w-2/3" />
            <div className="h-4 bg-zinc-800 animate-pulse rounded" />
            <div className="h-3 bg-zinc-800 animate-pulse rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
