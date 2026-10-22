// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
//
// Copies the pinned mixpanel-browser build into the site (assets/js/vendor/), so it is served from our own address and only loaded
// after a visitor accepts analytics: mixpanel.min.js (the library) and mixpanel-jslib-snippet.min.js (Mixpanel's small loader, pointed at our copy
// of the library). The copies are committed (like the fonts); this script refreshes them, or checks them.
//   npm run vendor            copy both files from node_modules/mixpanel-browser/dist/
//   npm run vendor -- --check exit 1 if a committed copy differs from the installed package (run in CI)
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "node_modules/mixpanel-browser/dist");
const files = ["mixpanel.min.js", "mixpanel-jslib-snippet.min.js"];
const source = join(dist, files[0]);
if (!existsSync(source)) { console.error("mixpanel-browser is not installed: run `npm ci` first."); process.exit(2); }
const version = JSON.parse(readFileSync(join(root, "node_modules/mixpanel-browser/package.json"), "utf8")).version;

if (process.argv.includes("--check")) {
  const bad = files.filter((f) => !existsSync(join(root, "assets/js/vendor", f)) || Buffer.compare(readFileSync(join(dist, f)), readFileSync(join(root, "assets/js/vendor", f))) !== 0);
  console.log(bad.length ? `${bad.join(", ")} in assets/js/vendor does not match mixpanel-browser ${version}: run \`npm run vendor\` and commit` : `vendored files match mixpanel-browser ${version}`);
  process.exit(bad.length ? 1 : 0);
}
mkdirSync(join(root, "assets/js/vendor"), { recursive: true });
for (const f of files) copyFileSync(join(dist, f), join(root, "assets/js/vendor", f));
console.log(`copied ${files.join(" and ")} from mixpanel-browser ${version}`);
