import type { ToolHandler } from "../tool-registry";
import { useMarketStore } from "@/lib/market/market-store";
import type { MarketFilters, MarketSort, TradeType } from "@/lib/market/types";
import { normalizeRarity, normalizePosition } from "@/lib/normalization";

const SORT_ALIASES: Record<string, MarketSort> = {
  recent: "recent",
  newest: "recent",
  sales: "sales",
  "most sales": "sales",
  volume: "sales",
  price_high: "price_high",
  "price high": "price_high",
  expensive: "price_high",
  price_low: "price_low",
  "price low": "price_low",
  cheap: "price_low",
  cheapest: "price_low",
  score: "score",
  "avg score": "score",
};

const TRADE_ALIASES: Record<string, TradeType> = {
  sale: "sale",
  sales: "sale",
  swap: "swap",
  swaps: "swap",
  mixed: "mixed",
};

function normalizeSort(input: string): MarketSort | null {
  return SORT_ALIASES[input.toLowerCase().trim()] ?? null;
}

function normalizeTradeType(input: string): TradeType | null {
  return TRADE_ALIASES[input.toLowerCase().trim()] ?? null;
}

export function createMarketTools(): ToolHandler[] {
  return [
    {
      definition: {
        name: "set_market_filters",
        description:
          "Set market filters to show specific players. Provide only the filters you want to change. Set a filter to null to clear it.",
        input_schema: {
          type: "object" as const,
          properties: {
            rarity: {
              type: "string",
              description:
                "Card rarity: limited, rare, super_rare, or unique. Set to 'null' to clear.",
            },
            position: {
              type: "string",
              description:
                "Player position: Goalkeeper, Defender, Midfielder, or Forward. Set to 'null' to clear.",
            },
            minPriceEth: {
              type: "number",
              description: "Minimum price in ETH. Set to 0 to clear.",
            },
            maxPriceEth: {
              type: "number",
              description: "Maximum price in ETH. Set to 0 to clear.",
            },
            playerSearch: {
              type: "string",
              description: "Search for a player by name.",
            },
            myPlayersOnly: {
              type: "boolean",
              description: "Only show players the user owns.",
            },
            sort: {
              type: "string",
              description:
                "Sort order: recent, sales, price_high, price_low, or score.",
            },
            tradeType: {
              type: "string",
              description:
                "Trade type: sale, swap, or mixed. Set to 'null' to clear.",
            },
            minSales: {
              type: "number",
              description: "Minimum number of sales to show.",
            },
          },
        },
      },
      execute: async (input) => {
        const updates: Partial<MarketFilters> = {};
        const changed: string[] = [];

        if ("rarity" in input) {
          const val = String(input.rarity);
          updates.rarity = val === "null" ? null : normalizeRarity(val);
          changed.push(`rarity=${updates.rarity ?? "any"}`);
        }
        if ("position" in input) {
          const val = String(input.position);
          updates.position = val === "null" ? null : normalizePosition(val);
          changed.push(`position=${updates.position ?? "any"}`);
        }
        if ("minPriceEth" in input) {
          const val = Number(input.minPriceEth);
          updates.minPriceEth = val > 0 ? val : null;
          changed.push(`minPrice=${updates.minPriceEth ?? "none"}`);
        }
        if ("maxPriceEth" in input) {
          const val = Number(input.maxPriceEth);
          updates.maxPriceEth = val > 0 ? val : null;
          changed.push(`maxPrice=${updates.maxPriceEth ?? "none"}`);
        }
        if ("playerSearch" in input) {
          updates.playerSearch = String(input.playerSearch);
          changed.push(`search="${updates.playerSearch}"`);
        }
        if ("myPlayersOnly" in input) {
          updates.myPlayersOnly = Boolean(input.myPlayersOnly);
          changed.push(`myPlayersOnly=${updates.myPlayersOnly}`);
        }
        if ("sort" in input) {
          const val = normalizeSort(String(input.sort));
          if (val) {
            updates.sort = val;
            changed.push(`sort=${val}`);
          }
        }
        if ("tradeType" in input) {
          const val = String(input.tradeType);
          updates.tradeType = val === "null" ? null : normalizeTradeType(val);
          changed.push(`tradeType=${updates.tradeType ?? "any"}`);
        }
        if ("minSales" in input) {
          updates.minSales = Number(input.minSales);
          changed.push(`minSales=${updates.minSales}`);
        }

        useMarketStore.getState().setFilters(updates);
        return `Filters updated: ${changed.join(", ")}`;
      },
    },
    {
      definition: {
        name: "clear_market_filters",
        description: "Reset all market filters to their defaults.",
        input_schema: { type: "object" as const, properties: {} },
      },
      execute: async () => {
        useMarketStore.getState().setFilters({
          rarity: null,
          position: null,
          minPriceEth: null,
          maxPriceEth: null,
          playerSearch: "",
          myPlayersOnly: false,
          sort: "recent",
          tradeType: null,
          minSales: 2,
        });
        return "All filters have been reset to defaults.";
      },
    },
    {
      definition: {
        name: "get_market_summary",
        description:
          "Get a summary of current market activity: top movers, total volume, and alert counts.",
        input_schema: { type: "object" as const, properties: {} },
      },
      execute: async () => {
        const { players, totalOffers, alerts } = useMarketStore.getState();

        const playerList = Object.values(players);
        const topBySales = [...playerList]
          .sort((a, b) => b.saleCount - a.saleCount)
          .slice(0, 5);

        const alertCounts = { critical: 0, warning: 0, info: 0 };
        for (const a of alerts) {
          if (a.severity in alertCounts)
            alertCounts[a.severity as keyof typeof alertCounts]++;
        }

        const lines: string[] = [];
        lines.push(`Total offers tracked: ${totalOffers}`);
        lines.push(`Active players: ${playerList.length}`);
        lines.push("");
        lines.push("Top 5 by sales:");
        for (const p of topBySales) {
          const trend =
            p.prices.length >= 6
              ? (() => {
                  const recent = p.prices.slice(-3);
                  const prev = p.prices.slice(-6, -3);
                  const avgR = recent.reduce((a, b) => a + b, 0) / recent.length;
                  const avgP = prev.reduce((a, b) => a + b, 0) / prev.length;
                  const pct = ((avgR - avgP) / avgP) * 100;
                  return pct > 10 ? " trending UP" : pct < -10 ? " trending DOWN" : "";
                })()
              : "";
          lines.push(
            `  ${p.playerName} (${p.rarity}) — ${p.saleCount} sales, latest ${p.latestPriceEth.toFixed(4)} ETH${trend}`,
          );
        }
        lines.push("");
        lines.push(
          `Alerts: ${alertCounts.critical} critical, ${alertCounts.warning} warning, ${alertCounts.info} info`,
        );

        return lines.join("\n");
      },
    },
    {
      definition: {
        name: "get_player_activity",
        description:
          "Get a specific player's market activity including sales count, prices, and trend.",
        input_schema: {
          type: "object" as const,
          properties: {
            playerName: {
              type: "string",
              description: "The player's name to look up.",
            },
          },
          required: ["playerName"],
        },
      },
      execute: async (input) => {
        const { players } = useMarketStore.getState();
        const query = String(input.playerName).toLowerCase();

        const match = Object.values(players).find(
          (p) =>
            p.playerName.toLowerCase().includes(query) ||
            p.playerSlug.toLowerCase().includes(query),
        );

        if (!match) {
          return `No market activity found for "${input.playerName}". The player may not have had recent sales.`;
        }

        const lines: string[] = [];
        lines.push(`${match.playerName} (${match.position ?? "Unknown"})`);
        lines.push(`Club: ${match.clubName ?? "Unknown"}`);
        lines.push(`Rarity: ${match.rarity}`);
        lines.push(`Sales: ${match.saleCount}`);
        lines.push(`Latest price: ${match.latestPriceEth.toFixed(4)} ETH`);
        if (match.avgScore) lines.push(`Avg score (L15): ${match.avgScore.toFixed(1)}`);

        if (match.prices.length >= 6) {
          const recent = match.prices.slice(-3);
          const prev = match.prices.slice(-6, -3);
          const avgR = recent.reduce((a, b) => a + b, 0) / recent.length;
          const avgP = prev.reduce((a, b) => a + b, 0) / prev.length;
          const pct = ((avgR - avgP) / avgP) * 100;
          lines.push(
            `Price trend: ${pct > 10 ? "UP" : pct < -10 ? "DOWN" : "FLAT"} (${pct > 0 ? "+" : ""}${pct.toFixed(1)}%)`,
          );
        }

        if (match.upcomingGame) {
          const g = match.upcomingGame;
          lines.push(`Next game: ${g.homeTeam.code} vs ${g.awayTeam.code}`);
        }

        if (match.recentOffers.length > 0) {
          lines.push(`\nRecent trades:`);
          for (const o of match.recentOffers.slice(0, 5)) {
            const ago = Math.round(
              (Date.now() - new Date(o.receivedAt).getTime()) / 60000,
            );
            lines.push(
              `  ${o.priceEth.toFixed(4)} ETH (${o.tradeType}) — ${ago}m ago`,
            );
          }
        }

        return lines.join("\n");
      },
    },
    {
      definition: {
        name: "get_recent_alerts",
        description:
          "Get recent market alerts, optionally filtered by severity.",
        input_schema: {
          type: "object" as const,
          properties: {
            severity: {
              type: "string",
              description: "Filter by severity: info, warning, or critical.",
            },
            limit: {
              type: "number",
              description: "Max number of alerts to return. Default 10.",
            },
          },
        },
      },
      execute: async (input) => {
        const { alerts } = useMarketStore.getState();
        const severity = input.severity ? String(input.severity).toLowerCase() : null;
        const limit = Number(input.limit) || 10;

        let filtered = alerts;
        if (severity) {
          filtered = filtered.filter((a) => a.severity === severity);
        }

        const recent = filtered.slice(0, limit);

        if (recent.length === 0) {
          return severity
            ? `No ${severity} alerts currently.`
            : "No alerts currently.";
        }

        const lines = recent.map((a) => {
          const ago = Math.round(
            (Date.now() - new Date(a.createdAt).getTime()) / 60000,
          );
          return `[${a.severity.toUpperCase()}] ${a.title} — ${a.description} (${ago}m ago)`;
        });

        return lines.join("\n");
      },
    },
  ];
}
