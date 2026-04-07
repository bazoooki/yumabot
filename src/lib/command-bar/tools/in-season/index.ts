import type { ToolHandler } from "../../tool-registry";
import type { SorareCard } from "@/lib/types";
import { createInSeasonRecommendTools } from "./recommend";
import { createInSeasonStatusTools } from "./status";

export function createInSeasonTools(cards: SorareCard[]): ToolHandler[] {
  return [
    ...createInSeasonRecommendTools(cards),
    ...createInSeasonStatusTools(cards),
  ];
}
