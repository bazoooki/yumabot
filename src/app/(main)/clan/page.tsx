"use client";

import { ClanTab } from "@/components/clan/clan-tab";
import { useCards } from "@/providers/cards-provider";

export default function ClanPage() {
  const { cards, userSlug } = useCards();
  return (
    <div className="page-enter flex flex-1 overflow-hidden">
      <ClanTab cards={cards} userSlug={userSlug!} />
    </div>
  );
}
