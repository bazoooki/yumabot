import type { ToolHandler } from "../../tool-registry";
import type { SorareCard } from "@/lib/types";
import { useLineupStore } from "@/lib/lineup-store";
import { normalizePlayMode } from "@/lib/normalization";
import { getLineupSummary } from "./shared";

export function createAutoFillTools(cards: SorareCard[]): ToolHandler[] {
  return [
    {
      definition: {
        name: "auto_fill_lineup",
        description:
          "Auto-fill the entire lineup using AI strategy. Replaces the current lineup. Uses common cards by default (Stellar competition).",
        input_schema: {
          type: "object" as const,
          properties: {
            strategyMode: {
              type: "string",
              description:
                "Strategy mode: safe (consistent), balanced, or fast (high ceiling). Optional.",
            },
            rarity: {
              type: "string",
              description:
                "Card rarity filter. Default 'common' (Stellar). Options: common, limited, rare, super_rare, unique.",
            },
          },
        },
      },
      execute: async (input) => {
        const store = useLineupStore.getState();

        if (input.strategyMode) {
          const mode = normalizePlayMode(String(input.strategyMode));
          if (mode) store.setPlayMode(mode);
        }

        const rarity = input.rarity ? String(input.rarity).toLowerCase() : "common";
        const filtered = cards.filter((c) => {
          if (rarity === "common") {
            return (
              c.rarityTyped === "common" &&
              (c.cardEditionName || "").toLowerCase().includes("stellar")
            );
          }
          return c.rarityTyped === rarity;
        });

        if (filtered.length === 0) {
          return `No ${rarity === "common" ? "Stellar" : rarity} cards found in your collection.`;
        }

        await store.autoFillWithStrategy(filtered);
        return `Lineup auto-filled with ${rarity === "common" ? "Stellar" : rarity} cards.\n${getLineupSummary()}`;
      },
    },
  ];
}
