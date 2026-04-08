"use client";

import { CLAN_MEMBERS } from "@/lib/clan/members";

export function UserPicker({ onSelect }: { onSelect: (slug: string) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">Welcome to YumaBot</h1>
          <p className="text-sm text-zinc-400">Who are you?</p>
        </div>
        <div className="space-y-2">
          {CLAN_MEMBERS.map((user) => (
            <button
              key={user.slug}
              onClick={() => onSelect(user.slug)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:border-zinc-600 transition-all group"
            >
              <div className="w-9 h-9 rounded-full bg-purple-600/30 text-purple-400 flex items-center justify-center text-sm font-bold">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors">
                  {user.name}
                </div>
                <div className="text-xs text-zinc-500">{user.slug}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
