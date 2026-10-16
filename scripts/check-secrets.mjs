#!/usr/bin/env node
// Lightweight secret scan. Usage:
//   node scripts/check-secrets.mjs            scan git-tracked files
//   node scripts/check-secrets.mjs --dist     also scan the production bundle in ./dist
// Reports rule + file only; matched values are never printed. Exits 1 on findings.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";

const SKIP_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".wav", ".jar", ".apk", ".tgz", ".woff", ".woff2", ".ttf", ".pdf", ".gz", ".wasm", ".traineddata"]);
const RULES = [
  { id: "private-key-block", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { id: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: "openai-style-key", re: /\bsk-[A-Za-z0-9_-]{32,}\b/ },
  { id: "groq-key", re: /\bgsk_(?![xX]{8})[A-Za-z0-9]{40,}\b/ },
  { id: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { id: "supabase-secret-key", re: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/ },
];
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

export function scanText(text) {
  const hits = [];
  for (const r of RULES) if (r.re.test(text)) hits.push(r.id);
  for (const m of text.matchAll(JWT_RE)) {
    try {
      const payload = JSON.parse(Buffer.from(m[0].split(".")[1], "base64url").toString("utf8"));
      // Supabase anon keys are public by design; any other role (notably service_role) is a leak.
      if (payload.role && payload.role !== "anon") hits.push(`jwt-role-${payload.role}`);
    } catch { /* not a decodable JWT */ }
  }
  return hits;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

function main() {
  const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
  if (process.argv.includes("--dist")) {
    if (!existsSync("dist")) { console.error("dist/ not found - run the build first"); process.exit(2); }
    files.push(...walk("dist"));
  }
  let findings = 0;
  for (const f of files) {
    if (SKIP_EXT.has(extname(f).toLowerCase()) || !existsSync(f)) continue;
    if (statSync(f).size > 15 * 1024 * 1024) continue;
    for (const id of new Set(scanText(readFileSync(f, "utf8")))) { console.error(`SECRET? [${id}] ${f}`); findings++; }
  }
  if (findings) { console.error(`\n${findings} potential secret(s) found.`); process.exit(1); }
  console.log(`Secret scan clean (${files.length} files).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
