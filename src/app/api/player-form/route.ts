import { NextResponse } from "next/server";
import { sorareClient } from "@/lib/sorare-client";
import { PLAYER_SCORES_QUERY } from "@/lib/queries";
import type { PlayerGameScore } from "@/lib/types";

interface PlayerScoresResponse {
  anyPlayer: {
    slug: string;
    allPlayerGameScores: {
      nodes: PlayerGameScore[];
    };
  } | null;
}

interface FormResult {
  trend: "rising" | "falling" | "stable";
  recentAvg: number;
  avgMinutes: number;
  last5Scores: number[];
}

function computeForm(scores: PlayerGameScore[]): FormResult {
  const valid = scores.filter((s) => s.scoreStatus === "FINAL" && s.score > 0);

  if (valid.length < 3) {
    return { trend: "stable", recentAvg: 0, avgMinutes: 0, last5Scores: [] };
  }

  const last5 = valid.slice(0, 5);
  const last10 = valid.slice(0, 10);
  const recentAvg = last5.reduce((s, g) => s + g.score, 0) / last5.length;
  const olderAvg = last10.length > 5
    ? last10.slice(3).reduce((s, g) => s + g.score, 0) / last10.slice(3).length
    : recentAvg;

  const diff = recentAvg - olderAvg;
  const pctDiff = olderAvg > 0 ? diff / olderAvg : 0;

  const trend: FormResult["trend"] = pctDiff > 0.10 ? "rising" : pctDiff < -0.10 ? "falling" : "stable";

  // Average minutes
  const withMins = valid.filter((s) => s.anyPlayerGameStats?.minsPlayed);
  const avgMinutes = withMins.length > 0
    ? Math.round(withMins.slice(0, 10).reduce((s, g) => s + (g.anyPlayerGameStats?.minsPlayed ?? 0), 0) / Math.min(withMins.length, 10))
    : 0;

  return {
    trend,
    recentAvg: Math.round(recentAvg * 10) / 10,
    avgMinutes,
    last5Scores: last5.map((s) => Math.round(s.score)),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slugs = searchParams.get("slugs");
  const positions = searchParams.get("positions");

  if (!slugs) {
    return NextResponse.json({ error: "Missing slugs" }, { status: 400 });
  }

  const slugList = slugs.split(",").slice(0, 15);
  const posList = positions ? positions.split(",") : [];

  const results = await Promise.allSettled(
    slugList.map(async (slug, i) => {
      const pos = posList[i] || "Forward";
      const result = await sorareClient.request<PlayerScoresResponse>(
        PLAYER_SCORES_QUERY,
        { slug, position: pos }
      );
      const scores = result?.anyPlayer?.allPlayerGameScores?.nodes ?? [];
      return { slug, form: computeForm(scores) };
    })
  );

  const players: Record<string, FormResult> = {};
  for (const r of results) {
    if (r.status === "fulfilled") {
      players[r.value.slug] = r.value.form;
    }
  }

  return NextResponse.json({ players });
}
