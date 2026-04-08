"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CardsResponse, SorareCard } from "@/lib/types";

interface CardsApiResponse extends CardsResponse {
  cached?: boolean;
  cachedAt?: string;
}

interface CardsContextValue {
  userSlug: string | null;
  cards: SorareCard[];
  isLoading: boolean;
  error: Error | null;
  cachedAt: Date | null;
  cacheAgeMin: number | null;
  isFresh: boolean;
  isRefreshing: boolean;
  handleRefresh: () => Promise<void>;
  handleUserSelect: (slug: string) => void;
}

const CardsContext = createContext<CardsContextValue | null>(null);

export function useCards() {
  const ctx = useContext(CardsContext);
  if (!ctx) throw new Error("useCards must be used within CardsProvider");
  return ctx;
}

function getStoredSlug(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("yumabot-user-slug");
}

async function fetchCards(
  slug: string,
  refresh = false,
  retries = 2,
): Promise<CardsApiResponse> {
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

export function CardsProvider({ children }: { children: ReactNode }) {
  const [userSlug, setUserSlug] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    setUserSlug(getStoredSlug());
  }, []);

  const handleUserSelect = useCallback(
    (slug: string) => {
      localStorage.setItem("yumabot-user-slug", slug);
      setUserSlug(slug);
      queryClient.invalidateQueries({ queryKey: ["cards"] });
    },
    [queryClient],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["cards", userSlug],
    queryFn: () => fetchCards(userSlug!),
    enabled: !!userSlug,
    staleTime: 6 * 60 * 60 * 1000,
  });

  const cachedAt = data?.cachedAt ? new Date(data.cachedAt) : null;
  const cacheAgeMin = cachedAt
    ? Math.round((Date.now() - cachedAt.getTime()) / 60000)
    : null;

  const handleRefresh = useCallback(async () => {
    if (!userSlug) return;
    setIsRefreshing(true);
    try {
      const fresh = await fetchCards(userSlug, true);
      queryClient.setQueryData(["cards", userSlug], fresh);
      toast.success(`Cards refreshed (${fresh.cards.length} cards)`, {
        duration: 3000,
      });
    } catch (e) {
      console.error("Refresh failed:", e);
      toast.error("Failed to refresh cards. Try again?", { duration: 5000 });
    }
    setIsRefreshing(false);
  }, [userSlug, queryClient]);

  const value: CardsContextValue = {
    userSlug,
    cards: data?.cards || [],
    isLoading,
    error: error as Error | null,
    cachedAt,
    cacheAgeMin,
    isFresh: !!data && !data.cached,
    isRefreshing,
    handleRefresh,
    handleUserSelect,
  };

  return (
    <CardsContext.Provider value={value}>{children}</CardsContext.Provider>
  );
}
