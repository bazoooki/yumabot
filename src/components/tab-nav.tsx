"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ClipboardList,
  TrendingUp,
  Tv,
  List,
  Trophy,
  Shield,
  RefreshCw,
} from "lucide-react";
import { useCards } from "@/providers/cards-provider";
import { cn } from "@/lib/utils";

const TABS = [
  {
    href: "/home",
    label: "Home",
    icon: Home,
    borderColor: "border-white",
    mobileAccent: "text-white",
  },
  {
    href: "/lineup",
    label: "Lineup",
    icon: ClipboardList,
    borderColor: "border-white",
    mobileAccent: "text-white",
  },
  {
    href: "/market",
    label: "Market",
    icon: TrendingUp,
    borderColor: "border-green-400",
    mobileAccent: "text-green-400",
  },
  {
    href: "/games",
    label: "Games",
    icon: Tv,
    borderColor: "border-cyan-400",
    mobileAccent: "text-cyan-400",
  },
  {
    href: "/lineups",
    label: "Lineups",
    icon: List,
    borderColor: "border-pink-400",
    mobileAccent: "text-pink-400",
  },
  {
    href: "/in-season",
    label: "In Season",
    icon: Trophy,
    borderColor: "border-amber-400",
    mobileAccent: "text-amber-400",
    badge: "beta",
  },
  {
    href: "/clan",
    label: "Clan",
    icon: Shield,
    borderColor: "border-violet-400",
    mobileAccent: "text-violet-400",
    badge: "beta",
  },
] satisfies {
  href: string;
  label: string;
  icon: typeof Home;
  borderColor: string;
  mobileAccent: string;
  badge?: string;
}[];

export function TabNav() {
  const pathname = usePathname();
  const { cacheAgeMin, isFresh, isRefreshing, isLoading, handleRefresh } =
    useCards();

  const navRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    if (!navRef.current) return;
    const activeLink = navRef.current.querySelector<HTMLElement>("[data-active=true]");
    if (activeLink) {
      const navRect = navRef.current.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      setIndicator({
        left: linkRect.left - navRect.left,
        width: linkRect.width,
      });
    }
  }, []);

  useEffect(() => {
    updateIndicator();
  }, [pathname, updateIndicator]);

  return (
    <>
      {/* Desktop: horizontal top bar */}
      <nav className="hidden md:block border-b border-zinc-800 px-6">
        <div ref={navRef} className="relative flex items-center gap-6">
          {/* Sliding indicator */}
          <div
            className="absolute bottom-0 h-0.5 bg-white transition-all duration-200 ease-out rounded-full"
            style={{ left: indicator.left, width: indicator.width }}
          />
          {TABS.map((tab) => {
            const active =
              pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                data-active={active}
                className={cn(
                  "py-3 text-sm font-medium transition-colors flex items-center gap-1.5",
                  active
                    ? "text-white"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {tab.label}
                {tab.badge && (
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 leading-none">
                    {tab.badge}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Refresh + cache info */}
          <div className="ml-auto flex items-center gap-3">
            {cacheAgeMin !== null && (
              <span className="text-[10px] text-zinc-600">
                {!isFresh
                  ? `cached ${cacheAgeMin < 60 ? `${cacheAgeMin}m` : `${Math.round(cacheAgeMin / 60)}h`} ago`
                  : "fresh"}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                isRefreshing
                  ? "bg-zinc-800 text-zinc-500 cursor-wait"
                  : "bg-purple-600/80 hover:bg-purple-500 text-white",
              )}
            >
              <RefreshCw
                className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")}
              />
              {isRefreshing ? "Refreshing..." : "Refresh Cards"}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile: fixed bottom bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-zinc-800 bg-[#0f0f0f]/95 backdrop-blur-sm safe-area-bottom">
        <div className="flex items-center justify-around px-1 pt-1.5 pb-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active =
              pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-0",
                  active
                    ? tab.mobileAccent
                    : "text-zinc-600 active:text-zinc-400",
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-[10px] font-medium truncate leading-tight">
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
