"use client";

import { Trophy } from "lucide-react";
import { CLAN_MEMBERS } from "@/lib/clan/members";
import type { LeaderboardSummary, ResultsRanking } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ClanMemberResult {
  slug: string;
  name: string;
  entries: { leaderboard: LeaderboardSummary; ranking: ResultsRanking }[];
  bestRanking: number | null;
  bestScore: number;
}

export function ClanSection({
  leaderboards,
}: {
  leaderboards: LeaderboardSummary[];
}) {
  // Aggregate clan member results across all leaderboards
  const memberResults: ClanMemberResult[] = CLAN_MEMBERS.map((member) => {
    const entries: ClanMemberResult["entries"] = [];
    let bestRanking: number | null = null;
    let bestScore = 0;

    for (const lb of leaderboards) {
      for (const entry of lb.clanEntries) {
        if (entry.user.slug === member.slug) {
          entries.push({ leaderboard: lb, ranking: entry });
          if (bestRanking === null || entry.ranking < bestRanking) {
            bestRanking = entry.ranking;
          }
          if (entry.score > bestScore) {
            bestScore = entry.score;
          }
        }
      }
    }

    return {
      slug: member.slug,
      name: member.name,
      entries,
      bestRanking,
      bestScore,
    };
  });

  // Sort: most entries first, then by best ranking
  memberResults.sort((a, b) => {
    if (a.entries.length !== b.entries.length)
      return b.entries.length - a.entries.length;
    return (a.bestRanking ?? 9999) - (b.bestRanking ?? 9999);
  });

  const hasAnyResults = memberResults.some((m) => m.entries.length > 0);

  if (!hasAnyResults) {
    return (
      <p className="text-sm text-zinc-500 text-center py-8">
        No clan member results found in these leaderboards
      </p>
    );
  }

  return (
    <div className="space-y-3 max-w-2xl">
      {memberResults.map((member) => (
        <div
          key={member.slug}
          className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-violet-300">
              {member.name}
            </span>
            {member.entries.length > 0 ? (
              <span className="text-[10px] text-zinc-500">
                {member.entries.length} competition
                {member.entries.length !== 1 ? "s" : ""}
                {member.bestRanking !== null && (
                  <span className="text-zinc-400">
                    {" "}
                    &middot; best: #{member.bestRanking}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-[10px] text-zinc-600">
                No entries this GW
              </span>
            )}
          </div>

          {member.entries.length > 0 && (
            <div className="space-y-1">
              {member.entries
                .sort((a, b) => a.ranking.ranking - b.ranking.ranking)
                .map(({ leaderboard: lb, ranking: r }) => (
                  <div
                    key={lb.slug}
                    className="flex items-center justify-between px-2 py-1.5 rounded bg-zinc-800/30"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {r.ranking <= 3 && (
                        <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                      )}
                      <span className="text-xs text-zinc-300 truncate">
                        {lb.leagueName}
                      </span>
                      {lb.division > 1 && (
                        <span className="text-[10px] text-zinc-600">
                          Div {lb.division}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          r.ranking <= 3
                            ? "text-amber-400 font-medium"
                            : r.ranking <= 10
                              ? "text-emerald-400"
                              : r.ranking <= 100
                                ? "text-zinc-300"
                                : "text-zinc-500",
                        )}
                      >
                        #{r.ranking}
                      </span>
                      <span className="text-[10px] text-zinc-500 tabular-nums w-12 text-right">
                        {Math.round(r.score)} pts
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
