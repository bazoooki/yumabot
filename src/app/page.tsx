"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Header } from "@/components/header";
import {
  SidebarFilters,
  applyFilters,
} from "@/components/sidebar-filters";
import { CardGrid, CardGridSkeleton } from "@/components/card-grid";
import { useFilterStore } from "@/lib/store";
import type { CardsResponse } from "@/lib/types";

const USER_SLUG = "ba-zii";

async function fetchCards(): Promise<CardsResponse> {
  const res = await fetch(`/api/cards?slug=${USER_SLUG}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to fetch cards");
  }
  return res.json();
}

export default function GalleryPage() {
  const { filters } = useFilterStore();

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cards", USER_SLUG],
    queryFn: fetchCards,
  });

  const allCards = data?.cards || [];
  const filteredCards = useMemo(
    () => applyFilters(allCards, filters),
    [allCards, filters]
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header userSlug={USER_SLUG} />

      {/* Tabs */}
      <div className="border-b border-zinc-800 px-6">
        <div className="flex gap-6">
          <button className="py-3 text-sm font-medium text-white border-b-2 border-white">
            Gallery
          </button>
          <button className="py-3 text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
            Collections
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <SidebarFilters
          cards={allCards}
          filteredCount={filteredCards.length}
        />

        {/* Card Grid */}
        <main className="flex-1 overflow-y-auto p-4">
          {error ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-3 max-w-md">
                <p className="text-lg font-medium text-red-400">
                  Error loading cards
                </p>
                <p className="text-sm text-zinc-500">
                  {error instanceof Error ? error.message : "Unknown error"}
                </p>
                <p className="text-xs text-zinc-600">
                  Make sure your SORARE_API_KEY is set in .env.local
                </p>
              </div>
            </div>
          ) : isLoading ? (
            <CardGridSkeleton />
          ) : (
            <CardGrid cards={filteredCards} isLoading={false} />
          )}
        </main>
      </div>
    </div>
  );
}
