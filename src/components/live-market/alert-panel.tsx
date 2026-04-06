"use client";

import { useState } from "react";
import { Bell, AlertTriangle, Info, Sparkles, Trash2 } from "lucide-react";
import { useMarketStore } from "@/lib/market/market-store";
import { AlertCard } from "./alert-card";
import { cn } from "@/lib/utils";
import type { AlertSeverity } from "@/lib/market/types";

export function AlertPanel() {
  const { alerts, unacknowledgedCount, acknowledgeAlert, clearAlerts } = useMarketStore();
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "all">("all");

  const criticalCount = alerts.filter(
    (a) => a.severity === "critical" && !a.acknowledged
  ).length;
  const warningCount = alerts.filter(
    (a) => a.severity === "warning" && !a.acknowledged
  ).length;
  const infoCount = alerts.filter(
    (a) => a.severity === "info" && !a.acknowledged
  ).length;

  const filtered = severityFilter === "all"
    ? alerts
    : alerts.filter((a) => a.severity === severityFilter);

  return (
    <div className="flex flex-col h-full border-l border-border/50 bg-card/30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10">
            <Bell className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">Alerts</span>
              {unacknowledgedCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                  {unacknowledgedCount}
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">Real-time market signals</p>
          </div>
        </div>

        {/* Severity filters (clickable) + clear */}
        <div className="flex items-center gap-1.5">
          {criticalCount > 0 && (
            <button
              onClick={() => setSeverityFilter(severityFilter === "critical" ? "all" : "critical")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-lg border transition-all",
                severityFilter === "critical"
                  ? "bg-red-500/20 border-red-500/40 ring-1 ring-red-500/30"
                  : "bg-red-500/10 border-red-500/20 hover:bg-red-500/15"
              )}
            >
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span className="text-[10px] font-semibold text-red-400">{criticalCount}</span>
            </button>
          )}
          {warningCount > 0 && (
            <button
              onClick={() => setSeverityFilter(severityFilter === "warning" ? "all" : "warning")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-lg border transition-all",
                severityFilter === "warning"
                  ? "bg-amber-500/20 border-amber-500/40 ring-1 ring-amber-500/30"
                  : "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15"
              )}
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-semibold text-amber-400">{warningCount}</span>
            </button>
          )}
          {infoCount > 0 && (
            <button
              onClick={() => setSeverityFilter(severityFilter === "info" ? "all" : "info")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-lg border transition-all",
                severityFilter === "info"
                  ? "bg-blue-500/20 border-blue-500/40 ring-1 ring-blue-500/30"
                  : "bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/15"
              )}
            >
              <Info className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] font-semibold text-blue-400">{infoCount}</span>
            </button>
          )}
          {alerts.length > 0 && (
            <button
              onClick={clearAlerts}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors ml-1"
              title="Clear all alerts"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-secondary/30 flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {alerts.length === 0 ? "No alerts yet" : "No matching alerts"}
            </p>
            <p className="text-[10px] text-muted-foreground text-center px-6">
              {alerts.length === 0
                ? "Alerts fire when unusual player trading activity is detected"
                : "Try changing the severity filter"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((alert) => (
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
