// Pure text formatting helpers (no colors, no I/O).

export function duration(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < 1000) return `${Math.round(abs)}ms`;
  let s = Math.floor(abs / 1000);
  const units: [string, number][] = [
    ["y", 365 * 86400],
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
    ["s", 1],
  ];
  const parts: string[] = [];
  for (const [name, size] of units) {
    const n = Math.floor(s / size);
    if (n > 0) {
      parts.push(`${n}${name}`);
      s -= n * size;
    }
    if (parts.length === 3) break;
  }
  return parts.join(" ") || "0s";
}

export function relative(ms: number, now = Date.now()): string {
  const diff = now - ms;
  return diff < 0 ? `in ${duration(diff)}` : `${duration(diff)} ago`;
}

export function tzShort(d: Date): string {
  try {
    return (
      new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
        .formatToParts(d)
        .find((p) => p.type === "timeZoneName")?.value ?? ""
    );
  } catch {
    return "";
  }
}

export const short = (id: bigint) => "…" + id.toString().slice(-6);
