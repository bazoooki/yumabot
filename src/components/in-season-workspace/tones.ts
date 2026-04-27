// Per-competition / per-team color tokens. Mirrors the mock's `TONE` palette
// (in-season.jsx:5-12) so the workspace UI stays visually identical.

export type ToneKey =
  | "emerald"
  | "sky"
  | "pink"
  | "amber"
  | "cyan"
  | "violet";

export interface ToneClasses {
  bg: string; // soft fill
  text: string;
  border: string;
  bar: string; // strong fill (the colored side rail / dot)
  soft: string; // even softer fill, used for hover backgrounds
}

export const TONE: Record<ToneKey, ToneClasses> = {
  emerald: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    bar: "bg-emerald-500",
    soft: "bg-emerald-500/10",
  },
  sky: {
    bg: "bg-sky-500/15",
    text: "text-sky-400",
    border: "border-sky-500/30",
    bar: "bg-sky-500",
    soft: "bg-sky-500/10",
  },
  pink: {
    bg: "bg-pink-500/15",
    text: "text-pink-400",
    border: "border-pink-500/30",
    bar: "bg-pink-500",
    soft: "bg-pink-500/10",
  },
  amber: {
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    border: "border-amber-500/30",
    bar: "bg-amber-500",
    soft: "bg-amber-500/10",
  },
  cyan: {
    bg: "bg-cyan-500/15",
    text: "text-cyan-400",
    border: "border-cyan-500/30",
    bar: "bg-cyan-500",
    soft: "bg-cyan-500/10",
  },
  violet: {
    bg: "bg-violet-500/15",
    text: "text-violet-400",
    border: "border-violet-500/30",
    bar: "bg-violet-500",
    soft: "bg-violet-500/10",
  },
};

export const TEAM_TONES: ReadonlyArray<ToneKey> = [
  "pink",
  "cyan",
  "emerald",
  "amber",
];

const ALL_TONES: ReadonlyArray<ToneKey> = [
  "emerald",
  "sky",
  "pink",
  "amber",
  "cyan",
  "violet",
];

// Stable per-slug color so each league reads consistent across the session.
export function toneForSlug(slug: string): ToneKey {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  }
  return ALL_TONES[Math.abs(hash) % ALL_TONES.length];
}
