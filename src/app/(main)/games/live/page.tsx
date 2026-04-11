"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LiveRoom } from "@/components/live-games/live-room";
import { useCards } from "@/providers/cards-provider";

export default function LiveRoomPage() {
  const { cards, userSlug } = useCards();
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

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

      <LiveRoom cards={cards} userSlug={userSlug!} />
    </div>
  );
}
