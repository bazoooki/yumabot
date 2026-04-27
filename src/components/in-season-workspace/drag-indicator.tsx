"use client";

import { GripVertical } from "lucide-react";
import type { SorareCard } from "@/lib/types";
import { useWorkspaceStore } from "@/lib/in-season/workspace-store";

interface DragIndicatorProps {
  cardsBySlug: Map<string, SorareCard>;
}

export function DragIndicator({ cardsBySlug }: DragIndicatorProps) {
  const drag = useWorkspaceStore((s) => s.drag);
  if (!drag) return null;
  const card = cardsBySlug.get(drag.cardSlug);
  const name = card?.anyPlayer?.displayName ?? "card";
  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 mono text-[10px] uppercase tracking-wider text-pink-300 bg-zinc-950 border border-pink-500/40 rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2 pointer-events-none">
      <GripVertical className="w-3 h-3" />
      Dragging <span className="font-bold text-pink-200">{name}</span>
      <span className="text-zinc-500">
        → drop on a slot, or back to pool to remove
      </span>
    </div>
  );
}
