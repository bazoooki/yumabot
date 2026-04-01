"use client";

import type { PlayerGameScore } from "@/lib/types";

interface ScoreChartProps {
  scores: PlayerGameScore[];
}

function getBarColor(score: number): string {
  if (score >= 60) return "#22c55e"; // green
  if (score >= 40) return "#eab308"; // yellow
  if (score >= 20) return "#f97316"; // orange
  return "#ef4444"; // red
}

export function ScoreChart({ scores }: ScoreChartProps) {
  // Take last 10 scored games, reversed so oldest is on left
  const games = scores
    .filter((s) => s.scoreStatus === "FINAL" && s.score > 0)
    .slice(0, 10)
    .reverse();

  if (games.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-zinc-500">
        No scored games to display
      </div>
    );
  }

  const maxScore = Math.max(...games.map((g) => g.score), 80);
  const barWidth = 32;
  const barGap = 6;
  const chartHeight = 120;
  const topPadding = 18;
  const bottomPadding = 30;
  const totalHeight = chartHeight + topPadding + bottomPadding;
  const totalWidth = games.length * (barWidth + barGap) - barGap;

  return (
    <div className="overflow-x-auto">
      <svg
        width={totalWidth + 8}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth + 8} ${totalHeight}`}
        className="mx-auto"
      >
        {games.map((game, i) => {
          const x = i * (barWidth + barGap) + 4;
          const barHeight = (game.score / maxScore) * chartHeight;
          const y = topPadding + chartHeight - barHeight;
          const color = getBarColor(game.score);
          const dateStr = new Date(game.anyGame.date).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric" }
          );

          return (
            <g key={`${game.anyGame.date}-${i}`}>
              {/* Score label */}
              <text
                x={x + barWidth / 2}
                y={y - 4}
                textAnchor="middle"
                className="text-[9px] font-bold"
                fill={color}
              >
                {Math.round(game.score)}
              </text>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={3}
                fill={color}
                opacity={0.85}
              />
              {/* Date label */}
              <text
                x={x + barWidth / 2}
                y={topPadding + chartHeight + 14}
                textAnchor="middle"
                className="text-[8px]"
                fill="#71717a"
              >
                {dateStr}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
