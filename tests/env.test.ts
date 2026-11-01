import { describe, expect, it } from "vitest";

import { getToken, parseEnv } from "../src/env";

// Runs fn with DISCORD_TOKEN set (or removed), then restores it.
function withProcessToken<T>(value: string | undefined, fn: () => T): T {
  const saved = process.env.DISCORD_TOKEN;
  if (value === undefined) delete process.env.DISCORD_TOKEN;
  else process.env.DISCORD_TOKEN = value;
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env.DISCORD_TOKEN;
    else process.env.DISCORD_TOKEN = saved;
  }
}

describe("parseEnv", () => {
  it("parses simple key=value lines", () => {
    expect(parseEnv("token=abc\nguild=123")).toEqual({ token: "abc", guild: "123" });
  });

  it("lowercases keys", () => {
    expect(parseEnv("TOKEN=abc")).toEqual({ token: "abc" });
  });

  it("accepts an export prefix", () => {
    expect(parseEnv("export TOKEN=abc")).toEqual({ token: "abc" });
  });

  it("strips matching quotes", () => {
    expect(parseEnv('token="abc"')).toEqual({ token: "abc" });
    expect(parseEnv("token='abc'")).toEqual({ token: "abc" });
  });

  it("keeps spaces and # inside quotes", () => {
    expect(parseEnv('token="a b # c"')).toEqual({ token: "a b # c" });
  });

  it("trims whitespace around keys and values", () => {
    expect(parseEnv("  token =  abc  ")).toEqual({ token: "abc" });
  });

  it("skips comments and blank lines", () => {
    expect(parseEnv("# a comment\n\ntoken=abc\n   \n# another")).toEqual({ token: "abc" });
  });

  it("removes trailing comments from unquoted values", () => {
    expect(parseEnv("token=abc # my bot")).toEqual({ token: "abc" });
  });

  it("keeps = signs inside values", () => {
    expect(parseEnv("token=abc==")).toEqual({ token: "abc==" });
  });

  it("ignores lines without a key", () => {
    expect(parseEnv("=abc\njust text")).toEqual({});
  });

  it("handles Windows line endings", () => {
    expect(parseEnv("token=abc\r\nguild=123\r\n")).toEqual({ token: "abc", guild: "123" });
  });

  it("returns an empty object for empty input", () => {
    expect(parseEnv("")).toEqual({});
  });
});

describe("getToken", () => {
  it("reads token", () => {
    expect(withProcessToken(undefined, () => getToken({ token: "abc" }))).toBe("abc");
  });

  it("falls back to discord_token, then bot_token", () => {
    expect(withProcessToken(undefined, () => getToken({ discord_token: "d" }))).toBe("d");
    expect(withProcessToken(undefined, () => getToken({ bot_token: "b" }))).toBe("b");
  });

  it("prefers token over the other keys", () => {
    const env = { token: "t", discord_token: "d", bot_token: "b" };
    expect(withProcessToken(undefined, () => getToken(env))).toBe("t");
  });

  it("strips a Bot prefix", () => {
    expect(withProcessToken(undefined, () => getToken({ token: "Bot abc" }))).toBe("abc");
    expect(withProcessToken(undefined, () => getToken({ token: "bot abc" }))).toBe("abc");
  });

  it("uses the DISCORD_TOKEN environment variable when .env has none", () => {
    expect(withProcessToken("fromenv", () => getToken({}))).toBe("fromenv");
  });

  it("prefers .env over the environment variable", () => {
    expect(withProcessToken("fromenv", () => getToken({ token: "fromfile" }))).toBe("fromfile");
  });

  it("returns null when there is no token anywhere", () => {
    expect(withProcessToken(undefined, () => getToken({}))).toBeNull();
  });

  it("returns null for an empty token", () => {
    expect(withProcessToken(undefined, () => getToken({ token: "" }))).toBeNull();
    expect(withProcessToken(undefined, () => getToken({ token: "   " }))).toBeNull();
  });
});
