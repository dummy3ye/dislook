// .env parsing and token lookup.

import * as fs from "node:fs";
import * as path from "node:path";

export function parseEnv(text: string): Record<string, string> {
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

export function loadEnv(): Record<string, string> {
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

export function getToken(env: Record<string, string>): string | null {
  const t = env.token ?? env.discord_token ?? env.bot_token ?? process.env.DISCORD_TOKEN ?? "";
  const clean = t.replace(/^bot\s+/i, "").trim();
  return clean || null;
}
