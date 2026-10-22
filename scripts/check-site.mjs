#!/usr/bin/env node
// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
// Checks the BUILT site (run `npm run build` first): internal links and anchors, image alt text, no external scripts or fonts,
// SVG safety, every documented page present, every llms.txt link real. Dependency free.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");
if (!existsSync(pub)) { console.error("No public/ folder: run `npm run build` first."); process.exit(2); }

const problems = [];
const files = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : files.push(p); } };
walk(pub);
const html = files.filter((f) => f.endsWith(".html"));
const idsCache = new Map();
const fileFor = (urlPath) => {
  const p = join(pub, decodeURIComponent(urlPath));
  if (existsSync(p) && statSync(p).isFile()) return p;
  const idx = join(p, "index.html");
  return existsSync(idx) ? idx : undefined;
};
const idsOf = (file) => {
  if (!idsCache.has(file)) idsCache.set(file, new Set([...readFileSync(file, "utf8").matchAll(/\sid=(?:"([^"]+)"|'([^']+)'|([^\s">]+))/g)].map((m) => m[1] ?? m[2] ?? m[3])));
  return idsCache.get(file);
};

for (const file of html) {
  const rel = file.slice(pub.length);
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/<img\b[^>]*>/g)) if (!/\balt=("[^"]+"|[^\s">][^\s>]*)/.test(m[0])) problems.push(`${rel}: image without alt text ${m[0].slice(0, 80)}`);
  for (const m of text.matchAll(/<script[^>]*\ssrc="(https?:)?\/\/[^"]+"/g)) problems.push(`${rel}: external script ${m[0]}`);
  for (const m of text.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="(https?:)?\/\/[^"]+"/g)) problems.push(`${rel}: external stylesheet ${m[0]}`);
  if (/fonts\.googleapis|fonts\.gstatic/.test(text)) problems.push(`${rel}: loads Google Fonts`);
  if (!/<title>[^<]+<\/title>/.test(text)) problems.push(`${rel}: no <title>`);
  for (const m of text.matchAll(/<a\b[^>]*?\shref=(?:"([^"]*)"|'([^']*)'|([^\s">]+))/g)) {
    const href = (m[1] ?? m[2] ?? m[3]).replace(/&amp;/g, "&");
    if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) continue; // external
    let [path, hash] = href.split("#");
    if (!path) path = rel.replace(/index\.html$/, "");
    else if (!path.startsWith("/")) path = new URL(path, "http://x" + rel.replace(/index\.html$/, "")).pathname;
    const target = fileFor(path.split("?")[0]);
    if (!target) { problems.push(`${rel}: broken link ${href}`); continue; }
    if (hash && target.endsWith(".html") && !idsOf(target).has(decodeURIComponent(hash))) problems.push(`${rel}: missing anchor ${href}`);
  }
}
// analytics: never a third-party script; and either fully present (token built in) or fully absent
const withAnalytics = html.filter((f) => /<meta name=["']?gs-analytics/.test(readFileSync(f, "utf8")));
for (const file of html) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']?(https?:)?\/\/[^"' >]*(mixpanel|mxpnl)[^"' >]*/gi)) problems.push(`${file.slice(pub.length)}: loads Mixpanel from another host: ${m[0].slice(0, 100)}`);
  if (withAnalytics.length) {
    if (!withAnalytics.includes(file)) problems.push(`${file.slice(pub.length)}: analytics is on for the site but this page has no gs-analytics config`);
    if (!/By continuing, you agree to our <a href=["']?https:\/\/neo4j\.com\/legal-terms\/privacy-notice\/["']?>Privacy Policies<\/a>/.test(text)) problems.push(`${file.slice(pub.length)}: analytics is on but the footer has no "By continuing, you agree to our Privacy Policies" notice linking to Neo4j's privacy notice`);
    if (/id=["']?consent\b/.test(text)) problems.push(`${file.slice(pub.length)}: a consent banner is no longer part of the site`);
  } else if (/privacy-note/.test(text)) problems.push(`${file.slice(pub.length)}: privacy notice without analytics`);
}
if (withAnalytics.length) {
  const cfg = JSON.parse(readFileSync(withAnalytics[0], "utf8").match(/<meta name=["']?gs-analytics["']? content=(?:'([^']*)'|"([^"]*)")/).slice(1).find(Boolean).replace(/&#34;/g, '"'));
  for (const key of ["src", "snippet"]) if (!existsSync(join(pub, cfg[key]))) problems.push(`analytics ${key} file ${cfg[key]} is not in the build`);
  if (!/^https:\/\/api-eu\.mixpanel\.com\/?$/.test(cfg.host)) problems.push(`analytics host is ${cfg.host}, expected the EU endpoint`);
} else {
  const leaked = files.filter((f) => /mixpanel/i.test(f) || (f.endsWith(".js") && /GSAnalyticsCore|api-eu\.mixpanel/.test(readFileSync(f, "utf8"))));
  for (const f of leaked) problems.push(`${f.slice(pub.length)}: analytics code in a build without a token`);
}

for (const svg of files.filter((f) => f.endsWith(".svg"))) {
  const t = readFileSync(svg, "utf8");
  if (/<script|<foreignObject|\son[a-z]+=|javascript:/i.test(t)) problems.push(`${svg.slice(pub.length)}: unsafe SVG content`);
}

// documented pages and llms.txt
const docs = JSON.parse(readFileSync(join(root, "data/docs.json"), "utf8"));
for (const repo of docs.repos) for (const page of repo.pages) if (!fileFor(page.url)) problems.push(`docs page missing from the build: ${page.url}`);
const llms = readFileSync(join(pub, "llms.txt"), "utf8");
const baseUrl = readFileSync(join(root, "hugo.toml"), "utf8").match(/baseURL\s*=\s*"([^"]+)"/)[1].replace(/\/$/, "");
const escaped = baseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const llmsLinks = [...llms.matchAll(new RegExp(`\\]\\((${escaped}[^)]*)\\)`, "g"))].map((m) => new URL(m[1]).pathname);
for (const p of llmsLinks) if (!fileFor(p) && !existsSync(join(pub, p))) problems.push(`llms.txt links to a page that does not exist: ${p}`);
const docPages = docs.repos.flatMap((r) => r.pages.map((p) => p.url));
for (const url of docPages) if (!llmsLinks.includes(url)) problems.push(`llms.txt does not list ${url}`);
if (!existsSync(join(pub, "llms-full.txt"))) problems.push("llms-full.txt was not built");
if (!existsSync(join(pub, "CNAME"))) problems.push("CNAME missing (custom domain)");

if (problems.length) { console.error(problems.join("\n")); console.error(`\n${problems.length} problem(s)`); process.exit(1); }
console.log(`check-site: ${html.length} pages, ${llmsLinks.length} llms.txt links, ${docPages.length} documented pages: all good`);
