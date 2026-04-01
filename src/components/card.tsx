"use client";

import { memo, useState, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { POSITION_SHORT, type SorareCard } from "@/lib/types";
import { getEditionInfo } from "@/lib/ai-lineup";

interface CardComponentProps {
  card: SorareCard;
  onClick?: () => void;
}

function getScoreColor(score: number): string {
  if (score >= 60) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  if (score >= 20) return "bg-orange-500";
  return "bg-red-500";
}

function ScoreBars({ score }: { score: number }) {
  const filled = Math.min(5, Math.max(0, Math.ceil(score / 20)));
  const barColor =
    score >= 60
      ? "bg-green-400"
      : score >= 40
        ? "bg-yellow-400"
        : score >= 20
          ? "bg-orange-400"
          : "bg-red-400";
  return (
    <div className="flex items-end gap-[2px]">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            "w-[3px] rounded-sm",
            i <= filled ? barColor : "bg-zinc-700"
          )}
          style={{ height: `${6 + i * 2}px` }}
        />
      ))}
    </div>
  );
}

function TierStars({ grade }: { grade: number }) {
  // Grade is XP-based tier: 0=1star, grade maps to stars via XP thresholds
  // For now: grade 0 = 1 star, grade 1+ = 2+ stars
  const stars = grade >= 80 ? 5 : grade >= 60 ? 4 : grade >= 40 ? 3 : grade >= 20 ? 2 : 1;
  return (
    <div className="flex items-center gap-[1px]">
      {Array.from({ length: stars }).map((_, i) => (
        <svg
          key={i}
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-yellow-400"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

export const CardComponent = memo(function CardComponent({
  card,
  onClick,
}: CardComponentProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleLoad = useCallback(() => setImageLoaded(true), []);
  const handleError = useCallback(() => {
    setImageError(true);
    setImageLoaded(true);
  }, []);

  const player = card.anyPlayer;
  if (!player) return null;

  const position = player.cardPositions?.[0] || "Unknown";
  const posShort =
    POSITION_SHORT[position] || position.slice(0, 2).toUpperCase();
  const flagUrl = player.country?.flagUrl;
  const countryCode = player.country?.code;
  const avgScore = player.averageScore || 0;
  const grade = card.grade || 0;
  const edition = (card.cardEditionName || "").toLowerCase();
  const isStellar = edition.includes("stellar");
  const editionInfo = getEditionInfo(card);

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-900/10"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Card Image */}
      <div className="relative aspect-[3/4] bg-zinc-800 overflow-hidden">
        {!imageError ? (
          <Image
            src={card.pictureUrl}
            alt={`${player.displayName} card`}
            fill
            className={cn(
              "object-cover transition-transform duration-300 group-hover:scale-105",
              !imageLoaded && "opacity-0"
            )}
            onLoad={handleLoad}
            onError={handleError}
            loading="lazy"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            {player.displayName}
          </div>
        )}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
        )}
        {editionInfo.bonus > 0 && (
          <div
            className={cn(
              "absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold",
              editionInfo.tier === "legendary"
                ? "bg-amber-500/90 text-black"
                : editionInfo.tier === "holo"
                  ? "bg-cyan-500/90 text-black"
                  : "bg-blue-500/90 text-white"
            )}
          >
            +{Math.round(editionInfo.bonus * 100)}%
          </div>
        )}
      </div>

      {/* Info Bar */}
      <div className="px-2.5 py-2 space-y-1">
        {/* Country, Position, Age */}
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
          {flagUrl ? (
            <Image
              src={flagUrl}
              alt={countryCode || ""}
              width={14}
              height={10}
              className="rounded-sm object-cover"
            />
          ) : countryCode ? (
            <span className="uppercase font-medium">{countryCode}</span>
          ) : null}
          <span className="font-semibold text-zinc-300">{posShort}</span>
          <span>{player.age}</span>
        </div>

        {/* Player Name */}
        <h3 className="text-[13px] font-bold text-white leading-tight line-clamp-2 uppercase tracking-wide">
          {player.displayName}
        </h3>

        {/* Card Set Label */}
        {isStellar && (
          <p className="text-[9px] text-purple-400 uppercase tracking-wider font-medium">
            Stellar Nights
          </p>
        )}
        {editionInfo.bonus > 0 && (
          <p
            className={cn(
              "text-[9px] uppercase tracking-wider font-medium",
              editionInfo.tier === "legendary"
                ? "text-amber-400"
                : editionInfo.tier === "holo"
                  ? "text-cyan-400"
                  : "text-blue-400"
            )}
          >
            {editionInfo.label}
          </p>
        )}

        {/* Score + Tier */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-1.5">
            <ScoreBars score={avgScore} />
            {avgScore > 0 && (
              <span
                className={cn(
                  "text-[11px] font-bold px-1.5 py-0.5 rounded text-white",
                  getScoreColor(avgScore)
                )}
              >
                {Math.round(avgScore)}
              </span>
            )}
          </div>
          <TierStars grade={grade} />
        </div>
      </div>
    </div>
  );
});
