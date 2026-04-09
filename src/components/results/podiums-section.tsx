"use client";

import type { LeaderboardSummary } from "@/lib/types";
import { PodiumCard } from "./podium-card";

export function PodiumsSection({
  leaderboards,
  clanSlugs,
}: {
  leaderboards: LeaderboardSummary[];
  clanSlugs: Set<string>;
}) {
  const div1 = leaderboards.filter(
    (lb) => lb.division === 1 && lb.podium.length > 0,
  );

  if (div1.length === 0) {
    return (
      <p className="text-sm text-zinc-500 text-center py-8">
        No Div 1 results available
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {div1.map((lb) => (
        <PodiumCard key={lb.slug} leaderboard={lb} clanSlugs={clanSlugs} />
      ))}
    </div>
  );
}
