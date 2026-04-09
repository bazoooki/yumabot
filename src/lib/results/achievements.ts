import type { ResultsRanking, LeaderboardSummary, Achievement } from "../types";

/** Detect achievements from a gameweek's leaderboard data */
export function detectAchievements(
  leaderboards: LeaderboardSummary[],
  allRankings: Map<string, ResultsRanking[]>,
  clanSlugs: Set<string>,
): Achievement[] {
  const achievements: Achievement[] = [];
  const div1 = leaderboards.filter((lb) => lb.division === 1);

  // --- Multi-Podium: same user in top 3 of 2+ Div 1 leaderboards ---
  const podiumCounts = new Map<string, { name: string; comps: string[] }>();
  for (const lb of div1) {
    for (const entry of lb.podium) {
      const existing = podiumCounts.get(entry.user.slug) ?? {
        name: entry.user.nickname,
        comps: [],
      };
      existing.comps.push(lb.leagueName);
      podiumCounts.set(entry.user.slug, existing);
    }
  }
  for (const [slug, data] of podiumCounts) {
    if (data.comps.length >= 2) {
      achievements.push({
        type: "multi_podium",
        title: "Multi-Podium",
        description: `Top 3 in ${data.comps.length} Div 1 competitions: ${data.comps.join(", ")}`,
        userSlug: slug,
        userName: data.name,
        value: data.comps.length,
        meta: { competitions: data.comps },
      });
    }
  }

  // --- GW Highest Score: max score across all Div 1 rankings ---
  let highestEntry: { ranking: ResultsRanking; lb: string } | null = null;
  for (const lb of div1) {
    const rankings = allRankings.get(lb.slug);
    if (!rankings?.length) continue;
    const top = rankings[0];
    if (!highestEntry || top.score > highestEntry.ranking.score) {
      highestEntry = { ranking: top, lb: lb.leagueName };
    }
  }
  if (highestEntry) {
    achievements.push({
      type: "highest_score",
      title: "GW Highest Score",
      description: `${Math.round(highestEntry.ranking.score)} pts in ${highestEntry.lb}`,
      userSlug: highestEntry.ranking.user.slug,
      userName: highestEntry.ranking.user.nickname,
      value: highestEntry.ranking.score,
      meta: { leaderboard: highestEntry.lb },
    });
  }

  // --- Consistent Placer: same user in top 100 of 3+ leaderboards ---
  const top100Counts = new Map<string, { name: string; count: number }>();
  for (const lb of leaderboards) {
    const rankings = allRankings.get(lb.slug);
    if (!rankings) continue;
    for (const r of rankings) {
      if (r.ranking > 100) break;
      const existing = top100Counts.get(r.user.slug) ?? {
        name: r.user.nickname,
        count: 0,
      };
      existing.count++;
      top100Counts.set(r.user.slug, existing);
    }
  }
  for (const [slug, data] of top100Counts) {
    if (data.count >= 3) {
      achievements.push({
        type: "consistent_placer",
        title: "Consistent Placer",
        description: `Top 100 in ${data.count} different leaderboards`,
        userSlug: slug,
        userName: data.name,
        value: data.count,
        meta: {},
      });
    }
  }

  // --- Captain Masterclass: captain scored 100+ in a top-50 lineup ---
  for (const lb of div1) {
    const rankings = allRankings.get(lb.slug);
    if (!rankings) continue;
    for (const r of rankings.slice(0, 50)) {
      const captain = r.lineup.find((a) => a.captain);
      if (captain && captain.score >= 100) {
        achievements.push({
          type: "captain_masterclass",
          title: "Captain Masterclass",
          description: `Captain scored ${Math.round(captain.score)} pts (${captain.playerName}) in ${lb.leagueName}`,
          userSlug: r.user.slug,
          userName: r.user.nickname,
          value: captain.score,
          meta: {
            player: captain.playerName,
            leaderboard: lb.leagueName,
          },
        });
        break; // One per leaderboard
      }
    }
  }

  // --- Short-Handed Hero: high score with 4 or fewer scoring slots ---
  for (const lb of div1) {
    const rankings = allRankings.get(lb.slug);
    if (!rankings) continue;
    for (const r of rankings.slice(0, 100)) {
      const scoringSlots = r.lineup.filter((a) => a.score > 0).length;
      if (scoringSlots <= 4 && scoringSlots >= 1 && r.ranking <= 20) {
        achievements.push({
          type: "short_handed_hero",
          title: "Short-Handed Hero",
          description: `Rank ${r.ranking} with only ${scoringSlots} scoring players in ${lb.leagueName}`,
          userSlug: r.user.slug,
          userName: r.user.nickname,
          value: r.score,
          meta: { scoringSlots, leaderboard: lb.leagueName },
        });
        break;
      }
    }
  }

  // --- Bad Captain, Good Team: top 10 but captain scored < 30 ---
  for (const lb of div1) {
    const rankings = allRankings.get(lb.slug);
    if (!rankings) continue;
    for (const r of rankings.slice(0, 10)) {
      const captain = r.lineup.find((a) => a.captain);
      if (captain && captain.score < 30 && captain.score > 0) {
        achievements.push({
          type: "bad_captain_good_team",
          title: "Bad Captain, Good Team",
          description: `Top ${r.ranking} in ${lb.leagueName} despite captain ${captain.playerName} scoring only ${Math.round(captain.score)} pts`,
          userSlug: r.user.slug,
          userName: r.user.nickname,
          value: r.score,
          meta: {
            captainScore: captain.score,
            captainPlayer: captain.playerName,
            leaderboard: lb.leagueName,
          },
        });
      }
    }
  }

  // --- Clan Top Finish: clan member in top 10 of any Div 1 ---
  for (const lb of div1) {
    const rankings = allRankings.get(lb.slug);
    if (!rankings) continue;
    for (const r of rankings.slice(0, 10)) {
      if (clanSlugs.has(r.user.slug)) {
        achievements.push({
          type: "clan_top_finish",
          title: "Clan Top Finish",
          description: `Rank ${r.ranking} in ${lb.leagueName} Div 1 with ${Math.round(r.score)} pts`,
          userSlug: r.user.slug,
          userName: r.user.nickname,
          value: r.ranking,
          meta: { leaderboard: lb.leagueName, score: r.score },
        });
      }
    }
  }

  // --- Clan Best GW: highest-scoring clan member ---
  let bestClan: { slug: string; name: string; score: number; lb: string } | null =
    null;
  for (const lb of leaderboards) {
    const rankings = allRankings.get(lb.slug);
    if (!rankings) continue;
    for (const r of rankings) {
      if (clanSlugs.has(r.user.slug)) {
        if (!bestClan || r.score > bestClan.score) {
          bestClan = {
            slug: r.user.slug,
            name: r.user.nickname,
            score: r.score,
            lb: lb.leagueName,
          };
        }
        break; // Only check best finish per leaderboard
      }
    }
  }
  if (bestClan) {
    achievements.push({
      type: "clan_best_gw",
      title: "Clan Best GW",
      description: `${Math.round(bestClan.score)} pts in ${bestClan.lb}`,
      userSlug: bestClan.slug,
      userName: bestClan.name,
      value: bestClan.score,
      meta: { leaderboard: bestClan.lb },
    });
  }

  // Sort: clan achievements first, then by value descending
  achievements.sort((a, b) => {
    const aClan = a.type.startsWith("clan_") ? 0 : 1;
    const bClan = b.type.startsWith("clan_") ? 0 : 1;
    if (aClan !== bClan) return aClan - bClan;
    return b.value - a.value;
  });

  return achievements;
}
