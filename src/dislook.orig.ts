#!/usr/bin/env node

// dislook: inspect any Discord ID snowflake.
//
// offline :
//   creation time, age, unix/discord timestamps, worker/process/increment,
//   binary + hex, day of year, ISO week, compare gaps between several ids.
//
// Online :
//   user    -> username, display name, avatar, banner, badges, bot flag, ...
//   channel -> name, type, guild, topic, recipients, ...      (only if the bot can see it)
//   guild   -> name, owner, member counts, boosts, ...        (only if the bot is in it)
//   --guild -> server nickname, roles, join date for a user in that server
//
// .env ( i.e. where you run this from, or next to this file):
//   token=YOUR_BOT_TOKEN
//   guild=OPTIONAL_DEFAULT_GUILD_ID
//

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";

const DISCORD_EPOCH = 1420070400000n;
const MAX_U64 = (1n << 64n) - 1n;
const API = "https://discord.com/api/v10";
const CDN = "https://cdn.discordapp.com";

// ───────────────────────── colors ─────────────────────────
let useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint =
  (code: string) =>
  (s: string | number | bigint): string =>
    useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s);

const c = {
  dim: paint("2"),
  bold: paint("1"),
  red: paint("31"),
  green: paint("32"),
  yellow: paint("33"),
  blue: paint("34"),
  magenta: paint("35"),
  cyan: paint("36"),
};

// .env
function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line
      .slice(0, eq)
      .replace(/^export\s+/, "")
      .trim()
      .toLowerCase();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    } else {
      val = val.replace(/\s+#.*$/, ""); // trailing comment
    }
    out[key] = val;
  }
  return out;
}

function loadEnv(): Record<string, string> {
  const dirs = [process.cwd()];
  if (process.argv[1]) dirs.push(path.dirname(path.resolve(process.argv[1])));
  for (const dir of dirs) {
    const file = path.join(dir, ".env");
    try {
      if (fs.existsSync(file)) return parseEnv(fs.readFileSync(file, "utf8"));
    } catch {
      /* try next */
    }
  }
  return {};
}

function getToken(env: Record<string, string>): string | null {
  const t = env.token ?? env.discord_token ?? env.bot_token ?? process.env.DISCORD_TOKEN ?? "";
  const clean = t.replace(/^bot\s+/i, "").trim();
  return clean || null;
}

// snowflake
interface Decoded {
  id: bigint;
  timestampBits: bigint;
  unixMs: number;
  date: Date;
  worker: bigint;
  proc: bigint;
  increment: bigint;
  binary: string;
}

function decode(id: bigint): Decoded {
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

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d.getTime() - start) / 86400000);
}

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
}

// formatting
function duration(ms: number): string {
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

function relative(ms: number): string {
  const diff = Date.now() - ms;
  return diff < 0 ? `in ${duration(diff)}` : `${duration(diff)} ago`;
}

function tzShort(d: Date): string {
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

const LABEL_WIDTH = 14;
const row = (label: string, value: string) =>
  console.log(`  ${c.dim(label.padEnd(LABEL_WIDTH))}${value}`);

function coloredBinary(bin: string): string {
  return [
    c.cyan(bin.slice(0, 42)),
    c.green(bin.slice(42, 47)),
    c.yellow(bin.slice(47, 52)),
    c.magenta(bin.slice(52, 64)),
  ].join(" ");
}

const short = (id: bigint) => "…" + id.toString().slice(-6);

// dc data
const USER_FLAGS: [number, string][] = [
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

function decodeFlags(flags: number): string[] {
  const big = BigInt(flags ?? 0);
  return USER_FLAGS.filter(([bit]) => (big >> BigInt(bit)) & 1n).map(([, name]) => name);
}

const CHANNEL_TYPES: Record<number, string> = {
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

function imageUrl(kind: "avatars" | "banners", id: string, hash: string): string {
  const ext = hash.startsWith("a_") ? "gif" : "png";
  return `${CDN}/${kind}/${id}/${hash}.${ext}?size=1024`;
}

function defaultAvatarIndex(user: any): number {
  if (user.discriminator && user.discriminator !== "0") {
    return Number(user.discriminator) % 5;
  }
  return Number((BigInt(user.id) >> 22n) % 6n);
}

// api
interface ApiResult {
  status: number;
  data: any;
}

async function api(route: string, token: string): Promise<ApiResult> {
  const res = await fetch(API + route, {
    headers: {
      Authorization: `Bot ${token}`,
      "User-Agent": "dislook (personal snowflake inspector)",
    },
    signal: AbortSignal.timeout(10000),
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, data };
}

type Lookup =
  | { kind: "user"; data: any; member?: any }
  | { kind: "channel"; data: any }
  | { kind: "guild"; data: any }
  | { kind: "none" }
  | { kind: "error"; message: string };

function fatal(res: ApiResult): string | null {
  if (res.status === 401) return "token was rejected by Discord (401), check your .env";
  if (res.status === 429) {
    const wait = res.data?.retry_after;
    return `rate limited${wait ? `, retry in ${Math.ceil(wait)}s` : ""}`;
  }
  if (res.status >= 500) return `Discord API error (${res.status})`;
  return null;
}

async function lookup(id: bigint, token: string, guildId: string | null): Promise<Lookup> {
  try {
    const user = await api(`/users/${id}`, token);
    if (user.status === 200) {
      let member: any;
      if (guildId) {
        const m = await api(`/guilds/${guildId}/members/${id}`, token);
        if (m.status === 200) member = m.data;
      }
      return { kind: "user", data: user.data, member };
    }
    const e1 = fatal(user);
    if (e1) return { kind: "error", message: e1 };

    const ch = await api(`/channels/${id}`, token);
    if (ch.status === 200) return { kind: "channel", data: ch.data };
    const e2 = fatal(ch);
    if (e2) return { kind: "error", message: e2 };

    const g = await api(`/guilds/${id}?with_counts=true`, token);
    if (g.status === 200) return { kind: "guild", data: g.data };
    const e3 = fatal(g);
    if (e3) return { kind: "error", message: e3 };

    return { kind: "none" };
  } catch (err: any) {
    return { kind: "error", message: `request failed: ${err?.message ?? err}` };
  }
}

// printing
function showDecoded(d: Decoded): void {
  const valid = !Number.isNaN(d.date.getTime());
  const unixSec = Math.floor(d.unixMs / 1000);

  console.log();
  console.log(`  ${c.bold(d.id.toString())}`);
  console.log();

  if (valid) {
    row("created", c.cyan(d.date.toISOString()));
    row(
      "local time",
      d.date.toLocaleString(undefined, { dateStyle: "full", timeStyle: "medium" }) +
        c.dim(`  (${tzShort(d.date)})`)
    );
    row("age", relative(d.unixMs));
    row("unix", `${unixSec}${c.dim(`  (${d.unixMs} ms)`)}`);
    row("discord tag", c.dim(`<t:${unixSec}:F>`));
    row(
      "calendar",
      c.dim(`day ${dayOfYear(d.date)} of ${d.date.getUTCFullYear()}, ISO week ${isoWeek(d.date)}`)
    );
    row("since epoch", c.dim(`day ${d.timestampBits / 86400000n} of Discord`));
  }

  console.log();
  row("worker id", c.green(d.worker.toString()));
  row("process id", c.yellow(d.proc.toString()));
  row("increment", c.magenta(d.increment.toString()));
  row("ts offset", `${d.timestampBits}${c.dim("  ms since 2015-01-01")}`);

  console.log();
  row("binary", coloredBinary(d.binary));
  row("", c.dim("timestamp(42) worker(5) process(5) increment(12)"));
  row("hex", "0x" + d.id.toString(16));
  row("mention", c.dim(`<@${d.id}>  <#${d.id}>  <@&${d.id}>`));

  const notes: string[] = [];
  if (d.timestampBits === 0n) {
    notes.push("timestamp is zero, probably not a real snowflake");
  } else if (valid && d.unixMs > Date.now()) {
    notes.push("timestamp is in the future, probably not a real snowflake");
  } else if (valid && d.unixMs < Number(DISCORD_EPOCH) + 30 * 86400000) {
    notes.push("extremely early date, probably not a real snowflake");
  }
  for (const n of notes) {
    console.log();
    console.log(`  ${c.red("!")} ${c.red(n)}`);
  }
}

function showUser(u: any, member?: any): void {
  const badges = decodeFlags(u.public_flags ?? u.flags ?? 0);
  const kind = u.bot ? "user (bot)" : u.system ? "user (system)" : "user";

  console.log();
  row("type", c.blue(kind));
  row(
    "username",
    c.bold(u.username) +
      (u.discriminator && u.discriminator !== "0" ? c.dim(`#${u.discriminator}`) : "")
  );
  if (u.global_name) row("display name", u.global_name);

  const avatar = u.avatar
    ? imageUrl("avatars", u.id, u.avatar)
    : `${CDN}/embed/avatars/${defaultAvatarIndex(u)}.png`;
  row("avatar", c.dim(avatar) + (u.avatar ? "" : c.dim("  (default)")));
  if (u.banner) row("banner", c.dim(imageUrl("banners", u.id, u.banner)));
  if (typeof u.accent_color === "number") {
    row("accent color", "#" + u.accent_color.toString(16).padStart(6, "0"));
  }
  if (u.avatar_decoration_data?.asset) {
    row("decoration", c.dim(u.avatar_decoration_data.asset));
  }
  const tag = u.primary_guild?.tag ?? u.clan?.tag;
  if (tag) row("server tag", tag);

  row("badges", badges.length ? badges.join(", ") : c.dim("none"));
  row("flags", c.dim(String(u.public_flags ?? u.flags ?? 0)));

  if (member) {
    console.log();
    row("in server", c.blue("member"));
    if (member.nick) row("nickname", member.nick);
    row(
      "joined",
      member.joined_at
        ? `${member.joined_at}${c.dim(`  (${relative(Date.parse(member.joined_at))})`)}`
        : c.dim("unknown")
    );
    if (member.premium_since) row("boosting since", member.premium_since);
    if (member.communication_disabled_until) {
      row("timeout until", c.yellow(member.communication_disabled_until));
    }
    row("roles", String(member.roles?.length ?? 0));
    if (member.roles?.length) row("", c.dim(member.roles.join(" ")));
    if (member.avatar) row("server avatar", c.dim(member.avatar));
  }
}

function showChannel(ch: any): void {
  console.log();
  row("type", c.blue(CHANNEL_TYPES[ch.type] ?? `channel (type ${ch.type})`));
  if (ch.name) row("name", c.bold(ch.name));
  if (ch.guild_id) {
    row("guild id", ch.guild_id);
    row("link", c.dim(`https://discord.com/channels/${ch.guild_id}/${ch.id}`));
  }
  if (ch.parent_id) row("parent id", ch.parent_id);
  if (ch.topic) row("topic", ch.topic);
  if (typeof ch.nsfw === "boolean") row("nsfw", ch.nsfw ? c.yellow("yes") : "no");
  if (ch.owner_id) row("owner id", ch.owner_id);
  if (Array.isArray(ch.recipients) && ch.recipients.length) {
    row("recipients", ch.recipients.map((r: any) => r.global_name ?? r.username).join(", "));
  }
  if (ch.last_message_id) {
    const lm = decode(BigInt(ch.last_message_id));
    row("last message", `${lm.date.toISOString()}${c.dim(`  (${relative(lm.unixMs)})`)}`);
  }
}

function showGuild(g: any): void {
  console.log();
  row("type", c.blue("server"));
  row("name", c.bold(g.name));
  if (g.description) row("description", g.description);
  row("owner id", g.owner_id);
  if (g.approximate_member_count != null) {
    row(
      "members",
      `${g.approximate_member_count}${
        g.approximate_presence_count != null
          ? c.dim(`  (${g.approximate_presence_count} online)`)
          : ""
      }`
    );
  }
  row(
    "boosts",
    `tier ${g.premium_tier ?? 0}${c.dim(`  (${g.premium_subscription_count ?? 0} boosts)`)}`
  );
  if (g.vanity_url_code) row("vanity url", c.dim(`discord.gg/${g.vanity_url_code}`));
  if (g.features?.length) row("features", c.dim(g.features.join(", ")));
}

function showLookup(l: Lookup): void {
  switch (l.kind) {
    case "user":
      return showUser(l.data, l.member);
    case "channel":
      return showChannel(l.data);
    case "guild":
      return showGuild(l.data);
    case "none":
      console.log();
      console.log(
        `  ${c.dim("api")}  ${c.dim("not a user, and no visible channel or server (could be a message, role, or something the bot can't see)")}`
      );
      return;
    case "error":
      console.log();
      console.log(`  ${c.red("api")}  ${c.red(l.message)}`);
      return;
  }
}

function showCompare(decoded: Decoded[]): void {
  console.log();
  console.log(`  ${c.bold("compare")}`);
  console.log();
  for (let i = 0; i < decoded.length - 1; i++) {
    const a = decoded[i];
    const b = decoded[i + 1];
    const diff = b.unixMs - a.unixMs;
    const label = `${short(a.id)} → ${short(b.id)}`;
    const text =
      diff === 0
        ? c.dim("same millisecond")
        : diff > 0
          ? `${c.cyan(duration(diff))} ${c.dim("later")}`
          : `${c.cyan(duration(diff))} ${c.dim("earlier")}`;
    row(label, text);
  }
  if (decoded.length > 2) {
    const times = decoded.map((d) => d.unixMs);
    row("total span", duration(Math.max(...times) - Math.min(...times)));
  }
}

// input
function extractIds(input: string): bigint[] {
  const out: bigint[] = [];
  for (const m of input.match(/\d{15,20}/g) ?? []) {
    const n = BigInt(m);
    if (n <= MAX_U64) out.push(n);
  }
  return out;
}

interface Ctx {
  token: string | null;
  guild: string | null;
  offline: boolean;
  json: boolean;
}

async function run(ids: bigint[], ctx: Ctx): Promise<any[]> {
  const results: any[] = [];
  const decoded: Decoded[] = [];
  const online = Boolean(ctx.token) && !ctx.offline;

  for (const id of ids) {
    const d = decode(id);
    decoded.push(d);
    const l: Lookup | null = online ? await lookup(id, ctx.token!, ctx.guild) : null;

    if (ctx.json) {
      results.push({
        id: id.toString(),
        created: Number.isNaN(d.date.getTime()) ? null : d.date.toISOString(),
        unix_ms: d.unixMs,
        worker: Number(d.worker),
        process: Number(d.proc),
        increment: Number(d.increment),
        day_of_year: dayOfYear(d.date),
        iso_week: isoWeek(d.date),
        lookup:
          l && l.kind !== "none" && l.kind !== "error"
            ? { kind: l.kind, data: l.data, member: (l as any).member }
            : l,
      });
    } else {
      showDecoded(d);
      if (l) showLookup(l);
    }
  }

  if (!ctx.json && decoded.length > 1) showCompare(decoded);
  if (!ctx.json) console.log();
  return results;
}

// main
function help(): void {
  console.log(`
  ${c.bold("dislook")} ${c.dim("inspect Discord IDs")}

  usage
    dislook.ts <id|url> [more ids...]    ${c.dim("several IDs also get compared")}
    dislook.ts                           ${c.dim("interactive mode")}

  options
    -g, --guild <id>   add server member info for users
    -o, --offline      skip the API, decode only
    -j, --json         JSON output
    -h, --help         this help

  .env ${c.dim("(project root)")}
    token=YOUR_BOT_TOKEN
    guild=OPTIONAL_DEFAULT_GUILD_ID
`);
}

async function main(): Promise<void> {
  const env = loadEnv();
  const ctx: Ctx = {
    token: getToken(env),
    guild: env.guild?.replace(/\D/g, "") || null,
    offline: false,
    json: false,
  };

  const inputs: string[] = [];
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-h" || a === "--help") return help();
    else if (a === "-o" || a === "--offline") ctx.offline = true;
    else if (a === "-j" || a === "--json") {
      ctx.json = true;
      useColor = false;
    } else if (a === "-g" || a === "--guild")
      ctx.guild = (args[++i] ?? "").replace(/\D/g, "") || null;
    else if (a.startsWith("--guild=")) ctx.guild = a.slice(8).replace(/\D/g, "") || null;
    else inputs.push(a);
  }

  if (!ctx.token && !ctx.offline && !ctx.json) {
    console.log(c.dim("\n  no token found in .env (token=...), running offline"));
  }

  if (inputs.length > 0) {
    const ids = extractIds(inputs.join(" "));
    if (ids.length === 0) {
      console.log(`\n  ${c.red("no valid ID found")} ${c.dim("(expecting 15 to 20 digits)")}\n`);
      process.exitCode = 1;
      return;
    }
    const results = await run(ids, ctx);
    if (ctx.json) console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
    return;
  }

  // interactive
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const prompt = `${c.cyan("id")} ${c.dim("›")} `;
  console.log(c.dim("\n  paste yo id. empty line to quit.\n"));

  const ask = () =>
    rl.question(prompt, async (line) => {
      if (!line.trim()) return rl.close();
      const ids = extractIds(line);
      if (ids.length === 0) {
        console.log(`\n  ${c.red("no valid ID found")} ${c.dim("(expecting 15 to 20 digits)")}\n`);
      } else {
        await run(ids, ctx);
      }
      ask();
    });
  rl.on("close", () => process.exit(0));
  ask();
}

main().catch((err) => {
  console.error(c.red(`\n  ${err?.message ?? err}\n`));
  process.exit(1);
});
