import type { ToolHandler } from "../../tool-registry";
import type { SorareCard } from "@/lib/types";
import { CLAN_MEMBERS } from "@/lib/clan/members";

/** Slim card shape returned by /api/clan/cards?include=cards */
interface SlimCard {
  slug: string;
  rarityTyped: string;
  inSeasonEligible: boolean;
  power: string;
  edition: string | null;
  playerName: string | null;
  playerSlug: string | null;
  position: string | null;
  averageScore: number | null;
  clubName: string | null;
  league: string | null;
  /** In-season eligible competition league names */
  inSeasonLeagues: string[];
  /** All eligible leaderboard types */
  eligibleTypes: string[];
}

interface ClanContext {
  userSlug: string;
  allCards: Record<string, SlimCard[]>;
}

/** Check if a card is truly eligible for in-season competitions using eligibleUpcomingLeagueTracks data */
function isRealInSeason(card: SlimCard): boolean {
  return card.inSeasonLeagues.length > 0;
}

/** Check if a card is eligible for a specific competition (by league display name) */
function isEligibleForCompetition(card: SlimCard, competition: string): boolean {
  const q = competition.toLowerCase();
  // Check against in-season league names
  if (card.inSeasonLeagues.some((l) => l.toLowerCase().includes(q))) return true;
  // Also check leaderboard types (e.g. "challenger" in "IN_SEASON_CHALLENGER_LIMITED")
  if (card.eligibleTypes.some((t) => t.toLowerCase().includes(q.replace(/\s+/g, "_")))) return true;
  return false;
}

let _clanContext: ClanContext | null = null;

export function setClanContext(ctx: ClanContext) {
  _clanContext = ctx;
}

function getCtx(): ClanContext {
  if (!_clanContext) throw new Error("Clan data not loaded yet");
  return _clanContext;
}

export function createClanTools(_userCards: SorareCard[]): ToolHandler[] {
  return [
    {
      definition: {
        name: "clan_overview",
        description:
          "Get an overview of all clan members: card counts, rarity breakdown, and top players by position.",
        input_schema: { type: "object" as const, properties: {} },
      },
      execute: async () => {
        const ctx = getCtx();
        const lines = ["Clan Overview", ""];

        for (const m of CLAN_MEMBERS) {
          const cards = ctx.allCards[m.slug] || [];
          const rarities: Record<string, number> = {};
          for (const c of cards) {
            rarities[c.rarityTyped] = (rarities[c.rarityTyped] || 0) + 1;
          }
          const rarStr = Object.entries(rarities)
            .filter(([, c]) => c > 0)
            .map(([r, c]) => `${c} ${r}`)
            .join(", ");
          const inSeason = cards.filter((c) => isRealInSeason(c)).length;
          lines.push(
            `${m.name} (${m.slug}${m.slug === ctx.userSlug ? " — YOU" : ""}) — ${cards.length} cards (${inSeason} in-season) | ${rarStr}`,
          );
        }

        return lines.join("\n");
      },
    },
    {
      definition: {
        name: "clan_find_cards",
        description:
          "Search across all clan members' cards by position, rarity, competition eligibility, league, or player name. " +
          "Returns matching cards grouped by member. Use this to find trade opportunities.\n" +
          "IMPORTANT: When the user mentions a competition (e.g. 'Challenger', 'Contender', 'Premier League', 'La Liga'), " +
          "use the 'competition' parameter — it applies ALL Sorare eligibility rules: inSeasonEligible + correct rarity + league match. " +
          "Cross-league competitions (Challenger, Contender, European, Global) allow any league. " +
          "League-specific competitions (e.g. 'Premier League') only allow players from that league.",
        input_schema: {
          type: "object" as const,
          properties: {
            position: {
              type: "string",
              description: "Position filter: Goalkeeper, Defender, Midfielder, Forward",
            },
            rarity: {
              type: "string",
              description: "Rarity filter: common, limited, rare, super_rare, unique",
            },
            competition: {
              type: "string",
              description: "Competition/league name for full eligibility check (e.g. 'Challenger', 'Premier League', 'La Liga'). " +
                "Applies: inSeasonEligible=true + rarity match + league restriction. Must also provide rarity when using this.",
            },
            inSeasonOnly: {
              type: "boolean",
              description: "Only return in-season eligible cards (use 'competition' instead for proper eligibility)",
            },
            league: {
              type: "string",
              description: "Filter by domestic league name (e.g. 'Premier League', 'La Liga')",
            },
            playerName: {
              type: "string",
              description: "Search by player name (partial match)",
            },
            excludeUser: {
              type: "string",
              description: "Exclude this user slug from results (e.g. to find cards you don't have)",
            },
            minScore: {
              type: "number",
              description: "Minimum average score (L15)",
            },
            limit: {
              type: "number",
              description: "Max results per member (default 10)",
            },
          },
        },
      },
      execute: async (input) => {
        const ctx = getCtx();
        const position = input.position as string | undefined;
        const rarity = input.rarity as string | undefined;
        const competition = input.competition as string | undefined;
        const inSeasonOnly = input.inSeasonOnly as boolean | undefined;
        const league = input.league as string | undefined;
        const playerName = input.playerName as string | undefined;
        const excludeUser = input.excludeUser as string | undefined;
        const minScore = input.minScore as number | undefined;
        const limit = (input.limit as number) || 10;

        const lines: string[] = [];
        let totalFound = 0;

        for (const m of CLAN_MEMBERS) {
          if (excludeUser && m.slug === excludeUser) continue;

          let filtered = ctx.allCards[m.slug] || [];

          if (position) {
            filtered = filtered.filter((c) =>
              c.position?.toLowerCase().startsWith(position.toLowerCase().slice(0, 3)),
            );
          }

          // Competition eligibility using real eligibleUpcomingLeagueTracks
          if (competition) {
            filtered = filtered.filter((c) => {
              if (rarity && c.rarityTyped !== rarity) return false;
              return isEligibleForCompetition(c, competition);
            });
          } else {
            if (rarity) {
              filtered = filtered.filter((c) => c.rarityTyped === rarity);
            }
            if (inSeasonOnly) {
              filtered = filtered.filter((c) => isRealInSeason(c));
            }
          }

          if (league) {
            const q = league.toLowerCase();
            filtered = filtered.filter((c) =>
              c.league?.toLowerCase().includes(q),
            );
          }
          if (playerName) {
            const q = playerName.toLowerCase();
            filtered = filtered.filter((c) =>
              c.playerName?.toLowerCase().includes(q),
            );
          }
          if (minScore) {
            filtered = filtered.filter((c) => (c.averageScore ?? 0) >= minScore);
          }

          filtered.sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0));
          filtered = filtered.slice(0, limit);

          if (filtered.length > 0) {
            lines.push(`\n${m.name} (${m.slug}${m.slug === ctx.userSlug ? " — YOU" : ""}):`);
            for (const c of filtered) {
              lines.push(
                `  ${c.playerName ?? "?"} — ${c.position ?? "?"} | ${c.rarityTyped} | Avg: ${c.averageScore?.toFixed(1) ?? "?"} | ${c.clubName ?? "?"} (${c.league ?? ""}) | Power: ${c.power}${isRealInSeason(c) ? " | IS" : ""}${c.edition ? " | " + c.edition : ""}`,
              );
            }
            totalFound += filtered.length;
          }
        }

        if (totalFound === 0) {
          return "No cards found matching those filters across clan members.";
        }

        // Build rich metadata for UI
        const memberResults: Array<{
          name: string;
          slug: string;
          isYou: boolean;
          cards: Array<{
            playerName: string;
            position: string;
            rarity: string;
            averageScore: number;
            power: string;
            club: string;
            league: string;
            inSeason: boolean;
          }>;
        }> = [];

        for (const m of CLAN_MEMBERS) {
          if (excludeUser && m.slug === excludeUser) continue;
          let cards = ctx.allCards[m.slug] || [];
          if (position) cards = cards.filter((c) => c.position?.toLowerCase().startsWith(position.toLowerCase().slice(0, 3)));
          if (rarity) cards = cards.filter((c) => c.rarityTyped === rarity);
          if (inSeasonOnly) cards = cards.filter((c) => isRealInSeason(c));
          if (league) { const q = league.toLowerCase(); cards = cards.filter((c) => c.league?.toLowerCase().includes(q)); }
          if (playerName) { const q = playerName.toLowerCase(); cards = cards.filter((c) => c.playerName?.toLowerCase().includes(q)); }
          if (minScore) cards = cards.filter((c) => (c.averageScore ?? 0) >= minScore);
          cards.sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0));
          cards = cards.slice(0, limit);
          if (cards.length > 0) {
            memberResults.push({
              name: m.name,
              slug: m.slug,
              isYou: m.slug === ctx.userSlug,
              cards: cards.map((c) => ({
                playerName: c.playerName ?? "Unknown",
                position: c.position ?? "?",
                rarity: c.rarityTyped,
                averageScore: c.averageScore ?? 0,
                power: c.power,
                club: c.clubName ?? "?",
                league: c.league ?? "",
                inSeason: isRealInSeason(c),
                edition: c.edition ?? "",
              })),
            });
          }
        }

        return {
          text: `Found ${totalFound} cards:\n${lines.join("\n")}`,
          metadata: {
            type: "clan_card_search",
            totalFound,
            members: memberResults,
          },
        };
      },
    },
    {
      definition: {
        name: "clan_trade_analysis",
        description:
          "Analyze trade opportunities between clan members for a specific position and rarity. " +
          "Finds members who have surplus cards at a position and members who need cards there. " +
          "Considers in-season eligibility and lineup requirements.\n" +
          "Use 'competition' for proper Sorare eligibility (same rules as clan_find_cards).",
        input_schema: {
          type: "object" as const,
          properties: {
            position: {
              type: "string",
              description: "Position to analyze: Goalkeeper, Defender, Midfielder, Forward",
            },
            rarity: {
              type: "string",
              description: "Rarity to analyze: limited, rare, super_rare, unique",
            },
            competition: {
              type: "string",
              description: "Competition name for eligibility (e.g. 'Challenger', 'Premier League'). Applies full rules.",
            },
            inSeasonOnly: {
              type: "boolean",
              description: "Only consider in-season eligible cards (default true). Use 'competition' for proper filtering.",
            },
          },
          required: ["position", "rarity"],
        },
      },
      execute: async (input) => {
        const ctx = getCtx();
        const position = input.position as string;
        const rarity = input.rarity as string;
        const competition = input.competition as string | undefined;
        const inSeasonOnly = input.inSeasonOnly !== false;

        const analysis: Array<{
          name: string;
          slug: string;
          cards: SlimCard[];
          totalOfRarity: number;
        }> = [];

        for (const m of CLAN_MEMBERS) {
          const allMemberCards = ctx.allCards[m.slug] || [];
          let atPosition = allMemberCards.filter((c) => {
            if (!c.position?.toLowerCase().startsWith(position.toLowerCase().slice(0, 3))) return false;
            if (c.rarityTyped !== rarity) return false;

            if (competition) {
              return isEligibleForCompetition(c, competition);
            }

            if (inSeasonOnly && !isRealInSeason(c)) return false;
            return true;
          });

          atPosition.sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0));

          analysis.push({
            name: m.name,
            slug: m.slug,
            cards: atPosition,
            totalOfRarity: allMemberCards.filter((c) => c.rarityTyped === rarity).length,
          });
        }

        const lines = [
          `Trade Analysis: ${position} (${rarity}${inSeasonOnly ? ", in-season only" : ""})`,
          "",
        ];

        const surplus = analysis.filter((m) => m.cards.length >= 2);
        const needy = analysis.filter((m) => m.cards.length === 0);
        const oneCard = analysis.filter((m) => m.cards.length === 1);

        if (surplus.length > 0) {
          lines.push("SURPLUS (potential trade partners):");
          for (const m of surplus) {
            lines.push(
              `  ${m.name}${m.slug === ctx.userSlug ? " (YOU)" : ""} — ${m.cards.length} cards:`,
            );
            for (const c of m.cards) {
              lines.push(
                `    ${c.playerName} — Avg: ${(c.averageScore ?? 0).toFixed(1)} | Power: ${c.power}${isRealInSeason(c) ? " | In-season" : ""}`,
              );
            }
          }
        }

        if (needy.length > 0) {
          lines.push("", "NEED (0 cards at this position):");
          for (const m of needy) {
            lines.push(
              `  ${m.name}${m.slug === ctx.userSlug ? " (YOU)" : ""} — has ${m.totalOfRarity} total ${rarity} cards`,
            );
          }
        }

        if (oneCard.length > 0) {
          lines.push("", "TIGHT (only 1 card, unlikely to trade):");
          for (const m of oneCard) {
            lines.push(
              `  ${m.name}${m.slug === ctx.userSlug ? " (YOU)" : ""} — ${m.cards[0]?.playerName} (Avg: ${(m.cards[0]?.averageScore ?? 0).toFixed(1)})`,
            );
          }
        }

        if (surplus.length === 0 && needy.length === 0) {
          lines.push("No clear trade opportunities — everyone has similar coverage.");
        }

        // Rich metadata
        const tradeData = {
          type: "clan_trade_analysis" as const,
          position,
          rarity,
          inSeasonOnly,
          surplus: surplus.map((m) => ({
            name: m.name,
            slug: m.slug,
            isYou: m.slug === ctx.userSlug,
            cardCount: m.cards.length,
            cards: m.cards.slice(0, 5).map((c) => ({
              playerName: c.playerName ?? "Unknown",
              position: c.position ?? "?",
              averageScore: c.averageScore ?? 0,
              power: c.power,
              club: c.clubName ?? "?",
              inSeason: isRealInSeason(c),
            })),
          })),
          needy: needy.map((m) => ({
            name: m.name,
            slug: m.slug,
            isYou: m.slug === ctx.userSlug,
            totalOfRarity: m.totalOfRarity,
          })),
          tight: oneCard.map((m) => ({
            name: m.name,
            slug: m.slug,
            isYou: m.slug === ctx.userSlug,
            card: m.cards[0] ? {
              playerName: m.cards[0].playerName ?? "Unknown",
              averageScore: m.cards[0].averageScore ?? 0,
            } : null,
          })),
        };

        return {
          text: lines.join("\n"),
          metadata: tradeData,
        };
      },
    },
    {
      definition: {
        name: "clan_member_cards",
        description:
          "Get a detailed view of a specific clan member's cards, optionally filtered.",
        input_schema: {
          type: "object" as const,
          properties: {
            memberSlug: {
              type: "string",
              description: "The member's slug (e.g. 'ba-zii', 'nimrodel')",
            },
            rarity: { type: "string", description: "Filter by rarity" },
            position: { type: "string", description: "Filter by position" },
            inSeasonOnly: { type: "boolean", description: "Only in-season eligible" },
          },
          required: ["memberSlug"],
        },
      },
      execute: async (input) => {
        const ctx = getCtx();
        const slug = input.memberSlug as string;
        const rarity = input.rarity as string | undefined;
        const position = input.position as string | undefined;
        const inSeasonOnly = input.inSeasonOnly as boolean | undefined;

        const member = CLAN_MEMBERS.find((m) => m.slug === slug);
        if (!member) return `Unknown member: ${slug}. Available: ${CLAN_MEMBERS.map((m) => m.slug).join(", ")}`;

        let cards = ctx.allCards[slug] || [];
        if (rarity) cards = cards.filter((c) => c.rarityTyped === rarity);
        if (position) {
          cards = cards.filter((c) =>
            c.position?.toLowerCase().startsWith(position.toLowerCase().slice(0, 3)),
          );
        }
        if (inSeasonOnly) cards = cards.filter((c) => isRealInSeason(c));

        cards.sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0));

        const top = cards.slice(0, 20);
        const lines = [
          `${member.name}'s cards${rarity ? ` (${rarity})` : ""}${position ? ` at ${position}` : ""}${inSeasonOnly ? " (in-season)" : ""}: ${cards.length} total`,
          "",
        ];

        for (const c of top) {
          lines.push(
            `${c.playerName ?? "?"} — ${c.position ?? "?"} | ${c.rarityTyped} | Avg: ${(c.averageScore ?? 0).toFixed(1)} | ${c.clubName ?? "?"} (${c.league ?? ""}) | Power: ${c.power}${isRealInSeason(c) ? " | IS" : ""}${c.edition ? " | " + c.edition : ""}`,
          );
        }

        if (cards.length > 20) {
          lines.push(`\n... and ${cards.length - 20} more`);
        }

        return lines.join("\n");
      },
    },
  ];
}
