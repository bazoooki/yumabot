export const CLAN_MEMBERS = [
  { slug: "ba-zii", name: "Ba Zii" },
  { slug: "jose_the_special_one", name: "Jose" },
  { slug: "nimrodel", name: "Nimrodel" },
  { slug: "el-loco-kibuttznik", name: "El Loco" },
  { slug: "mcginnis", name: "McGinnis" },
] as const;

export type ClanMemberSlug = (typeof CLAN_MEMBERS)[number]["slug"];
