"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Trophy } from "lucide-react";
import { CLAN_MEMBERS } from "@/lib/clan/members";
import type { InSeasonCompetition } from "@/lib/types";
import { LineupCard } from "@/components/lineup-card/lineup-card";
import { cn } from "@/lib/utils";

async function fetchMemberLineups(userSlug: string) {
  const res = await fetch(
    `/api/in-season/competitions?userSlug=${encodeURIComponent(userSlug)}&type=LIVE&seasonality=all`,
  );
  if (!res.ok) return null;
  return res.json() as Promise<{
    fixtureSlug: string;
    gameWeek: number;
    competitions: InSeasonCompetition[];
  }>;
}

export function ClanLineupsPanel({ userSlug }: { userSlug: string }) {
  const [selectedSlug, setSelectedSlug] = useState(userSlug);

  const { data, isLoading } = useQuery({
    queryKey: ["in-season-competitions", selectedSlug, "LIVE"],
    queryFn: () => fetchMemberLineups(selectedSlug),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const lineups = useMemo(() => {
    if (!data?.competitions) return [];
    const result: { competition: InSeasonCompetition; teamIndex: number }[] = [];
    for (const comp of data.competitions) {
      for (let i = 0; i < comp.teams.length; i++) {
        if (comp.teams[i].slots.some((s) => s.cardSlug)) {
          result.push({ competition: comp, teamIndex: i });
        }
      }
    }
    return result;
  }, [data]);

  const selectedMember = CLAN_MEMBERS.find((m) => m.slug === selectedSlug);

  return (
    <div className="flex flex-col h-full border-l border-border/50 bg-card/20">
      {/* Header with member tabs */}
      <div className="px-3 py-2 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          <Trophy className="w-3.5 h-3.5 text-pink-400" />
          <span className="text-xs font-semibold text-foreground">
            Live Lineups
          </span>
          {data?.gameWeek && (
            <span className="text-[10px] text-muted-foreground">
              GW{data.gameWeek}
            </span>
          )}
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {CLAN_MEMBERS.map((m) => (
            <button
              key={m.slug}
              onClick={() => setSelectedSlug(m.slug)}
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-medium transition-colors shrink-0",
                selectedSlug === m.slug
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "text-muted-foreground hover:text-foreground border border-transparent",
              )}
            >
              {m.name}
              {m.slug === userSlug && (
                <span className="ml-0.5 opacity-50">*</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable lineups */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-pink-400 animate-spin" />
          </div>
        ) : lineups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Trophy className="w-6 h-6 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">
              {selectedMember?.name ?? "Member"} has no live lineups
            </p>
          </div>
        ) : (
          lineups.map(({ competition, teamIndex }) => (
            <LineupCard
              key={`${competition.slug}-${teamIndex}`}
              competition={competition}
              teamIndex={teamIndex}
              variant="compact"
            />
          ))
        )}
      </div>
    </div>
  );
}
