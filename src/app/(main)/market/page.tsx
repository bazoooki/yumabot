"use client";

import { LiveMarketTab } from "@/components/live-market/live-market-tab";
import { useCards } from "@/providers/cards-provider";
import { useMarketStream } from "@/lib/market/use-market-stream";

export default function MarketPage() {
  const { cards, userSlug } = useCards();
  // Subscribe to the Sorare market WS only while this page is mounted —
  // see ws-manager.ts for connection cost (heartbeats, offer firehose).
  useMarketStream();
  return (
    <div className="page-enter flex flex-1 overflow-hidden">
      <LiveMarketTab cards={cards} userSlug={userSlug!} />
    </div>
  );
}
