"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { RoomMessage } from "@/lib/rooms/types";

const ROOM_ID = "clan-chat";

export function ClanChat({ userSlug }: { userSlug: string }) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial messages
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("room_messages")
        .select("*")
        .eq("room_id", ROOM_ID)
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) setMessages(data as RoomMessage[]);
    }
    load();
  }, []);

  // Subscribe to new messages via Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`room-messages-${ROOM_ID}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_messages",
          filter: `room_id=eq.${ROOM_ID}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as RoomMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  async function sendChat() {
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    setIsSending(true);

    await supabase.from("room_messages").insert({
      room_id: ROOM_ID,
      author: userSlug,
      message: text,
      message_type: "chat",
      metadata: {},
    });

    setIsSending(false);
  }

  return (
    <div className="flex flex-col h-full border-l border-border/50 bg-card/30">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <MessageCircle className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-bold text-foreground">Clan Chat</h3>
        {messages.length > 0 && (
          <span className="flex items-center gap-1 ml-auto px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-secondary/30 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              No messages yet. Say hi to your clan!
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id}>
              <p className="text-[10px]">
                <span
                  className={cn(
                    "font-semibold",
                    msg.author === userSlug ? "text-violet-400" : "text-primary"
                  )}
                >
                  {msg.author}
                </span>
                {msg.author === userSlug && (
                  <span className="text-zinc-600 ml-1">(You)</span>
                )}
                <span className="text-zinc-600 ml-1">
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </p>
              <p className="text-[11px] text-zinc-300">{msg.message}</p>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-border/50 shrink-0">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            placeholder="Say something..."
            className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-md px-2 py-1 text-[11px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          <button
            onClick={sendChat}
            disabled={!input.trim() || isSending}
            className="text-primary hover:text-primary/80 disabled:text-zinc-700 transition-colors"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
