"use client";

import { useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tv, ChevronLeft } from "lucide-react";
import type { SorareCard } from "@/lib/types";
import { GamesList } from "./games-list";
import { MatchRoom } from "./match-room";

interface Props {
  cards: SorareCard[];
  userSlug: string;
}

export function LiveGamesTab({ cards, userSlug }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedGameId = searchParams.get("game");

  const selectGame = useCallback((id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("game", id);
    router.push(`?${params.toString()}`);
  }, [searchParams, router]);

  const clearGame = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("game");
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "/");
  }, [searchParams, router]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

      {/* Header */}
      <div className="px-6 py-3 border-b border-zinc-800 flex items-center gap-3 shrink-0">
        {selectedGameId ? (
          <button
            onClick={clearGame}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to games
          </button>
        ) : (
          <>
            <Tv className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Live Games</h2>
          </>
        )}
      </div>

      {/* Content */}
      {selectedGameId ? (
        <MatchRoom gameId={selectedGameId} cards={cards} userSlug={userSlug} />
      ) : (
        <GamesList
          cards={cards}
          onSelectGame={selectGame}
        />
      )}
    </div>
  );
}
