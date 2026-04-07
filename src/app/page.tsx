"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Header } from "@/components/header";
import { UserPicker } from "@/components/user-picker";
import { LineupBuilder } from "@/components/lineup-builder/lineup-builder";
import { HomeDashboard } from "@/components/home-dashboard";
import { LiveMarketTab } from "@/components/live-market/live-market-tab";
import { LiveGamesTab } from "@/components/live-games/live-games-tab";
import { InSeasonTab } from "@/components/in-season/in-season-tab";
import { useMarketStream } from "@/lib/market/use-market-stream";
import type { CardsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "home" | "lineup" | "market" | "live-games" | "in-season";

interface CardsApiResponse extends CardsResponse {
  cached?: boolean;
  cachedAt?: string;
}

function getStoredSlug(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("yumabot-user-slug");
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

const TABS: { key: Tab; label: string; borderColor?: string; badge?: string }[] = [
  { key: "home", label: "Home" },
  { key: "lineup", label: "Lineup Builder" },
  { key: "market", label: "Live Market", borderColor: "border-green-400" },
  { key: "live-games", label: "Live Games", borderColor: "border-cyan-400" },
  { key: "in-season", label: "In Season", borderColor: "border-amber-400", badge: "beta" },
];

export default function GalleryPageWrapper() {
  return (
    <Suspense>
      <GalleryPage />
    </Suspense>
  );
}

function GalleryPage() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userSlug, setUserSlug] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Keep market stream connected regardless of active tab
  useMarketStream();

  const searchParams = useSearchParams();

  useEffect(() => {
    setUserSlug(getStoredSlug());
  }, []);

  // Auto-switch to live-games tab when ?game= param is present
  useEffect(() => {
    if (searchParams.get("game")) {
      setActiveTab("live-games");
    }
  }, [searchParams]);

  const handleUserSelect = (slug: string) => {
    localStorage.setItem("yumabot-user-slug", slug);
    setUserSlug(slug);
  };

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cards", userSlug],
    queryFn: () => fetchCards(userSlug!),
    enabled: !!userSlug,
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
  });

  const cachedAt = data?.cachedAt ? new Date(data.cachedAt) : null;
  const cacheAgeMin = cachedAt ? Math.round((Date.now() - cachedAt.getTime()) / 60000) : null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await fetchCards(userSlug!, true);
      queryClient.setQueryData(["cards", userSlug], fresh);
    } catch (e) {
      console.error("Refresh failed:", e);
    }
    setIsRefreshing(false);
  };

  const allCards = data?.cards || [];

  if (!userSlug) {
    return <UserPicker onSelect={handleUserSelect} />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        userSlug={userSlug}
        onUserChange={async (newSlug: string) => {
          handleUserSelect(newSlug);
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
                "py-3 text-sm font-medium transition-colors flex items-center gap-1.5",
                activeTab === tab.key
                  ? `text-white border-b-2 ${tab.borderColor || "border-white"}`
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab.label}
              {tab.badge && (
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 leading-none">
                  {tab.badge}
                </span>
              )}
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
      {error ? (
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
      ) : (
        <>
          {activeTab === "home" && <HomeDashboard cards={allCards} onNavigate={setActiveTab} />}
          {activeTab === "lineup" && <LineupBuilder cards={allCards} />}
          {activeTab === "in-season" && <InSeasonTab cards={allCards} userSlug={userSlug} />}

          {/* Keep market & live-games always mounted so streams persist */}
          <div className={activeTab === "market" ? "flex flex-1 overflow-hidden" : "hidden"}>
            <LiveMarketTab cards={allCards} />
          </div>
          <div className={activeTab === "live-games" ? "flex flex-1 overflow-hidden" : "hidden"}>
            <LiveGamesTab cards={allCards} />
          </div>
        </>
      )}
    </div>
  );
}
