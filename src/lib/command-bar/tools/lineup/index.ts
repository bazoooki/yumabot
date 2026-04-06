import type { ToolHandler } from "../../tool-registry";
import type { SorareCard } from "@/lib/types";
import { createPlayerPlacementTools } from "./player-placement";
import { createAutoFillTools } from "./auto-fill";
import { createStatusTools } from "./status";
import { createAnalysisTools } from "./analysis";
import { createStrategyTools } from "./strategy";
import { createRecommendTools } from "./recommend";
import { createSimulateTools } from "./simulate";
import { createClearTools } from "./clear";

export function createLineupTools(cards: SorareCard[]): ToolHandler[] {
  return [
    ...createPlayerPlacementTools(cards),
    ...createAutoFillTools(cards),
    ...createStatusTools(cards),
    ...createAnalysisTools(cards),
    ...createStrategyTools(cards),
    ...createRecommendTools(cards),
    ...createSimulateTools(cards),
    ...createClearTools(cards),
  ];
}
