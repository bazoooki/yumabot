import type { ToolHandler } from "../../tool-registry";
import type { SorareCard } from "@/lib/types";
import { useInSeasonStore } from "@/lib/in-season-store";

export function createInSeasonStatusTools(
  _cards: SorareCard[],
): ToolHandler[] {
  return [
    {
      definition: {
        name: "in_season_status",
        description:
          "Get an overview of all in-season competitions: lineup counts, streak progress, " +
          "cutoff times, and which competitions need attention.",
        input_schema: { type: "object" as const, properties: {} },
      },
      execute: async () => {
        const state = useInSeasonStore.getState();
        const { competitions, gameWeek, fixtureSlug } = state;

        if (competitions.length === 0) {
          return "No in-season competitions loaded. Navigate to the In Season tab first.";
        }

        const lines = [
          `In-Season Overview — GW${gameWeek ?? "?"}`,
          `Fixture: ${fixtureSlug ?? "unknown"}`,
          `${competitions.length} competitions`,
          "",
        ];

        for (const comp of competitions) {
          const filledTeams = comp.teams.filter((t) =>
            t.slots.some((s) => s.cardSlug),
          ).length;
          const cutoff = comp.cutOffDate
            ? new Date(comp.cutOffDate).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : "unknown";

          const streakInfo = comp.streak
            ? `Streak Lv.${comp.streak.currentLevel}`
            : "No streak data";

          const needsAttention =
            filledTeams < comp.teamsCap && comp.canCompose;

          lines.push(
            `${needsAttention ? "!" : " "} ${comp.leagueName} (${comp.displayName} Div.${comp.division}) — ` +
              `${filledTeams}/${comp.teamsCap} teams | ${streakInfo} | ` +
              `Locks: ${cutoff}${!comp.canCompose ? " [LOCKED]" : ""}`,
          );
        }

        const needAttention = competitions.filter(
          (c) =>
            c.canCompose &&
            c.teams.filter((t) => t.slots.some((s) => s.cardSlug)).length <
              c.teamsCap,
        );

        if (needAttention.length > 0) {
          lines.push(
            "",
            `${needAttention.length} competition(s) need lineups before cutoff.`,
          );
        }

        return lines.join("\n");
      },
    },
    {
      definition: {
        name: "in_season_lineup_status",
        description:
          "Get the current lineup state for the selected in-season competition and team.",
        input_schema: { type: "object" as const, properties: {} },
      },
      execute: async () => {
        const state = useInSeasonStore.getState();
        const comp = state.competitions.find(
          (c) => c.slug === state.selectedCompSlug,
        );
        if (!comp)
          return "No competition selected. Select one from the sidebar.";

        const lines = [
          `${comp.leagueName} — ${comp.displayName} Div.${comp.division}`,
          `Team ${String.fromCharCode(65 + state.selectedTeamIndex)}`,
          "",
        ];

        const positions = ["GK", "DEF", "MID", "FWD", "EX"];
        for (let i = 0; i < state.slots.length; i++) {
          const slot = state.slots[i];
          const card = slot.card;
          if (card) {
            const p = card.anyPlayer;
            lines.push(
              `${positions[i]}: ${p?.displayName ?? "Unknown"}${slot.isCaptain ? " (C)" : ""} — ` +
                `${card.rarityTyped} | Power: ${card.power}` +
                `${card.inSeasonEligible ? "" : " [NOT in-season]"}`,
            );
          } else {
            lines.push(`${positions[i]}: Empty`);
          }
        }

        const filledCount = state.slots.filter((s) => s.card).length;
        const inSeasonCount = state.slots.filter(
          (s) => s.card?.inSeasonEligible,
        ).length;
        const hasCaptain = state.slots.some((s) => s.isCaptain && s.card);

        lines.push(
          "",
          `${filledCount}/5 filled | ${inSeasonCount}/4 in-season | Captain: ${hasCaptain ? "Yes" : "No"}`,
        );

        if (state.targetThreshold) {
          lines.push(
            `Target: ${state.targetThreshold.score} pts (${state.targetThreshold.reward})`,
          );
        }

        return lines.join("\n");
      },
    },
  ];
}
