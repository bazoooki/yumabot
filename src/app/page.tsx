"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Header } from "@/components/header";
import {
  SidebarFilters,
  applyFilters,
} from "@/components/sidebar-filters";
import { CardGrid, CardGridSkeleton } from "@/components/card-grid";
import { LineupBuilder } from "@/components/lineup-builder/lineup-builder";
import { StrategyDashboard } from "@/components/strategy-dashboard";
import { useFilterStore } from "@/lib/store";
import type { CardsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const USER_SLUG = "ba-zii";

type Tab = "gallery" | "lineup" | "strategy";

async function fetchCards(): Promise<CardsResponse> {
  const res = await fetch(`/api/cards?slug=${USER_SLUG}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to fetch cards");
  }
  return res.json();
}

export default function GalleryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("gallery");
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
          <button
            onClick={() => setActiveTab("gallery")}
            className={cn(
              "py-3 text-sm font-medium transition-colors",
              activeTab === "gallery"
                ? "text-white border-b-2 border-white"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Gallery
          </button>
          <button
            onClick={() => setActiveTab("lineup")}
            className={cn(
              "py-3 text-sm font-medium transition-colors",
              activeTab === "lineup"
                ? "text-white border-b-2 border-white"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Lineup Builder
          </button>
          <button
            onClick={() => setActiveTab("strategy")}
            className={cn(
              "py-3 text-sm font-medium transition-colors",
              activeTab === "strategy"
                ? "text-white border-b-2 border-purple-400"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Strategy
          </button>
        </div>
      </div>

      {/* Main Content */}
      {activeTab === "gallery" ? (
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
      ) : error ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3 max-w-md">
            <p className="text-lg font-medium text-red-400">
              Error loading cards
            </p>
            <p className="text-sm text-zinc-500">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-zinc-500">Loading cards...</p>
          </div>
        </div>
      ) : activeTab === "lineup" ? (
        <LineupBuilder cards={allCards} />
      ) : (
        <StrategyDashboard cards={allCards} />
      )}
    </div>
  );
}
