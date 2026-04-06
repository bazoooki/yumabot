import type { ToolHandler } from "../../tool-registry";
import type { SorareCard } from "@/lib/types";
import { useLineupStore } from "@/lib/lineup-store";

export function createClearTools(_cards: SorareCard[]): ToolHandler[] {
  return [
    {
      definition: {
        name: "clear_lineup",
        description: "Remove all players from the lineup.",
        input_schema: { type: "object" as const, properties: {} },
      },
      execute: async () => {
        useLineupStore.getState().clearLineup();
        return "Lineup cleared.";
      },
    },
  ];
}
