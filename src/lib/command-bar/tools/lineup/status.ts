import type { ToolHandler } from "../../tool-registry";
import type { SorareCard } from "@/lib/types";
import { useLineupStore } from "@/lib/lineup-store";
import {
  SLOT_TO_POSITION,
  normalizeLineupPosition,
} from "@/lib/normalization";
import { scoreCardsWithStrategy } from "@/lib/ai-lineup";
import { getLineupSummary } from "./shared";

export function createStatusTools(cards: SorareCard[]): ToolHandler[] {
  return [
    {
      definition: {
        name: "get_lineup_status",
        description:
          "Get the current lineup state including players, captain, projected score, and strategy mode.",
        input_schema: { type: "object" as const, properties: {} },
      },
      execute: async () => {
        return getLineupSummary();
      },
    },
    {
      definition: {
        name: "get_slot_alternatives",
        description:
          "Get alternative player options for a specific lineup position. Shows the top 5 alternatives not already in the lineup. Use when the user asks 'who else can I play at DEF?' or 'show alternatives for midfielder'.",
        input_schema: {
          type: "object" as const,
          properties: {
            position: {
              type: "string",
              description: "Position slot: GK, DEF, MID, FWD, or EX.",
            },
            rarity: {
              type: "string",
              description:
                "Card rarity filter. Default 'common' (Stellar).",
            },
          },
          required: ["position"],
        },
      },
      execute: async (input) => {
        const pos = normalizeLineupPosition(String(input.position));
        if (!pos) return `Invalid position "${input.position}". Use GK, DEF, MID, FWD, or EX.`;

        const rarity = input.rarity ? String(input.rarity).toLowerCase() : "common";
        const rarityFiltered = cards.filter((c) => {
          if (rarity === "common") {
            return (
              c.rarityTyped === "common" &&
              (c.cardEditionName || "").toLowerCase().includes("stellar")
            );
          }
          return c.rarityTyped === rarity;
        });

        const level = useLineupStore.getState().currentLevel;
        const scored = scoreCardsWithStrategy(rarityFiltered, level);

        // Filter by position
        const targetPosition = SLOT_TO_POSITION[pos];
        const posFiltered = pos === "EX"
          ? scored.filter((sc) => sc.card.anyPlayer?.cardPositions?.[0] !== "Goalkeeper")
          : scored.filter((sc) => sc.card.anyPlayer?.cardPositions?.[0] === targetPosition);

        // Exclude players already in the lineup
        const { slots } = useLineupStore.getState();
        const inLineup = new Set(
          slots.filter((s) => s.card).map((s) => s.card!.anyPlayer?.slug ?? s.card!.slug),
        );
        const alternatives = posFiltered
          .filter((sc) => sc.hasGame && !sc.isInjured)
          .filter((sc) => !inLineup.has(sc.card.anyPlayer?.slug ?? sc.card.slug))
          .slice(0, 5);

        if (alternatives.length === 0) {
          return `No alternative ${pos} players found with upcoming games.`;
        }

        const lines = [`Top ${alternatives.length} alternatives for ${pos}:`, ""];
        for (const sc of alternatives) {
          const p = sc.card.anyPlayer!;
          lines.push(
            `${p.displayName} — expected ~${Math.round(sc.strategy.expectedScore)} pts | ` +
            `Floor: ${Math.round(sc.strategy.floor)} | Ceiling: ${Math.round(sc.strategy.ceiling)} | ` +
            `${sc.strategy.strategyTag} | Start prob: ${Math.round(sc.strategy.startProbability * 100)}%`,
          );
        }
        return lines.join("\n");
      },
    },
  ];
}
