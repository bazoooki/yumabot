import type { ToolHandler } from "../../tool-registry";
import type { SorareCard } from "@/lib/types";
import { useInSeasonStore } from "@/lib/in-season-store";
import { planGameweek } from "@/lib/gw-optimizer";

export function createInSeasonPlanTools(cards: SorareCard[]): ToolHandler[] {
  return [
    {
      definition: {
        name: "in_season_plan_gw",
        description:
          "Plan the entire gameweek across ALL competitions at once. " +
          "Runs a multi-competition optimizer that allocates your best cards, " +
          "identifies contested cards (eligible for 2+ competitions), and flags gaps. " +
          "Use this when the user wants to optimize their full GW, not just one competition.",
        input_schema: { type: "object" as const, properties: {} },
      },
      execute: async () => {
        const state = useInSeasonStore.getState();
        const { competitions, gameWeek } = state;

        if (competitions.length === 0) {
          return "No in-season competitions loaded. Navigate to the In Season tab first.";
        }

        const plan = await planGameweek(
          cards,
          competitions,
          state.cachedPlayerIntel,
        );

        // Store plan in state so UI can render it
        useInSeasonStore.setState({ gwPlan: plan, plannerMode: true });

        const lines = [
          `GW${gameWeek ?? "?"} Plan — ${competitions.length} competitions`,
          `Total expected: ~${Math.round(plan.totalExpectedScore)} pts`,
          "",
        ];

        for (const alloc of plan.allocations) {
          const comp = competitions.find(
            (c) => c.slug === alloc.competitionSlug,
          );
          const status =
            alloc.filledSlots >= alloc.totalSlots ? "[FULL]" : `[${alloc.filledSlots}/${alloc.totalSlots}]`;
          lines.push(
            `${status} ${comp?.leagueName ?? alloc.competitionSlug} (${comp?.mainRarityType ?? ""}) — ~${Math.round(alloc.expectedScore)} pts`,
          );
          for (const sc of alloc.lineup) {
            const player = sc.card.anyPlayer;
            lines.push(
              `  ${player?.cardPositions?.[0]?.slice(0, 3).toUpperCase() ?? "???"} ${player?.displayName ?? "?"} — ${Math.round(sc.strategy.expectedScore)} expected`,
            );
          }
        }

        if (plan.contestedCards.length > 0) {
          lines.push("");
          lines.push(
            `Contested cards (${plan.contestedCards.length}):`,
          );
          for (const cc of plan.contestedCards.slice(0, 5)) {
            const player = cc.card.anyPlayer;
            const assigned = cc.assignedTo
              ? competitions.find((c) => c.slug === cc.assignedTo)?.leagueName ??
                cc.assignedTo
              : "unassigned";
            lines.push(
              `  ${player?.displayName ?? "?"} — ${cc.eligibleCompetitions.length} comps, assigned: ${assigned}`,
            );
          }
        }

        if (plan.gaps.length > 0) {
          lines.push("");
          lines.push("Gaps:");
          for (const gap of plan.gaps) {
            lines.push(`  ${gap.message}`);
          }
        }

        return {
          text: lines.join("\n"),
          metadata: {
            type: "gw_plan",
            totalExpected: plan.totalExpectedScore,
            competitionCount: plan.allocations.length,
            contestedCount: plan.contestedCards.length,
            gapCount: plan.gaps.length,
          },
        };
      },
    },
  ];
}
