import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const client = new Anthropic();

const CACHE_TTL_MS = 5 * 60 * 1000;

interface InSeasonTakeDraftPlayer {
  name: string;
  pos: string;
  starterProb?: number;
  expected?: number;
  lastFiveAvg?: number;
  rewardsUsd?: number;
}

interface InSeasonTakeDraft {
  name: string;
  expected: number;
  winProb: number;
  captain: string | null;
  players: InSeasonTakeDraftPlayer[];
}

interface InSeasonTakeRequest {
  competition: {
    leagueName: string;
    rarity: string;
    division?: number;
  };
  targetThreshold: { score: number; reward: string };
  drafts: InSeasonTakeDraft[];
  notes?: string | null;
}

const SYSTEM_PROMPT = `You are a Sorare in-season prep coach.
The manager is preparing 1–4 lineups for the upcoming weekend gameweek and wants quick guidance.
Write 4–6 short lines, no headers, no bullet markers. Pure coach voice.
- Identify the strongest of the drafts and say why (captain, ceiling, mix).
- Call out one obvious risk per draft when it exists (low starter prob, missing captain, lopsided rarity, etc).
- If two drafts share many players, suggest an easy diversification swap.
- Reference the threshold score and reward. Mention specific player names you flag.
- If the manager attached a note, take it into account.
- No greetings, no preamble, no labels — just the take.`;

function buildUserPrompt(body: InSeasonTakeRequest): string {
  const lines: string[] = [];
  const div = body.competition.division ? ` D${body.competition.division}` : "";
  lines.push(
    `Competition: ${body.competition.leagueName}${div} · ${body.competition.rarity}`,
  );
  lines.push(
    `Target: ${body.targetThreshold.score} pts → ${body.targetThreshold.reward}`,
  );
  if (body.notes && body.notes.trim().length > 0) {
    lines.push(`Manager note: ${body.notes.trim()}`);
  }
  lines.push("");
  for (let i = 0; i < body.drafts.length; i++) {
    const d = body.drafts[i];
    lines.push(`Draft ${i + 1} — ${d.name}:`);
    lines.push(
      `- Expected ${Math.round(d.expected)} pts · win prob ${Math.round(d.winProb * 100)}% · captain ${d.captain ?? "none"}`,
    );
    for (const p of d.players) {
      const bits: string[] = [`${p.pos} ${p.name}`];
      if (typeof p.expected === "number")
        bits.push(`${Math.round(p.expected)}xp`);
      if (typeof p.starterProb === "number")
        bits.push(`${Math.round(p.starterProb * 100)}% start`);
      if (typeof p.lastFiveAvg === "number")
        bits.push(`L5 ${Math.round(p.lastFiveAvg)}`);
      if (typeof p.rewardsUsd === "number" && p.rewardsUsd > 0)
        bits.push(`$${Math.round(p.rewardsUsd)}`);
      lines.push(`  · ${bits.join(" · ")}`);
    }
    lines.push("");
  }
  lines.push("Give your take.");
  return lines.join("\n");
}

function cacheKeyFor(body: InSeasonTakeRequest): string {
  const draftKey = body.drafts
    .map((d) => {
      const playerSlugs = d.players
        .map((p) => p.name)
        .sort()
        .join(",");
      return `${d.name}:${Math.round(d.expected / 5) * 5}:${Math.round(d.winProb * 100)}:${d.captain ?? "-"}:${playerSlugs}`;
    })
    .join("|");
  const noteHash = body.notes ? body.notes.trim().length : 0;
  return `ai-in-season-take:${body.competition.leagueName}:${body.targetThreshold.score}:${noteHash}:${draftKey}`;
}

export async function POST(request: NextRequest) {
  let body: InSeasonTakeRequest;
  try {
    body = (await request.json()) as InSeasonTakeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body?.drafts?.length || !body?.targetThreshold?.score) {
    return NextResponse.json(
      { error: "Missing drafts or targetThreshold" },
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
    console.warn("[in-season-take] cache read failed", err);
  }

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
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
      console.warn("[in-season-take] cache write failed", err);
    }

    return NextResponse.json({ text, cached: false });
  } catch (err) {
    console.error("[in-season-take] Anthropic error:", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
