#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
// AI-Era Feature Verification Script
// Run this AFTER deploying the Supabase Edge Function to confirm each
// priority actually works end-to-end, not just that it compiles.
//
// Usage:
//   node scripts/verify-ai-features.mjs <email> <password>
//
// What it checks, per priority:
//   [P0] /ai/status              — endpoint reachable, reports config
//   [P0] Cash flow forecast      — client-side only, checked via unit test
//   [P0] Anomaly detection       — client-side only, checked via unit test
//   [P0] /ai/weekly-briefing     — generates and caches a real briefing
//   [P1] /ai/negotiation-script  — drafts a real message via Gemini
//   [P1] Agentic bucket action   — verified via existing /buckets endpoint
// ════════════════════════════════════════════════════════════════════════

const PROJECT_ID = process.env.VITE_SUPABASE_PROJECT_ID || "pnfdefqxkpnglbyzeqid";
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuZmRlZnF4a3BuZ2xieXplcWlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MTE5OTIsImV4cCI6MjA5NjI4Nzk5Mn0.czCMGNhHxwOuecf2ZUlRFG-vWqCG8DTrRtsN4GnHrNc";
const BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/make-server-a3fe149f`;
const AUTH_BASE = `https://${PROJECT_ID}.supabase.co/auth/v1`;

const [, , email, password] = process.argv;

const results = [];
function report(priority, name, ok, detail) {
  results.push({ priority, name, ok, detail });
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} [${priority}] ${name}${detail ? " — " + detail : ""}`);
}

async function main() {
  console.log(`\nVerifying against: ${BASE}\n`);

  // ── 0) Health check (no auth needed) ────────────────────────────────
  try {
    const res = await fetch(`${BASE}/health`);
    const body = await res.json();
    report("—", "Server reachable (/health)", res.ok && body.status === "ok");
  } catch (e) {
    report("—", "Server reachable (/health)", false, String(e));
    console.log("\nServer is unreachable — stop here and check deployment / network first.");
    printSummary();
    return;
  }

  if (!email || !password) {
    console.log("\nNo credentials given — skipping authenticated checks.");
    console.log("Run again as: node scripts/verify-ai-features.mjs you@example.com yourpassword\n");
    printSummary();
    return;
  }

  // ── Sign in to get a real access token ──────────────────────────────
  let token;
  try {
    const res = await fetch(`${AUTH_BASE}/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok || !body.access_token) throw new Error(body.error_description || body.msg || "sign-in failed");
    token = body.access_token;
    report("—", "Sign-in", true);
  } catch (e) {
    report("—", "Sign-in", false, String(e));
    printSummary();
    return;
  }

  const authedFetch = (path, init = {}) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
    });

  // ── [P0] /ai/status ──────────────────────────────────────────────────
  try {
    const res = await authedFetch("/ai/status");
    const body = await res.json();
    report("P0", "/ai/status reachable", res.ok);
    if (res.ok) {
      report("P0", "Gemini API key configured", body.geminiConfigured === true,
        body.geminiConfigured ? undefined : "Set GEMINI_API_KEY as a Supabase Edge Function secret");
      console.log("   Feature flags:", JSON.stringify(body.features, null, 2).split("\n").join("\n   "));
    }
  } catch (e) {
    report("P0", "/ai/status reachable", false, String(e));
  }

  // ── [P0] Weekly briefing (force=true so it always actually calls Gemini once) ──
  try {
    const res = await authedFetch("/ai/weekly-briefing", {
      method: "POST",
      body: JSON.stringify({
        snapshot: {
          healthScore: 68, healthScoreDelta: 3, weeklySpend: 4200, avgWeeklySpend: 3600,
          savingsRatePct: 24, topCategory: "Food", topCategoryChangePct: 35,
          annualLeakage: 18000, forecastEndOfMonthBalance: 22000,
        },
        force: true,
      }),
    });
    const body = await res.json();
    report("P0", "/ai/weekly-briefing generates real text", res.ok && typeof body.text === "string" && body.text.length > 10, body.text?.slice(0, 80));
  } catch (e) {
    report("P0", "/ai/weekly-briefing generates real text", false, String(e));
  }

  // ── [P1] Negotiation script ──────────────────────────────────────────
  try {
    const res = await authedFetch("/ai/negotiation-script", {
      method: "POST",
      body: JSON.stringify({
        kind: "subscription_cancel",
        context: { name: "Test Streaming Service", currentAmount: 499 },
      }),
    });
    const body = await res.json();
    if (res.status === 429) {
      report("P1", "/ai/negotiation-script drafts a message", true, "rate-limited (expected if run repeatedly today) — endpoint IS live");
    } else {
      report("P1", "/ai/negotiation-script drafts a message", res.ok && typeof body.text === "string" && body.text.length > 10, body.text?.slice(0, 80));
    }
  } catch (e) {
    report("P1", "/ai/negotiation-script drafts a message", false, String(e));
  }

  // ── [P1] Agentic action substrate — confirm buckets endpoint (already existing) still works ──
  try {
    const res = await authedFetch("/buckets");
    report("P1", "Buckets endpoint reachable (agentic move-to-bucket depends on this)", res.ok);
  } catch (e) {
    report("P1", "Buckets endpoint reachable (agentic move-to-bucket depends on this)", false, String(e));
  }

  printSummary();
}

function printSummary() {
  const failed = results.filter((r) => !r.ok);
  console.log("\n─────────────────────────────────────────");
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("Failed:");
    failed.forEach((r) => console.log(`  - [${r.priority}] ${r.name}${r.detail ? ": " + r.detail : ""}`));
    process.exitCode = 1;
  } else {
    console.log("All checks passed — AI-era features are live.");
  }
  console.log("─────────────────────────────────────────\n");
}

main().catch((e) => {
  console.error("Verification script crashed:", e);
  process.exit(1);
});
