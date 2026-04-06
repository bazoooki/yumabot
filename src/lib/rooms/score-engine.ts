import { supabase } from "@/lib/supabase";
import { sorareClient } from "@/lib/sorare-client";
import { LIVE_PLAYER_SCORES_QUERY } from "@/lib/queries";
import { generateNarration } from "./narrator";
import type {
  RoomLineup,
  Participant,
  RoomScore,
  NarrationContext,
  ParticipantState,
  ScoreChange,
  GameEvent,
  LeaderboardEntry,
  PlayerScoreData,
} from "./types";
import { STREAK_REWARDS } from "./types";

interface LiveScoreResult {
  player: {
    slug: string;
    displayName: string;
    activeClub: {
      upcomingGames: {
        playerGameScore: {
          score: number;
          scoreStatus: string;
          projectedScore: number | null;
          anyPlayerGameStats: {
            minsPlayed: number;
            fieldStatus: string | null;
          } | null;
        } | null;
        anyGame: {
          statusTyped: string;
          date: string;
          homeTeam: { code: string };
          awayTeam: { code: string };
        };
      }[];
    } | null;
  };
}

// Fetch live scores for a batch of player slugs (max 10)
async function fetchLiveScores(
  slugs: string[]
): Promise<Record<string, PlayerScoreData>> {
  const results: Record<string, PlayerScoreData> = {};

  // Batch in groups of 10 (Sorare API limit)
  for (let i = 0; i < slugs.length; i += 10) {
    const batch = slugs.slice(i, i + 10);

    const responses = await Promise.allSettled(
      batch.map((slug) =>
        sorareClient.request<{ player: LiveScoreResult["player"] }>(
          LIVE_PLAYER_SCORES_QUERY,
          { slug }
        )
      )
    );

    for (let j = 0; j < responses.length; j++) {
      const res = responses[j];
      if (res.status !== "fulfilled") continue;

      const player = res.value.player;
      if (!player?.activeClub?.upcomingGames?.[0]) continue;

      const game = player.activeClub.upcomingGames[0];
      const pgs = game.playerGameScore;

      results[player.slug] = {
        playerSlug: player.slug,
        playerName: player.displayName,
        score: pgs?.score ?? 0,
        projectedScore: pgs?.projectedScore ?? null,
        minsPlayed: pgs?.anyPlayerGameStats?.minsPlayed ?? 0,
        isCaptain: false, // Set by caller
        gameStatus: game.anyGame?.statusTyped ?? "scheduled",
        fieldStatus: pgs?.anyPlayerGameStats?.fieldStatus ?? null,
      };
    }
  }

  return results;
}

// Main: refresh scores for a room and trigger narration
export async function refreshRoomScores(roomId: string) {
  // 1. Get participants + lineups + previous scores
  const [participantsRes, lineupsRes, prevScoresRes, prevMessagesRes] =
    await Promise.all([
      supabase.from("participants").select("*").eq("room_id", roomId),
      supabase.from("room_lineups").select("*").eq("room_id", roomId),
      supabase.from("room_scores").select("*").eq("room_id", roomId),
      supabase
        .from("room_messages")
        .select("message")
        .eq("room_id", roomId)
        .eq("message_type", "narration")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const participants: Participant[] = participantsRes.data || [];
  const lineups: RoomLineup[] = lineupsRes.data || [];
  const prevScores: RoomScore[] = prevScoresRes.data || [];
  const prevNarrations = (prevMessagesRes.data || []).map((m) => m.message);

  if (participants.length === 0 || lineups.length === 0) return;

  // 2. Collect all unique player slugs
  const allSlugs = new Set<string>();
  for (const lineup of lineups) {
    const slots = (lineup.slots as unknown as { playerSlug: string | null }[]) || [];
    for (const slot of slots) {
      if (slot.playerSlug) allSlugs.add(slot.playerSlug);
    }
  }

  if (allSlugs.size === 0) return;

  // 3. Fetch live scores
  const liveScores = await fetchLiveScores([...allSlugs]);

  // 4. Compute per-participant totals
  const scoreChanges: ScoreChange[] = [];
  const participantStates: ParticipantState[] = [];
  const upserts: {
    room_id: string;
    participant_id: string;
    total_score: number;
    projected_score: number;
    scores_json: Record<string, PlayerScoreData>;
  }[] = [];

  for (const participant of participants) {
    const lineup = lineups.find((l) => l.participant_id === participant.id);
    if (!lineup) continue;

    const slots = (lineup.slots as unknown as { playerSlug: string | null; playerName: string | null; position: string }[]) || [];
    let totalScore = 0;
    let projectedScore = 0;
    const playerScores: Record<string, PlayerScoreData> = {};

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot.playerSlug) continue;

      const live = liveScores[slot.playerSlug];
      if (!live) continue;

      const isCaptain = i === lineup.captain_index;
      const multiplier = isCaptain ? 1.5 : 1;

      const entry: PlayerScoreData = { ...live, isCaptain };
      playerScores[slot.playerSlug] = entry;

      totalScore += live.score * multiplier;
      projectedScore += (live.projectedScore ?? live.score) * multiplier;

      // Check for score changes vs previous
      const prev = prevScores.find((s) => s.participant_id === participant.id);
      const prevPlayerScores = (prev?.scores_json || {}) as Record<string, PlayerScoreData>;
      const prevScore = prevPlayerScores[slot.playerSlug]?.score ?? 0;
      const delta = live.score - prevScore;

      if (Math.abs(delta) >= 1) {
        // Find or update existing change entry
        const existing = scoreChanges.find((c) => c.playerName === live.playerName);
        if (existing) {
          if (!existing.ownedBy.includes(participant.display_name)) {
            existing.ownedBy.push(participant.display_name);
          }
          if (isCaptain) existing.isCaptainFor.push(participant.display_name);
        } else {
          scoreChanges.push({
            playerName: live.playerName,
            previousScore: prevScore,
            newScore: live.score,
            delta,
            ownedBy: [participant.display_name],
            isCaptainFor: isCaptain ? [participant.display_name] : [],
          });
        }
      }
    }

    upserts.push({
      room_id: roomId,
      participant_id: participant.id,
      total_score: totalScore,
      projected_score: projectedScore,
      scores_json: playerScores,
    });

    const distanceToTarget = lineup.target_score - totalScore;
    const projectedDistance = lineup.target_score - projectedScore;

    participantStates.push({
      name: participant.display_name,
      lineup: slots.map((s, i) => ({
        playerName: s.playerName || "Empty",
        position: s.position || "?",
        isCaptain: i === lineup.captain_index,
      })),
      currentScore: totalScore,
      projectedScore,
      targetScore: lineup.target_score,
      currentLevel: lineup.current_level,
      streakReward: STREAK_REWARDS[lineup.current_level] || "$?",
      distanceToTarget,
      status:
        distanceToTarget <= 0
          ? "on_track"
          : projectedDistance <= 0
            ? "at_risk"
            : "unlikely",
    });
  }

  // 5. Detect game events from field status & score delta patterns
  const gameEvents: GameEvent[] = [];
  for (const [slug, live] of Object.entries(liveScores)) {
    // Find which managers have this player
    const owners: string[] = [];
    for (const p of participants) {
      const lineup = lineups.find((l) => l.participant_id === p.id);
      if (!lineup) continue;
      const slots = (lineup.slots as unknown as { playerSlug: string | null }[]) || [];
      if (slots.some((s) => s.playerSlug === slug)) owners.push(p.display_name);
    }
    if (owners.length === 0) continue;

    // Check for substitution (was playing, now has fieldStatus change or minsPlayed stopped growing)
    const prevAll = prevScores.flatMap((s) => Object.entries((s.scores_json || {}) as Record<string, PlayerScoreData>));
    const prevEntry = prevAll.find(([k]) => k === slug)?.[1];

    if (prevEntry) {
      // Sub out: was playing (minsPlayed > 0) and minsPlayed stopped but game still live
      if (prevEntry.minsPlayed > 0 && live.minsPlayed === prevEntry.minsPlayed && live.gameStatus === "playing" && live.minsPlayed < 90) {
        gameEvents.push({
          type: "sub_out",
          playerName: live.playerName,
          playerSlug: slug,
          description: `Substituted off at ${live.minsPlayed}'`,
          affectedManagers: owners,
        });
      }

      // Injury detection (fieldStatus changed to injured-like)
      if (prevEntry.fieldStatus !== "INJURED" && live.fieldStatus === "INJURED") {
        gameEvents.push({
          type: "injury",
          playerName: live.playerName,
          playerSlug: slug,
          description: `Injury reported`,
          affectedManagers: owners,
        });
      }
    }

    // Large positive score jump (likely decisive action: goal/assist)
    const scoreChange = scoreChanges.find((c) => c.playerName === live.playerName);
    if (scoreChange && scoreChange.delta >= 8) {
      gameEvents.push({
        type: "goal",
        playerName: live.playerName,
        playerSlug: slug,
        description: `Major score jump (+${scoreChange.delta.toFixed(0)}) — likely decisive action`,
        affectedManagers: owners,
      });
    }

    // Negative score drop (yellow/red card or penalty conceded)
    if (scoreChange && scoreChange.delta <= -5) {
      gameEvents.push({
        type: "yellow",
        playerName: live.playerName,
        playerSlug: slug,
        description: `Score dropped (${scoreChange.delta.toFixed(0)}) — possible card or negative action`,
        affectedManagers: owners,
      });
    }
  }

  // 6. Upsert scores to Supabase (triggers Realtime broadcast)
  for (const upsert of upserts) {
    await supabase.from("room_scores").upsert(upsert, {
      onConflict: "room_id,participant_id",
    });
  }

  // Store game events
  for (const event of gameEvents) {
    await supabase.from("room_events").insert({
      room_id: roomId,
      event_type: event.type,
      player_slug: event.playerSlug,
      player_name: event.playerName,
      affected_participants: event.affectedManagers,
      description: event.description,
    });
  }

  // 7. Determine phase
  const anyLive = Object.values(liveScores).some((s) => s.gameStatus === "playing");
  const allFinished = Object.values(liveScores).every((s) => s.gameStatus === "played" || s.gameStatus === "scheduled");
  const phase = anyLive ? "live" : allFinished && Object.values(liveScores).some((s) => s.gameStatus === "played") ? "post" : "pre";

  // 8. Generate AI narration
  const leaderboard: LeaderboardEntry[] = participantStates
    .sort((a, b) => b.currentScore - a.currentScore)
    .map((p, i) => ({ name: p.name, score: p.currentScore, rank: i + 1 }));

  const narrationCtx: NarrationContext = {
    phase,
    participants: participantStates,
    scoreChanges,
    gameEvents,
    activeGames: [],
    leaderboard,
    previousNarrations: prevNarrations,
  };

  const narration = await generateNarration(narrationCtx);

  if (narration) {
    await supabase.from("room_messages").insert({
      room_id: roomId,
      author: "ai",
      message: narration,
      message_type: "narration",
      metadata: {
        leaderboard,
        scoreChanges: scoreChanges.map((c) => ({
          player: c.playerName,
          delta: c.delta,
        })),
      },
    });
  }

  return { scores: upserts, narration, leaderboard };
}
