"use client";

import { PowerRankingsSection } from "@/components/results/power-rankings-section";

export default function PowerRankPage() {
  return (
    <div className="page-enter flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        <PowerRankingsSection gameWeek={null} />
      </div>
    </div>
  );
}
