import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { SorareCard } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type KickoffUrgency = "imminent" | "soon" | "later" | "no-game";

export function getKickoffUrgency(dateStr: string): KickoffUrgency {
  const kickoff = new Date(dateStr).getTime();
  const now = Date.now();
  const hoursUntil = (kickoff - now) / (1000 * 60 * 60);
  if (hoursUntil <= 2) return "imminent";
  if (hoursUntil <= 6) return "soon";
  return "later";
}

export function formatKickoffTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatKickoffDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Returns the merge window in minutes based on level.
 *  L1-2: 30min (tight — grab soonest batch)
 *  L3:   90min (merge 2-3 nearby kickoffs)
 *  L4:   180min (3-hour window)
 *  L5-6: 360min (6-hour window — need the best players) */
export function getMergeWindowForLevel(level: number): number {
  if (level <= 2) return 30;
  if (level <= 3) return 90;
  if (level <= 4) return 180;
  return 360;
}

export interface KickoffGroup<T> {
  windowLabel: string;
  kickoffTime: Date;
  gameCount: number;
  items: T[];
}

export function groupByKickoffWindow<T extends { card: SorareCard }>(
  items: T[],
  windowMinutes = 30,
): KickoffGroup<T>[] {
  const withTime = items
    .map((item) => {
      const dateStr = item.card.anyPlayer?.activeClub?.upcomingGames?.[0]?.date;
      return { item, time: dateStr ? new Date(dateStr).getTime() : null };
    })
    .filter((x): x is { item: T; time: number } => x.time !== null)
    .sort((a, b) => a.time - b.time);

  if (withTime.length === 0) return [];

  const groups: KickoffGroup<T>[] = [];
  let currentGroup: typeof withTime = [];
  let groupStart = withTime[0].time;

  for (const entry of withTime) {
    if (entry.time - groupStart > windowMinutes * 60 * 1000 && currentGroup.length > 0) {
      groups.push(buildGroup(currentGroup));
      currentGroup = [];
      groupStart = entry.time;
    }
    currentGroup.push(entry);
  }
  if (currentGroup.length > 0) {
    groups.push(buildGroup(currentGroup));
  }

  // Items with no game
  const noGame = items.filter(
    (item) => !item.card.anyPlayer?.activeClub?.upcomingGames?.[0]?.date
  );
  if (noGame.length > 0) {
    groups.push({
      windowLabel: "No upcoming game",
      kickoffTime: new Date(0),
      gameCount: 0,
      items: noGame,
    });
  }

  return groups;

  function buildGroup(entries: { item: T; time: number }[]): KickoffGroup<T> {
    const earliest = new Date(entries[0].time);
    const latest = new Date(entries[entries.length - 1].time);
    const now = new Date();
    const isToday = earliest.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = earliest.toDateString() === tomorrow.toDateString();

    const dayPrefix = isToday ? "Today" : isTomorrow ? "Tomorrow" : formatKickoffDate(earliest.toISOString());
    const startTime = formatKickoffTime(earliest.toISOString());

    const uniqueGames = new Set(
      entries.map((e) => e.item.card.anyPlayer?.activeClub?.upcomingGames?.[0]?.homeTeam?.code + "-" + e.item.card.anyPlayer?.activeClub?.upcomingGames?.[0]?.awayTeam?.code)
    );

    let label = `${dayPrefix} ${startTime}`;
    if (latest.getTime() - earliest.getTime() > 5 * 60 * 1000) {
      label += ` - ${formatKickoffTime(latest.toISOString())}`;
    }
    label += ` (${uniqueGames.size} game${uniqueGames.size !== 1 ? "s" : ""})`;

    return {
      windowLabel: label,
      kickoffTime: earliest,
      gameCount: uniqueGames.size,
      items: entries.map((e) => e.item),
    };
  }
}
