"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Header } from "@/components/header";
import {
  SidebarFilters,
  applyFilters,
} from "@/components/sidebar-filters";
import { CardGrid, CardGridSkeleton } from "@/components/card-grid";
import { LineupBuilder } from "@/components/lineup-builder/lineup-builder";
import { StrategyDashboard } from "@/components/strategy-dashboard";
import { HomeDashboard } from "@/components/home-dashboard";
import { LiveMarketTab } from "@/components/live-market/live-market-tab";
import { RoomsList } from "@/components/rooms/rooms-list";
import { RoomView } from "@/components/rooms/room-view";
import { LiveGamesTab } from "@/components/live-games/live-games-tab";
import { useFilterStore } from "@/lib/store";
import type { CardsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "home" | "lineup" | "strategy" | "gallery" | "market" | "live-games" | "rooms";

interface CardsApiResponse extends CardsResponse {
  cached?: boolean;
  cachedAt?: string;
}

async function fetchSettings(): Promise<{ userSlug: string }> {
  const res = await fetch("/api/settings");
  if (!res.ok) return { userSlug: "ba-zii" };
  return res.json();
}

async function fetchCards(slug: string, refresh = false, retries = 2): Promise<CardsApiResponse> {
  const url = `/api/cards?slug=${slug}${refresh ? "&refresh=true" : ""}`;
  const res = await fetch(url);
  if (res.status === 429 && retries > 0) {
    await new Promise((r) => setTimeout(r, 3000));
    return fetchCards(slug, refresh, retries - 1);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to fetch cards");
  }
  return res.json();
}

const TABS: { key: Tab; label: string; borderColor?: string }[] = [
  { key: "home", label: "Home" },
  { key: "lineup", label: "Lineup Builder" },
  { key: "strategy", label: "Strategy", borderColor: "border-purple-400" },
  { key: "gallery", label: "Gallery" },
  { key: "market", label: "Live Market", borderColor: "border-green-400" },
  { key: "live-games", label: "Live Games", borderColor: "border-cyan-400" },
  { key: "rooms", label: "Rooms", borderColor: "border-cyan-400" },
];

export default function GalleryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { filters } = useFilterStore();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    staleTime: Infinity,
  });

  const userSlug = settings?.userSlug || "ba-zii";

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cards", userSlug],
    queryFn: () => fetchCards(userSlug),
    enabled: !!userSlug,
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
  });

  const cachedAt = data?.cachedAt ? new Date(data.cachedAt) : null;
  const cacheAgeMin = cachedAt ? Math.round((Date.now() - cachedAt.getTime()) / 60000) : null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await fetchCards(userSlug, true);
      queryClient.setQueryData(["cards", userSlug], fresh);
    } catch (e) {
      console.error("Refresh failed:", e);
    }
    setIsRefreshing(false);
  };

  const allCards = data?.cards || [];
  const filteredCards = useMemo(
    () => applyFilters(allCards, filters),
    [allCards, filters]
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        userSlug={userSlug}
        onUserChange={async (newSlug: string) => {
          await fetch("/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userSlug: newSlug }),
          });
          queryClient.invalidateQueries({ queryKey: ["settings"] });
          queryClient.invalidateQueries({ queryKey: ["cards"] });
        }}
      />

      {/* Tabs + Refresh */}
      <div className="border-b border-zinc-800 px-6">
        <div className="flex items-center gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "py-3 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? `text-white border-b-2 ${tab.borderColor || "border-white"}`
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab.label}
            </button>
          ))}

          {/* Refresh + cache info */}
          <div className="ml-auto flex items-center gap-3">
            {cacheAgeMin !== null && (
              <span className="text-[10px] text-zinc-600">
                {data?.cached ? `cached ${cacheAgeMin < 60 ? `${cacheAgeMin}m` : `${Math.round(cacheAgeMin / 60)}h`} ago` : "fresh"}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                isRefreshing
                  ? "bg-zinc-800 text-zinc-500 cursor-wait"
                  : "bg-purple-600/80 hover:bg-purple-500 text-white"
              )}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
              {isRefreshing ? "Refreshing..." : "Refresh Cards"}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {activeTab === "gallery" ? (
        <div className="flex flex-1 overflow-hidden">
          <SidebarFilters
            cards={allCards}
            filteredCount={filteredCards.length}
          />
          <main className="flex-1 overflow-y-auto p-4">
            {error ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center space-y-3 max-w-md">
                  <p className="text-lg font-medium text-red-400">Error loading cards</p>
                  <p className="text-sm text-zinc-500">{error instanceof Error ? error.message : "Unknown error"}</p>
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
            <p className="text-lg font-medium text-red-400">Error loading cards</p>
            <p className="text-sm text-zinc-500">{error instanceof Error ? error.message : "Unknown error"}</p>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-zinc-500">Loading cards...</p>
          </div>
        </div>
      ) : activeTab === "rooms" ? (
        activeRoomId ? (
          <RoomView
            roomId={activeRoomId}
            userSlug={userSlug}
            cards={allCards}
            onBack={() => setActiveRoomId(null)}
          />
        ) : (
          <RoomsList
            userSlug={userSlug}
            onEnterRoom={(id) => setActiveRoomId(id)}
          />
        )
      ) : activeTab === "market" ? (
        <LiveMarketTab cards={allCards} />
      ) : activeTab === "live-games" ? (
        <LiveGamesTab cards={allCards} />
      ) : activeTab === "home" ? (
        <HomeDashboard cards={allCards} onNavigate={setActiveTab} />
      ) : activeTab === "lineup" ? (
        <LineupBuilder cards={allCards} />
      ) : (
        <StrategyDashboard cards={allCards} />
      )}
    </div>
  );
}
