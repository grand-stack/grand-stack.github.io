// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const core = createRequire(import.meta.url)("../assets/js/analytics-core.js");
const DAY = 86400000;
const now = 1_800_000_000_000;

test("consent: nothing stored means ask; a stored choice is honoured until it is a year old", () => {
  assert.equal(core.consentState(null, now, false, null), "ask");
  assert.equal(core.consentState(core.consentRecord("granted", now - 10 * DAY), now, false, null), "granted");
  assert.equal(core.consentState(core.consentRecord("denied", now - 10 * DAY), now, false, null), "denied");
  assert.equal(core.consentState(core.consentRecord("granted", now - 400 * DAY), now, false, null), "ask");
});

test("consent: Global Privacy Control and Do Not Track mean denied, even after an earlier accept", () => {
  const granted = core.consentRecord("granted", now);
  assert.equal(core.consentState(granted, now, true, null), "denied");
  assert.equal(core.consentState(granted, now, false, "1"), "denied");
  assert.equal(core.consentState(null, now, true, null), "denied");
  assert.equal(core.consentState(granted, now, false, "0"), "granted");
});

test("consent: garbage in storage is treated as not chosen", () => {
  for (const bad of ["{", "null", '{"v":"maybe","t":1}', '{"v":"granted"}', "[]", ""]) assert.equal(core.consentState(bad, now, false, null), "ask");
});

test("sections and repositories", () => {
  assert.equal(core.sectionFor("/"), "home");
  assert.equal(core.sectionFor("/quickstart/"), "quickstart");
  assert.equal(core.sectionFor("/docs/grandstack-server/mutations/"), "docs");
  assert.equal(core.sectionFor("/examples/"), "examples");
  assert.equal(core.sectionFor("/agents/"), "agents");
  assert.equal(core.sectionFor("/privacy/"), "privacy");
  assert.equal(core.sectionFor("/nope/"), "other");
  assert.equal(core.repoFor("/docs/grandstack-server/mutations/"), "grandstack-server");
  assert.equal(core.repoFor("/docs/"), "");
  assert.equal(core.repoFor("/quickstart/"), "");
});

test("GitHub links: org, repo, file, issues, release, other hosts", () => {
  assert.deepEqual(core.parseGithubUrl("https://github.com/grand-stack"), { orgRepo: "grand-stack", kind: "org" });
  assert.deepEqual(core.parseGithubUrl("https://github.com/grand-stack/grandstack-server"), { orgRepo: "grand-stack/grandstack-server", kind: "repo" });
  assert.deepEqual(core.parseGithubUrl("https://github.com/grand-stack/grandstack-server/blob/main/docs/x.md#a"), { orgRepo: "grand-stack/grandstack-server", kind: "file" });
  assert.deepEqual(core.parseGithubUrl("https://github.com/grand-stack/grandstack/issues/3"), { orgRepo: "grand-stack/grandstack", kind: "issues" });
  assert.deepEqual(core.parseGithubUrl("https://github.com/grand-stack/grandstack/releases/tag/v1"), { orgRepo: "grand-stack/grandstack", kind: "release" });
  assert.deepEqual(core.parseGithubUrl("https://github.com/grand-stack/grandstack/actions"), { orgRepo: "grand-stack/grandstack", kind: "other" });
  assert.equal(core.parseGithubUrl("https://gitlab.com/x/y"), null);
  assert.equal(core.parseGithubUrl("https://github.com.evil.example/grand-stack"), null);
  assert.equal(core.parseGithubUrl("/docs/"), null);
  assert.equal(core.parseGithubUrl("not a url at all %%%"), null);
});

test("placement: explicit marker wins, then the nearest known container", () => {
  assert.equal(core.placementFrom(["placement:home-hero", "class:site-header"], "home"), "home-hero");
  assert.equal(core.placementFrom(["class:nav", "class:site-header", "class:wrap"], "home"), "header");
  assert.equal(core.placementFrom(["class:site-footer"], "docs"), "footer");
  assert.equal(core.placementFrom(["class:source", "class:prose"], "docs"), "docs-source");
  assert.equal(core.placementFrom(["class:card", "class:grid"], "home"), "home-card");
  assert.equal(core.placementFrom(["class:prose"], "docs"), "docs-body");
  assert.equal(core.placementFrom(["class:prose"], "quickstart"), "quickstart");
  assert.equal(core.placementFrom(["class:prose"], "agents"), "agents");
  assert.equal(core.placementFrom([], "home"), "other");
});

test("UTM parameters and referrer", () => {
  assert.deepEqual(core.utmFrom("?utm_source=newsletter&utm_medium=email&x=1&utm_campaign=" + "a".repeat(300)), { utm_source: "newsletter", utm_medium: "email", utm_campaign: "a".repeat(100) });
  assert.deepEqual(core.utmFrom(""), {});
  assert.equal(core.referrerDomain("https://www.google.com/search?q=x", "www.grandstack.ai"), "google.com");
  assert.equal(core.referrerDomain("https://grandstack.ai/docs/", "www.grandstack.ai"), "");
  assert.equal(core.referrerDomain("", "www.grandstack.ai"), "");
  assert.equal(core.referrerDomain("garbage", "www.grandstack.ai"), "");
});

test("scroll depth: percent, and each milestone is reported once", () => {
  assert.equal(core.scrollPercent(0, 800, 2800), 0);
  assert.equal(core.scrollPercent(1000, 800, 2800), 50);
  assert.equal(core.scrollPercent(2000, 800, 2800), 100);
  assert.equal(core.scrollPercent(0, 800, 600), 100); // a page shorter than the window counts as fully seen
  assert.deepEqual(core.newScrollSteps([], 30), [25]);
  assert.deepEqual(core.newScrollSteps([25], 80), [50, 75]);
  assert.deepEqual(core.newScrollSteps([25, 50, 75], 80), []);
  assert.deepEqual(core.newScrollSteps([], 100), [25, 50, 75, 100]);
});

test("docs navigation", () => {
  assert.equal(core.docsNavVia(["class:sidebar"]), "sidebar");
  assert.equal(core.docsNavVia(["class:next", "class:pager"]), "next");
  assert.equal(core.docsNavVia(["class:prev", "class:pager"]), "previous");
  assert.equal(core.docsNavVia(["class:crumbs"]), "breadcrumb");
  assert.equal(core.docsNavVia(["class:prose"]), "");
});
