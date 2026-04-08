"use client";

import { LineupBuilder } from "@/components/lineup-builder/lineup-builder";
import { useCards } from "@/providers/cards-provider";

export default function LineupPage() {
  const { cards } = useCards();
  return <LineupBuilder cards={cards} />;
}
