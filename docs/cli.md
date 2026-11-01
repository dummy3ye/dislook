# Command line

dislook takes one or more Discord IDs — or anything containing them — and prints what can be decoded from each one.

```bash
dislook <id|url> [more ids...]
dislook                          # interactive mode
```

## Arguments

An argument does not have to be a bare ID. dislook scans the whole string for runs of 15 to 20 digits, so a pasted link works:

```bash
dislook https://discord.com/channels/@me/208265082977648640
dislook "my id is 208265082977648640, friend is 208265082977648641"
```

Every number that fits in 64 bits is decoded. Anything with no valid ID prints an error and exits with code 1.

## Options

| Option               | What it does                                                  |
| -------------------- | ------------------------------------------------------------- |
| `-g`, `--guild <id>` | Add server member info (nickname, roles, join date) for users |
| `-o`, `--offline`    | Skip the Discord API and only decode the ID                   |
| `-j`, `--json`       | Print JSON instead of formatted text                          |
| `-h`, `--help`       | Show help                                                     |

`--guild` also accepts the `--guild=<id>` form. Non-digits are stripped from the value, so a full channel or server link can be passed. The CLI value overrides the `guild` entry from `.env`.

Any argument that is not a known flag is treated as input, so flags and IDs can be mixed in any order.

## Interactive mode

With no IDs on the command line, dislook prompts for them one line at a time:

```
  id ›
```

Each line can hold one ID, several IDs, or a link. An empty line quits.

## Comparing IDs

Passing more than one ID adds a comparison block after the decoded output. It shows the gap between each consecutive pair and the total span when there are three or more:

```bash
dislook 208265082977648640 208265082977648641
```

Comparison is only printed in the human-readable output, never in JSON mode.

## JSON output

`--json` prints a single object for one ID and an array for several:

```bash
dislook 208265082977648640 --json
```

```json
{
  "id": "208265082977648640",
  "created": "2016-07-28T16:51:05.160Z",
  "unix_ms": 1469724665160,
  "worker": 0,
  "process": 0,
  "increment": 0,
  "day_of_year": 210,
  "iso_week": 30,
  "lookup": null
}
```

`lookup` is `null` when no token is available, when `--offline` is set, or when nothing matched. Otherwise it holds the online result described in [api.mdx](api.mdx).

JSON mode always disables colors.

## Colors

Colors are used only when stdout is a terminal. They are turned off when:

- the output is piped or redirected,
- `NO_COLOR` is set to any value,
- `--json` is passed.

## Exit codes

| Code | Meaning                                          |
| ---- | ------------------------------------------------ |
| `0`  | Normal run, including lookups that found nothing |
| `1`  | No valid ID in the input, or an unexpected error |

A rejected token or a rate limit is reported in the output but does not change the exit code.

## Warnings

An ID is flagged as suspicious when its timestamp is zero, in the future, or within 30 days of the Discord epoch. The decode still runs; the warning just notes that it is probably not a real snowflake.
