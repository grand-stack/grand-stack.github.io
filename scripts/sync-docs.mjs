#!/usr/bin/env node
// Copies the docs of the sibling repos into this site (content/docs, static/diagrams, data/docs.json, data/versions.json, content/roadmap.md).
// The repos are the source of truth: do not edit the generated files. Run `npm run sync` after changing a doc in any repo.
// Links between docs become site links; links to files the site does not hold become GitHub links; broken links are reported and fail the run.
//   node scripts/sync-docs.mjs [--check]     (--check compares with what is on disk and changes nothing)
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const manifest = JSON.parse(readFileSync(join(root, "docs-manifest.json"), "utf8"));
const hugo = readFileSync(join(root, "hugo.toml"), "utf8");
const org = hugo.match(/githubOrg\s*=\s*"([^"]+)"/)?.[1] ?? "grand-stack";
const branch = manifest.githubBranch ?? "main";
const workspace = resolve(root, manifest.workspace);
const repoDir = (id) => join(workspace, id);

const missing = manifest.repos.filter((r) => !existsSync(repoDir(r.id)));
if (missing.length) {
  console.log(`sync-docs: skipped, these repos are not next to this one: ${missing.map((r) => r.id).join(", ")}`);
  process.exit(0);
}

const out = new Map(); // relative path -> content (string or Buffer)
const problems = [];
const pageUrl = (repo, page) => (page.slug === "index" ? `/docs/${repo.id}/` : `/docs/${repo.id}/${page.slug ?? basename(page.file, ".md")}/`);
const pagesByPath = new Map();
for (const repo of manifest.repos) for (const page of repo.pages) pagesByPath.set(resolve(repoDir(repo.id), page.file), { repo, page });

const ghUrl = (abs) => {
  const repo = manifest.repos.find((r) => abs.startsWith(repoDir(r.id) + "/") || abs === repoDir(r.id));
  if (!repo) return undefined;
  const rel = relative(repoDir(repo.id), abs).split("\\").join("/");
  const kind = statSync(abs).isDirectory() ? "tree" : "blob";
  return `https://github.com/${org}/${repo.id}/${kind}/${branch}/${rel}`.replace(/\/$/, "");
};

function titleOf(md, fallback) {
  return md.match(/^#\s+(.+)$/m)?.[1].trim() ?? fallback;
}
function descriptionOf(md) {
  const body = md.replace(/^#\s+.*$/m, "").split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^([>#|!`\[<-]|\d+\.|\*)/.test(p));
  const text = (body ?? "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "").replace(/\s+/g, " ");
  return text.length > 170 ? text.slice(0, 167).replace(/\s+\S*$/, "") + "..." : text;
}

function rewrite(md, file, repo) {
  const dir = dirname(resolve(repoDir(repo.id), file));
  const fix = (target, isImage, where) => {
    if (/^([a-z]+:|#|\/)/i.test(target)) return target;
    const [pathPart, ...hash] = target.split("#");
    if (!pathPart) return target;
    const abs = resolve(dir, decodeURIComponent(pathPart));
    const anchor = hash.length ? "#" + hash.join("#") : "";
    if (isImage || /\.svg$/i.test(abs)) {
      if (!existsSync(abs)) { problems.push(`${repo.id}/${file}: missing image ${target}`); return target; }
      const owner = manifest.repos.find((r) => abs.startsWith(repoDir(r.id) + "/"));
      const name = basename(abs);
      out.set(`static/diagrams/${owner.id}/${name}`, readFileSync(abs));
      return `/diagrams/${owner.id}/${name}`;
    }
    const hit = pagesByPath.get(abs);
    if (hit) return pageUrl(hit.repo, hit.page) + anchor;
    if (!existsSync(abs)) { problems.push(`${repo.id}/${file}: broken link ${target}`); return target; }
    const gh = ghUrl(abs);
    if (gh) return gh + anchor;
    problems.push(`${repo.id}/${file}: link outside the repos ${target}`);
    return target;
  };
  // images first (they may sit inside links), then links; code fences are left alone
  const parts = md.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) return part;
    return part
      // a clickable image: [![alt](image)](link)
      .replace(/\[!\[([^\]]*)\]\(([^)\s]+)\)\]\(([^)\s]+)\)/g, (_, alt, src, href) => `[![${alt}](${fix(src, true)})](${fix(href, false)})`)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `![${alt}](${fix(src, true)})`)
      .replace(/(^|[^!])\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\]\(([^)\s]+)\)/g, (m, pre, text, href) => `${pre}[${text}](${fix(href, false)})`);
  }).join("");
}

const q = (s) => JSON.stringify(s);
const docsData = { repos: [] };
for (const repo of manifest.repos) {
  const entry = { id: repo.id, blurb: repo.blurb, pages: [] };
  repo.pages.forEach((page, index) => {
    const abs = resolve(repoDir(repo.id), page.file);
    if (!existsSync(abs)) { problems.push(`${repo.id}: manifest page ${page.file} does not exist`); return; }
    let md = readFileSync(abs, "utf8");
    const title = page.file === "AGENTS.md" ? "AGENTS.md: guide for coding agents" : page.slug === "index" ? `${repo.id}: overview` : titleOf(md, basename(page.file));
    const description = descriptionOf(md) || title;
    md = md.replace(/^#\s+.*\n+/m, "");
    md = rewrite(md, page.file, repo);
    const url = pageUrl(repo, page);
    const path = page.slug === "index" ? `content/docs/${repo.id}/_index.md` : `content/docs/${repo.id}/${page.slug ?? basename(page.file, ".md")}.md`;
    const front = ["---", `title: ${q(title)}`, `description: ${q(description)}`, `weight: ${index + 1}`, `repo: ${q(repo.id)}`, `section: ${q(page.section)}`, `source: ${q(page.file)}`, `url: ${q(url)}`, "generated: true", "---", "", "<!-- Generated by scripts/sync-docs.mjs from the repository. Do not edit here. -->", ""].join("\n");
    out.set(path, front + md);
    entry.pages.push({ url, title: page.slug === "index" ? "Overview" : page.file === "AGENTS.md" ? "AGENTS.md" : title, section: page.section });
    if (repo.id === manifest.roadmap.repo && page.file === manifest.roadmap.file) {
      out.set("content/roadmap.md", ["---", `title: "Roadmap"`, `description: "What is built and what is planned."`, `url: "/roadmap/"`, "generated: true", "---", "", "<!-- Generated by scripts/sync-docs.mjs from grandstack/docs/roadmap.md. Do not edit here. -->", "", md.replace(/^> \*\*Not built yet\.\*\*[^\n]*\n/m, "")].join("\n"));
    }
  });
  docsData.repos.push(entry);
}
out.set("content/docs/_index.md", ["---", `title: "Documentation"`, `description: "Docs for the six GRANDstack repositories."`, `url: "/docs/"`, "generated: true", "---", ""].join("\n"));
out.set("data/docs.json", JSON.stringify(docsData, null, 2) + "\n");

const versions = {};
for (const repo of manifest.repos) {
  try { versions[repo.id] = execSync("git describe --tags --abbrev=0", { cwd: repoDir(repo.id), stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { versions[repo.id] = "unreleased"; }
}
out.set("data/versions.json", JSON.stringify(versions, null, 2) + "\n");

if (problems.length) {
  console.error("sync-docs: problems\n  " + problems.join("\n  "));
  process.exit(1);
}

// write (or compare)
const generatedRoots = ["content/docs", "static/diagrams"];
const existing = new Set();
const walk = (d) => { if (!existsSync(d)) return; for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : existing.add(relative(root, p)); } };
generatedRoots.forEach((g) => walk(join(root, g)));
let changed = 0;
for (const [path, content] of out) {
  const full = join(root, path);
  const same = existsSync(full) && Buffer.compare(readFileSync(full), Buffer.isBuffer(content) ? content : Buffer.from(content)) === 0;
  if (!same) { changed++; if (!check) { mkdirSync(dirname(full), { recursive: true }); writeFileSync(full, content); } }
  existing.delete(path);
}
for (const stale of existing) { changed++; if (!check) rmSync(join(root, stale)); }
console.log(`sync-docs: ${out.size} files, ${changed} ${check ? "out of date" : "written or removed"}`);
if (check && changed) process.exit(1);
