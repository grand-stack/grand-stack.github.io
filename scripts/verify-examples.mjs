#!/usr/bin/env node
// Runs the commands in data/examples.json against a RUNNING stack and checks each result contains its `expect` text.
//   node scripts/verify-examples.mjs --stack default|agents|federation|auth [--write]
// --write stores the real output (shortened) in data/examples.json so the page shows what the commands returned.
// Examples with a different stack are skipped. Creates and deletes a film titled "ZZ Example".
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const path = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "data/examples.json");
const args = process.argv.slice(2);
const stack = args[args.indexOf("--stack") + 1];
const write = args.includes("--write");
if (!stack || stack.startsWith("--")) { console.error("Usage: verify-examples.mjs --stack default|agents|federation|auth [--write]"); process.exit(2); }

const examples = JSON.parse(readFileSync(path, "utf8"));
let failed = 0, ran = 0;
const shorten = (text, truncate) => {
  let t = text.trim();
  if (t.startsWith("event:")) t = t.split("\n").find((l) => l.startsWith("data:"))?.slice(5).trim() ?? t;
  try { t = JSON.stringify(JSON.parse(t)); } catch { /* keep */ }
  const limit = truncate ? 220 : 400;
  return t.length > limit ? t.slice(0, limit) + " ..." : t;
};
for (const ex of examples) {
  if (ex.stack !== stack) continue;
  ran++;
  let result = "";
  try { result = execSync(ex.command, { encoding: "utf8", shell: "/bin/sh", timeout: 60000 }); } catch (error) { result = String(error.stdout ?? "") + String(error.message); }
  const ok = result.includes(ex.expect);
  console.log(`${ok ? "PASS" : "FAIL"}  ${ex.id}${ok ? "" : `: expected "${ex.expect}" in ${result.slice(0, 200)}`}`);
  if (!ok) failed++;
  else if (write) ex.output = result.trim().split("\n").map((l) => shorten(l, ex.truncate)).filter(Boolean).join("\n");
}
if (write && failed === 0) writeFileSync(path, JSON.stringify(examples, null, 1) + "\n");
console.log(`${ran} example(s) for the ${stack} stack, ${failed} failed${write && !failed ? ", outputs written" : ""}`);
process.exit(failed ? 1 : 0);
