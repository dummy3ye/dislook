import { describe, expect, it } from "vitest";

import { duration, relative, short, tzShort } from "../src/format";

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const YEAR = 365 * DAY;

describe("duration", () => {
  it("shows milliseconds under one second", () => {
    expect(duration(0)).toBe("0ms");
    expect(duration(999)).toBe("999ms");
  });

  it("formats single units", () => {
    expect(duration(SEC)).toBe("1s");
    expect(duration(MIN)).toBe("1m");
    expect(duration(HOUR)).toBe("1h");
    expect(duration(DAY)).toBe("1d");
    expect(duration(YEAR)).toBe("1y");
  });

  it("combines units", () => {
    expect(duration(MIN + SEC)).toBe("1m 1s");
    expect(duration(2 * YEAR + 173 * DAY + 5 * HOUR)).toBe("2y 173d 5h");
  });

  it("shows at most three units", () => {
    expect(duration(DAY + HOUR + MIN + SEC)).toBe("1d 1h 1m");
  });

  it("ignores the sign", () => {
    expect(duration(-HOUR)).toBe(duration(HOUR));
  });

  it("drops sub-second remainders once past one second", () => {
    expect(duration(SEC + 999)).toBe("1s");
  });
});

describe("relative", () => {
  const now = Date.UTC(2026, 0, 1);

  it("says ago for the past", () => {
    expect(relative(now - 3 * HOUR, now)).toBe("3h ago");
  });

  it("says in for the future", () => {
    expect(relative(now + 2 * DAY, now)).toBe("in 2d");
  });

  it("handles the present", () => {
    expect(relative(now, now)).toBe("0ms ago");
  });

  it("defaults to the current time", () => {
    expect(relative(Date.now() - 10 * DAY)).toMatch(/^10d( \d+[hms])* ago$/);
  });
});

describe("short", () => {
  it("keeps the last six digits", () => {
    expect(short(1206662099582066695n)).toBe("…066695");
  });
});

describe("tzShort", () => {
  it("returns a string", () => {
    expect(typeof tzShort(new Date())).toBe("string");
  });
});
