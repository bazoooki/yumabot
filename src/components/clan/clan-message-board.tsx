"use client";

import { useEffect, useRef, useState } from "react";
import {
  Megaphone,
  Search,
  HelpCircle,
  ArrowRightLeft,
  MessageSquarePlus,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { CLAN_MEMBERS } from "@/lib/clan/members";
import type { RoomMessage } from "@/lib/rooms/types";

const ROOM_ID = "clan-board";

type PostType = "need_card" | "lineup_help" | "trade_offer" | "general";

const POST_TYPES: { value: PostType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "need_card", label: "Need a Card", icon: <Search className="w-3.5 h-3.5" />, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { value: "lineup_help", label: "Lineup Help", icon: <HelpCircle className="w-3.5 h-3.5" />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  { value: "trade_offer", label: "Trade Offer", icon: <ArrowRightLeft className="w-3.5 h-3.5" />, color: "text-green-400 bg-green-500/10 border-green-500/20" },
  { value: "general", label: "General", icon: <Megaphone className="w-3.5 h-3.5" />, color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20" },
];

function getPostType(msg: RoomMessage): PostType {
  const meta = msg.metadata as Record<string, unknown> | null;
  return (meta?.postType as PostType) ?? "general";
}

function getMemberName(slug: string): string {
  return CLAN_MEMBERS.find((m) => m.slug === slug)?.name ?? slug;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function PostCard({
  msg,
  userSlug,
}: {
  msg: RoomMessage;
  userSlug: string;
}) {
  const postType = getPostType(msg);
  const config = POST_TYPES.find((t) => t.value === postType) ?? POST_TYPES[3];
  const isYou = msg.author === userSlug;

  return (
    <div className="rounded-lg border border-border/40 bg-card/40 p-3 space-y-2 hover:border-border/60 transition-colors">
      {/* Header: type badge + author + time */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border",
            config.color,
          )}
        >
          {config.icon}
          {config.label}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <div
            className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold",
              isYou ? "bg-violet-500/30 text-violet-300" : "bg-secondary/50 text-muted-foreground",
            )}
          >
            {getMemberName(msg.author).slice(0, 2).toUpperCase()}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {getMemberName(msg.author)}
            {isYou && <span className="text-violet-400 ml-0.5">(You)</span>}
          </span>
        </span>
      </div>

      {/* Message body */}
      <p className="text-xs text-foreground leading-relaxed">{msg.message}</p>

      {/* Footer */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground/60">{timeAgo(msg.created_at)}</span>
      </div>
    </div>
  );
}

export function ClanMessageBoard({ userSlug }: { userSlug: string }) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [input, setInput] = useState("");
  const [postType, setPostType] = useState<PostType>("general");
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial messages
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("room_messages")
        .select("*")
        .eq("room_id", ROOM_ID)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setMessages((data as RoomMessage[]).reverse());
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
        },
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

  async function sendPost() {
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    setIsSending(true);

    await supabase.from("room_messages").insert({
      room_id: ROOM_ID,
      author: userSlug,
      message: text,
      message_type: "chat",
      metadata: { postType },
    });

    setIsSending(false);
    setPostType("general");
  }

  const selectedType = POST_TYPES.find((t) => t.value === postType) ?? POST_TYPES[3];

  return (
    <div className="flex flex-col h-full border-l border-border/50 bg-card/20">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Megaphone className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-bold text-foreground">Message Board</h3>
        {messages.length > 0 && (
          <span className="flex items-center gap-1 ml-auto px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-[10px] font-medium">
            {messages.length} post{messages.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-secondary/30 flex items-center justify-center">
              <Megaphone className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-[200px]">
              No posts yet. Ask for help with a lineup, request a missing card, or offer a trade!
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <PostCard key={msg.id} msg={msg} userSlug={userSlug} />
          ))
        )}
      </div>

      {/* Compose */}
      <div className="px-3 py-3 border-t border-border/50 shrink-0 space-y-2">
        {/* Type picker */}
        <div className="relative">
          <button
            onClick={() => setShowTypePicker(!showTypePicker)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold transition-colors",
              selectedType.color,
            )}
          >
            {selectedType.icon}
            {selectedType.label}
            <ChevronDown className="w-3 h-3 ml-0.5" />
          </button>
          {showTypePicker && (
            <div className="absolute bottom-full left-0 mb-1 bg-zinc-900 border border-border/50 rounded-lg shadow-xl p-1 z-10">
              {POST_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => {
                    setPostType(t.value);
                    setShowTypePicker(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-1.5 rounded text-[11px] font-medium text-left transition-colors",
                    postType === t.value
                      ? "bg-secondary/40 text-foreground"
                      : "text-muted-foreground hover:bg-secondary/20 hover:text-foreground",
                  )}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex items-start gap-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendPost();
              }
            }}
            placeholder="Post to the board..."
            rows={2}
            className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 resize-none"
          />
          <button
            onClick={sendPost}
            disabled={!input.trim() || isSending}
            className={cn(
              "mt-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1",
              input.trim()
                ? "bg-violet-500 text-white hover:bg-violet-600"
                : "bg-zinc-800 text-zinc-600",
            )}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
