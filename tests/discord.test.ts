import { describe, expect, it } from "vitest";

import { CHANNEL_TYPES, decodeFlags, defaultAvatarIndex, imageUrl } from "../src/discord";

describe("decodeFlags", () => {
  it("returns nothing for no flags", () => {
    expect(decodeFlags(0)).toEqual([]);
  });

  it("decodes a single badge", () => {
    expect(decodeFlags(1 << 22)).toEqual(["Active Developer"]);
    expect(decodeFlags(1 << 9)).toEqual(["Early Supporter"]);
  });

  it("decodes several badges at once", () => {
    expect(decodeFlags((1 << 0) | (1 << 9) | (1 << 22))).toEqual([
      "Discord Staff",
      "Early Supporter",
      "Active Developer",
    ]);
  });

  it("decodes the three HypeSquad houses separately", () => {
    expect(decodeFlags(1 << 6)).toEqual(["HypeSquad Bravery"]);
    expect(decodeFlags(1 << 7)).toEqual(["HypeSquad Brilliance"]);
    expect(decodeFlags(1 << 8)).toEqual(["HypeSquad Balance"]);
  });

  it("ignores bits it does not know", () => {
    expect(decodeFlags(1 << 30)).toEqual([]);
    expect(decodeFlags((1 << 30) | (1 << 22))).toEqual(["Active Developer"]);
  });

  it("copes with missing values", () => {
    expect(decodeFlags(undefined as unknown as number)).toEqual([]);
  });
});

describe("imageUrl", () => {
  it("builds a png URL for normal hashes", () => {
    expect(imageUrl("avatars", "123", "abc")).toBe(
      "https://cdn.discordapp.com/avatars/123/abc.png?size=1024"
    );
  });

  it("uses gif for animated hashes", () => {
    expect(imageUrl("avatars", "123", "a_abc")).toBe(
      "https://cdn.discordapp.com/avatars/123/a_abc.gif?size=1024"
    );
  });

  it("supports banners", () => {
    expect(imageUrl("banners", "123", "abc")).toContain("/banners/123/abc.png");
  });
});

describe("defaultAvatarIndex", () => {
  it("uses the ID for accounts without a discriminator", () => {
    expect(defaultAvatarIndex({ id: "1238848324803494032", discriminator: "0" })).toBe(4);
    expect(defaultAvatarIndex({ id: "1238848324803494032" })).toBe(4);
  });

  it("uses the discriminator for legacy accounts", () => {
    expect(defaultAvatarIndex({ id: "1238848324803494032", discriminator: "1234" })).toBe(4);
    expect(defaultAvatarIndex({ id: "1238848324803494032", discriminator: "0001" })).toBe(1);
    expect(defaultAvatarIndex({ id: "1238848324803494032", discriminator: "0005" })).toBe(0);
  });

  it("always returns an index from 0 to 5", () => {
    for (let i = 0n; i < 50n; i++) {
      const idx = defaultAvatarIndex({ id: String(1206662099582066695n + (i << 22n)) });
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThanOrEqual(5);
    }
  });
});

describe("CHANNEL_TYPES", () => {
  it("names the common channel types", () => {
    expect(CHANNEL_TYPES[0]).toBe("text channel");
    expect(CHANNEL_TYPES[1]).toBe("DM");
    expect(CHANNEL_TYPES[2]).toBe("voice channel");
    expect(CHANNEL_TYPES[15]).toBe("forum");
  });
});
