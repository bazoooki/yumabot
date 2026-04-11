import type { Fixture, FixtureGame, SorareCard } from "./types";

export async function fetchFixture(type: "live" | "upcoming"): Promise<Fixture | null> {
  const res = await fetch(`/api/fixtures?type=${type}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.fixture ?? null;
}

export function countMyPlayers(game: FixtureGame, cards: SorareCard[]): number {
  let count = 0;
  for (const card of cards) {
    const club = card.anyPlayer?.activeClub;
    if (!club?.code) continue;
    if (club.code === game.homeTeam?.code || club.code === game.awayTeam?.code) {
      count++;
    }
  }
  return count;
}

export function formatGameTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} ${time}`;
}
