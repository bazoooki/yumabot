"use client";

import { ClanTab } from "@/components/clan/clan-tab";
import { useCards } from "@/providers/cards-provider";

export default function ClanPage() {
  const { cards, userSlug } = useCards();
  return <ClanTab cards={cards} userSlug={userSlug!} />;
}
