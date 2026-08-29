#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
// [P0] Offline unit checks for the pure, no-network intelligence functions
// (cash flow forecast, bill-shock detection, anomaly detection). These need
// no Supabase deployment or Gemini key — they prove the MATH is correct.
// Run: npx tsx scripts/verify-intelligence.mjs   (needs tsx — node alone cannot
//        resolve the .ts extensionless imports in intelligence.ts/store.tsx)
// ════════════════════════════════════════════════════════════════════════
import { forecastCashFlow, upcomingBigBills, spendingAnomalies } from "../src/app/lib/intelligence.ts";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log(`✅ ${name}`); pass++; }
  else { console.log(`❌ ${name}${detail ? " — " + detail : ""}`); fail++; }
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ── Synthetic transaction history ───────────────────────────────────────
const tx = [];
// Monthly salary on the 1st, 3 months back
for (let m = 0; m < 3; m++) {
  const d = new Date();
  d.setMonth(d.getMonth() - m, 1);
  tx.push({ id: `sal-${m}`, title: "Salary", merchant: "Employer", category: "Salary", amount: 60000, type: "income", date: d.toISOString().slice(0, 10) });
}
// Monthly rent on the 5th, 3 months back
for (let m = 0; m < 3; m++) {
  const d = new Date();
  d.setMonth(d.getMonth() - m, 5);
  tx.push({ id: `rent-${m}`, title: "Rent", merchant: "Landlord", category: "Rent", amount: 18000, type: "expense", date: d.toISOString().slice(0, 10) });
}
// Quarterly insurance premium, last one 80 days ago (due again ~in 10 days)
tx.push({ id: "ins-1", title: "Insurance", merchant: "LIC", category: "Insurance", amount: 9000, type: "expense", date: daysAgo(170) });
tx.push({ id: "ins-2", title: "Insurance", merchant: "LIC", category: "Insurance", amount: 9000, type: "expense", date: daysAgo(80) });
// Normal food spend for 8 weeks, then a spike this month
for (let w = 8; w >= 2; w--) {
  tx.push({ id: `food-${w}`, title: "Zomato", merchant: "Zomato", category: "Food", amount: 1200, type: "expense", date: daysAgo(w * 7) });
}
tx.push({ id: "food-spike", title: "Zomato", merchant: "Zomato", category: "Food", amount: 5000, type: "expense", date: daysAgo(3) });

// ── [P0.1] Cash flow forecast ────────────────────────────────────────────
const forecast = forecastCashFlow(tx, 25000, 30, 5000);
check("forecastCashFlow returns 31 points (0..30 days)", forecast.points.length === 31, `got ${forecast.points.length}`);
check("forecastCashFlow detects recurring salary as income event", forecast.endOfMonthBalance !== 25000, "balance should move from the starting point given recurring rent/salary");
check("forecastCashFlow flags safety-line risk correctly", typeof forecast.willGoBelowSafetyLine === "boolean");
console.log(`   → endOfMonthBalance=${forecast.endOfMonthBalance}, lowest=${forecast.lowestPoint.projectedBalance} on ${forecast.lowestPoint.date}`);

// ── [P0.3] Bill shock prevention ─────────────────────────────────────────
const bills = upcomingBigBills(tx, 21);
check("upcomingBigBills detects the quarterly insurance premium", bills.some((b) => b.title.toLowerCase().includes("insurance") || b.title.toLowerCase().includes("lic")), JSON.stringify(bills));

// ── [P0.2] Anomaly detection ──────────────────────────────────────────────
const monthKey = new Date().toISOString().slice(0, 7);
const anomalies = spendingAnomalies(tx, monthKey, 3);
check("spendingAnomalies flags the Food spike this month", anomalies.some((a) => a.category === "Food" && a.direction === "spike"), JSON.stringify(anomalies));

console.log(`\n${pass}/${pass + fail} checks passed`);
if (fail > 0) process.exit(1);
