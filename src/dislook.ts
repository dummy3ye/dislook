#!/usr/bin/env -S npx tsx
// dislook: inspect any Discord ID (snowflake).
//
// Offline (always works):
//   creation time, age, unix/discord timestamps, worker/process/increment,
//   binary + hex, day of year, ISO week, compare gaps between several IDs.
//
// Online (needs a bot token in .env):
//   user    -> username, display name, avatar, banner, badges, bot flag, ...
//   channel -> name, type, guild, topic, recipients, ...      (only if the bot can see it)
//   guild   -> name, owner, member counts, boosts, ...        (only if the bot is in it)
//   --guild -> server nickname, roles, join date for a user in that server
//
// .env (in the project root, i.e. where you run this from, or next to this file):
//   token=YOUR_BOT_TOKEN
//   guild=OPTIONAL_DEFAULT_GUILD_ID
//
// Usage:
//   npx tsx dislook.ts <id|url> [more ids...]
//   npx tsx dislook.ts                        interactive mode
//   npx tsx dislook.ts <id> -g <guildId>      add server member info
//   npx tsx dislook.ts <id> -o                offline only, skip API
//   npx tsx dislook.ts <id> -j                JSON output
//
// Needs Node 18+ (global fetch). No dependencies.

import * as readline from "node:readline";

import { CDN, CHANNEL_TYPES, decodeFlags, defaultAvatarIndex, imageUrl } from "./discord";
import { getToken, loadEnv } from "./env";
import { duration, relative, short, tzShort } from "./format";
import { DISCORD_EPOCH, decode, dayOfYear, extractIds, isoWeek, type Decoded } from "./snowflake";

const API = "https://discord.com/api/v10";

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

// ───────────────────────── formatting ─────────────────────────
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

// ───────────────────────── API ─────────────────────────
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

// ───────────────────────── printing ─────────────────────────
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

// ───────────────────────── input ─────────────────────────
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

// ───────────────────────── main ─────────────────────────
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
  console.log(c.dim("\n  paste an ID or Discord link (several = compare). empty line to quit.\n"));

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
