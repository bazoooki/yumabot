"use client";

import { useState, useCallback } from "react";
import { Tv, ChevronLeft } from "lucide-react";
import type { SorareCard } from "@/lib/types";
import { GamesList } from "./games-list";
import { MatchRoom } from "./match-room";

interface Props {
  cards: SorareCard[];
  userSlug: string;
}

export function LiveGamesTab({ cards, userSlug }: Props) {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const selectGame = useCallback((id: string) => {
    setSelectedGameId(id);
  }, []);

  const clearGame = useCallback(() => {
    setSelectedGameId(null);
  }, []);

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
