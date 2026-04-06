"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const REACTIONS = [
  { emoji: "🔥", label: "fire", bg: "hover:bg-orange-500/20", ring: "ring-orange-500/30" },
  { emoji: "😱", label: "shock", bg: "hover:bg-purple-500/20", ring: "ring-purple-500/30" },
  { emoji: "💀", label: "dead", bg: "hover:bg-zinc-500/20", ring: "ring-zinc-500/30" },
  { emoji: "🎯", label: "target", bg: "hover:bg-red-500/20", ring: "ring-red-500/30" },
  { emoji: "😤", label: "frustrated", bg: "hover:bg-amber-500/20", ring: "ring-amber-500/30" },
  { emoji: "🎉", label: "celebrate", bg: "hover:bg-green-500/20", ring: "ring-green-500/30" },
];

export function Reactions({ roomId, userSlug }: { roomId: string; userSlug: string }) {
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function sendReaction(emoji: string) {
    if (sending) return;
    setSending(true);
    setLastSent(emoji);

    await supabase.from("room_messages").insert({
      room_id: roomId,
      author: userSlug,
      message: emoji,
      message_type: "reaction",
      metadata: {},
    });

    setTimeout(() => {
      setLastSent(null);
      setSending(false);
    }, 500);
  }

  return (
    <div className="px-4 py-3 border-t border-border/50 bg-gradient-to-t from-card to-transparent">
      <div className="flex items-center justify-center gap-2">
        {REACTIONS.map((r) => (
          <button
            key={r.label}
            onClick={() => sendReaction(r.emoji)}
            disabled={sending}
            className={cn(
              "w-11 h-11 text-xl rounded-xl flex items-center justify-center transition-all duration-200",
              "bg-secondary/30 border border-border/50",
              r.bg,
              lastSent === r.emoji && `ring-2 ${r.ring} scale-110`,
              "hover:scale-110 hover:border-border active:scale-95",
              "disabled:opacity-50 disabled:hover:scale-100"
            )}
            title={r.label}
          >
            <span className={cn(
              "transition-transform duration-200",
              lastSent === r.emoji && "animate-bounce"
            )}>
              {r.emoji}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
