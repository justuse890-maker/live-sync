export const user = {
  name: "Aarav Sharma",
  initials: "AS",
  email: "aarav@example.com",
};

export const financial = {
  netWorth: 842500,
  monthlyIncome: 120000,
  monthlyExpenses: 78400,
  monthlySavings: 41600,
  healthScore: 78,
  emergencyMonths: 6.2,
  emergencyFund: 240000,
  burnRate: 38600,
};

export const healthBreakdown = [
  { name: "Savings", score: 82, color: "#10B981" },
  { name: "Debt", score: 71, color: "#1E40AF" },
  { name: "Budget", score: 88, color: "#10B981" },
  { name: "Emergency Fund", score: 76, color: "#1E40AF" },
  { name: "Subscriptions", score: 64, color: "#F59E0B" },
  { name: "Investments", score: 70, color: "#1E40AF" },
];

export const cashFlow = [
  { month: "Jan", income: 110000, expenses: 82000 },
  { month: "Feb", income: 115000, expenses: 79000 },
  { month: "Mar", income: 118000, expenses: 84000 },
  { month: "Apr", income: 120000, expenses: 77000 },
  { month: "May", income: 122000, expenses: 81000 },
  { month: "Jun", income: 120000, expenses: 78400 },
];

export const transactions = [
  { id: "1", title: "Salary — Acme Corp", category: "Salary", amount: 120000, type: "income", date: "Jun 1", icon: "Briefcase" },
  { id: "2", title: "Zomato", category: "Food", amount: -680, type: "expense", date: "Jun 5", icon: "UtensilsCrossed" },
  { id: "3", title: "Apartment Rent", category: "Rent", amount: -28000, type: "expense", date: "Jun 3", icon: "Home" },
  { id: "4", title: "Spotify Premium", category: "Subscriptions", amount: -149, type: "expense", date: "Jun 4", icon: "Music" },
  { id: "5", title: "Uber", category: "Travel", amount: -340, type: "expense", date: "Jun 5", icon: "Car" },
  { id: "6", title: "BigBasket", category: "Grocery", amount: -3200, type: "expense", date: "Jun 4", icon: "ShoppingCart" },
  { id: "7", title: "Freelance Project", category: "Freelance", amount: 18000, type: "income", date: "Jun 2", icon: "Laptop" },
  { id: "8", title: "Netflix", category: "Subscriptions", amount: -499, type: "expense", date: "Jun 3", icon: "Tv" },
  { id: "9", title: "Apollo Pharmacy", category: "Medical", amount: -1240, type: "expense", date: "Jun 2", icon: "Stethoscope" },
  { id: "10", title: "Amazon", category: "Shopping", amount: -2899, type: "expense", date: "Jun 1", icon: "ShoppingBag" },
];

export const goals = [
  { id: "g1", name: "Emergency Fund", target: 360000, current: 240000, deadline: "Dec 2026", icon: "Shield", color: "#1E40AF" },
  { id: "g2", name: "Goa Vacation", target: 80000, current: 32000, deadline: "Nov 2026", icon: "Plane", color: "#F59E0B" },
  { id: "g3", name: "New Bike", target: 120000, current: 45000, deadline: "Mar 2027", icon: "Bike", color: "#10B981" },
  { id: "g4", name: "House Down Payment", target: 2000000, current: 380000, deadline: "Jun 2028", icon: "Home", color: "#1E40AF" },
];

export const subscriptions = [
  { id: "s1", name: "Netflix", cost: 499, renewal: "Jun 15", category: "Entertainment", status: "active", trend: "stable", icon: "Tv" },
  { id: "s2", name: "Spotify Premium", cost: 149, renewal: "Jun 18", category: "Music", status: "increased", trend: "up", priceChange: 30, icon: "Music" },
  { id: "s3", name: "iCloud+ 200GB", cost: 75, renewal: "Jun 22", category: "Storage", status: "active", trend: "stable", icon: "Cloud" },
  { id: "s4", name: "Adobe Creative Cloud", cost: 1675, renewal: "Jun 28", category: "Productivity", status: "unused", trend: "stable", icon: "Palette" },
  { id: "s5", name: "Disney+ Hotstar", cost: 299, renewal: "Jul 02", category: "Entertainment", status: "duplicate", trend: "stable", icon: "Tv" },
  { id: "s6", name: "Notion", cost: 800, renewal: "Jul 05", category: "Productivity", status: "active", trend: "stable", icon: "FileText" },
];

export const budgets = [
  { category: "Food", spent: 6400, limit: 8000, color: "#1E40AF" },
  { category: "Travel", spent: 2200, limit: 3000, color: "#10B981" },
  { category: "Shopping", spent: 4800, limit: 5000, color: "#F59E0B" },
  { category: "Grocery", spent: 5100, limit: 6000, color: "#1E40AF" },
  { category: "Entertainment", spent: 1900, limit: 2000, color: "#F59E0B" },
  { category: "Medical", spent: 1240, limit: 3000, color: "#10B981" },
];

export const aiInsights = [
  { id: "i1", title: "Dining up 42%", body: "You spent ₹6,400 on dining this month vs ₹4,500 last month.", action: "View breakdown", severity: "warning" as const },
  { id: "i2", title: "Spotify price increase", body: "Spotify Premium increased by ₹30/mo. Review or cancel.", action: "Review", severity: "warning" as const },
  { id: "i3", title: "On track for Goa goal", body: "At current pace you'll hit ₹80,000 by Oct 28 — 3 weeks early.", action: "See goal", severity: "success" as const },
  { id: "i4", title: "Adobe CC unused", body: "No activity in 45 days. Cancel to save ₹20,100/year.", action: "Cancel request", severity: "danger" as const },
];

export const upcomingBills = [
  { id: "b1", name: "Electricity Bill", amount: 2400, due: "Jun 10", icon: "Zap" },
  { id: "b2", name: "Credit Card", amount: 18500, due: "Jun 12", icon: "CreditCard" },
  { id: "b3", name: "Internet", amount: 999, due: "Jun 15", icon: "Wifi" },
];

export const coachSuggestions = [
  "Can I afford a new phone?",
  "How can I save more this month?",
  "Why am I overspending on food?",
  "Can I retire at 50?",
  "Should I cancel Adobe CC?",
];

export const coachInitial = [
  { role: "assistant" as const, text: "Hi Aarav 👋  I'm your AI financial coach. Ask me anything about your money — affordability, savings, goals, or where you might be leaking cash." },
];
