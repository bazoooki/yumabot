import type { ToolHandler } from "../tool-registry";
import type { SorareCard, LineupPosition } from "@/lib/types";
import { useLineupStore, STREAK_LEVELS, type PlayMode } from "@/lib/lineup-store";
import {
  estimateTotalScore,
  scoreCardsWithStrategy,
  getEditionInfo,
  getStrategyMode,
} from "@/lib/ai-lineup";

const POSITION_MAP: Record<string, number> = {
  GK: 0,
  DEF: 1,
  MID: 2,
  FWD: 3,
  EX: 4,
};

const POSITION_ALIASES: Record<string, LineupPosition> = {
  gk: "GK",
  goalkeeper: "GK",
  def: "DEF",
  defender: "DEF",
  mid: "MID",
  midfielder: "MID",
  fwd: "FWD",
  forward: "FWD",
  striker: "FWD",
  st: "FWD",
  ex: "EX",
  extra: "EX",
  any: "EX",
};

const MODE_ALIASES: Record<string, PlayMode> = {
  safe: "safe",
  balanced: "balanced",
  fast: "fast",
  ceiling: "fast",
  auto: "auto",
};

function normalizePosition(input: string): LineupPosition | null {
  return POSITION_ALIASES[input.toLowerCase().trim()] ?? null;
}

function findCard(cards: SorareCard[], query: string): SorareCard | null {
  const q = query.toLowerCase();
  return (
    cards.find(
      (c) => c.anyPlayer?.displayName.toLowerCase() === q,
    ) ??
    cards.find(
      (c) => c.anyPlayer?.displayName.toLowerCase().includes(q),
    ) ??
    cards.find(
      (c) => c.anyPlayer?.slug.toLowerCase().includes(q),
    ) ??
    null
  );
}

function getLineupSummary(): string {
  const { slots, currentLevel, playMode } = useLineupStore.getState();
  const lines: string[] = [];
  lines.push(`Level ${currentLevel}, mode: ${playMode}`);

  const captainIdx = slots.findIndex((s) => s.isCaptain);
  const filledCards = slots.map((s) => s.card);
  const projected = estimateTotalScore(filledCards, captainIdx >= 0 ? captainIdx : undefined);

  for (const s of slots) {
    if (s.card) {
      const name = s.card.anyPlayer?.displayName ?? "Unknown";
      const score = s.card.anyPlayer?.averageScore?.toFixed(1) ?? "?";
      lines.push(`  ${s.position}: ${name} (avg ${score})${s.isCaptain ? " [CAPTAIN]" : ""}`);
    } else {
      lines.push(`  ${s.position}: empty`);
    }
  }

  lines.push(`Projected score: ${projected.toFixed(0)}`);
  return lines.join("\n");
}

export function createLineupTools(cards: SorareCard[]): ToolHandler[] {
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
        const pos = normalizePosition(String(input.position));
        if (!pos || !(pos in POSITION_MAP)) {
          return `Invalid position "${input.position}". Use GK, DEF, MID, FWD, or EX.`;
        }
        useLineupStore.getState().addCard(POSITION_MAP[pos], card);
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
        const pos = normalizePosition(String(input.position));
        if (!pos || !(pos in POSITION_MAP)) {
          return `Invalid position "${input.position}".`;
        }
        useLineupStore.getState().removeCard(POSITION_MAP[pos]);
        return `Removed player from ${pos}.`;
      },
    },
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
          const mode = MODE_ALIASES[String(input.strategyMode).toLowerCase()];
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
    {
      definition: {
        name: "get_lineup_status",
        description:
          "Get the current lineup state including players, captain, projected score, and strategy mode.",
        input_schema: { type: "object" as const, properties: {} },
      },
      execute: async () => {
        return getLineupSummary();
      },
    },
    {
      definition: {
        name: "analyze_player",
        description:
          "Get a brief analysis of a player including their average score, position, edition bonus, and upcoming game.",
        input_schema: {
          type: "object" as const,
          properties: {
            playerName: {
              type: "string",
              description: "The player's name to analyze.",
            },
          },
          required: ["playerName"],
        },
      },
      execute: async (input) => {
        const card = findCard(cards, String(input.playerName));
        if (!card) {
          return `Player "${input.playerName}" not found in your collection.`;
        }
        const player = card.anyPlayer;
        if (!player) return "No player data available.";

        const lines: string[] = [];
        lines.push(`${player.displayName} — ${player.cardPositions.join("/")}`);
        lines.push(`Club: ${player.activeClub?.name ?? "Unknown"}`);
        lines.push(`Rarity: ${card.rarityTyped}, Power: ${card.power}`);
        lines.push(`Avg score (L15): ${player.averageScore?.toFixed(1) ?? "N/A"}`);
        if (card.cardEditionName) lines.push(`Edition: ${card.cardEditionName}`);

        const games = player.activeClub?.upcomingGames;
        if (games?.length) {
          const g = games[0];
          const isHome = g.homeTeam.code === player.activeClub?.code;
          lines.push(
            `Next game: ${isHome ? "vs" : "@"} ${isHome ? g.awayTeam.name : g.homeTeam.name} (${isHome ? "H" : "A"})`,
          );
        } else {
          lines.push("No upcoming game.");
        }

        return lines.join("\n");
      },
    },
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
        const mode = MODE_ALIASES[String(input.mode).toLowerCase()];
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
        const pos = normalizePosition(query);
        if (pos && pos in POSITION_MAP) {
          const idx = POSITION_MAP[pos];
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
    {
      definition: {
        name: "recommend_best_lineup",
        description:
          "Analyze all cards in the collection and recommend the best 5 players for a target level. Returns detailed per-player data so you can explain WHY each pick is good. Also sets the lineup automatically. IMPORTANT: Always pass rarity='common' unless the user explicitly asks for a different rarity. The default competition is Stellar which only allows common cards.",
        input_schema: {
          type: "object" as const,
          properties: {
            targetLevel: {
              type: "number",
              description:
                "The streak level to optimize for (1-6). Determines thresholds: 1=280, 2=320, 3=360, 4=400, 5=440, 6=480.",
            },
            rarity: {
              type: "string",
              description:
                "Card rarity to filter by. Default is 'common' (Stellar competition). Options: common, limited, rare, super_rare, unique.",
            },
            gameBatch: {
              type: "string",
              description:
                "Filter players by game time. 'today' = games today, 'tomorrow' = games tomorrow, 'weekend' = Saturday+Sunday, 'saturday' = Saturday only, 'sunday' = Sunday only, 'next' = next upcoming batch, 'all' = all games (default).",
            },
            excludePlayers: {
              type: "array",
              items: { type: "string" },
              description:
                "Array of player names to exclude from the lineup. Use when the user says 'exclude X' or 'without X'.",
            },
            competition: {
              type: "string",
              description:
                "Filter by competition/league name (e.g. 'Premier League', 'La Liga'). Case-insensitive partial match.",
            },
            minStartProbability: {
              type: "number",
              description:
                "Minimum start probability (0-100). Use when user asks for 'likely starters' or 'confirmed starters'. 70 = likely, 90 = very likely.",
            },
          },
          required: ["targetLevel"],
        },
      },
      execute: async (input) => {
        const level = Math.max(1, Math.min(6, Number(input.targetLevel) || 1));
        const threshold = STREAK_LEVELS.find((l) => l.level === level)?.threshold ?? 280;
        const strategyMode = getStrategyMode(level);
        const rarity = input.rarity ? String(input.rarity).toLowerCase() : "common";

        // Filter by rarity first (default: common/Stellar)
        // "common" = Stellar edition only (cardEditionName contains "stellar")
        const rarityFiltered = cards.filter((c) => {
          if (rarity === "common") {
            return (
              c.rarityTyped === "common" &&
              (c.cardEditionName || "").toLowerCase().includes("stellar")
            );
          }
          return c.rarityTyped === rarity;
        });

        if (rarityFiltered.length === 0) {
          return `No ${rarity === "common" ? "Stellar" : rarity} cards found in your collection.`;
        }

        // Exclude players by name
        const excludeNames = (input.excludePlayers as string[] | undefined) ?? [];
        let filtered = rarityFiltered;
        if (excludeNames.length > 0) {
          const excludeLower = excludeNames.map((n) => n.toLowerCase());
          filtered = filtered.filter((c) => {
            const name = c.anyPlayer?.displayName?.toLowerCase() ?? "";
            return !excludeLower.some((ex) => name.includes(ex));
          });
        }

        // Filter by competition
        const competition = input.competition ? String(input.competition).toLowerCase() : null;
        if (competition) {
          filtered = filtered.filter((c) => {
            const compName = c.anyPlayer?.activeClub?.upcomingGames?.[0]?.competition?.name?.toLowerCase();
            return compName && compName.includes(competition);
          });
        }

        // Filter by game batch
        const gameBatch = input.gameBatch ? String(input.gameBatch).toLowerCase() : "all";
        let batchFiltered = filtered;

        if (gameBatch === "today" || gameBatch === "tomorrow") {
          const target = new Date();
          if (gameBatch === "tomorrow") target.setDate(target.getDate() + 1);
          const targetStr = target.toISOString().slice(0, 10); // YYYY-MM-DD
          batchFiltered = filtered.filter((c) => {
            const gameDate = c.anyPlayer?.activeClub?.upcomingGames?.[0]?.date;
            return gameDate && gameDate.slice(0, 10) === targetStr;
          });
        } else if (gameBatch === "weekend" || gameBatch === "saturday" || gameBatch === "sunday") {
          // Find next Saturday and Sunday
          const now = new Date();
          const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
          const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7; // next Saturday (or today if Saturday)
          const saturday = new Date(now);
          saturday.setDate(now.getDate() + (dayOfWeek === 6 ? 0 : daysUntilSat));
          const sunday = new Date(saturday);
          sunday.setDate(saturday.getDate() + 1);
          const satStr = saturday.toISOString().slice(0, 10);
          const sunStr = sunday.toISOString().slice(0, 10);

          batchFiltered = filtered.filter((c) => {
            const gameDate = c.anyPlayer?.activeClub?.upcomingGames?.[0]?.date;
            if (!gameDate) return false;
            const dateStr = gameDate.slice(0, 10);
            if (gameBatch === "saturday") return dateStr === satStr;
            if (gameBatch === "sunday") return dateStr === sunStr;
            return dateStr === satStr || dateStr === sunStr; // weekend
          });
        } else if (gameBatch === "next") {
          // Find the earliest game time and include all games within 2 hours of it
          const withDates = filtered
            .map((c) => ({
              card: c,
              date: c.anyPlayer?.activeClub?.upcomingGames?.[0]?.date,
            }))
            .filter((x) => !!x.date)
            .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());

          if (withDates.length > 0) {
            const earliest = new Date(withDates[0].date!).getTime();
            const windowMs = 2 * 60 * 60 * 1000; // 2 hours
            batchFiltered = withDates
              .filter((x) => new Date(x.date!).getTime() - earliest <= windowMs)
              .map((x) => x.card);
          }
        }

        if (batchFiltered.length === 0) {
          const batchLabel = gameBatch === "today" ? "today" : gameBatch === "tomorrow" ? "tomorrow" : "in the next batch";
          return `No ${rarity === "common" ? "Stellar" : rarity} cards found with games ${batchLabel}.`;
        }

        // Score filtered cards with strategy metrics
        const scored = scoreCardsWithStrategy(batchFiltered, level);
        let eligible = scored.filter((sc) => sc.hasGame && !sc.isInjured);

        // Filter by minimum start probability
        const minStartProb = input.minStartProbability ? Number(input.minStartProbability) : 0;
        if (minStartProb > 0) {
          eligible = eligible.filter(
            (sc) => sc.strategy.startProbability * 100 >= minStartProb,
          );
        }

        if (eligible.length === 0) {
          return "No eligible players found with upcoming games.";
        }

        // Pick best 5 with positional diversity (same logic as autoFill)
        const selected: typeof eligible = [];
        const usedSlugs = new Set<string>();
        const positionMap: Record<string, typeof eligible> = {
          Goalkeeper: [],
          Defender: [],
          Midfielder: [],
          Forward: [],
        };

        for (const sc of eligible) {
          const pos = sc.card.anyPlayer?.cardPositions?.[0];
          if (pos && positionMap[pos]) positionMap[pos].push(sc);
        }

        for (const pos of ["Goalkeeper", "Defender", "Midfielder", "Forward"]) {
          const slug = (sc: (typeof eligible)[0]) => sc.card.anyPlayer?.slug ?? sc.card.slug;
          const best = positionMap[pos].find((sc) => !usedSlugs.has(slug(sc)));
          if (best && selected.length < 5) {
            selected.push(best);
            usedSlugs.add(slug(best));
          }
        }

        for (const sc of eligible) {
          if (selected.length >= 5) break;
          const slug = sc.card.anyPlayer?.slug ?? sc.card.slug;
          if (!usedSlugs.has(slug)) {
            selected.push(sc);
            usedSlugs.add(slug);
          }
        }

        // Set the lineup
        const store = useLineupStore.getState();
        store.setCurrentLevel(level);

        // Map mode
        const modeMap: Record<string, PlayMode> = { floor: "safe", balanced: "balanced", ceiling: "fast" };
        store.setPlayMode(modeMap[strategyMode] ?? "balanced");

        // Place cards
        store.clearLineup();
        const slotPositions: LineupPosition[] = ["GK", "DEF", "MID", "FWD", "EX"];
        const placedInSlot: boolean[] = [false, false, false, false, false];

        for (const sc of selected) {
          const playerPos = sc.card.anyPlayer?.cardPositions?.[0];
          const posAlias: Record<string, LineupPosition> = {
            Goalkeeper: "GK", Defender: "DEF", Midfielder: "MID", Forward: "FWD",
          };
          const targetSlot = posAlias[playerPos ?? ""];

          let slotIdx = targetSlot ? slotPositions.indexOf(targetSlot) : -1;
          if (slotIdx >= 0 && !placedInSlot[slotIdx]) {
            placedInSlot[slotIdx] = true;
          } else {
            // Find EX or any empty
            const exIdx = slotPositions.indexOf("EX");
            if (!placedInSlot[exIdx]) {
              slotIdx = exIdx;
              placedInSlot[exIdx] = true;
            } else {
              slotIdx = placedInSlot.findIndex((p) => !p);
              if (slotIdx >= 0) placedInSlot[slotIdx] = true;
            }
          }
          if (slotIdx >= 0) {
            store.addCard(slotIdx, sc.card);
          }
        }

        // Set captain on highest expected score
        let bestCaptainIdx = -1;
        let bestCaptainScore = -1;
        for (let i = 0; i < selected.length; i++) {
          if (selected[i].strategy.expectedScore > bestCaptainScore) {
            bestCaptainScore = selected[i].strategy.expectedScore;
            bestCaptainIdx = i;
          }
        }
        // Find the slot index of the best captain
        if (bestCaptainIdx >= 0) {
          const captainSlug = selected[bestCaptainIdx].card.anyPlayer?.slug;
          const { slots } = useLineupStore.getState();
          const captainSlotIdx = slots.findIndex(
            (s) => s.card?.anyPlayer?.slug === captainSlug,
          );
          if (captainSlotIdx >= 0) store.setCaptain(captainSlotIdx);
        }

        // Build detailed output for Claude to reason about
        const totalExpected = selected.reduce((s, sc) => s + sc.strategy.expectedScore, 0);
        const captainBonus = bestCaptainScore * 0.5;
        const projectedTotal = Math.round(totalExpected + captainBonus);

        const lines: string[] = [];
        lines.push(`=== Best Lineup for Level ${level} (target: ${threshold} pts) ===`);
        lines.push(`Rarity: ${rarity === "common" ? "Stellar" : rarity} | Strategy: ${strategyMode} | Games: ${gameBatch}`);
        lines.push(`Projected total: ${projectedTotal} pts (${projectedTotal >= threshold ? "ABOVE" : "BELOW"} target)`);
        lines.push("");

        // Build structured metadata for rich UI rendering
        const playersMeta = selected.map((sc, i) => {
          const p = sc.card.anyPlayer!;
          const edition = getEditionInfo(sc.card);
          const games = p.activeClub?.upcomingGames;
          const game = games?.[0];
          const isHome = game ? game.homeTeam.code === p.activeClub?.code : false;
          const isCaptain = i === bestCaptainIdx;

          // Also build text for Claude
          lines.push(`${i + 1}. ${p.displayName} (${p.cardPositions[0]})${isCaptain ? " [CAPTAIN]" : ""}`);
          lines.push(`   Club: ${p.activeClub?.name ?? "?"}`);
          lines.push(`   Avg score: ${p.averageScore?.toFixed(1) ?? "?"} | Expected: ${sc.strategy.expectedScore.toFixed(1)} pts`);
          lines.push(`   Floor: ${sc.strategy.floor.toFixed(1)} | Ceiling: ${sc.strategy.ceiling.toFixed(1)}`);
          lines.push(`   Consistency: ${sc.strategy.consistencyScore}/100 | Start prob: ${(sc.strategy.startProbability * 100).toFixed(0)}%`);
          lines.push(`   Strategy tag: ${sc.strategy.strategyTag} — ${sc.strategy.strategyReason}`);
          lines.push(`   Rarity: ${sc.card.rarityTyped} | Power: ${sc.card.power} | Edition: ${edition.label}`);
          if (game) {
            lines.push(`   Game: ${isHome ? "vs" : "@"} ${isHome ? game.awayTeam.name : game.homeTeam.name} (${isHome ? "HOME" : "AWAY"})`);
          }
          lines.push("");

          return {
            name: p.displayName,
            position: p.cardPositions[0],
            club: p.activeClub?.name ?? null,
            pictureUrl: sc.card.pictureUrl,
            isCaptain,
            expectedScore: Math.round(sc.strategy.expectedScore),
            floor: Math.round(sc.strategy.floor),
            ceiling: Math.round(sc.strategy.ceiling),
            consistency: sc.strategy.consistencyScore,
            startProbability: Math.round(sc.strategy.startProbability * 100),
            strategyTag: sc.strategy.strategyTag,
            power: sc.card.power,
            editionLabel: edition.label,
            opponent: game
              ? (isHome ? game.awayTeam.code : game.homeTeam.code)
              : null,
            isHome,
            gameTime: game?.date ?? null,
          };
        });

        // Also show top runners-up
        const runnersUp = eligible
          .filter((sc) => !usedSlugs.has(sc.card.anyPlayer?.slug ?? sc.card.slug))
          .slice(0, 3);

        if (runnersUp.length > 0) {
          lines.push("Runners-up (possible swaps):");
          for (const sc of runnersUp) {
            const p = sc.card.anyPlayer!;
            lines.push(
              `  ${p.displayName} (${p.cardPositions[0]}) — expected ${sc.strategy.expectedScore.toFixed(1)} pts, ${sc.strategy.strategyTag}`,
            );
          }
        }

        return {
          text: lines.join("\n"),
          metadata: {
            type: "lineup_recommendation",
            level,
            threshold,
            projectedTotal,
            strategyMode,
            gameBatch,
            players: playersMeta,
            runnersUp: runnersUp.map((sc) => ({
              name: sc.card.anyPlayer!.displayName,
              position: sc.card.anyPlayer!.cardPositions[0],
              expectedScore: Math.round(sc.strategy.expectedScore),
              strategyTag: sc.strategy.strategyTag,
            })),
          },
        };
      },
    },
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
    {
      definition: {
        name: "get_slot_alternatives",
        description:
          "Get alternative player options for a specific lineup position. Shows the top 5 alternatives not already in the lineup. Use when the user asks 'who else can I play at DEF?' or 'show alternatives for midfielder'.",
        input_schema: {
          type: "object" as const,
          properties: {
            position: {
              type: "string",
              description: "Position slot: GK, DEF, MID, FWD, or EX.",
            },
            rarity: {
              type: "string",
              description:
                "Card rarity filter. Default 'common' (Stellar).",
            },
          },
          required: ["position"],
        },
      },
      execute: async (input) => {
        const pos = normalizePosition(String(input.position));
        if (!pos) return `Invalid position "${input.position}". Use GK, DEF, MID, FWD, or EX.`;

        const rarity = input.rarity ? String(input.rarity).toLowerCase() : "common";
        const rarityFiltered = cards.filter((c) => {
          if (rarity === "common") {
            return (
              c.rarityTyped === "common" &&
              (c.cardEditionName || "").toLowerCase().includes("stellar")
            );
          }
          return c.rarityTyped === rarity;
        });

        const level = useLineupStore.getState().currentLevel;
        const scored = scoreCardsWithStrategy(rarityFiltered, level);

        // Filter by position
        const positionMap: Record<string, string> = {
          GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward",
        };
        const targetPosition = positionMap[pos];
        const posFiltered = pos === "EX"
          ? scored.filter((sc) => sc.card.anyPlayer?.cardPositions?.[0] !== "Goalkeeper")
          : scored.filter((sc) => sc.card.anyPlayer?.cardPositions?.[0] === targetPosition);

        // Exclude players already in the lineup
        const { slots } = useLineupStore.getState();
        const inLineup = new Set(
          slots.filter((s) => s.card).map((s) => s.card!.anyPlayer?.slug ?? s.card!.slug),
        );
        const alternatives = posFiltered
          .filter((sc) => sc.hasGame && !sc.isInjured)
          .filter((sc) => !inLineup.has(sc.card.anyPlayer?.slug ?? sc.card.slug))
          .slice(0, 5);

        if (alternatives.length === 0) {
          return `No alternative ${pos} players found with upcoming games.`;
        }

        const lines = [`Top ${alternatives.length} alternatives for ${pos}:`, ""];
        for (const sc of alternatives) {
          const p = sc.card.anyPlayer!;
          lines.push(
            `${p.displayName} — expected ~${Math.round(sc.strategy.expectedScore)} pts | ` +
            `Floor: ${Math.round(sc.strategy.floor)} | Ceiling: ${Math.round(sc.strategy.ceiling)} | ` +
            `${sc.strategy.strategyTag} | Start prob: ${Math.round(sc.strategy.startProbability * 100)}%`,
          );
        }
        return lines.join("\n");
      },
    },
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
