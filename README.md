# dislook

[![CI](https://img.shields.io/github/actions/workflow/status/dummy3ye/dislook/ci.yml?label=CI&style=flat-square)](https://github.com/dummy3ye/dislook/actions/workflows/ci.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/dummy3ye/dislook/codeql.yml?label=CodeQL&style=flat-square)](https://github.com/dummy3ye/dislook/actions/workflows/codeql.yml)
[![Release](https://img.shields.io/github/actions/workflow/status/dummy3ye/dislook/release.yml?label=Release&style=flat-square)](https://github.com/dummy3ye/dislook/actions/workflows/release.yml)
[![npm version](https://img.shields.io/npm/v/dislook?style=flat-square)](https://www.npmjs.com/package/dislook)
[![node](https://img.shields.io/node/v/dislook?style=flat-square)](package.json)
[![license](https://img.shields.io/npm/l/dislook?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org)
[![tested with vitest](https://img.shields.io/badge/tested%20with-vitest-6e9f18?logo=vitest&logoColor=white&style=flat-square)](https://vitest.dev)
[![code style: prettier](https://img.shields.io/badge/code%20style-prettier-ff69b4?logo=prettier&logoColor=white&style=flat-square)](https://prettier.io)
[![last commit](https://img.shields.io/github/last-commit/dummy3ye/dislook?style=flat-square)](https://github.com/dummy3ye/dislook/commits)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/dummy3ye/dislook/pulls)
<!--[![stars](https://img.shields.io/github/stars/dummy3ye/dislook?style=flat)](https://github.com/dummy3ye/dislook/stargazers)-->
<!--[![issues](https://img.shields.io/github/issues/dummy3ye/dislook)](https://github.com/dummy3ye/dislook/issues)-->
<!--[![install size](https://packagephobia.com/badge?p=dislook)](https://packagephobia.com/result?p=dislook)-->

Inspect any Discord id, dm, channel from your terminal.

Paste a user, channel, server, or message ID (or a whole Discord link) and see everything that can be known about it:

- when it was created
- how old it is
- what's inside the snowflake

### with a bot token:

- the name
- avatar
- badges
- and more behind it.

## Install

Run it without installing:

```bash
npx dislook 208265082977648640
```

Or install it globally:

```bash
npm i -g dislook
dislook 208265082977648640
```

Requires Node.js 18 or newer. There are no runtime dependencies.

## Usage

```bash
dislook <id|url> [more ids...]
dislook                          # interactive mode
```

| Option               | What it does                                                  |
| -------------------- | ------------------------------------------------------------- |
| `-g`, `--guild <id>` | Add server member info (nickname, roles, join date) for users |
| `-o`, `--offline`    | Skip the Discord API and only decode the ID                   |
| `-j`, `--json`       | Print JSON instead of formatted text                          |
| `-h`, `--help`       | Show help                                                     |

Pass a bare ID, or anything that contains one. A pasted link like `https://discord.com/channels/@me/208265082977648640` works too, and the ID is extracted for you.

Run `dislook` with no arguments to enter interactive mode, then paste IDs one after another. An empty line quits.

### Comparing IDs

Give it more than one ID and it also prints how far apart they were created:

```bash
dislook <your_user_id> <friend_user_id> <dm_channel_id>
```

You get the gap between each consecutive pair and the total span, which is handy for questions like "how long after I joined did we open this DM?"

## What you get

### Offline, always

| Field                        | Meaning                                             |
| ---------------------------- | --------------------------------------------------- |
| created                      | Exact creation time in UTC, plus your local time    |
| age                          | How long ago that was                               |
| unix / discord tag           | Unix timestamp and a ready-to-paste `<t:...:F>` tag |
| calendar                     | Day of the year and ISO week                        |
| worker / process / increment | The internal parts of the snowflake                 |
| binary / hex                 | The raw value, with the four sections color-coded   |
| mention                      | The `<@id>`, `<#id>`, and `<@&id>` formats          |

IDs with a zero, future, or implausibly early timestamp get a warning, since they are probably not real snowflakes.

### Online, with a bot token

dislook tries the ID as a **user** first, then a **channel**, then a **server**, and shows the first match.

- **User:** username, display name, avatar and banner links, accent color, server tag, bot flag, and decoded badges such as Early Supporter, HypeSquad, and Active Developer
- **Channel:** type, name, server, topic, NSFW flag, recipients, and the time of the last message
- **Server:** name, description, owner, member counts, boost tier, vanity URL, and features
- **Server member info** (with `-g`): nickname, join date, boost status, timeout, and roles

## Setting up a token

Online lookups need a Discord bot token. It's free and takes a couple of minutes.

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and create an application.
2. Go to the **Bot** tab and copy the token.
3. Give dislook the token in one of two ways:

   ** copy the `.enx.example` into `.env` file** in the folder you run dislook from:

   ```bash
   cp .env.example .env
   ```

and the inside that file

```env
token=YOUR_BOT_TOKEN
guild=OPTIONAL_DEFAULT_GUILD_ID
```

### Or another method is

**An environment variable:**

### bash | zsh

```bash
export token=YOUR_BOT_TOKEN
```

### Fish

```fish
set -gx token "YOUR_BOT_TOKEN"
```

`guild` is optional. It sets the default server used for member info, so you don't need `-g` every time.

Without a token, dislook runs offline and tells you so.

> **Keep your token private.** Anyone with it can control your bot. If you use a `.env` file inside a git repository, add `.env` to your `.gitignore`. dislook never prints the token or includes it in JSON output.

## What the API can and can't see

- **User lookups work for anyone**, even if your bot shares no server with them. Only public account info comes back: no email, bio, status, or connected accounts.
- **Nicknames and roles are per server**, so they need `-g` and a server your bot is in.
- **Channels and servers are only visible if your bot is in them.** DMs between other people show up as not visible, including your own DMs with friends.
- **Messages and roles can't be looked up from an ID alone.** Discord also needs the channel or server, so these IDs only get the offline decode.
- **Rate limits apply.** A handful of lookups is fine. Bulk scraping will get you throttled and goes against Discord's developer terms.
- **Worker and process IDs are usually `0`** on newer IDs, so they don't tell you much.

## JSON output

```bash
dislook 208265082977648640 --json
```

Prints one object for a single ID, or an array for several. Colors are turned off automatically in this mode.

Colors are also disabled when output is piped or when the `NO_COLOR` environment variable is set.

## Development

```bash
git clone https://github.com/dummy3ye/dislook
cd dislook
npm install
npm run build
node dist/dislook.js <id>
```

Useful scripts:

| Script               | What it does                                           |
| -------------------- | ------------------------------------------------------ |
| `npm test`           | Run the unit tests once ([vitest](https://vitest.dev)) |
| `npm run test:watch` | Re-run tests on every change                           |
| `npm run check`      | Typecheck, lint, and check formatting                  |
| `npm run format`     | Format everything with Prettier                        |
| `npm run build`      | Bundle `src/` into `dist/dislook.js`                   |

### Project layout

```
src/
  dislook.ts    CLI entry: arguments, printing, API requests
  snowflake.ts  decode, calendar helpers, ID extraction
  format.ts     durations and relative times
  env.ts        .env parsing and token lookup
  discord.ts    badges, channel types, CDN URLs
tests/          unit tests for the modules above
```

The pure logic lives in the small modules so it can be tested without touching the network or the terminal.

## License

MIT
