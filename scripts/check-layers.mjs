// Checks that imports go the way docs/architecture.md says. Run by `npm run lint`.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx|mjs)$/.test(name) ? [path] : [];
  });
}

/** Each `from "…"` of the file, with whether it imports types only. */
function imports(source) {
  return [...source.matchAll(/^import\s+(type\s+)?[^;]*?from\s+"([^"]+)"/gms)].map((m) => ({
    typeOnly: Boolean(m[1]),
    from: m[2],
  }));
}

const DATABASE = /^(drizzle-orm(\/.*)?|@\/lib\/db(\/index)?)$/;
const problems = [];

// Pages, Server Actions and components reach the database only through lib/.
for (const file of [...files("app"), ...files("components")]) {
  for (const { from } of imports(readFileSync(file, "utf8"))) {
    if (DATABASE.test(from)) problems.push(`${file} importe ${from} : passe par une fonction de lib/.`);
  }
}

// lib/ knows nothing of the pages and components; what touches the database stays on the server.
for (const file of files("lib")) {
  if (file.startsWith(join("lib", "db"))) continue;
  const source = readFileSync(file, "utf8");
  const found = imports(source);
  for (const { from } of found) {
    if (/^@\/(app|components)\//.test(from)) problems.push(`${file} importe ${from} : lib/ ne dépend pas de app/ ni de components/.`);
  }
  const database = found.some(({ from, typeOnly }) => DATABASE.test(from) && !typeOnly);
  if (database && !source.includes('import "server-only";')) {
    problems.push(`${file} lit la base sans import "server-only".`);
  }
}

if (problems.length) {
  console.error(`Couches (docs/architecture.md) :\n${problems.map((p) => `- ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("Couches : rien à signaler.");
