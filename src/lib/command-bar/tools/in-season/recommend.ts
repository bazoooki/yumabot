import type { ToolHandler } from "../../tool-registry";
import type { SorareCard, InSeasonLineupSlot } from "@/lib/types";
import { useInSeasonStore } from "@/lib/in-season-store";
import { recommendInSeasonLineup, mapThresholdToLevel } from "@/lib/ai-lineup";
import { positionMatchesSlot } from "@/lib/normalization";

export function createInSeasonRecommendTools(
  cards: SorareCard[],
): ToolHandler[] {
  return [
    {
      definition: {
        name: "in_season_recommend",
        description:
          "Generate the best in-season lineup for the currently selected competition and team. " +
          "Uses AI strategy scoring with dynamic thresholds. " +
          "Optionally accepts a targetScore override.",
        input_schema: {
          type: "object" as const,
          properties: {
            targetScore: {
              type: "number",
              description:
                "Target threshold score to optimize for. If not provided, uses the selected threshold from the streak header.",
            },
          },
        },
      },
      execute: async (input) => {
        const state = useInSeasonStore.getState();
        const comp = state.competitions.find(
          (c) => c.slug === state.selectedCompSlug,
        );
        if (!comp) return "No competition selected. Select one from the sidebar first.";

        const targetScore =
          typeof input.targetScore === "number"
            ? input.targetScore
            : state.targetThreshold?.score ?? 360;

        useInSeasonStore.setState({
          isAutoFilling: true,
          strategyResults: null,
          lineupProbability: null,
        });

        try {
          const { lineup, warnings, probability } =
            await recommendInSeasonLineup(
              cards,
              comp,
              targetScore,
              state.cachedPlayerIntel,
              state.usedCardSlugs,
            );

          // Place into slots
          const slots: InSeasonLineupSlot[] = [
            { position: "GK", card: null, isCaptain: false },
            { position: "DEF", card: null, isCaptain: false },
            { position: "MID", card: null, isCaptain: false },
            { position: "FWD", card: null, isCaptain: false },
            { position: "EX", card: null, isCaptain: false },
          ];
          const placed = new Set<string>();

          for (const sc of lineup) {
            const card = sc.card;
            const primaryPos = card.anyPlayer?.cardPositions?.[0];
            let bestSlot = -1;
            for (let i = 0; i < slots.length; i++) {
              if (slots[i].card) continue;
              if (positionMatchesSlot(primaryPos, slots[i].position)) {
                bestSlot = i;
                break;
              }
            }
            if (bestSlot === -1) {
              const exIdx = slots.findIndex(
                (s) => s.position === "EX" && !s.card,
              );
              if (exIdx !== -1) bestSlot = exIdx;
            }
            const playerSlug = card.anyPlayer?.slug ?? card.slug;
            if (bestSlot !== -1 && !placed.has(playerSlug)) {
              slots[bestSlot] = { ...slots[bestSlot], card };
              placed.add(playerSlug);
            }
          }

          // Captain on highest scorer
          let captainIdx = -1;
          let captainScore = -1;
          for (let i = 0; i < slots.length; i++) {
            if (!slots[i].card) continue;
            const sc = lineup.find((l) => l.card.slug === slots[i].card?.slug);
            if (sc && sc.strategy.expectedScore > captainScore) {
              captainScore = sc.strategy.expectedScore;
              captainIdx = i;
            }
          }
          if (captainIdx >= 0) {
            slots[captainIdx] = { ...slots[captainIdx], isCaptain: true };
          }

          useInSeasonStore.setState({
            slots,
            selectedSlotIndex: null,
            strategyResults: lineup,
            lineupProbability: probability,
            isAutoFilling: false,
          });

          // Build response text
          const level = mapThresholdToLevel(targetScore);
          const lines = [
            `Generated lineup for ${comp.leagueName} (${comp.displayName} Div.${comp.division})`,
            `Target: ${targetScore} pts (Level ${level})`,
            `Expected total: ~${probability.expectedTotal} pts`,
            `Success probability: ${Math.round(probability.successProbability * 100)}% (${probability.confidenceLevel})`,
            "",
          ];

          for (const sc of lineup) {
            const p = sc.card.anyPlayer!;
            const pos = p.cardPositions?.[0] || "?";
            const isCaptain = slots.find(
              (s) => s.card?.slug === sc.card.slug,
            )?.isCaptain;
            lines.push(
              `${isCaptain ? "(C) " : ""}${p.displayName} [${pos}] — ` +
                `~${Math.round(sc.strategy.expectedScore)} pts | ` +
                `${sc.strategy.strategyTag} | ` +
                `Start: ${Math.round(sc.strategy.startProbability * 100)}%` +
                `${sc.card.inSeasonEligible ? "" : " [NOT in-season]"}`,
            );
          }

          if (warnings.length > 0) {
            lines.push("", "Warnings:");
            for (const w of warnings) lines.push(`- ${w}`);
          }

          return {
            text: lines.join("\n"),
            metadata: {
              type: "in_season_lineup_recommendation",
              competition: comp.leagueName,
              rarity: comp.mainRarityType,
              targetScore,
              expectedTotal: probability.expectedTotal,
              successProbability: probability.successProbability,
            },
          };
        } catch (err) {
          useInSeasonStore.setState({ isAutoFilling: false });
          return `Error generating lineup: ${err instanceof Error ? err.message : "Unknown error"}`;
        }
      },
    },
  ];
}
