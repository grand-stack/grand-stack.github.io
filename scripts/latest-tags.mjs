// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
//
// Finds the latest release tag (highest vMAJOR.MINOR.PATCH) of every documented repository and compares it with the versions the site
// was last built from (data/versions.json). Used by the site workflow to decide whether a rebuild is needed.
//   node scripts/latest-tags.mjs                       asks the GitHub API (GITHUB_TOKEN raises the rate limit)
//   node scripts/latest-tags.mjs --local ..            reads `git tag` from folders beside this one (for testing)
// Prints JSON {tags, changed, changes}; with GITHUB_OUTPUT set it also writes `tags` (JSON), `changed` and `run` (true on any event except
// a scheduled one with nothing new).
import { execSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

/** The highest vMAJOR.MINOR.PATCH among the names, or null. */
export function highestTag(names) {
  const parsed = names.map((n) => [n, n.match(SEMVER_TAG)]).filter(([, m]) => m).map(([n, m]) => [n, m.slice(1).map(Number)]);
  parsed.sort((a, b) => a[1][0] - b[1][0] || a[1][1] - b[1][1] || a[1][2] - b[1][2]);
  return parsed.at(-1)?.[0] ?? null;
}

/** Compares the latest tags with the known versions. A repository with no release yet is "unreleased". */
export function compare(latest, known) {
  const changes = [];
  for (const [repo, tag] of Object.entries(latest)) {
    const was = known[repo] ?? "unreleased";
    const now = tag ?? "unreleased";
    if (was !== now) changes.push(`${repo} ${was} -> ${now}`);
  }
  return { changed: changes.length > 0, changes };
}

export async function githubTags(org, repo, fetchImpl = fetch, token = process.env.GITHUB_TOKEN) {
  const headers = { accept: "application/vnd.github+json", "user-agent": "grandstack-site", ...(token ? { authorization: `Bearer ${token}` } : {}) };
  const names = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetchImpl(`https://api.github.com/repos/${org}/${repo}/tags?per_page=100&page=${page}`, { headers });
    if (res.status === 404) return []; // not published yet
    if (!res.ok) throw new Error(`GitHub answered HTTP ${res.status} for ${org}/${repo} tags`);
    const batch = await res.json();
    names.push(...batch.map((t) => t.name));
    if (batch.length < 100) break;
  }
  return names;
}

function localTags(dir) {
  return existsSync(dir) ? execSync("git tag", { cwd: dir, encoding: "utf8" }).split("\n").filter(Boolean) : [];
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const manifest = JSON.parse(readFileSync(join(root, "docs-manifest.json"), "utf8"));
  const hugo = readFileSync(join(root, "hugo.toml"), "utf8");
  const org = process.env.GITHUB_REPOSITORY_OWNER ?? hugo.match(/githubOrg\s*=\s*"([^"]+)"/)?.[1] ?? "grand-stack";
  const args = process.argv.slice(2);
  const local = args.includes("--local") ? resolve(root, args[args.indexOf("--local") + 1]) : null;
  const known = existsSync(join(root, "data/versions.json")) ? JSON.parse(readFileSync(join(root, "data/versions.json"), "utf8")) : {};

  const latest = {};
  for (const repo of manifest.repos) {
    const names = local ? localTags(join(local, repo.id)) : await githubTags(org, repo.id);
    latest[repo.id] = highestTag(names);
  }
  const { changed, changes } = compare(latest, known);
  const run = process.env.GITHUB_EVENT_NAME !== "schedule" || changed;
  console.log(JSON.stringify({ tags: latest, changed, changes, run }, null, 2));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `tags=${JSON.stringify(latest)}\nchanged=${changed}\nrun=${run}\nsummary=${changes.join("; ")}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
