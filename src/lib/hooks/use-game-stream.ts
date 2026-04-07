"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GameDetail, GameEvent } from "@/lib/types";
import { diffGameStats } from "@/lib/game-events";

const MAX_EVENTS = 50;
const POLL_INTERVAL = 30_000; // 30s for detailed stats

/**
 * Hybrid approach:
 * - WebSocket (SSE) for instant score/status updates (lightweight query)
 * - REST polling every 30s for full detailed stats (player scores, decisive stats)
 * - Stat diffing runs on each REST poll to detect changes
 */
export function useGameStream(gameId: string) {
  const [game, setGame] = useState<GameDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatsRef = useRef<Map<string, Map<string, number>>>(new Map());
  const gameRef = useRef<GameDetail | null>(null);

  // Full REST fetch — includes detailed stats for diffing
  const fetchFullGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.game) return;

      const gameData = data.game as GameDetail;

      if (prevStatsRef.current.size === 0) {
        // First fetch: initialize state without generating events
        const initState = new Map<string, Map<string, number>>();
        for (const ps of gameData.playerGameScores ?? []) {
          const stats = new Map<string, number>();
          for (const stat of ps.detailedScore ?? []) {
            stats.set(stat.stat, stat.totalScore);
          }
          initState.set(ps.anyPlayer.slug, stats);
        }
        prevStatsRef.current = initState;
      } else {
        // Diff stats to detect changes
        const { events: newEvents, nextState } = diffGameStats(
          prevStatsRef.current,
          gameData,
        );
        prevStatsRef.current = nextState;

        if (newEvents.length > 0) {
          console.log("[Game Events] Detected stat changes:", newEvents);
          setEvents((prev) => [...newEvents, ...prev].slice(0, MAX_EVENTS));
        }
      }

      setGame(gameData);
      gameRef.current = gameData;
      setIsLoading(false);
      setUpdateCount((c) => c + 1);
    } catch {
      // ignore
    }
  }, [gameId]);

  useEffect(() => {
    // Initial full fetch
    fetchFullGame();

    // Connect SSE for instant score/status updates
    const es = new EventSource(`/api/games/${gameId}/stream`);
    esRef.current = es;

    es.addEventListener("game_update", (e) => {
      try {
        // WS includes player scores (but no detailedScore breakdown)
        const wsData = JSON.parse(e.data) as GameDetail;

        console.log(
          `[Game WS] Update: ${wsData.homeScore}-${wsData.awayScore} (${wsData.statusTyped}), ${wsData.playerGameScores?.length ?? 0} players`,
        );

        // Merge: use WS data but keep detailedScore/decisiveStats from last REST fetch
        setGame((prev) => {
          if (!prev) return wsData;
          const prevScoreMap = new Map(
            prev.playerGameScores.map((ps) => [ps.anyPlayer.slug, ps]),
          );
          const merged: GameDetail = {
            ...wsData,
            playerGameScores: (wsData.playerGameScores ?? []).map((ps) => {
              const prevPs = prevScoreMap.get(ps.anyPlayer.slug);
              return {
                ...ps,
                // Keep detailed stats from REST, WS doesn't have them
                detailedScore: prevPs?.detailedScore ?? ps.detailedScore ?? [],
                positiveDecisiveStats: prevPs?.positiveDecisiveStats ?? ps.positiveDecisiveStats ?? [],
                negativeDecisiveStats: prevPs?.negativeDecisiveStats ?? ps.negativeDecisiveStats ?? [],
              };
            }),
          };
          gameRef.current = merged;
          return merged;
        });
        setUpdateCount((c) => c + 1);

        // Also trigger REST fetch for detailed stats
        fetchFullGame();
      } catch {
        // ignore
      }
    });

    es.addEventListener("status", (e) => {
      try {
        const data = JSON.parse(e.data);
        setConnected(data.connected ?? false);
      } catch {
        // ignore
      }
    });

    es.onerror = () => {
      setConnected(false);
    };

    // Poll for detailed stats every 30s during live games
    pollRef.current = setInterval(() => {
      if (gameRef.current?.statusTyped === "playing") {
        fetchFullGame();
      }
    }, POLL_INTERVAL);

    return () => {
      es.close();
      esRef.current = null;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [gameId, fetchFullGame]);

  const isLive = game?.statusTyped === "playing";

  return { game, isLoading, isLive, connected, updateCount, events };
}
