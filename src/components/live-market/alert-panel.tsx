"use client";

import { Bell, AlertTriangle, Info } from "lucide-react";
import { useMarketStore } from "@/lib/market/market-store";
import { AlertCard } from "./alert-card";
import { cn } from "@/lib/utils";

export function AlertPanel() {
  const { alerts, unacknowledgedCount, acknowledgeAlert } = useMarketStore();

  const criticalCount = alerts.filter(
    (a) => a.severity === "critical" && !a.acknowledged
  ).length;
  const warningCount = alerts.filter(
    (a) => a.severity === "warning" && !a.acknowledged
  ).length;
  const infoCount = alerts.filter(
    (a) => a.severity === "info" && !a.acknowledged
  ).length;

  return (
    <div className="flex flex-col h-full border-l border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-xs font-semibold text-white">Alerts</span>
          {unacknowledgedCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500/20 text-red-400">
              {unacknowledgedCount}
            </span>
          )}
        </div>

        {/* Severity summary */}
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-red-400">
              <AlertTriangle className="w-3 h-3" />
              {criticalCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400">
              <AlertTriangle className="w-3 h-3" />
              {warningCount}
            </span>
          )}
          {infoCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-blue-400">
              <Info className="w-3 h-3" />
              {infoCount}
            </span>
          )}
        </div>
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Bell className="w-6 h-6 text-zinc-700" />
            <p className="text-xs text-zinc-600">No alerts yet</p>
            <p className="text-[10px] text-zinc-700 text-center px-4">
              Alerts fire when unusual player trading activity is detected
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-2">
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onDismiss={acknowledgeAlert}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
