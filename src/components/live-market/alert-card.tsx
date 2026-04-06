"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  X, TrendingUp, Users, Zap, ChevronDown, Briefcase, CalendarDays,
  ArrowDown, List, XCircle, Lock,
} from "lucide-react";
import type { MarketAlert } from "@/lib/market/types";

const SEVERITY_STYLES = {
  info: {
    card: "bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20",
    icon: "bg-blue-500/10 text-blue-400",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  warning: {
    card: "bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20",
    icon: "bg-amber-500/10 text-amber-400",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  critical: {
    card: "bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20",
    icon: "bg-red-500/10 text-red-400",
    badge: "bg-red-500/10 text-red-400 border-red-500/20",
  },
} as const;

const RULE_ICONS: Record<string, typeof TrendingUp> = {
  volume_spike: TrendingUp,
  price_spike: Zap,
  buyer_concentration: Users,
  velocity: TrendingUp,
  portfolio: Briefcase,
  gameweek_signal: CalendarDays,
  price_drop: ArrowDown,
  listing_surge: List,
  cancellation_wave: XCircle,
  lineup_lock: Lock,
  lineup_cluster: Users,
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms)) return "\u2014";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs text-foreground font-medium">{value}</span>
    </div>
  );
}

function SalesList({ sales }: { sales: unknown }) {
  if (!Array.isArray(sales) || sales.length === 0) return null;
  return (
    <div className="pt-1.5 space-y-1">
      <span className="text-xs text-muted-foreground">Trades</span>
      {sales.map((s: { price?: number; buyer?: string; seller?: string; time?: string }, i: number) => (
        <div key={i} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-background/30 text-[10px]">
          <span className="text-foreground font-semibold tabular-nums w-20 shrink-0">
            {typeof s.price === "number" ? `${s.price.toFixed(4)} ETH` : "?"}
          </span>
          <span className="text-muted-foreground truncate flex-1">
            {s.seller || "?"} &rarr; {s.buyer || "?"}
          </span>
          {s.time && (
            <span className="text-muted-foreground/60 shrink-0">{timeAgo(s.time)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function SellersList({ sellers }: { sellers: unknown }) {
  if (!Array.isArray(sellers) || sellers.length === 0) return null;
  return (
    <div className="pt-1.5">
      <span className="text-xs text-muted-foreground">Sellers</span>
      <div className="flex flex-wrap gap-1 mt-1">
        {sellers.map((s: string) => (
          <span key={s} className="px-1.5 py-0.5 rounded-lg bg-secondary/50 text-[10px] text-foreground font-mono border border-border/30">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AlertCard({
  alert,
  onDismiss,
}: {
  alert: MarketAlert;
  onDismiss: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = RULE_ICONS[alert.ruleType] || TrendingUp;
  const styles = SEVERITY_STYLES[alert.severity];
  const meta = alert.metadata || {};

  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-300",
        styles.card,
        alert.acknowledged && "opacity-40"
      )}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-secondary/10 transition-colors text-left cursor-pointer rounded-xl"
      >
        <div className={cn("p-2 rounded-lg shrink-0", styles.icon)}>
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-foreground truncate">
              {alert.title}
            </span>
            <span className={cn(
              "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border shrink-0",
              styles.badge
            )}>
              {alert.severity}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {alert.description}
          </p>
          <span className="text-[10px] text-muted-foreground/60 mt-1 block">
            {timeAgo(alert.createdAt)}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!alert.acknowledged && (
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(alert.id); }}
              className="p-1.5 rounded-lg hover:bg-secondary/30 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180",
          )} />
        </div>
      </button>

      {/* Expanded metadata */}
      {expanded && (
        <div className="px-4 pb-4 pt-0">
          <div className="rounded-lg bg-secondary/20 border border-border/30 p-3 space-y-0.5">
            {alert.ruleType === "volume_spike" && (
              <>
                <MetadataRow label="Sales count" value={String(meta.count || "?")} />
                <MetadataRow label="Rarity" value={String(meta.rarity || "?")} />
                <MetadataRow label="Avg price" value={`${meta.avgPrice || "?"} ETH`} />
                <SalesList sales={meta.sales} />
              </>
            )}
            {alert.ruleType === "price_spike" && (
              <>
                <MetadataRow label="Latest price" value={`${typeof meta.latestPrice === 'number' ? meta.latestPrice.toFixed(4) : "?"} ETH`} />
                <MetadataRow label="Median price" value={`${typeof meta.median === 'number' ? meta.median.toFixed(4) : "?"} ETH`} />
                <MetadataRow label="Spike ratio" value={`${typeof meta.ratio === 'number' ? meta.ratio.toFixed(1) : "?"}x`} />
                <MetadataRow label="Rarity" value={String(meta.rarity || "?")} />
                <SalesList sales={meta.sales} />
              </>
            )}
            {alert.ruleType === "buyer_concentration" && (
              <>
                <MetadataRow label="Buyer" value={String(meta.buyer || "?")} />
                <MetadataRow label="Cards bought" value={String(meta.count || "?")} />
                <MetadataRow label="Rarity" value={String(meta.rarity || "?")} />
                <SalesList sales={meta.sales} />
              </>
            )}
            {alert.ruleType === "velocity" && (
              <>
                <MetadataRow label="Sales count" value={String(meta.count || "?")} />
                <MetadataRow label="Window" value={String(meta.window || "?")} />
              </>
            )}
            {alert.ruleType === "portfolio" && (
              <>
                <MetadataRow label="You own" value={String(meta.ownedCount || "?")} />
                <MetadataRow label="Rarities" value={String(meta.ownedRarities || "?")} />
                <MetadataRow label="Sales this session" value={String(meta.saleCount || "?")} />
                <MetadataRow label="Latest price" value={`${typeof meta.latestPrice === 'number' ? meta.latestPrice.toFixed(4) : "?"} ETH`} />
              </>
            )}
            {alert.ruleType === "gameweek_signal" && (
              <>
                <MetadataRow label="Signal" value={String(meta.signal || "?")} />
                <MetadataRow label="Opponent" value={String(meta.opponent || "?")} />
                <MetadataRow label="Game date" value={String(meta.gameDate || "?")} />
                <MetadataRow label="Sales" value={String(meta.saleCount || "?")} />
                {meta.isOwned && <MetadataRow label="Portfolio" value="You own this player" />}
              </>
            )}
            {alert.ruleType === "price_drop" && (
              <>
                <MetadataRow label="Previous price" value={`${typeof meta.previousPrice === 'number' ? meta.previousPrice.toFixed(4) : "?"} ETH`} />
                <MetadataRow label="New price" value={`${typeof meta.newPrice === 'number' ? meta.newPrice.toFixed(4) : "?"} ETH`} />
                <MetadataRow label="Drop" value={`${meta.dropPct || "?"}%`} />
                <MetadataRow label="Rarity" value={String(meta.rarity || "?")} />
                <MetadataRow label="Seller" value={String(meta.seller || "?")} />
              </>
            )}
            {alert.ruleType === "listing_surge" && (
              <>
                <MetadataRow label="New listings" value={String(meta.count || "?")} />
                <MetadataRow label="Window" value="30 min" />
                <MetadataRow label="Rarity" value={String(meta.rarity || "?")} />
                <SellersList sellers={meta.sellers} />
              </>
            )}
            {alert.ruleType === "cancellation_wave" && (
              <>
                <MetadataRow label="Cancellations" value={String(meta.count || "?")} />
                <MetadataRow label="Window" value="30 min" />
                <MetadataRow label="Rarity" value={String(meta.rarity || "?")} />
                <SellersList sellers={meta.sellers} />
              </>
            )}
            {alert.ruleType === "lineup_lock" && (
              <>
                <MetadataRow label="Card" value={String(meta.cardSlug || "?")} />
                <MetadataRow label="Rarity" value={String(meta.rarity || "?")} />
                <MetadataRow label="Competition" value={String(meta.competition || "?")} />
                {meta.gameDate && <MetadataRow label="Game date" value={String(meta.gameDate)} />}
              </>
            )}
            {alert.ruleType === "lineup_cluster" && (
              <>
                <MetadataRow label="Lineup locks" value={String(meta.count || "?")} />
                <MetadataRow label="Window" value="60 min" />
                <MetadataRow label="Rarity" value={String(meta.rarity || "?")} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
