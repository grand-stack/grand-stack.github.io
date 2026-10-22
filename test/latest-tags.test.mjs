// Copyright (c) "Neo4j"
// Neo4j Sweden AB [http://neo4j.com]
import assert from "node:assert/strict";
import test from "node:test";
import { compare, githubTags, highestTag } from "../scripts/latest-tags.mjs";

test("the highest release tag ignores everything that is not vMAJOR.MINOR.PATCH", () => {
  assert.equal(highestTag(["v0.9.2", "v0.10.0", "v0.2.0", "latest", "v1.0", "v0.10.1-rc1"]), "v0.10.0");
  assert.equal(highestTag(["nightly", "v1"]), null);
  assert.equal(highestTag([]), null);
});

test("compare reports what changed, and treats a first release as a change", () => {
  const known = { a: "v0.1.0", b: "v0.2.0", c: "unreleased" };
  assert.deepEqual(compare({ a: "v0.1.0", b: "v0.2.0", c: null }, known), { changed: false, changes: [] });
  assert.deepEqual(compare({ a: "v0.1.1", b: "v0.2.0", c: "v0.1.0" }, known), { changed: true, changes: ["a v0.1.0 -> v0.1.1", "c unreleased -> v0.1.0"] });
  assert.equal(compare({ d: "v1.0.0" }, {}).changed, true);
});

test("github tags: pagination, a missing repository, and errors", async () => {
  const page1 = Array.from({ length: 100 }, (_, i) => ({ name: `v0.0.${i}` }));
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes("/missing/")) return new Response("{}", { status: 404 });
    if (url.includes("/broken/")) return new Response("{}", { status: 500 });
    return new Response(JSON.stringify(url.includes("page=2") ? [{ name: "v0.1.0" }] : page1), { status: 200 });
  };
  const names = await githubTags("o", "r", fetchImpl, "token");
  assert.equal(names.length, 101);
  assert.equal(calls.length, 2);
  assert.deepEqual(await githubTags("o", "missing", fetchImpl, undefined, false), []);
  await assert.rejects(githubTags("o", "missing", fetchImpl, undefined, true), /was not found/);
  await assert.rejects(githubTags("o", "broken", fetchImpl), /HTTP 500/);
});
