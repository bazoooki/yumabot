import type { ToolHandler } from "../tool-registry";
import type { SorareCard } from "@/lib/types";

export function createGlobalTools(cards: SorareCard[]): ToolHandler[] {
  return [
    {
      definition: {
        name: "get_collection_overview",
        description:
          "Get an overview of the user's card collection: total count, breakdown by rarity and position, top players by score.",
        input_schema: { type: "object" as const, properties: {} },
      },
      execute: async () => {
        if (cards.length === 0) return "No cards in collection.";

        const byRarity: Record<string, number> = {};
        const byPosition: Record<string, number> = {};
        const withScore: Array<{ name: string; score: number; rarity: string }> = [];

        for (const c of cards) {
          byRarity[c.rarityTyped] = (byRarity[c.rarityTyped] || 0) + 1;

          const pos = c.anyPlayer?.cardPositions?.[0];
          if (pos) byPosition[pos] = (byPosition[pos] || 0) + 1;

          if (c.anyPlayer?.averageScore) {
            withScore.push({
              name: c.anyPlayer.displayName,
              score: c.anyPlayer.averageScore,
              rarity: c.rarityTyped,
            });
          }
        }

        const top5 = withScore
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        const lines: string[] = [];
        lines.push(`Total cards: ${cards.length}`);
        lines.push("");
        lines.push("By rarity:");
        for (const [r, count] of Object.entries(byRarity).sort((a, b) => b[1] - a[1])) {
          lines.push(`  ${r}: ${count}`);
        }
        lines.push("");
        lines.push("By position:");
        for (const [p, count] of Object.entries(byPosition).sort((a, b) => b[1] - a[1])) {
          lines.push(`  ${p}: ${count}`);
        }

        if (top5.length > 0) {
          lines.push("");
          lines.push("Top 5 by avg score:");
          for (const p of top5) {
            lines.push(`  ${p.name} (${p.rarity}) — ${p.score.toFixed(1)}`);
          }
        }

        return lines.join("\n");
      },
    },
  ];
}
