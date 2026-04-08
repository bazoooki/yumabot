"use client";

import { LiveLineupsTab } from "@/components/live-lineups/live-lineups-tab";
import { useCards } from "@/providers/cards-provider";

export default function LineupsPage() {
  const { cards, userSlug } = useCards();
  return <LiveLineupsTab cards={cards} userSlug={userSlug!} />;
}
