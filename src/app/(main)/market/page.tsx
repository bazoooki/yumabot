"use client";

import { LiveMarketTab } from "@/components/live-market/live-market-tab";
import { useCards } from "@/providers/cards-provider";

export default function MarketPage() {
  const { cards, userSlug } = useCards();
  return (
    <div className="page-enter flex flex-1 overflow-hidden">
      <LiveMarketTab cards={cards} userSlug={userSlug!} />
    </div>
  );
}
