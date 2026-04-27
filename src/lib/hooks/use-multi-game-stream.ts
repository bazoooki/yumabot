"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GameDetail, GameEvent, FeedItem } from "@/lib/types";
import { isBatchedEvent } from "@/lib/types";
import { diffGameStats, batchEvents } from "@/lib/game-events";

const MAX_EVENTS = 80;
const POLL_INTERVAL = 30_000;
/** Stagger initial fetches to avoid API flood */
const STAGGER_MS = 300;

type PrevState = Map<string, Map<string, number>>;
/** Previous fieldStatus per player — for sub detection */
type PrevFieldMap = Map<string, string>;

interface MultiGameStreamOptions {
  gameIds: string[];
  ownedPlayerSlugs: Set<string>;
  minPointsThreshold?: number;
}

interface MultiGameStreamResult {
  games: Map<string, GameDetail>;
  events: FeedItem[];
  isLoading: boolean;
  connectedCount: number;
}

export function useMultiGameStream({
  gameIds,
  ownedPlayerSlugs,
  minPointsThreshold,
}: MultiGameStreamOptions): MultiGameStreamResult {
  const [games, setGames] = useState<Map<string, GameDetail>>(new Map());
  const [allEvents, setAllEvents] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const prevStatsRef = useRef<Map<string, PrevState>>(new Map());
  const prevFieldRef = useRef<Map<string, PrevFieldMap>>(new Map());
  const gamesRef = useRef<Map<string, GameDetail>>(new Map());
  const fetchedRef = useRef<Set<string>>(new Set());
  const ownedRef = useRef(ownedPlayerSlugs);
  ownedRef.current = ownedPlayerSlugs;
  const thresholdRef = useRef(minPointsThreshold);
  thresholdRef.current = minPointsThreshold;

  const getGameLabel = useCallback((game: GameDetail) => {
    return `${game.homeTeam.code} vs ${game.awayTeam.code}`;
  }, []);

  const getMatchMinute = useCallback((game: GameDetail) => {
    return Math.max(0, game.minute ?? 0);
  }, []);

  /** Detect substitutions by tracking fieldStatus changes: ON_BENCH↔ON_FIELD */
  const detectSubs = useCallback((
    gameId: string,
    gameData: GameDetail,
    gameLabel: string,
  ): GameEvent[] => {
    const events: GameEvent[] = [];
    const prevField = prevFieldRef.current.get(gameId);
    const nextField: PrevFieldMap = new Map();
    const minute = getMatchMinute(gameData);

    for (const ps of gameData.playerGameScores) {
      const slug = ps.anyPlayer.slug;
      const status = ps.anyPlayerGameStats?.fieldStatus ?? "";
      nextField.set(slug, status);

      if (!prevField || !ownedRef.current.has(slug)) continue;
      const prev = prevField.get(slug) ?? "";

      // Sub IN: was ON_BENCH (or empty), now ON_FIELD
      if (prev !== "ON_FIELD" && status === "ON_FIELD" && prev !== "") {
        events.push({
          playerSlug: slug,
          playerName: ps.anyPlayer.displayName,
          teamCode: ps.anyPlayer.activeClub?.code ?? "",
          minute,
          stat: "substitution",
          category: "all_around",
          pointsDelta: 0,
          newValue: 0,
          playerTotalScore: Math.round(ps.score),
          isOwned: true,
          subPlayerIn: ps.anyPlayer.displayName,
          gameId,
          gameLabel,
          timestamp: Date.now(),
        });
      }

      // Sub OUT: was ON_FIELD, now ON_BENCH
      if (prev === "ON_FIELD" && status === "ON_BENCH") {
        events.push({
          playerSlug: slug,
          playerName: ps.anyPlayer.displayName,
          teamCode: ps.anyPlayer.activeClub?.code ?? "",
          minute,
          stat: "substitution",
          category: "all_around",
          pointsDelta: 0,
          newValue: 0,
          playerTotalScore: Math.round(ps.score),
          isOwned: true,
          subPlayerOut: ps.anyPlayer.displayName,
          gameId,
          gameLabel,
          timestamp: Date.now(),
        });
      }
    }

    prevFieldRef.current.set(gameId, nextField);
    return events;
  }, [getMatchMinute]);

  // Fetch game + diff stats + detect subs → produce events
  const fetchAndDiffGame = useCallback(async (gameId: string) => {
    try {
      const res = await fetch(`/api/games/${gameId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.game) return;

      const gameData = data.game as GameDetail;
      const gameLabel = getGameLabel(gameData);

      gamesRef.current.set(gameId, gameData);
      setGames(new Map(gamesRef.current));

      const prevStats = prevStatsRef.current.get(gameId);
      if (!prevStats) {
        // First fetch: seed baseline — no stat events
        const initState: PrevState = new Map();
        for (const ps of gameData.playerGameScores ?? []) {
          const stats = new Map<string, number>();
          for (const stat of ps.detailedScore ?? []) {
            stats.set(stat.stat, stat.totalScore);
          }
          initState.set(ps.anyPlayer.slug, stats);
        }
        prevStatsRef.current.set(gameId, initState);
        // Seed sub tracking baseline too
        detectSubs(gameId, gameData, gameLabel);
      } else {
        // Diff stats
        const { events: statEvents, nextState } = diffGameStats(prevStats, gameData, thresholdRef.current);
        prevStatsRef.current.set(gameId, nextState);

        // Detect subs
        const subEvents = detectSubs(gameId, gameData, gameLabel);

        // Tag ALL events with game context + ownership BEFORE batching
        const taggedEvents = [
          ...statEvents.map((ev) => ({
            ...ev,
            gameId,
            gameLabel,
            isOwned: ownedRef.current.has(ev.playerSlug),
          })),
          ...subEvents,
        ];

        if (taggedEvents.length > 0) {
          // Batch ALL events first (so goal+assist stay grouped)
          const feedItems = batchEvents(taggedEvents);

          // Then filter: keep items that involve at least one owned player
          const ownedFeed = feedItems.filter((item) => {
            if (isBatchedEvent(item)) {
              return (
                item.trigger.isOwned ||
                item.relatedTriggers.some((rt) => rt.isOwned) ||
                item.affected.some((a) => a.isOwned)
              );
            }
            return item.isOwned;
          });

          if (ownedFeed.length > 0) {
            // Propagate gameId/gameLabel into batched sub-events
            const finalFeed = ownedFeed.map((item) => {
              if (isBatchedEvent(item)) {
                return {
                  ...item,
                  trigger: { ...item.trigger, gameId, gameLabel },
                  relatedTriggers: item.relatedTriggers.map((rt) => ({ ...rt, gameId, gameLabel })),
                  affected: item.affected.map((a) => ({ ...a, gameId, gameLabel })),
                };
              }
              return item;
            });

            setAllEvents((prev) => [...finalFeed, ...prev].slice(0, MAX_EVENTS));
          }
        }
      }
    } catch {
      // ignore
    }
  }, [getGameLabel, detectSubs]);

  // Stable key
  const gameIdsKey = gameIds.slice().sort().join(",");

  // Initial fetch — staggered to avoid flooding
  useEffect(() => {
    let cancelled = false;

    async function initFetch() {
      for (let i = 0; i < gameIds.length; i++) {
        if (cancelled) return;
        const gid = gameIds[i];
        if (fetchedRef.current.has(gid)) continue;
        fetchedRef.current.add(gid);
        fetchAndDiffGame(gid).then(() => setIsLoading(false));
        // Stagger
        if (i < gameIds.length - 1) {
          await new Promise((r) => setTimeout(r, STAGGER_MS));
        }
      }
      if (gameIds.length === 0) setIsLoading(false);
    }

    initFetch();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameIdsKey, fetchAndDiffGame]);

  // Poll every 30s — all playing games
  useEffect(() => {
    const interval = setInterval(() => {
      for (const [gid, game] of gamesRef.current) {
        if (game.statusTyped === "playing") {
          fetchAndDiffGame(gid);
        }
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchAndDiffGame]);

  return {
    games,
    events: allEvents,
    isLoading,
    connectedCount: gamesRef.current.size,
  };
}
