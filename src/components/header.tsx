"use client";

import { Settings, Bell, ChevronDown } from "lucide-react";

interface HeaderProps {
  userSlug: string;
}

export function Header({ userSlug }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
      <h1 className="text-xl font-bold text-white">My Cards</h1>

      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
          <Settings className="w-5 h-5" />
        </button>
        <button className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
            {userSlug.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-white capitalize">
            {userSlug.replace("-", ".")}
          </span>
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        </button>
      </div>
    </header>
  );
}
