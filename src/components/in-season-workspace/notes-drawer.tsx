"use client";

import { useState } from "react";
import { StickyNote, ChevronDown } from "lucide-react";
import { useWorkspaceStore } from "@/lib/in-season/workspace-store";
import { cn } from "@/lib/utils";

export function NotesDrawer() {
  const notes = useWorkspaceStore((s) => s.notes);
  const setNotes = useWorkspaceStore((s) => s.setNotes);
  const [open, setOpen] = useState(false);
  const hasNotes = notes.trim().length > 0;

  return (
    <div className="border-b border-zinc-800/80 bg-zinc-950/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-1.5 flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <StickyNote className="w-3.5 h-3.5" />
        <span className="mono text-[10px] uppercase tracking-wider">Notes</span>
        {hasNotes && (
          <span className="mono text-[9px] text-zinc-500 normal-case">
            · {notes.trim().split(/\s+/).length} words
          </span>
        )}
        <ChevronDown
          className={cn(
            "w-3 h-3 ml-auto transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="px-4 pb-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Free-text notes — share strategy, captain rationale, swap ideas. Saved with the draft."
            className="w-full bg-zinc-900/60 border border-zinc-800 rounded-md px-2 py-2 text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 resize-y min-h-[60px]"
          />
        </div>
      )}
    </div>
  );
}
