import type { GameDetail, GameEvent, BatchedGameEvent, FeedItem } from "./types";

/** Stat display config — creative icons per action type */
const STAT_CONFIG: Record<string, { label: string; icon: string }> = {
  // Decisive — goals & assists
  goal: { label: "Goal", icon: "⚽" },
  goals: { label: "Goal", icon: "⚽" },
  assist: { label: "Assist", icon: "👟" },
  penalty_won: { label: "Penalty Won", icon: "🎯" },
  clean_sheet: { label: "Clean Sheet", icon: "🔒" },
  clean_sheet_60: { label: "Clean Sheet 60'", icon: "🔒" },
  last_man_tackle: { label: "Last Man Tackle", icon: "🦁" },

  // Decisive — negative
  own_goal: { label: "Own Goal", icon: "💀" },
  penalty_conceded: { label: "Penalty Conceded", icon: "😱" },
  red_card: { label: "Red Card", icon: "🟥" },
  goal_conceded: { label: "Goal Conceded", icon: "💔" },
  error_led_to_goal: { label: "Error → Goal", icon: "🤦" },

  // Defending
  won_tackle: { label: "Tackle Won", icon: "🦵" },
  interception: { label: "Interception", icon: "🖐️" },
  clearance: { label: "Clearance", icon: "🧹" },
  blocked_cross: { label: "Blocked Cross", icon: "🚧" },
  outfielder_block: { label: "Block", icon: "🛡️" },

  // Duels
  won_contest: { label: "Duel Won", icon: "⚔️" },
  won_duel: { label: "Duel Won", icon: "⚔️" },
  duel_lost: { label: "Duel Lost", icon: "😤" },

  // Attacking
  accurate_pass: { label: "Key Pass", icon: "🎯" },
  big_chance_created: { label: "Big Chance Created", icon: "✨" },
  shot_on_target: { label: "Shot on Target", icon: "🎯" },
  ontarget_scoring_att: { label: "Shot on Target", icon: "🎯" },
  fouls_drawn: { label: "Foul Drawn", icon: "🤕" },

  // GK
  save: { label: "Save", icon: "🧤" },
  saves: { label: "Save", icon: "🧤" },
  saved_ibox: { label: "Save in Box", icon: "🧤" },
  goal_kick_from_goalkeeper: { label: "Goal Kick Save", icon: "🧤" },

  // Negative AA
  lost_ball: { label: "Lost Possession", icon: "📉" },
  conceded_foul: { label: "Foul", icon: "⚡" },
  fouls: { label: "Foul", icon: "⚡" },
  missed_pass: { label: "Missed Pass", icon: "💨" },
  error_led_to_shot: { label: "Error → Shot", icon: "⚠️" },
  big_chance_missed: { label: "Big Chance Missed", icon: "😩" },
  yellow_card: { label: "Yellow Card", icon: "🟨" },

  // Bonus combos
  double_double: { label: "Double-Double", icon: "🏆" },
  triple_double: { label: "Triple-Double", icon: "👑" },
  triple_triple: { label: "Triple-Triple", icon: "💎" },
  level_score: { label: "Level Score", icon: "📈" },

  // Game events
  substitution: { label: "Substitution", icon: "🔄" },
  injury_sub: { label: "Injury Sub", icon: "🏥" },
  adjusted_total_att_assist: { label: "Assist Adjusted", icon: "📝" },
  adjusted_total_scoring_att: { label: "Shot Adjusted", icon: "📝" },
};

/** Only show events above this point threshold (unless in ALWAYS_SHOW) */
const MIN_POINTS_THRESHOLD = 1.5;

/** Always show regardless of points */
const ALWAYS_SHOW = new Set([
  "goal", "goals", "assist", "own_goal", "red_card", "yellow_card",
  "penalty_won", "penalty_conceded", "clean_sheet", "clean_sheet_60",
  "error_led_to_goal", "last_man_tackle", "big_chance_created",
  "big_chance_missed", "save", "saves", "saved_ibox",
  "double_double", "triple_double", "triple_triple",
]);

/** Defending stats that count toward double/triple */
const DEFENDING_STATS = new Set([
  "won_tackle", "interception", "won_contest", "won_duel",
  "clearance", "blocked_cross", "outfielder_block",
]);

/** Thresholds for double-double / triple-double / triple-triple */
const COMBO_THRESHOLDS = {
  double_double: 2, // 2 stats at 5+
  triple_double: 3, // 3 stats at 5+
  triple_triple: 3, // 3 stats at 10+ (this is the real one)
};

type PrevState = Map<string, Map<string, number>>;

export function diffGameStats(
  prev: PrevState,
  game: GameDetail,
): { events: GameEvent[]; nextState: PrevState } {
  const events: GameEvent[] = [];
  const nextState: PrevState = new Map();
  const matchMinute = Math.max(
    0,
    Math.round((Date.now() - new Date(game.date).getTime()) / 60000),
  );

  for (const ps of game.playerGameScores) {
    const slug = ps.anyPlayer.slug;
    const prevStats = prev.get(slug) ?? new Map<string, number>();
    const newStats = new Map<string, number>();

    for (const stat of ps.detailedScore ?? []) {
      newStats.set(stat.stat, stat.totalScore);

      const prevScore = prevStats.get(stat.stat) ?? 0;
      const delta = stat.totalScore - prevScore;

      if (Math.abs(delta) < 0.01) continue;

      const isImportant =
        ALWAYS_SHOW.has(stat.stat) || Math.abs(delta) >= MIN_POINTS_THRESHOLD;
      if (!isImportant) continue;

      const isDecisive = (ps.positiveDecisiveStats ?? []).some(
        (s) => s.stat === stat.stat,
      );
      const isNegative = (ps.negativeDecisiveStats ?? []).some(
        (s) => s.stat === stat.stat,
      );
      const category: GameEvent["category"] = isDecisive
        ? "decisive"
        : isNegative
          ? "negative"
          : "all_around";

      events.push({
        playerSlug: slug,
        playerName: ps.anyPlayer.displayName,
        teamCode: ps.anyPlayer.activeClub?.code ?? "",
        minute: matchMinute,
        stat: stat.stat,
        category,
        pointsDelta: Math.round(delta * 10) / 10,
        newValue: stat.statValue,
        playerTotalScore: Math.round(ps.score),
        timestamp: Date.now(),
      });
    }

    // ── Consolidate same-player events ──

    // 1) Combo upgrades: DD→TD or TD→TT — merge into one event showing the upgrade
    const COMBO_RANK = ["double_double", "triple_double", "triple_triple"];
    const playerEvents = events.filter((e) => e.playerSlug === slug);
    const comboEvents = playerEvents.filter((e) => COMBO_RANK.includes(e.stat));
    if (comboEvents.length > 1) {
      // Find highest combo gained and lowest combo lost
      const gained = comboEvents.filter((e) => e.pointsDelta > 0)
        .sort((a, b) => COMBO_RANK.indexOf(b.stat) - COMBO_RANK.indexOf(a.stat))[0];
      const lost = comboEvents.filter((e) => e.pointsDelta < 0);
      if (gained && lost.length > 0) {
        const netDelta = comboEvents.reduce((sum, e) => sum + e.pointsDelta, 0);
        // Remove all combo events, replace with the upgrade
        for (const e of comboEvents) {
          const idx = events.indexOf(e);
          if (idx >= 0) events.splice(idx, 1);
        }
        events.push({
          ...gained,
          pointsDelta: Math.round(netDelta * 10) / 10,
        });
      }
    }

    // 2) Adjusted stats pair with their source: merge if same player, same poll
    const ADJUSTED_PAIRS: Record<string, string> = {
      adjusted_total_att_assist: "big_chance_created",
      adjusted_total_scoring_att: "shot_on_target",
    };
    for (const [adjStat, sourceStat] of Object.entries(ADJUSTED_PAIRS)) {
      const adjIdx = events.findIndex((e) => e.playerSlug === slug && e.stat === adjStat);
      const srcIdx = events.findIndex((e) => e.playerSlug === slug && e.stat === sourceStat);
      if (adjIdx >= 0 && srcIdx >= 0) {
        // Merge into the source event with combined delta
        events[srcIdx] = {
          ...events[srcIdx],
          pointsDelta: Math.round((events[srcIdx].pointsDelta + events[adjIdx].pointsDelta) * 10) / 10,
        };
        events.splice(adjIdx, 1);
      }
    }

    // Check near-achievement for defending combos
    const nearAchievements = checkNearAchievements(ps.detailedScore ?? []);
    for (const alert of nearAchievements) {
      // Only emit if we haven't already emitted this alert recently
      const alertKey = `${slug}:near:${alert.achievement}`;
      if (!prevStats.has(alertKey)) {
        events.push({
          playerSlug: slug,
          playerName: ps.anyPlayer.displayName,
          teamCode: ps.anyPlayer.activeClub?.code ?? "",
          minute: matchMinute,
          stat: `near_${alert.achievement}`,
          category: "all_around",
          pointsDelta: 0,
          newValue: 0,
          playerTotalScore: Math.round(ps.score),
          timestamp: Date.now(),
        });
        newStats.set(alertKey, 1);
      }
    }

    nextState.set(slug, newStats);
  }

  return { events, nextState };
}

/** Check if player is 1 stat shy of double-double or triple-double */
function checkNearAchievements(
  detailedScore: Array<{ stat: string; statValue: number }>,
): Array<{ achievement: string; missing: string }> {
  const alerts: Array<{ achievement: string; missing: string }> = [];

  // Count defending stats at various thresholds
  const at5Plus: string[] = [];
  const at4: string[] = []; // 1 shy of 5
  const at10Plus: string[] = [];
  const at9: string[] = []; // 1 shy of 10

  for (const s of detailedScore) {
    if (!DEFENDING_STATS.has(s.stat)) continue;
    if (s.statValue >= 10) {
      at10Plus.push(s.stat);
      at5Plus.push(s.stat);
    } else if (s.statValue >= 5) {
      at5Plus.push(s.stat);
      if (s.statValue === 9) at9.push(s.stat);
    } else if (s.statValue === 4) {
      at4.push(s.stat);
    }
  }

  // 1 stat shy of double-double (have 1 at 5+, need 1 more at 4)
  if (at5Plus.length === 1 && at4.length >= 1) {
    alerts.push({ achievement: "double_double", missing: at4[0] });
  }

  // 1 stat shy of triple-double (have 2 at 5+, need 1 more at 4)
  if (at5Plus.length === 2 && at4.length >= 1) {
    alerts.push({ achievement: "triple_double", missing: at4[0] });
  }

  return alerts;
}

export function getStatLabel(stat: string): { label: string; icon: string } {
  // Near-achievement alerts
  if (stat === "near_double_double") {
    return { label: "1 away from Double-Double!", icon: "🔥" };
  }
  if (stat === "near_triple_double") {
    return { label: "1 away from Triple-Double!", icon: "🔥" };
  }

  return (
    STAT_CONFIG[stat] ?? {
      label: stat
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: "📊",
    }
  );
}

// ─── Event batching ───────────────────────────────────────────────

/** Stats that can trigger a batch (big impact events) */
const TRIGGER_STATS = new Set([
  "goal", "goals", "own_goal", "red_card",
  "penalty_won", "penalty_conceded", "error_led_to_goal",
]);

/** Stats that are secondary triggers (shown prominently but grouped with a goal) */
const RELATED_TRIGGER_STATS = new Set(["assist"]);

/** Stats that are ripple effects of a goal */
const RIPPLE_STATS = new Set([
  "goal_conceded", "clean_sheet", "clean_sheet_60",
]);

/**
 * Takes a flat array of events from a single diffGameStats cycle and groups
 * causally-related events into BatchedGameEvents.
 *
 * Logic:
 * - If there's a trigger event (goal, red card, etc.), create a batch
 * - Assists at the same minute pair with goals
 * - Ripple events (clean_sheet loss, goal_conceded) fold into the batch
 * - Everything else stays as individual events
 */
export function batchEvents(events: GameEvent[]): FeedItem[] {
  if (events.length <= 1) return events;

  const triggers: GameEvent[] = [];
  const relatedTriggers: GameEvent[] = [];
  const ripples: GameEvent[] = [];
  const standalone: GameEvent[] = [];

  for (const ev of events) {
    if (TRIGGER_STATS.has(ev.stat)) {
      triggers.push(ev);
    } else if (RELATED_TRIGGER_STATS.has(ev.stat)) {
      relatedTriggers.push(ev);
    } else if (RIPPLE_STATS.has(ev.stat)) {
      ripples.push(ev);
    } else {
      standalone.push(ev);
    }
  }

  // No trigger → no batching, return all events individually
  if (triggers.length === 0) return events;

  // Build one batch per trigger event
  const result: FeedItem[] = [];
  const usedRelated = new Set<number>();
  const usedRipples = new Set<number>();

  for (const trigger of triggers) {
    // Find related triggers (e.g. assist for a goal — different team from trigger isn't an assist for this goal)
    const related: GameEvent[] = [];
    for (let i = 0; i < relatedTriggers.length; i++) {
      if (usedRelated.has(i)) continue;
      const rt = relatedTriggers[i];
      // Assists pair with goals (same team or just same batch if only one goal)
      if (
        (trigger.stat === "goal" || trigger.stat === "goals") &&
        rt.stat === "assist"
      ) {
        // Same team → definitely paired
        if (rt.teamCode === trigger.teamCode || triggers.length === 1) {
          related.push(rt);
          usedRelated.add(i);
        }
      }
    }

    // Ripple effects: clean sheet / goal conceded from the opposing team
    const affected: GameEvent[] = [];
    for (let i = 0; i < ripples.length; i++) {
      if (usedRipples.has(i)) continue;
      const rp = ripples[i];
      // goal_conceded / clean_sheet loss → opposing team
      if (rp.teamCode !== trigger.teamCode || trigger.stat === "own_goal") {
        affected.push(rp);
        usedRipples.add(i);
      }
    }

    // Also pull in remaining standalone events that are score-only updates
    // for players on the opposing team (they're ripple effects too)
    // Keep it simple: only ripple stats go in, others stay standalone

    const batch: BatchedGameEvent = {
      type: "batched",
      id: `batch-${trigger.playerSlug}-${trigger.stat}-${trigger.timestamp}`,
      trigger,
      relatedTriggers: related,
      affected,
      minute: trigger.minute,
      timestamp: trigger.timestamp,
    };

    result.push(batch);
  }

  // Add unused related triggers as standalone
  for (let i = 0; i < relatedTriggers.length; i++) {
    if (!usedRelated.has(i)) result.push(relatedTriggers[i]);
  }
  // Add unused ripples as standalone
  for (let i = 0; i < ripples.length; i++) {
    if (!usedRipples.has(i)) result.push(ripples[i]);
  }
  // Add all standalone events
  result.push(...standalone);

  return result;
}

export function extractGoalScorers(
  game: GameDetail,
): Array<{ playerName: string; teamCode: string }> {
  const scorers: Array<{ playerName: string; teamCode: string }> = [];

  for (const ps of game.playerGameScores) {
    const goals = (ps.positiveDecisiveStats ?? []).filter(
      (s) => s.stat === "goal" || s.stat === "goals",
    );
    if (goals.length > 0 && goals[0].statValue > 0) {
      for (let i = 0; i < goals[0].statValue; i++) {
        scorers.push({
          playerName: ps.anyPlayer.displayName,
          teamCode: ps.anyPlayer.activeClub?.code ?? "",
        });
      }
    }
  }

  return scorers;
}
