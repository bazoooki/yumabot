"use client";

import { InSeasonTab } from "@/components/in-season/in-season-tab";
import { useCards } from "@/providers/cards-provider";

export default function InSeasonPage() {
  const { cards, userSlug } = useCards();
  return (
    <div className="page-enter flex flex-1 overflow-hidden">
      <InSeasonTab cards={cards} userSlug={userSlug!} />
    </div>
  );
}
