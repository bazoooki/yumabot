"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MatchRoom } from "@/components/live-games/match-room";
import { useCards } from "@/providers/cards-provider";

export default function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { cards, userSlug } = useCards();
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

      {/* Back nav */}
      <div className="px-6 py-3 border-b border-zinc-800 flex items-center gap-3 shrink-0">
        <Link
          href="/games"
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to games
        </Link>
      </div>

      <MatchRoom gameId={id} cards={cards} userSlug={userSlug!} />
    </div>
  );
}
