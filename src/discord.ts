// Static Discord knowledge: badges, channel types, CDN URLs.

export const CDN = "https://cdn.discordapp.com";

export const USER_FLAGS: [number, string][] = [
  [0, "Discord Staff"],
  [1, "Partnered Server Owner"],
  [2, "HypeSquad Events"],
  [3, "Bug Hunter (Level 1)"],
  [6, "HypeSquad Bravery"],
  [7, "HypeSquad Brilliance"],
  [8, "HypeSquad Balance"],
  [9, "Early Supporter"],
  [10, "Team User"],
  [14, "Bug Hunter (Level 2)"],
  [16, "Verified Bot"],
  [17, "Early Verified Bot Developer"],
  [18, "Moderator Programs Alumni"],
  [19, "Bot (HTTP interactions)"],
  [22, "Active Developer"],
];

export function decodeFlags(flags: number): string[] {
  const big = BigInt(flags ?? 0);
  return USER_FLAGS.filter(([bit]) => (big >> BigInt(bit)) & 1n).map(([, name]) => name);
}

export const CHANNEL_TYPES: Record<number, string> = {
  0: "text channel",
  1: "DM",
  2: "voice channel",
  3: "group DM",
  4: "category",
  5: "announcement channel",
  10: "announcement thread",
  11: "public thread",
  12: "private thread",
  13: "stage channel",
  14: "directory",
  15: "forum",
  16: "media channel",
};

export function imageUrl(kind: "avatars" | "banners", id: string, hash: string): string {
  const ext = hash.startsWith("a_") ? "gif" : "png";
  return `${CDN}/${kind}/${id}/${hash}.${ext}?size=1024`;
}

export function defaultAvatarIndex(user: any): number {
  if (user.discriminator && user.discriminator !== "0") {
    return Number(user.discriminator) % 5;
  }
  return Number((BigInt(user.id) >> 22n) % 6n);
}
