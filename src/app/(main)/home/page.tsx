"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { HomeDashboard } from "@/components/home-dashboard";
import { useCards } from "@/providers/cards-provider";

const TAB_TO_ROUTE: Record<string, string> = {
  home: "/home",
  lineup: "/lineup",
  market: "/market",
  "live-games": "/games",
  "live-lineups": "/lineups",
  "in-season": "/in-season",
  clan: "/clan",
};

export default function HomePage() {
  const { cards, userSlug } = useCards();
  const router = useRouter();

  const handleNavigate = useCallback(
    (tab: string) => {
      const route = TAB_TO_ROUTE[tab] || "/home";
      router.push(route);
    },
    [router],
  );

  return (
    <HomeDashboard
      cards={cards}
      onNavigate={handleNavigate}
      userSlug={userSlug!}
    />
  );
}
