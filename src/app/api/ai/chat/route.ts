import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const client = new Anthropic();

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

interface RichMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

interface ScreenContext {
  activeTab: string;
  tools: Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }>;
  contextSnapshot?: string;
}

function buildSystemPrompt(ctx: ScreenContext): string {
  const base = `You are an AI assistant embedded in YumaBot, a Sorare fantasy football management tool.

IMPORTANT RULES:
- Be concise — 1-3 sentences for text responses.
- Always use tool calls when an action is requested or when you need data to answer a question.
- After receiving tool results, ALWAYS provide a helpful text response analyzing or summarizing what the data shows. Never leave the user without a text answer.
- When setting filters, confirm what was changed and mention what the user should see.
- When analyzing data, give actionable insights, not just raw numbers.`;

  const screenInstructions: Record<string, string> = {
    market: `The user is on the Live Market screen viewing real-time card sales and market alerts.
Use set_market_filters to adjust what the user sees (rarity, position, price range, sort, etc.).
Use get_ tools to answer questions about current market state, player activity, or alerts.
Use clear_market_filters to reset all filters.
When the user asks to "show" or "find" something, set the appropriate filters.
For rarity values use: limited, rare, super_rare, unique.
For position values use: Goalkeeper, Defender, Midfielder, Forward.
For sort values use: recent, sales, price_high, price_low, score.
You can call multiple tools in one turn — e.g. get_market_summary + get_recent_alerts to give a comprehensive overview.`,

    lineup: `The user is on the Lineup Builder screen building a Sorare fantasy football lineup of 5 players (GK, DEF, MID, FWD, EX).
IMPORTANT: The default competition is Stellar which ONLY allows common rarity cards. Always use rarity='common' when recommending or auto-filling lineups unless the user explicitly requests a different rarity.
Use lineup tools to add/remove players, auto-fill, set captain, or change strategy.
Use analyze_player to give detailed analysis of specific players.
Use get_lineup_status to check the current state before giving advice.
Use simulate_captain when the user asks "what if I captain X?" or "should I captain X?" — it compares projected scores without changing the lineup.
Use get_slot_alternatives when the user asks "who else for DEF?" or "show alternatives for midfielder" — it shows top 5 alternatives for a position.
Strategy modes: safe (consistent picks), balanced (moderate), fast (highest ceiling).
Position slots: GK (Goalkeeper), DEF (Defender), MID (Midfielder), FWD (Forward), EX (any outfield player).
You can call multiple tools — e.g. get_lineup_status + analyze_player to give informed recommendations.
When the user mentions game timing, use gameBatch: 'today', 'tomorrow', 'weekend' (Sat+Sun), 'saturday', 'sunday', 'next' (next batch), or 'all'.
When the user says "exclude X" or "without X", pass excludePlayers with the player names.
When the user mentions a league like "Premier League" or "La Liga", use the competition parameter.
When the user asks for "likely starters" or "confirmed starters", use minStartProbability (70 = likely, 90 = very likely).`,

    "in-season": `The user is on the In Season tab managing in-season competitions (Limited/Rare/SR/Unique cards, league-specific).
Rules: min 4 out of 5 cards must be in-season eligible. NO common cards. League-specific players only (except cross-league competitions like Challenger/Contender).
Captain gets +50% score bonus. Dynamic streak thresholds per competition (NOT the hardcoded Stellar thresholds).
Use in_season_recommend to generate optimized lineups for the selected competition.
Use in_season_status for an overview of all competitions and which need attention.
Use in_season_lineup_status to check the current lineup state.
When the user says "fill" or "generate", use in_season_recommend with the appropriate target score.`,

    clan: `You are the Clan AI Assistant — a smart advisor helping a group of 5 friends who play Sorare together.
You have access to ALL clan members' card collections, positions, rarities, scores, and in-season eligibility.

YOUR PRIMARY ROLE: Help users find trade opportunities, build better lineups, and collaborate.

KEY KNOWLEDGE:
- Sorare lineups: 5 slots (GK, DEF, MID, FWD, EX). EX = any outfield player.
- In-season: min 4/5 cards must be inSeasonEligible. Captain gets +50% score bonus.
- Divisions: "Challenger" and "Contender" are cross-league (any league). Other divisions are league-specific.
- Rarities: limited, rare, super_rare, unique (each has its own competitions).
- Average score (L15) is important, but NOT the only factor.

PLAYER VIABILITY — consider ALL of these when recommending cards:
- hasUpcomingGame: If false, the player has NO game this weekend — DO NOT recommend them for this GW.
- isActiveAtClub: If false, player transferred/retired — the card is worthless, never recommend it.
- Players without a game should be deprioritized even for general trade advice.
- When suggesting cards, briefly note if a player has no game ("no game this GW").

TRADE ANALYSIS APPROACH:
When a user needs a card (e.g. "I need a DEF in-season for rare challenger"):
1. Use clan_find_cards to search across all members for matching cards (exclude the requesting user).
2. Use clan_trade_analysis to find who has surplus vs who needs cards at that position/rarity.
3. Analyze win-win: if a member has 2+ cards at a position but only needs 1 for their lineup, the extra is tradeable.
4. Consider the member's overall lineup needs — trading away a card they need is NOT win-win.
5. Suggest specific trade proposals with reasoning.
6. Only recommend players who have an upcoming game and are active at their club.

ALWAYS call tools to get real data before answering. Never guess about card ownership.
Be specific with names, scores, and trade reasoning. Think like a fantasy football analyst.`,
  };

  const screen = screenInstructions[ctx.activeTab] ?? `The user is browsing their Sorare collection.`;

  let prompt = `${base}\n\n${screen}`;

  if (ctx.contextSnapshot) {
    prompt += `\n\nCurrent state:\n${ctx.contextSnapshot}`;
  }

  return prompt;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, screenContext } = body as {
      messages: RichMessage[];
      screenContext: ScreenContext;
    };

    if (!messages?.length || !screenContext) {
      return new Response("Missing messages or screenContext", { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(screenContext);

    const apiMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    })) as Anthropic.MessageParam[];

    const stream = client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: apiMessages,
      tools: screenContext.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool["input_schema"],
      })),
    });

    const encoder = new TextEncoder();
    let currentToolCall: {
      id: string;
      name: string;
      inputJson: string;
    } | null = null;

    const readable = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        try {
          for await (const event of stream) {
            if (event.type === "content_block_start") {
              if (event.content_block.type === "tool_use") {
                currentToolCall = {
                  id: event.content_block.id,
                  name: event.content_block.name,
                  inputJson: "",
                };
              }
            } else if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                send("text_delta", { text: event.delta.text });
              } else if (
                event.delta.type === "input_json_delta" &&
                currentToolCall
              ) {
                currentToolCall.inputJson += event.delta.partial_json;
              }
            } else if (event.type === "content_block_stop") {
              if (currentToolCall) {
                let input = {};
                try {
                  input = JSON.parse(currentToolCall.inputJson || "{}");
                } catch {
                  // keep empty object
                }
                send("tool_use", {
                  id: currentToolCall.id,
                  name: currentToolCall.name,
                  input,
                });
                currentToolCall = null;
              }
            } else if (event.type === "message_stop") {
              // Send stop_reason so client knows if it needs a follow-up
              const finalMessage = await stream.finalMessage();
              send("done", { stop_reason: finalMessage.stop_reason });
            }
          }
        } catch (err) {
          send("error", {
            message: err instanceof Error ? err.message : "Stream error",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[AI Chat] Error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
