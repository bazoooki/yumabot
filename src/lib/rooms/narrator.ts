import Anthropic from "@anthropic-ai/sdk";
import type { NarrationContext } from "./types";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are the AI companion for a Sorare game window room. You are OBSESSED with the MANAGERS — their lineups, their stakes, their rivalry. You NEVER commentate football. You commentate PEOPLE.

You operate in phases:

PRE-MATCH (before kickoff):
- Review lineups when managers lock them in
- Compare captain picks and highlight differentials
- Build anticipation: "Combined $67 in streak rewards at stake in this room"

LIVE (during games):
- Narrate score changes in terms of manager impact
- React to game events (subs, injuries, cards) through the lens of manager stakes
- Create drama: "That substitution just cost sarah potential bonus points"
- Note captain differentials: "david's captain pick is paying off — 1.5x on that score bump"
- Reference predictions if any were made

POST-MATCH (all games finished):
- Write a 3-4 sentence match report from the managers' perspective
- Pick an MVP (best decision in the room)
- Summarize key moments

Rules:
- 1-2 sentences max during live games. Be punchy.
- Vary your style. Don't start messages the same way.
- Use manager names. Reference their specific choices.
- If nothing meaningful happened, return exactly: NULL
- Be energetic but not cringey. This is real money and real stakes.
- When someone hits target: make it a BIG moment.
- When someone falls behind: add urgency.
- Reference game events (subs at 60' = less time for bonus, injury = disaster, yellow card = risk of missing next game)`;

export async function generateNarration(
  context: NarrationContext
): Promise<string | null> {
  if (context.scoreChanges.length === 0 && !context.phase) return null;

  const hasMeaningfulChange = context.scoreChanges.some((c) => Math.abs(c.delta) >= 3);
  if (!hasMeaningfulChange && context.phase === "live") return null;

  const userPrompt = buildPrompt(context);

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : null;
    if (!text || text === "NULL" || text.toLowerCase() === "null") return null;
    return text;
  } catch (err) {
    console.error("[Narrator] Claude API error:", err);
    return null;
  }
}

export async function generateLineupReview(
  managerName: string,
  lineup: { playerName: string; position: string; isCaptain: boolean; averageScore?: number; startOdds?: number }[],
  level: number,
  reward: string,
  targetScore: number
): Promise<string | null> {
  try {
    const lineupStr = lineup.map((p) =>
      `${p.position}: ${p.playerName}${p.isCaptain ? " (CAPTAIN)" : ""}${p.averageScore ? ` avg:${p.averageScore.toFixed(0)}` : ""}${p.startOdds ? ` start:${p.startOdds}%` : ""}`
    ).join("\n");

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      system: "You review Sorare lineups from the manager's perspective. Be concise (1-2 sentences). Comment on captain choice, risk level, and any bold/interesting picks. Don't be generic.",
      messages: [{
        role: "user",
        content: `${managerName} locked in their Level ${level} lineup (${reward}, target: ${targetScore} pts):\n\n${lineupStr}\n\nQuick review:`
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : null;
    return text;
  } catch (err) {
    console.error("[Narrator] Lineup review error:", err);
    return null;
  }
}

export async function generateMatchReport(context: NarrationContext): Promise<string | null> {
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: "Write a 3-4 sentence match report for a Sorare game room. Focus on the MANAGERS — who won, who lost their streak, whose captain pick was the difference. Pick an MVP (best decision). Be dramatic but concise.",
      messages: [{ role: "user", content: buildPrompt({ ...context, phase: "post" }) }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : null;
    return text;
  } catch (err) {
    console.error("[Narrator] Match report error:", err);
    return null;
  }
}

function buildPrompt(ctx: NarrationContext): string {
  const parts: string[] = [];

  if (ctx.phase) parts.push(`## Phase: ${ctx.phase.toUpperCase()}\n`);

  parts.push("## Room Participants\n");
  for (const p of ctx.participants) {
    const statusLabel = p.status === "on_track" ? "ON TRACK" : p.status === "at_risk" ? "AT RISK" : "UNLIKELY";
    parts.push(`**${p.name}** — Score: ${p.currentScore.toFixed(0)} / Target: ${p.targetScore} (${statusLabel}) — Level ${p.currentLevel} streak (${p.streakReward}) — ${p.distanceToTarget > 0 ? `${p.distanceToTarget.toFixed(0)} pts away` : "TARGET HIT!"}`);
    const lineupStr = p.lineup.map((l) => `${l.playerName}${l.isCaptain ? " (C)" : ""}`).join(", ");
    parts.push(`  Lineup: ${lineupStr}\n`);
  }

  if (ctx.scoreChanges.length > 0) {
    parts.push("\n## Score Changes\n");
    for (const c of ctx.scoreChanges) {
      const owners = c.ownedBy.join(", ");
      const captains = c.isCaptainFor.length > 0 ? ` (CAPTAIN for: ${c.isCaptainFor.join(", ")})` : "";
      parts.push(`${c.playerName}: ${c.previousScore.toFixed(0)} → ${c.newScore.toFixed(0)} (${c.delta > 0 ? "+" : ""}${c.delta.toFixed(0)})${c.event ? ` [${c.event}]` : ""} — owned by: ${owners}${captains}`);
    }
  }

  if (ctx.gameEvents && ctx.gameEvents.length > 0) {
    parts.push("\n## Game Events\n");
    for (const e of ctx.gameEvents) {
      parts.push(`${e.type}: ${e.playerName} — ${e.description} (affects: ${e.affectedManagers.join(", ") || "nobody in room"})`);
    }
  }

  parts.push("\n## Room Leaderboard\n");
  for (const l of ctx.leaderboard) {
    parts.push(`${l.rank}. ${l.name} — ${l.score.toFixed(0)} pts`);
  }

  if (ctx.previousNarrations.length > 0) {
    parts.push(`\n## Your Recent Messages (don't repeat)\n${ctx.previousNarrations.join("\n")}`);
  }

  return parts.join("\n");
}
