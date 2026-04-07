import type { SorareCard } from "@/lib/types";
import { createMarketTools } from "./tools/market-tools";
import { createLineupTools } from "./tools/lineup";
import { createInSeasonTools } from "./tools/in-season";
import { createGlobalTools } from "./tools/global-tools";

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type ToolResult =
  | string
  | { text: string; metadata: Record<string, unknown> };

export interface ToolHandler {
  definition: ToolDefinition;
  execute: (input: Record<string, unknown>) => Promise<ToolResult>;
}

export function getToolsForScreen(
  tab: string,
  cards: SorareCard[],
): ToolHandler[] {
  const global = createGlobalTools(cards);

  switch (tab) {
    case "market":
      return [...createMarketTools(), ...global];
    case "lineup":
      return [...createLineupTools(cards), ...global];
    case "in-season":
      return [...createInSeasonTools(cards), ...global];
    default:
      return global;
  }
}
