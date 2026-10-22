// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
//
// Browser test of the analytics. Builds the site with a dummy token for a local address, serves it, and drives headless Chrome with every
// request to Mixpanel intercepted (nothing leaves the machine): events arrive with the expected properties, the footer carries the privacy
// notice, and Global Privacy Control and Do Not Track send nothing and load nothing.
//   npm run test:browser          (CHROME_PATH if Chrome is not found; needs `npm ci` and Hugo)
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TOKEN = "test-token-not-real";
const dest = mkdtempSync(join(tmpdir(), "gs-analytics-"));
const chrome = process.env.CHROME_PATH ?? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
if (!chrome) { console.error("Chrome not found: set CHROME_PATH"); process.exit(2); }

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".txt": "text/plain", ".woff2": "font/woff2", ".xml": "application/xml" };
const server = createServer((req, res) => {
  const path = decodeURIComponent(req.url.split("?")[0]);
  let file = join(dest, path);
  if (existsSync(file) && !extname(file)) file = join(file, "index.html");
  else if (!extname(file)) file = join(file, "index.html");
  if (!existsSync(file)) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
execFileSync("hugo", ["--gc", "--minify", "--destination", dest, "--baseURL", base + "/"], { cwd: root, env: { ...process.env, HUGO_PARAMS_MIXPANELTOKEN: TOKEN }, stdio: "pipe" });

let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `: ${detail}`}`); if (!ok) failed++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// the library sends events in batches about a second apart: poll for an event instead of waiting a fixed time
async function until(fn, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await wait(150); } return false; }

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
// a fresh visitor: separate browsing context, with every request outside the local server captured
async function visitor({ gpc = false, dnt = false } = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const seen = { mixpanel: [], scripts: [], other: [], events: [] };
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.hostname === "api-eu.mixpanel.com") {
      // answer like Mixpanel does, including the CORS preflight the browser sends first (credentials are allowed for the page's origin)
      const cors = { "access-control-allow-origin": base, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET, POST, OPTIONS" };
      if (req.method() === "OPTIONS") { req.respond({ status: 204, headers: cors }); return; }
      seen.mixpanel.push(req.url());
      const body = req.postData() ?? "";
      const data = new URLSearchParams(body).get("data") ?? url.searchParams.get("data");
      if (data) {
        // the library sends the events as JSON (older formats were base64 JSON): accept either
        let parsed;
        try { parsed = JSON.parse(data); } catch { try { parsed = JSON.parse(Buffer.from(data, "base64").toString("utf8")); } catch { /* not an event batch */ } }
        if (parsed) (Array.isArray(parsed) ? parsed : [parsed]).forEach((e) => e.event && seen.events.push(e));
      }
      req.respond({ status: 200, contentType: "application/json", body: "1", headers: cors });
    } else if (url.hostname === "github.com") {
      req.respond({ status: 200, contentType: "text/html", body: "<title>GitHub (stub)</title>" });
    } else if (url.origin === base) {
      if (/vendor\/mixpanel/.test(url.pathname)) seen.scripts.push(url.pathname);
      req.continue();
    } else { seen.other.push(req.url()); req.respond({ status: 204, body: "" }); }
  });
  await page.evaluateOnNewDocument((gpcOn, dntOn) => {
    if (gpcOn) Object.defineProperty(navigator, "globalPrivacyControl", { value: true });
    if (dntOn) Object.defineProperty(navigator, "doNotTrack", { value: "1" });
  }, gpc, dnt);
  return { context, page, seen };
}
const names = (seen) => seen.events.map((e) => e.event);
const find = (seen, name) => seen.events.filter((e) => e.event === name);
const visible = (page, sel) => page.$eval(sel, (e) => !e.hidden && getComputedStyle(e).display !== "none").catch(() => false);

try {
  // 1. a normal visitor: the footer notice, and tracking from the first page view, with no banner and no click needed
  { const { context, page, seen } = await visitor();
    await context.overridePermissions(base, ["clipboard-read", "clipboard-write"]);
    await page.goto(base + "/?utm_source=newsletter&utm_medium=email", { waitUntil: "networkidle0" });
    check("there is no consent banner", (await page.$("#consent")) === null && (await page.$("#privacy-settings")) === null);
    const note = await page.$eval(".privacy-note", (e) => ({ text: e.textContent.trim(), href: e.querySelector("a").href })).catch(() => null);
    check("the footer says: By continuing, you agree to our Privacy Policies", note?.text === "By continuing, you agree to our Privacy Policies.", JSON.stringify(note));
    check("the Privacy Policies link goes to Neo4j's privacy notice", note?.href === "https://neo4j.com/legal-terms/privacy-notice/", note?.href);
    await until(() => find(seen, "Page View").length > 0);
    const pv = find(seen, "Page View")[0];
    check("Mixpanel's loader and library are served by the site itself, once each", seen.scripts.length === 2, seen.scripts.join(", "));
    check("a Page View is sent to the EU endpoint with the project token, without any click", !!pv && pv.properties.token === TOKEN);
    check("Page View carries section, UTM and viewport", !!pv && pv.properties.section === "home" && pv.properties.utm_source === "newsletter" && pv.properties.viewport === "desktop", JSON.stringify(pv?.properties));
    check("first-touch source is kept for later events", !!pv && pv.properties.initial_utm_source === "newsletter" && pv.properties.initial_path === "/");
    check("no request to any Mixpanel CDN or other host", seen.other.length === 0, seen.other.join(", "));
    const docNote = await (async () => { await page.goto(base + "/docs/grandstack-server/", { waitUntil: "networkidle0" }); return page.$eval(".privacy-note", (e) => e.textContent.trim()).catch(() => null); })();
    check("the notice is in the footer of every page (checked on a docs page)", docNote === "By continuing, you agree to our Privacy Policies.");
    await page.goto(base + "/?utm_source=newsletter&utm_medium=email", { waitUntil: "networkidle0" });

    await page.click(".cmd .copy"); await until(() => find(seen, "Copy Command").length > 0);
    check("Copy Command is sent with which command", find(seen, "Copy Command").some((e) => e.properties.command === "p-default" && /docker compose/.test(e.properties.text_start)));
    await page.click("#t-agents"); await until(() => find(seen, "Setup Tab").length > 0);
    check("Setup Tab is sent", find(seen, "Setup Tab").some((e) => e.properties.tab === "t-agents"));
    await page.click(".theme-toggle"); await until(() => find(seen, "Theme Toggle").length > 0);
    check("Theme Toggle is sent", find(seen, "Theme Toggle").length === 1);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await until(() => find(seen, "Scroll Depth").some((e) => e.properties.percent === 100));
    check("Scroll Depth reaches 100 and each step is sent once", [25, 50, 75, 100].every((p) => find(seen, "Scroll Depth").filter((e) => e.properties.percent === p).length === 1), find(seen, "Scroll Depth").map((e) => e.properties.percent).join(","));

    // GitHub click from the header (navigates away: the beacon must still arrive)
    await page.evaluate(() => window.scrollTo(0, 0));
    await Promise.all([page.waitForNavigation().catch(() => {}), page.click('.site-header a[href^="https://github.com"]')]);
    await until(() => find(seen, "GitHub Click").length > 0);
    const gh = find(seen, "GitHub Click")[0];
    check("GitHub Click from the header: org, kind and placement", !!gh && gh.properties.org_repo === "grand-stack" && gh.properties.link_kind === "org" && gh.properties.placement === "header", JSON.stringify(gh?.properties));
    check("GitHub Click carries the first-touch source", !!gh && gh.properties.initial_utm_source === "newsletter");

    // docs page: sidebar navigation, source link
    await page.goto(base + "/docs/grandstack-server/", { waitUntil: "networkidle0" });
    await wait(400);
    await page.evaluate(() => document.querySelector('.sidebar a[href="/docs/grandstack-server/mutations/"]').click());
    await until(() => find(seen, "Docs Navigation").length > 0);
    check("Docs Navigation via the sidebar", find(seen, "Docs Navigation").some((e) => e.properties.via === "sidebar" && e.properties.to_path === "/docs/grandstack-server/mutations/"));
    await page.goto(base + "/docs/grandstack-server/mutations/", { waitUntil: "networkidle0" });
    await Promise.all([page.waitForNavigation().catch(() => {}), page.evaluate(() => document.querySelector(".source a").click())]);
    await until(() => find(seen, "GitHub Click").some((e) => e.properties.placement === "docs-source"));
    const src = find(seen, "GitHub Click").find((e) => e.properties.placement === "docs-source");
    check("GitHub Click from a docs 'source' link: repo, file kind, placement", !!src && src.properties.org_repo === "grand-stack/grandstack-server" && src.properties.link_kind === "file", JSON.stringify(src?.properties));

    // examples filter and time on page
    await page.goto(base + "/examples/", { waitUntil: "networkidle0" });
    await page.click('.chip[data-tag="query"]'); await until(() => find(seen, "Example Filter").length > 0);
    check("Example Filter is sent", find(seen, "Example Filter").some((e) => e.properties.tag === "query"));
    await wait(5200);
    await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { get: () => "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
    await until(() => find(seen, "Time On Page").length > 0);
    check("Time On Page is sent when the page is left (5 s or more)", find(seen, "Time On Page").some((e) => e.properties.seconds >= 5));

    // moving to another page keeps tracking (a new page view, same visit)
    await page.goto(base + "/quickstart/", { waitUntil: "networkidle0" }); await until(() => find(seen, "Page View").some((e) => e.properties.section === "quickstart"));
    const second = find(seen, "Page View").find((e) => e.properties.section === "quickstart");
    check("a later page is a new Page View in the same visit, with the first-touch source", !!second && second.properties.page_in_visit >= 2 && second.properties.initial_utm_source === "newsletter", JSON.stringify(second?.properties));
    await context.close(); }

  // 2. Global Privacy Control and Do Not Track: nothing is loaded and nothing is sent
  for (const [name, opts] of [["Global Privacy Control", { gpc: true }], ["Do Not Track", { dnt: true }]]) {
    const { context, page, seen } = await visitor(opts);
    await page.goto(base + "/", { waitUntil: "networkidle0" });
    await page.click(".theme-toggle");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await wait(2500);
    check(`${name}: nothing is sent and the library is not downloaded`, seen.mixpanel.length === 0 && seen.scripts.length === 0, `${seen.mixpanel.length} requests, ${seen.scripts.length} scripts`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(failed === 0 ? "\nAll analytics checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
