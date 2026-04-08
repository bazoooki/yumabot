"use client";

import { LiveLineupsTab } from "@/components/live-lineups/live-lineups-tab";
import { useCards } from "@/providers/cards-provider";

export default function LineupsPage() {
  const { cards, userSlug } = useCards();
  return (
    <div className="page-enter flex flex-1 overflow-hidden">
      <LiveLineupsTab cards={cards} userSlug={userSlug!} />
    </div>
  );
}
