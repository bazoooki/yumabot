"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Tv } from "lucide-react";
import type { SorareCard } from "@/lib/types";
import { GamesList } from "./games-list";

interface Props {
  cards: SorareCard[];
  userSlug: string;
}

export function LiveGamesTab({ cards }: Props) {
  const router = useRouter();

  const selectGame = useCallback(
    (id: string) => {
      router.push(`/games/${id}`);
    },
    [router],
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

      {/* Header */}
      <div className="px-6 py-3 border-b border-zinc-800 flex items-center gap-3 shrink-0">
        <Tv className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-semibold text-zinc-200">Live Games</h2>
      </div>

      {/* Content */}
      <GamesList cards={cards} onSelectGame={selectGame} />
    </div>
  );
}
