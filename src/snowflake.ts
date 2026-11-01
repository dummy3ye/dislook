// Pure snowflake logic: no I/O, no side effects.

export const DISCORD_EPOCH = 1420070400000n;
export const MAX_U64 = (1n << 64n) - 1n;

export interface Decoded {
  id: bigint;
  timestampBits: bigint;
  unixMs: number;
  date: Date;
  worker: bigint;
  proc: bigint;
  increment: bigint;
  binary: string;
}

export function decode(id: bigint): Decoded {
  const timestampBits = id >> 22n;
  const unixMs = Number(timestampBits + DISCORD_EPOCH);
  return {
    id,
    timestampBits,
    unixMs,
    date: new Date(unixMs),
    worker: (id & 0x3e0000n) >> 17n,
    proc: (id & 0x1f000n) >> 12n,
    increment: id & 0xfffn,
    binary: id.toString(2).padStart(64, "0"),
  };
}

export function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d.getTime() - start) / 86400000);
}

export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
}

// Accepts bare IDs or anything containing them (e.g. a pasted Discord URL).
export function extractIds(input: string): bigint[] {
  const out: bigint[] = [];
  for (const m of input.match(/\d{15,20}/g) ?? []) {
    const n = BigInt(m);
    if (n <= MAX_U64) out.push(n);
  }
  return out;
}
