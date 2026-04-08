"use client";

import { useState } from "react";
import { Settings, Bell, ChevronDown, X, Check } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

interface HeaderProps {
  userSlug: string;
  onUserChange?: (newSlug: string) => Promise<void>;
}

export function Header({ userSlug, onUserChange }: HeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [slugInput, setSlugInput] = useState(userSlug);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onUserChange || slugInput.trim() === userSlug) {
      setSettingsOpen(false);
      return;
    }
    setSaving(true);
    await onUserChange(slugInput.trim());
    setSaving(false);
    setSettingsOpen(false);
  };

  return (
    <header className="flex items-center justify-between px-3 py-2 md:px-6 md:py-4 border-b border-zinc-800">
      <h1 className="text-base md:text-xl font-bold text-white">YumaBot</h1>

      <div className="flex items-center gap-2 md:gap-3">
        <Dialog.Root open={settingsOpen} onOpenChange={(open) => { setSettingsOpen(open); if (open) setSlugInput(userSlug); }}>
          <Dialog.Trigger asChild>
            <button className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
            <Dialog.Content className="fixed inset-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:w-[400px] bg-zinc-900 md:border md:border-zinc-700 md:rounded-xl shadow-2xl z-50 p-6 focus:outline-none">
              <Dialog.Title className="text-lg font-bold text-white mb-1">Settings</Dialog.Title>
              <Dialog.Description className="text-sm text-zinc-500 mb-5">Configure your YumaBot preferences</Dialog.Description>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                    Sorare Username
                  </label>
                  <input
                    type="text"
                    value={slugInput}
                    onChange={(e) => setSlugInput(e.target.value)}
                    placeholder="your-sorare-slug"
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  />
                  <p className="text-[11px] text-zinc-600 mt-1.5">
                    Your Sorare username slug (e.g., &quot;ba-zii&quot;). This determines which cards are loaded.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Dialog.Close asChild>
                    <button className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    onClick={handleSave}
                    disabled={saving || slugInput.trim().length === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                    {!saving && <Check className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Dialog.Close asChild>
                <button className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <button className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        <button className="flex items-center gap-2 pl-2 pr-1.5 md:pr-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] md:text-xs font-bold">
            {userSlug.slice(0, 2).toUpperCase()}
          </div>
          <span className="hidden md:inline text-sm font-medium text-white capitalize">
            {userSlug.replace(/-/g, ".")}
          </span>
          <ChevronDown className="hidden md:block w-4 h-4 text-zinc-400" />
        </button>
      </div>
    </header>
  );
}
