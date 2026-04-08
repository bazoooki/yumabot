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
  pictureUrl: string | null;
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
  /** Whether the player has an upcoming game this GW */
  hasUpcomingGame: boolean;
  /** Whether the player is active at a club (false = transferred/retired) */
  isActiveAtClub: boolean;
  clubCode: string | null;
  clubPictureUrl: string | null;
  upcomingGame: {
    date: string;
    homeTeamCode: string;
    awayTeamCode: string;
  } | null;
}

interface ClanContext {
  userSlug: string;
  allCards: Record<string, SlimCard[]>;
}

/** Check if a card is in-season — uses the authoritative inSeasonEligible boolean from Sorare */
function isRealInSeason(card: SlimCard): boolean {
  return card.inSeasonEligible;
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

/** Convert a SlimCard to a SorareCard shape so GridCard can render it */
function slimToSorareCard(c: SlimCard): SorareCard {
  const position = (c.position ?? "Forward") as import("@/lib/types").Position;
  return {
    slug: c.slug,
    rarityTyped: c.rarityTyped as SorareCard["rarityTyped"],
    pictureUrl: c.pictureUrl ?? "",
    seasonYear: 0,
    grade: 0,
    xp: 0,
    xpNeededForNextGrade: 0,
    inSeasonEligible: c.inSeasonLeagues.length > 0,
    cardEditionName: c.edition,
    power: c.power,
    anyPlayer: {
      slug: c.playerSlug ?? "",
      displayName: c.playerName ?? "Unknown",
      cardPositions: [position],
      age: 0,
      averageScore: c.averageScore,
      country: null,
      activeClub: c.isActiveAtClub
        ? {
            slug: "",
            name: c.clubName ?? "",
            code: c.clubCode ?? undefined,
            pictureUrl: c.clubPictureUrl ?? "",
            domesticLeague: c.league ? { name: c.league } : null,
            upcomingGames: c.upcomingGame
              ? [
                  {
                    date: c.upcomingGame.date,
                    homeTeam: { code: c.upcomingGame.homeTeamCode, name: "", pictureUrl: "" },
                    awayTeam: { code: c.upcomingGame.awayTeamCode, name: "", pictureUrl: "" },
                    competition: { name: "" },
                  },
                ]
              : [],
          }
        : null,
    },
  };
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
          "Search across all clan members' cards. Returns cards grouped by member, deduplicated by player.\n\n" +
          "You MUST provide the 'competition' parameter. It filters cards by REAL Sorare eligibility data.\n" +
          "Examples: 'Challenger', 'Contender', 'Premier League', 'La Liga', 'Bundesliga', 'Serie A'.\n" +
          "Cross-league: Challenger, Contender, European, Global (any league).\n" +
          "If the user doesn't specify a competition, ask them which one, or default to 'Challenger'.",
        input_schema: {
          type: "object" as const,
          properties: {
            competition: {
              type: "string",
              description: "REQUIRED. Competition for eligibility (e.g. 'Challenger', 'Contender', 'Premier League'). " +
                "Filters using real eligibleUpcomingLeagueTracks from Sorare. Always provide this.",
            },
            position: {
              type: "string",
              description: "Position filter: Goalkeeper, Defender, Midfielder, Forward",
            },
            rarity: {
              type: "string",
              description: "Rarity filter: common, limited, rare, super_rare, unique",
            },
            includeClassic: {
              type: "boolean",
              description: "Set true ONLY when user explicitly asks for classic/old/all cards. Default false = in-season only.",
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
              description: "Exclude this user slug from results",
            },
            minScore: {
              type: "number",
              description: "Minimum average score (L15)",
            },
            limit: {
              type: "number",
              description: "Max results per member (default 5)",
            },
          },
        },
      },
      execute: async (input) => {
        const ctx = getCtx();
        const position = input.position as string | undefined;
        const rarity = input.rarity as string | undefined;
        const competition = input.competition as string | undefined;
        const includeClassic = input.includeClassic === true;
        const league = input.league as string | undefined;
        const playerName = input.playerName as string | undefined;
        const excludeUser = input.excludeUser as string | undefined;
        const minScore = input.minScore as number | undefined;
        const limit = (input.limit as number) || 5;

        console.log("[clan_find_cards] params:", { competition, position, rarity, includeClassic, league, playerName, excludeUser, minScore, limit });

        const memberResults: Array<{
          member: typeof CLAN_MEMBERS[number];
          cards: SlimCard[];
        }> = [];
        let totalFound = 0;

        for (const m of CLAN_MEMBERS) {
          if (excludeUser && m.slug === excludeUser) continue;

          let filtered = ctx.allCards[m.slug] || [];

          // Always exclude transferred/retired players
          filtered = filtered.filter((c) => c.isActiveAtClub);

          // DEFAULT: in-season only. Classic cards only if explicitly requested.
          if (!includeClassic) {
            filtered = filtered.filter((c) => isRealInSeason(c));
          }

          // Competition eligibility — strict check against real Sorare data
          if (competition) {
            filtered = filtered.filter((c) => isEligibleForCompetition(c, competition));
          }

          if (rarity) {
            filtered = filtered.filter((c) => c.rarityTyped === rarity);
          }

          if (position) {
            filtered = filtered.filter((c) =>
              c.position?.toLowerCase().startsWith(position.toLowerCase().slice(0, 3)),
            );
          }

          if (league) {
            const q = league.toLowerCase();
            filtered = filtered.filter((c) => c.league?.toLowerCase().includes(q));
          }
          if (playerName) {
            const q = playerName.toLowerCase();
            filtered = filtered.filter((c) => c.playerName?.toLowerCase().includes(q));
          }
          if (minScore) {
            filtered = filtered.filter((c) => (c.averageScore ?? 0) >= minScore);
          }

          // Sort: players with upcoming game first, then by score
          filtered.sort((a, b) => {
            if (a.hasUpcomingGame !== b.hasUpcomingGame) return a.hasUpcomingGame ? -1 : 1;
            return (b.averageScore ?? 0) - (a.averageScore ?? 0);
          });

          // Deduplicate by player — keep best card per player
          const seen = new Set<string>();
          filtered = filtered.filter((c) => {
            const key = c.playerSlug ?? c.playerName ?? c.slug;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          filtered = filtered.slice(0, limit);

          if (filtered.length > 0) {
            memberResults.push({ member: m, cards: filtered });
            totalFound += filtered.length;
          }
        }

        if (totalFound === 0) {
          return "No cards found matching those filters across clan members.";
        }

        // Build text for AI
        const lines: string[] = [];
        for (const { member: m, cards } of memberResults) {
          lines.push(`\n${m.name} (${m.slug}${m.slug === ctx.userSlug ? " — YOU" : ""}):`);
          for (const c of cards) {
            const flags = [
              c.hasUpcomingGame ? "" : "NO GAME",
            ].filter(Boolean);
            lines.push(
              `  ${c.playerName ?? "?"} — ${c.position ?? "?"} | ${c.rarityTyped} | Avg: ${c.averageScore?.toFixed(1) ?? "?"} | ${c.clubName ?? "?"} (${c.league ?? ""}) | Power: ${c.power}${flags.length ? " | " + flags.join(" | ") : ""}`,
            );
          }
        }

        // Build rich metadata for UI — pass SorareCard-compatible shapes so we can reuse GridCard
        const members = memberResults.map(({ member: m, cards }) => ({
          name: m.name,
          slug: m.slug,
          isYou: m.slug === ctx.userSlug,
          cards: cards.map((c) => slimToSorareCard(c)),
        }));

        return {
          text: `Found ${totalFound} cards:\n${lines.join("\n")}`,
          metadata: {
            type: "clan_card_search",
            totalFound,
            members,
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
          "Default: in-season only. Set includeClassic=true for old/classic cards.\n" +
          "Use 'competition' for strict eligibility (e.g. 'Challenger', 'Premier League').",
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
              description: "Competition name for strict eligibility (e.g. 'Challenger', 'Premier League').",
            },
            includeClassic: {
              type: "boolean",
              description: "Set true ONLY when user explicitly asks for classic/old cards. Default false = in-season only.",
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
        const includeClassic = input.includeClassic === true;

        console.log("[clan_trade_analysis] params:", { competition, position, rarity, includeClassic });

        const analysis: Array<{
          name: string;
          slug: string;
          cards: SlimCard[];
          totalOfRarity: number;
        }> = [];

        for (const m of CLAN_MEMBERS) {
          const allMemberCards = ctx.allCards[m.slug] || [];
          let atPosition = allMemberCards.filter((c) => {
            if (!c.isActiveAtClub) return false;
            if (!includeClassic && !isRealInSeason(c)) return false;
            if (!c.position?.toLowerCase().startsWith(position.toLowerCase().slice(0, 3))) return false;
            if (c.rarityTyped !== rarity) return false;
            if (competition && !isEligibleForCompetition(c, competition)) return false;
            return true;
          });

          atPosition.sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0));

          // Deduplicate by player
          const seen = new Set<string>();
          atPosition = atPosition.filter((c) => {
            const key = c.playerSlug ?? c.playerName ?? c.slug;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          analysis.push({
            name: m.name,
            slug: m.slug,
            cards: atPosition,
            totalOfRarity: allMemberCards.filter((c) => c.rarityTyped === rarity && c.isActiveAtClub).length,
          });
        }

        const lines = [
          `Trade Analysis: ${position} (${rarity}, in-season)`,
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
          inSeasonOnly: !includeClassic,
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
              hasUpcomingGame: c.hasUpcomingGame,
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
