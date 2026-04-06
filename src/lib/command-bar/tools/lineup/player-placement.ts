import type { ToolHandler } from "../../tool-registry";
import type { SorareCard } from "@/lib/types";
import { useLineupStore } from "@/lib/lineup-store";
import {
  SLOT_INDEX,
  normalizeLineupPosition,
} from "@/lib/normalization";
import { findCard } from "./shared";

export function createPlayerPlacementTools(cards: SorareCard[]): ToolHandler[] {
  return [
    {
      definition: {
        name: "set_player_in_slot",
        description:
          "Place a specific player from the user's collection into a lineup slot by position.",
        input_schema: {
          type: "object" as const,
          properties: {
            playerName: {
              type: "string",
              description: "The player's name to search for.",
            },
            position: {
              type: "string",
              description:
                "The lineup slot: GK, DEF, MID, FWD, or EX (extra/any outfield).",
            },
          },
          required: ["playerName", "position"],
        },
      },
      execute: async (input) => {
        const card = findCard(cards, String(input.playerName));
        if (!card) {
          return `Player "${input.playerName}" not found in your collection.`;
        }
        const pos = normalizeLineupPosition(String(input.position));
        if (!pos || !(pos in SLOT_INDEX)) {
          return `Invalid position "${input.position}". Use GK, DEF, MID, FWD, or EX.`;
        }
        useLineupStore.getState().addCard(SLOT_INDEX[pos], card);
        return `Placed ${card.anyPlayer?.displayName ?? "player"} at ${pos}.`;
      },
    },
    {
      definition: {
        name: "remove_player_from_slot",
        description: "Remove a player from a lineup slot.",
        input_schema: {
          type: "object" as const,
          properties: {
            position: {
              type: "string",
              description: "The lineup slot to clear: GK, DEF, MID, FWD, or EX.",
            },
          },
          required: ["position"],
        },
      },
      execute: async (input) => {
        const pos = normalizeLineupPosition(String(input.position));
        if (!pos || !(pos in SLOT_INDEX)) {
          return `Invalid position "${input.position}".`;
        }
        useLineupStore.getState().removeCard(SLOT_INDEX[pos]);
        return `Removed player from ${pos}.`;
      },
    },
  ];
}
