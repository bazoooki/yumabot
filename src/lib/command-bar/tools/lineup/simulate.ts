import type { ToolHandler } from "../../tool-registry";
import type { SorareCard } from "@/lib/types";
import { useLineupStore } from "@/lib/lineup-store";
import { scoreCardsWithStrategy } from "@/lib/ai-lineup";

export function createSimulateTools(_cards: SorareCard[]): ToolHandler[] {
  return [
    {
      definition: {
        name: "simulate_captain",
        description:
          "Simulate what the projected score would be if a specific player were captain. Does NOT change the actual lineup. Use when the user asks 'what if I captain X?' or 'should I captain X?'.",
        input_schema: {
          type: "object" as const,
          properties: {
            playerName: {
              type: "string",
              description: "The player's name to simulate as captain.",
            },
          },
          required: ["playerName"],
        },
      },
      execute: async (input) => {
        const { slots } = useLineupStore.getState();
        const filledSlots = slots.filter((s) => s.card);
        if (filledSlots.length === 0) return "No players in the lineup to simulate.";

        const query = String(input.playerName).toLowerCase();
        const targetIdx = slots.findIndex(
          (s) => s.card?.anyPlayer?.displayName.toLowerCase().includes(query),
        );
        if (targetIdx < 0) return `Player "${input.playerName}" not found in current lineup.`;

        const scored = scoreCardsWithStrategy(
          slots.filter((s) => s.card).map((s) => s.card!),
          useLineupStore.getState().currentLevel,
        );

        // Compute score with simulated captain
        const targetSlug = slots[targetIdx].card!.anyPlayer?.slug;
        let simTotal = 0;
        for (const sc of scored) {
          const isSim = sc.card.anyPlayer?.slug === targetSlug;
          simTotal += sc.strategy.expectedScore * (isSim ? 1.5 : 1);
        }

        // Compute score with current captain
        const currentCaptainIdx = slots.findIndex((s) => s.isCaptain);
        let currentTotal = 0;
        const currentCaptainSlug = currentCaptainIdx >= 0 ? slots[currentCaptainIdx].card?.anyPlayer?.slug : null;
        for (const sc of scored) {
          const isCurrent = sc.card.anyPlayer?.slug === currentCaptainSlug;
          currentTotal += sc.strategy.expectedScore * (isCurrent ? 1.5 : 1);
        }

        const diff = Math.round(simTotal - currentTotal);
        const targetName = slots[targetIdx].card!.anyPlayer?.displayName ?? "Unknown";
        const currentName = currentCaptainIdx >= 0 ? slots[currentCaptainIdx].card?.anyPlayer?.displayName ?? "None" : "None";

        const lines = [
          `Captain simulation: ${targetName}`,
          `Projected total with ${targetName} as captain: ${Math.round(simTotal)} pts`,
          `Current captain (${currentName}): ${Math.round(currentTotal)} pts`,
          `Difference: ${diff >= 0 ? "+" : ""}${diff} pts`,
        ];
        return lines.join("\n");
      },
    },
  ];
}
