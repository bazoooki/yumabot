import type { SorareCard } from "@/lib/types";
import { useLineupStore } from "@/lib/lineup-store";
import { estimateTotalScore } from "@/lib/ai-lineup";

export function findCard(cards: SorareCard[], query: string): SorareCard | null {
  const q = query.toLowerCase();
  return (
    cards.find(
      (c) => c.anyPlayer?.displayName.toLowerCase() === q,
    ) ??
    cards.find(
      (c) => c.anyPlayer?.displayName.toLowerCase().includes(q),
    ) ??
    cards.find(
      (c) => c.anyPlayer?.slug.toLowerCase().includes(q),
    ) ??
    null
  );
}

export function getLineupSummary(): string {
  const { slots, currentLevel, playMode } = useLineupStore.getState();
  const lines: string[] = [];
  lines.push(`Level ${currentLevel}, mode: ${playMode}`);

  const captainIdx = slots.findIndex((s) => s.isCaptain);
  const filledCards = slots.map((s) => s.card);
  const projected = estimateTotalScore(filledCards, captainIdx >= 0 ? captainIdx : undefined);

  for (const s of slots) {
    if (s.card) {
      const name = s.card.anyPlayer?.displayName ?? "Unknown";
      const score = s.card.anyPlayer?.averageScore?.toFixed(1) ?? "?";
      lines.push(`  ${s.position}: ${name} (avg ${score})${s.isCaptain ? " [CAPTAIN]" : ""}`);
    } else {
      lines.push(`  ${s.position}: empty`);
    }
  }

  lines.push(`Projected score: ${projected.toFixed(0)}`);
  return lines.join("\n");
}
