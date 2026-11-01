# Configuration

dislook runs fully offline by default. A bot token unlocks the online lookups; everything else is optional.

## Where settings are read from

Two sources are consulted, in order:

1. A `.env` file in the current working directory.
2. A `.env` file next to the script being executed.

The first file found wins. If neither exists, settings come from the process environment.

## `.env` format

```env
token=YOUR_BOT_TOKEN
guild=OPTIONAL_DEFAULT_GUILD_ID
```

The parser is deliberately small and predictable:

- one `KEY=value` pair per line,
- blank lines and lines starting with `#` are skipped,
- a leading `export ` is stripped,
- keys are lowercased, so `TOKEN=` and `token=` are the same setting,
- surrounding single or double quotes are removed,
- an unquoted trailing `# comment` is removed,
- a line without `=` is ignored.

Values are never expanded or interpolated. `token=$OTHER_VAR` is taken literally.

## Token resolution

The token is taken from the first of these that is set and non-empty:

1. `token` in `.env`
2. `discord_token` in `.env`
3. `bot_token` in `.env`
4. the `DISCORD_TOKEN` environment variable

A leading `bot ` prefix is stripped, so both a raw token and `Bot <token>` work.

Without a token, dislook stays offline and says so:

```
  no token found in .env (token=...), running offline
```

Use `--offline` to skip the API even when a token is present.

## The default guild

`guild` sets the server used for member lookups, so `-g` is not needed on every run:

```env
guild=208265082977648640
```

Only digits are kept, so a full invite or channel link is acceptable. The `-g` / `--guild` option overrides this value for a single run.

## Environment variables

| Variable        | Effect                                     |
| --------------- | ------------------------------------------ |
| `DISCORD_TOKEN` | Token used when `.env` does not define one |
| `NO_COLOR`      | Any value disables colored output          |

## Keeping the token safe

- Add `.env` to `.gitignore`; the repository already does this.
- dislook never prints the token and never includes it in JSON output.
- A `.env` containing a token should be readable only by you:

```bash
chmod 600 .env
```

If the token is ever pasted into a chat, a log, or a commit, revoke it in the Discord Developer Portal and generate a new one.
