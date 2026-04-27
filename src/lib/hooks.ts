"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SorareCard, PlayerIntel, LivePlayerScore } from "./types";
import { useLineupStore } from "./lineup-store";

async function fetchPlayerIntelBatch(
  slugs: string[],
): Promise<Record<string, PlayerIntel>> {
  if (slugs.length === 0) return {};
  const res = await fetch(`/api/player-scores?slugs=${slugs.join(",")}`);
  if (!res.ok) return {};
  const data = await res.json();
  const result: Record<string, PlayerIntel> = {};
  for (const [slug, info] of Object.entries(data.players ?? {})) {
    const d = info as { starterProbability: number | null; fieldStatus: string | null; reliability: string | null; projectionGrade: string | null; projectedScore: number | null };
    result[slug] = {
      starterProbability: d.starterProbability != null ? d.starterProbability * 100 : null,
      fieldStatus: d.fieldStatus,
      reliability: d.reliability,
      projectionGrade: d.projectionGrade ?? null,
      projectedScore: d.projectedScore ?? null,
    };
  }
  return result;
}

export function usePlayerIntel(
  cards: SorareCard[],
): Record<string, PlayerIntel> | undefined {
  const allSlugs = useMemo(() => {
    const seen = new Set<string>();
    const slugs: string[] = [];
    for (const card of cards) {
      const player = card.anyPlayer;
      if (!player || seen.has(player.slug)) continue;
      if (!player.activeClub?.upcomingGames?.length) continue;
      seen.add(player.slug);
      slugs.push(player.slug);
    }
    return slugs;
  }, [cards]);

  const { data } = useQuery({
    queryKey: ["player-intel", allSlugs.length],
    queryFn: async () => {
      const chunks: string[][] = [];
      for (let i = 0; i < allSlugs.length; i += 20) {
        chunks.push(allSlugs.slice(i, i + 20));
      }
      const results = await Promise.all(
        chunks.map((chunk) => fetchPlayerIntelBatch(chunk))
      );
      const merged: Record<string, PlayerIntel> = {};
      for (const r of results) {
        Object.assign(merged, r);
      }
      return merged;
    },
    staleTime: 5 * 60 * 1000,
    enabled: allSlugs.length > 0,
  });

  return data;
}

// --- Live Scores Hook ---

async function fetchLiveScores(slugs: string[]): Promise<Record<string, LivePlayerScore>> {
  if (slugs.length === 0) return {};
  const res = await fetch(`/api/live-scores?slugs=${slugs.join(",")}`);
  if (!res.ok) return {};
  const data = await res.json();
  return (data.scores ?? {}) as Record<string, LivePlayerScore>;
}

export interface LiveState {
  scores: Record<string, LivePlayerScore>;
  isAnyGameLive: boolean;
  allGamesFinished: boolean;
  actualTotal: number;
  projectedTotal: number;
  filledCount: number;
}

export function useLiveScores(): LiveState {
  const slots = useLineupStore((s) => s.slots);

  const lineupSlugs = useMemo(() => {
    return slots
      .filter((s) => s.card?.anyPlayer?.slug)
      .map((s) => s.card!.anyPlayer!.slug);
  }, [slots]);

  // Determine if we should poll — any game kickoff has passed
  const shouldPoll = useMemo(() => {
    if (lineupSlugs.length === 0) return false;
    const now = Date.now();
    return slots.some((s) => {
      const gameDate = s.card?.anyPlayer?.activeClub?.upcomingGames?.[0]?.date;
      if (!gameDate) return false;
      return new Date(gameDate).getTime() <= now + 5 * 60 * 1000; // 5 min before kickoff
    });
  }, [slots, lineupSlugs]);

  const { data: scores = {} } = useQuery({
    queryKey: ["live-scores", lineupSlugs.join(",")],
    queryFn: () => fetchLiveScores(lineupSlugs),
    enabled: lineupSlugs.length > 0,
    refetchInterval: shouldPoll ? 30_000 : false,
    staleTime: shouldPoll ? 15_000 : 5 * 60 * 1000,
  });

  return useMemo(() => {
    const filledSlots = slots.filter((s) => s.card);
    const filledCount = filledSlots.length;
    if (filledCount === 0) {
      return { scores: {}, isAnyGameLive: false, allGamesFinished: false, actualTotal: 0, projectedTotal: 0, filledCount: 0 };
    }

    let actualTotal = 0;
    let projectedTotal = 0;
    let liveCount = 0;
    let finalCount = 0;

    for (const slot of filledSlots) {
      const slug = slot.card!.anyPlayer?.slug;
      if (!slug) continue;
      const ls = scores[slug];
      const isCaptain = slot.isCaptain;
      const multiplier = isCaptain ? 1.5 : 1;

      if (ls) {
        if (ls.scoreStatus === "FINAL" || ls.gameStatus === "played") {
          actualTotal += ls.score * multiplier;
          projectedTotal += ls.score * multiplier;
          finalCount++;
        } else if (ls.scoreStatus === "PLAYING" || ls.gameStatus === "playing") {
          actualTotal += ls.score * multiplier;
          projectedTotal += (ls.projectedScore ?? ls.score) * multiplier;
          liveCount++;
        } else {
          // Scheduled — use card's average as projection
          const avg = slot.card!.anyPlayer?.averageScore ?? 0;
          const power = parseFloat(slot.card!.power) || 1;
          projectedTotal += avg * power * multiplier;
        }
      } else {
        // No live data yet — use estimate
        const avg = slot.card!.anyPlayer?.averageScore ?? 0;
        const power = parseFloat(slot.card!.power) || 1;
        projectedTotal += avg * power * multiplier;
      }
    }

    const isAnyGameLive = liveCount > 0;
    const allGamesFinished = finalCount === filledCount && filledCount > 0;

    return { scores, isAnyGameLive, allGamesFinished, actualTotal: Math.round(actualTotal), projectedTotal: Math.round(projectedTotal), filledCount };
  }, [scores, slots]);
}

// --- Player Form Hook ---

export interface PlayerForm {
  trend: "rising" | "falling" | "stable";
  recentAvg: number;
  avgMinutes: number;
  last5Scores: number[];
}

async function fetchPlayerFormBatch(
  slugs: string[],
  positions: string[],
): Promise<Record<string, PlayerForm>> {
  if (slugs.length === 0) return {};
  const res = await fetch(`/api/player-form?slugs=${slugs.join(",")}&positions=${positions.join(",")}`);
  if (!res.ok) return {};
  const data = await res.json();
  return (data.players ?? {}) as Record<string, PlayerForm>;
}

export function usePlayerForm(
  cards: SorareCard[],
): Record<string, PlayerForm> | undefined {
  const allSlugs = useMemo(() => {
    const seen = new Set<string>();
    const slugs: string[] = [];
    const positions: string[] = [];
    for (const card of cards) {
      const player = card.anyPlayer;
      if (!player || seen.has(player.slug)) continue;
      if (!player.activeClub?.upcomingGames?.length) continue;
      seen.add(player.slug);
      slugs.push(player.slug);
      positions.push(player.cardPositions?.[0] || "Forward");
      if (slugs.length >= 30) break;
    }
    return { slugs, positions };
  }, [cards]);

  const { data } = useQuery({
    queryKey: ["player-form", allSlugs.slugs.length],
    queryFn: async () => {
      const chunks: { slugs: string[]; positions: string[] }[] = [];
      for (let i = 0; i < allSlugs.slugs.length; i += 10) {
        chunks.push({
          slugs: allSlugs.slugs.slice(i, i + 10),
          positions: allSlugs.positions.slice(i, i + 10),
        });
      }
      const results = await Promise.all(
        chunks.map((c) => fetchPlayerFormBatch(c.slugs, c.positions))
      );
      const merged: Record<string, PlayerForm> = {};
      for (const r of results) Object.assign(merged, r);
      return merged;
    },
    staleTime: 10 * 60 * 1000,
    enabled: allSlugs.slugs.length > 0,
  });

  return data;
}
