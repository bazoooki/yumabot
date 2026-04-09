"use client";

import {
  Award,
  Zap,
  Target,
  Crown,
  Shield,
  Star,
  Users,
  TrendingUp,
} from "lucide-react";
import type { Achievement } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACHIEVEMENT_CONFIG: Record<
  string,
  { icon: typeof Award; color: string; bg: string }
> = {
  multi_podium: { icon: Crown, color: "text-amber-400", bg: "bg-amber-500/10" },
  highest_score: { icon: Zap, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  consistent_placer: { icon: Target, color: "text-blue-400", bg: "bg-blue-500/10" },
  captain_masterclass: { icon: Star, color: "text-purple-400", bg: "bg-purple-500/10" },
  short_handed_hero: { icon: TrendingUp, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  bad_captain_good_team: { icon: Award, color: "text-orange-400", bg: "bg-orange-500/10" },
  clan_top_finish: { icon: Shield, color: "text-violet-400", bg: "bg-violet-500/10" },
  clan_best_gw: { icon: Users, color: "text-violet-400", bg: "bg-violet-500/10" },
};

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const config = ACHIEVEMENT_CONFIG[achievement.type] ?? {
    icon: Award,
    color: "text-zinc-400",
    bg: "bg-zinc-500/10",
  };
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-3 py-2.5 rounded-lg border border-zinc-800",
        config.bg,
      )}
    >
      <div className={cn("mt-0.5 shrink-0", config.color)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-200">
            {achievement.title}
          </span>
          <span className="text-[10px] text-zinc-500">
            {achievement.userName}
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 mt-0.5">
          {achievement.description}
        </p>
      </div>
    </div>
  );
}

export function AchievementsSection({
  achievements,
}: {
  achievements: Achievement[];
}) {
  if (achievements.length === 0) {
    return (
      <p className="text-sm text-zinc-500 text-center py-8">
        No achievements detected yet
      </p>
    );
  }

  return (
    <div className="space-y-2 max-w-2xl">
      {achievements.map((a, i) => (
        <AchievementCard key={`${a.type}-${a.userSlug}-${i}`} achievement={a} />
      ))}
    </div>
  );
}
