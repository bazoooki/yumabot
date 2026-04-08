"use client";

import { LiveGamesTab } from "@/components/live-games/live-games-tab";
import { useCards } from "@/providers/cards-provider";

export default function GamesPage() {
  const { cards, userSlug } = useCards();
  return (
    <div className="page-enter flex flex-1 overflow-hidden">
      <LiveGamesTab cards={cards} userSlug={userSlug!} />
    </div>
  );
}
