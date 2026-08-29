/**
 * Creates sample financial records for the deliberately public investor-demo
 * account. It is idempotent: existing collections are left unchanged.
 *
 * Run: node scripts/seed-investor-demo.mjs
 * Never change this script to use a real customer or employee account.
 */
const projectId = process.env.VITE_SUPABASE_PROJECT_ID ?? "pnfdefqxkpnglbyzeqid";
const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuZmRlZnF4a3BuZ2xieXplcWlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MTE5OTIsImV4cCI6MjA5NjI4Nzk5Mn0.czCMGNhHxwOuecf2ZUlRFG-vWqCG8DTrRtsN4GnHrNc";
const email = process.env.VITE_DEMO_EMAIL ?? "investor.demo@livesync.example";
const password = process.env.VITE_DEMO_PASSWORD ?? "LiveSyncDemo2026!";
const base = `https://${projectId}.supabase.co/functions/v1/make-server-a3fe149f`;

async function json(url, init = {}) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status}: ${body.error ?? response.statusText}`);
  return body;
}

const auth = await json(`https://${projectId}.supabase.co/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anonKey, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const headers = { Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json" };

const samples = {
  transactions: [
    { id: "demo-income", title: "Monthly salary", category: "Income", amount: 125000, type: "income", date: "2026-08-01", merchant: "Acme Labs" },
    { id: "demo-rent", title: "Apartment rent", category: "Rent", amount: 32000, type: "expense", date: "2026-08-03", merchant: "Greenview Residences" },
    { id: "demo-groceries", title: "Weekly groceries", category: "Grocery", amount: 2860, type: "expense", date: "2026-08-10", merchant: "FreshMart" },
    { id: "demo-invest", title: "Index fund SIP", category: "Investments", amount: 15000, type: "expense", date: "2026-08-12", merchant: "Nifty 50 Index Fund" },
    { id: "demo-dining", title: "Dinner with friends", category: "Food", amount: 1450, type: "expense", date: "2026-08-16", merchant: "Olive Kitchen" },
  ],
  goals: [{ id: "demo-goal", name: "Goa holiday", target: 120000, current: 68500, deadline: "2026-12-20", icon: "Palmtree", color: "#10B981" }],
  budgets: [
    { id: "demo-food-budget", category: "Food", limit: 12000, spent: 6450, color: "#F59E0B", month: "2026-08" },
    { id: "demo-travel-budget", category: "Travel", limit: 8000, spent: 2150, color: "#6366F1", month: "2026-08" },
  ],
  subscriptions: [{ id: "demo-subscription", name: "Music streaming", cost: 119, renewal: "2026-09-01", category: "Entertainment", status: "active", icon: "Music", period: "monthly" }],
  assets: [{ id: "demo-emergency-fund", name: "Emergency fund", type: "cash", value: 280000, notes: "Sample data" }],
  liabilities: [{ id: "demo-card", name: "Credit card balance", type: "credit_card", value: 8400, notes: "Sample data" }],
  investments: [{ id: "demo-mf", name: "Nifty 50 Index Fund", type: "mutual_fund", investedAmount: 340000, currentValue: 398000, purchaseDate: "2024-01-15", notes: "Sample data" }],
};

for (const [collection, items] of Object.entries(samples)) {
  const existing = await json(`${base}/${collection}`, { headers });
  if (existing.items?.length) {
    console.log(`${collection}: already populated; skipped`);
    continue;
  }
  await Promise.all(items.map((item) => json(`${base}/${collection}`, {
    method: "POST", headers, body: JSON.stringify(item),
  })));
  console.log(`${collection}: seeded ${items.length} sample item(s)`);
}
