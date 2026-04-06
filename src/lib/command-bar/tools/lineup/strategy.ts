import type { ToolHandler } from "../../tool-registry";
import type { SorareCard } from "@/lib/types";
import { useLineupStore } from "@/lib/lineup-store";
import {
  SLOT_INDEX,
  normalizeLineupPosition,
  normalizePlayMode,
} from "@/lib/normalization";

export function createStrategyTools(_cards: SorareCard[]): ToolHandler[] {
  return [
    {
      definition: {
        name: "set_strategy_mode",
        description: "Change the lineup strategy mode.",
        input_schema: {
          type: "object" as const,
          properties: {
            mode: {
              type: "string",
              description: "Strategy: safe, balanced, fast, or auto.",
            },
          },
          required: ["mode"],
        },
      },
      execute: async (input) => {
        const mode = normalizePlayMode(String(input.mode));
        if (!mode) {
          return `Invalid mode "${input.mode}". Use safe, balanced, fast, or auto.`;
        }
        useLineupStore.getState().setPlayMode(mode);
        return `Strategy mode set to ${mode}.`;
      },
    },
    {
      definition: {
        name: "set_captain",
        description: "Set the captain for the lineup by player name or position.",
        input_schema: {
          type: "object" as const,
          properties: {
            playerName: {
              type: "string",
              description:
                "The player's name or position (GK, DEF, MID, FWD, EX) to set as captain.",
            },
          },
          required: ["playerName"],
        },
      },
      execute: async (input) => {
        const { slots } = useLineupStore.getState();
        const query = String(input.playerName);

        // Try position first
        const pos = normalizeLineupPosition(query);
        if (pos && pos in SLOT_INDEX) {
          const idx = SLOT_INDEX[pos];
          if (slots[idx].card) {
            useLineupStore.getState().setCaptain(idx);
            return `Captain set to ${slots[idx].card!.anyPlayer?.displayName ?? pos}.`;
          }
          return `No player in ${pos} slot.`;
        }

        // Search by player name
        const q = query.toLowerCase();
        const idx = slots.findIndex(
          (s) =>
            s.card?.anyPlayer?.displayName.toLowerCase().includes(q),
        );
        if (idx >= 0) {
          useLineupStore.getState().setCaptain(idx);
          return `Captain set to ${slots[idx].card!.anyPlayer?.displayName}.`;
        }
        return `Player "${query}" not found in current lineup.`;
      },
    },
  ];
}
