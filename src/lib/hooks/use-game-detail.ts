import { useQuery } from "@tanstack/react-query";
import type { GameDetail } from "@/lib/types";

async function fetchGameDetail(gameId: string): Promise<GameDetail | null> {
  const res = await fetch(`/api/games/${gameId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.game ?? null;
}

export function useGameDetail(gameId: string) {
  const { data: game = null, isLoading } = useQuery({
    queryKey: ["game-detail", gameId],
    queryFn: () => fetchGameDetail(gameId),
    enabled: !!gameId,
    refetchInterval: (query) => {
      const g = query.state.data;
      return g?.statusTyped === "playing" ? 30_000 : false;
    },
    staleTime: 15_000,
  });

  const isLive = game?.statusTyped === "playing";

  return { game, isLoading, isLive };
}
