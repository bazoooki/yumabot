import type { ToolHandler } from "../../tool-registry";
import type { SorareCard } from "@/lib/types";
import { findCard } from "./shared";

export function createAnalysisTools(cards: SorareCard[]): ToolHandler[] {
  return [
    {
      definition: {
        name: "analyze_player",
        description:
          "Get a brief analysis of a player including their average score, position, edition bonus, and upcoming game.",
        input_schema: {
          type: "object" as const,
          properties: {
            playerName: {
              type: "string",
              description: "The player's name to analyze.",
            },
          },
          required: ["playerName"],
        },
      },
      execute: async (input) => {
        const card = findCard(cards, String(input.playerName));
        if (!card) {
          return `Player "${input.playerName}" not found in your collection.`;
        }
        const player = card.anyPlayer;
        if (!player) return "No player data available.";

        const lines: string[] = [];
        lines.push(`${player.displayName} — ${player.cardPositions.join("/")}`);
        lines.push(`Club: ${player.activeClub?.name ?? "Unknown"}`);
        lines.push(`Rarity: ${card.rarityTyped}, Power: ${card.power}`);
        lines.push(`Avg score (L15): ${player.averageScore?.toFixed(1) ?? "N/A"}`);
        if (card.cardEditionName) lines.push(`Edition: ${card.cardEditionName}`);

        const games = player.activeClub?.upcomingGames;
        if (games?.length) {
          const g = games[0];
          const isHome = g.homeTeam.code === player.activeClub?.code;
          lines.push(
            `Next game: ${isHome ? "vs" : "@"} ${isHome ? g.awayTeam.name : g.homeTeam.name} (${isHome ? "H" : "A"})`,
          );
        } else {
          lines.push("No upcoming game.");
        }

        return lines.join("\n");
      },
    },
  ];
}
