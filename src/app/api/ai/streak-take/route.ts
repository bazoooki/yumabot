import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const client = new Anthropic();

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface TeamSummary {
  name: string;
  lineupSlug?: string | null;
  actualTotal: number;
  projectedTotal: number;
  successProbability: number; // 0..1
  pendingPlayers: string[];
  finishedPlayers: { name: string; score: number }[];
}

interface StreakTakeRequest {
  competition: {
    leagueName: string;
    division: number;
    rarity: string;
  };
  targetScore: number;
  rewardLabel: string;
  teams: TeamSummary[];
}

const SYSTEM_PROMPT = `You are a die-hard football fan commenting on the user's Sorare Fantasy lineups.
Write 2–4 lines, pure fan voice — no preamble, no hedging, no bullet lists.
- Crushing it and projected well above the threshold? Hype them hard ("monster lineup", "absolutely cooked this one", "bag secured").
- Borderline (40–70%)? Build tension — name the specific players still to play and what they need.
- Bombing (<30%)? A gentle roast with a smirk, never cruel ("oof, this one got away 😅", "we'll chalk this one up to chemistry"). Keep it light.
- Multiple teams? Cover them briefly — one short clause each is fine.
- Always mention specific players still to play by name, and reference the exact threshold score.
- Occasional ⚽ 🔥 😅 emoji is fine. Don't overdo it.
- Output just the take — no greetings, no explanations, no labels.`;

function buildUserPrompt(body: StreakTakeRequest): string {
  const { competition, targetScore, rewardLabel, teams } = body;
  const lines: string[] = [];
  lines.push(
    `Competition: ${competition.leagueName}${competition.division ? ` D${competition.division}` : ""} · ${competition.rarity}`,
  );
  lines.push(`Next threshold: ${targetScore} pts → ${rewardLabel}`);
  lines.push("");
  for (let i = 0; i < teams.length; i++) {
    const t = teams[i];
    lines.push(`Team ${i + 1} (${t.name}):`);
    lines.push(
      `- So far: ${t.actualTotal} · projected final: ${t.projectedTotal} · clearance odds: ${Math.round(t.successProbability * 100)}%`,
    );
    if (t.finishedPlayers.length > 0) {
      const fin = t.finishedPlayers
        .map((p) => `${p.name} (${Math.round(p.score)})`)
        .join(", ");
      lines.push(`- Finished: ${fin}`);
    }
    if (t.pendingPlayers.length > 0) {
      lines.push(`- Still to play: ${t.pendingPlayers.join(", ")}`);
    } else {
      lines.push(`- All players finished.`);
    }
    lines.push("");
  }
  lines.push("Give your take.");
  return lines.join("\n");
}

function cacheKeyFor(body: StreakTakeRequest): string {
  const teamKey = body.teams
    .map((t) => {
      const actualBucket = Math.round(t.actualTotal / 10) * 10;
      const slug = t.lineupSlug ?? t.name;
      return `${slug}:${actualBucket}:${t.pendingPlayers.length}`;
    })
    .join("|");
  return `ai-streak-take:${body.competition.leagueName}:${body.competition.division}:${body.targetScore}:${teamKey}`;
}

export async function POST(request: NextRequest) {
  let body: StreakTakeRequest;
  try {
    body = (await request.json()) as StreakTakeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body?.teams?.length || !body?.targetScore) {
    return NextResponse.json(
      { error: "Missing teams or targetScore" },
      { status: 400 },
    );
  }

  const key = cacheKeyFor(body);
  try {
    const cached = await prisma.computedResults.findUnique({ where: { key } });
    if (cached && Date.now() - cached.computedAt.getTime() < CACHE_TTL_MS) {
      const parsed = JSON.parse(cached.dataJson) as { text: string };
      return NextResponse.json({ ...parsed, cached: true });
    }
  } catch (err) {
    console.warn("[streak-take] cache read failed", err);
  }

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(body) }],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    try {
      await prisma.computedResults.upsert({
        where: { key },
        create: { key, dataJson: JSON.stringify({ text }) },
        update: { dataJson: JSON.stringify({ text }), computedAt: new Date() },
      });
    } catch (err) {
      console.warn("[streak-take] cache write failed", err);
    }

    return NextResponse.json({ text, cached: false });
  } catch (err) {
    console.error("[streak-take] Anthropic error:", err);
    return NextResponse.json(
      { error: "AI request failed" },
      { status: 500 },
    );
  }
}
