import { describe, expect, it } from "vitest";

import { DISCORD_EPOCH, MAX_U64, dayOfYear, decode, extractIds, isoWeek } from "../src/snowflake";

// Builds a snowflake from its parts, the same way Discord does.
function makeSnowflake(ms: number, worker: bigint, proc: bigint, increment: bigint): bigint {
  const ts = BigInt(ms) - DISCORD_EPOCH;
  return (ts << 22n) | (worker << 17n) | (proc << 12n) | increment;
}

// A generated snowflake for tests that need a second ID.
const OTHER = makeSnowflake(Date.UTC(2023, 5, 15, 12, 0, 0), 3n, 7n, 144n);

describe("decode", () => {
  it("decodes a real user ID", () => {
    const d = decode(208265082977648640n);
    expect(d.date.toISOString()).toBe("2016-07-28T16:51:05.160Z");
    expect(d.unixMs).toBe(1469724665160);
    expect(d.worker).toBe(0n);
    expect(d.proc).toBe(0n);
    expect(d.increment).toBe(0n);
  });

  it("decodes a generated ID", () => {
    const d = decode(OTHER);
    expect(d.date.toISOString()).toBe("2023-06-15T12:00:00.000Z");
    expect(d.worker).toBe(3n);
    expect(d.proc).toBe(7n);
    expect(d.increment).toBe(144n);
  });

  it("treats 0 as the Discord epoch", () => {
    const d = decode(0n);
    expect(d.timestampBits).toBe(0n);
    expect(d.unixMs).toBe(1420070400000);
    expect(d.date.toISOString()).toBe("2015-01-01T00:00:00.000Z");
  });

  it("round-trips every field", () => {
    const cases: [number, bigint, bigint, bigint][] = [
      [1707761063238, 2n, 2n, 7n],
      [1420070400000, 0n, 0n, 0n],
      [1893456000000, 31n, 31n, 4095n], // max worker, process, increment
      [1600000000000, 5n, 17n, 1234n],
    ];
    for (const [ms, worker, proc, inc] of cases) {
      const d = decode(makeSnowflake(ms, worker, proc, inc));
      expect(d.unixMs).toBe(ms);
      expect(d.worker).toBe(worker);
      expect(d.proc).toBe(proc);
      expect(d.increment).toBe(inc);
    }
  });

  it("orders IDs by creation time", () => {
    const earlier = makeSnowflake(1600000000000, 0n, 0n, 0n);
    const later = makeSnowflake(1600000000001, 0n, 0n, 0n);
    expect(later > earlier).toBe(true);
  });

  it("keeps IDs from the same millisecond distinct via the increment", () => {
    const a = makeSnowflake(1600000000000, 1n, 1n, 1n);
    const b = makeSnowflake(1600000000000, 1n, 1n, 2n);
    expect(a).not.toBe(b);
    expect(decode(a).unixMs).toBe(decode(b).unixMs);
  });

  it("produces a 64-character binary string", () => {
    expect(decode(1n).binary).toHaveLength(64);
    expect(decode(MAX_U64).binary).toBe("1".repeat(64));
    expect(decode(208265082977648640n).binary).toHaveLength(64);
  });

  it("splits the binary into 42 + 5 + 5 + 12 bits", () => {
    const d = decode(makeSnowflake(1600000000000, 31n, 0n, 1n));
    const bin = d.binary;
    expect(bin.slice(42, 47)).toBe("11111"); // worker
    expect(bin.slice(47, 52)).toBe("00000"); // process
    expect(bin.slice(52)).toBe("000000000001"); // increment
  });
});

describe("dayOfYear", () => {
  it("counts from 1", () => {
    expect(dayOfYear(new Date("2024-01-01T00:00:00Z"))).toBe(1);
    expect(dayOfYear(new Date("2024-02-20T12:00:00Z"))).toBe(51);
  });

  it("handles leap years", () => {
    expect(dayOfYear(new Date("2024-12-31T12:00:00Z"))).toBe(366);
    expect(dayOfYear(new Date("2023-12-31T12:00:00Z"))).toBe(365);
    expect(dayOfYear(new Date("2024-03-01T00:00:00Z"))).toBe(61);
  });
});

describe("isoWeek", () => {
  it("matches known ISO weeks", () => {
    expect(isoWeek(new Date("2024-01-01T00:00:00Z"))).toBe(1);
    expect(isoWeek(new Date("2024-02-20T12:00:00Z"))).toBe(8);
  });

  it("handles year boundaries", () => {
    // 2020 has 53 ISO weeks, and Jan 3 2021 (a Sunday) still belongs to week 53
    expect(isoWeek(new Date("2020-12-31T00:00:00Z"))).toBe(53);
    expect(isoWeek(new Date("2021-01-03T00:00:00Z"))).toBe(53);
    expect(isoWeek(new Date("2021-01-04T00:00:00Z"))).toBe(1);
    // Dec 30 2024 (a Monday) is already week 1 of 2025
    expect(isoWeek(new Date("2024-12-30T00:00:00Z"))).toBe(1);
  });
});

describe("extractIds", () => {
  it("finds a bare ID", () => {
    expect(extractIds("208265082977648640")).toEqual([208265082977648640n]);
  });

  it("finds the ID inside a Discord URL", () => {
    expect(extractIds(`https://discord.com/channels/@me/${OTHER}`)).toEqual([OTHER]);
  });

  it("finds every ID in a server channel link", () => {
    const url = `https://discord.com/channels/208265082977648640/${OTHER}`;
    expect(extractIds(url)).toEqual([208265082977648640n, OTHER]);
  });

  it("finds several IDs separated by spaces or commas", () => {
    expect(extractIds(`208265082977648640, ${OTHER}`)).toHaveLength(2);
  });

  it("ignores numbers that are too short to be snowflakes", () => {
    expect(extractIds("123")).toEqual([]);
    expect(extractIds("12345678901234")).toEqual([]); // 14 digits
  });

  it("ignores text without digits", () => {
    expect(extractIds("")).toEqual([]);
    expect(extractIds("hello @me")).toEqual([]);
  });

  it("accepts the largest 64-bit value and rejects anything above it", () => {
    expect(extractIds("18446744073709551615")).toEqual([MAX_U64]);
    expect(extractIds("18446744073709551616")).toEqual([]);
    expect(extractIds("99999999999999999999")).toEqual([]);
  });
});
