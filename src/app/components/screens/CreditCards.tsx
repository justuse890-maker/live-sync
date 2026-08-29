import { useState, useMemo, useEffect } from "react";
import {
  CreditCard as CreditCardIcon,
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  CalendarDays,
  AlertCircle,
  Wallet,
  Plane,
  Building2,
  Fuel,
  Smartphone,
  Sparkles,
  Percent,
  X,
  Loader2,
  Globe,
  Coins,
  ShieldAlert,
  WalletCards
} from "lucide-react";
import { useStore, type CreditCard, type CreditCardType, type CardNetwork } from "../../store";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

// Color palettes for card skins
const CARD_THEMES = [
  { id: "obsidian", label: "Obsidian", color: "#18181B" },
  { id: "indigo", label: "Royal Indigo", color: "#4338CA" },
  { id: "navy", label: "Midnight Navy", color: "#1E3A8A" },
  { id: "emerald", label: "Emerald Elite", color: "#065F46" },
  { id: "gold", label: "Amex Gold", color: "#B45309" },
  { id: "titanium", label: "Titanium Gray", color: "#475569" },
  { id: "crimson", label: "Ruby Crimson", color: "#9F1239" },
  { id: "violet", label: "Sunset Violet", color: "#6D28D9" },
  { id: "sapphire", label: "Sapphire Blue", color: "#0284C7" },
  { id: "metal", label: "Stealth Metal", color: "#334155" },
];

export const CARD_TYPES: { id: CreditCardType; label: string; icon: any; desc: string }[] = [
  { id: "credit", label: "Credit Card", icon: CreditCardIcon, desc: "Rewards, cashback, EMI & credit line" },
  { id: "debit", label: "Debit Card", icon: Wallet, desc: "Linked to savings/salary bank account" },
  { id: "forex", label: "Forex & Travel", icon: Globe, desc: "Zero forex markup, multi-currency card" },
  { id: "rupay_upi", label: "RuPay UPI", icon: Smartphone, desc: "UPI linked credit on QR scan" },
  { id: "corporate", label: "Corporate / Business", icon: Building2, desc: "Company expense & GST claim" },
  { id: "prepaid", label: "Prepaid / Virtual", icon: CreditCardIcon, desc: "Digital wallet & burner card" },
  { id: "fuel", label: "Fuel & Co-Branded", icon: Fuel, desc: "Fuel surcharge waiver & fleet rewards" },
  { id: "transit", label: "Transit / Metro (NCMC)", icon: Coins, desc: "Metro, bus & toll mobility tap card" },
  { id: "other", label: "Other Card", icon: CreditCardIcon, desc: "Custom card format" },
];

export const CARD_NETWORKS: { id: CardNetwork; label: string }[] = [
  { id: "visa", label: "Visa" },
  { id: "mastercard", label: "Mastercard" },
  { id: "rupay", label: "RuPay" },
  { id: "amex", label: "American Express" },
  { id: "diners", label: "Diners Club" },
  { id: "discover", label: "Discover" },
  { id: "other", label: "Other Network" },
];

// Popular Indian & International Banks with preset card suggestions
const POPULAR_BANKS: { name: string; cards: string[] }[] = [
  {
    name: "HDFC Bank",
    cards: ["Infinia Metal", "Regalia Gold", "Millennia", "Tata Neu Infinity RuPay", "Swiggy HDFC", "MoneyBack+", "EasyShop Platinum Debit"]
  },
  {
    name: "ICICI Bank",
    cards: ["Amazon Pay ICICI", "Sapphiro", "Emeralde", "Coral RuPay", "Rubyx", "Platinum Chip", "Expressions Debit"]
  },
  {
    name: "SBI Card",
    cards: ["SBI Cashback", "SimplyCLICK", "SimplySAVE", "BPCL Octane", "Prime", "Elite", "SBI Global International Debit"]
  },
  {
    name: "Axis Bank",
    cards: ["Magnus", "Atlas", "Flipkart Axis", "Airtel Axis", "Ace Card", "Neo", "Burgundy Debit", "Liberty Debit"]
  },
  {
    name: "American Express",
    cards: ["Amex Platinum Travel", "Membership Rewards (MRCC)", "Gold Card", "Platinum Charge Card", "SmartEarn"]
  },
  {
    name: "Kotak Mahindra",
    cards: ["Kotak League", "Kotak Zen", "Mojo Platinum", "White Reserve", "Myntra Kotak", "Kotak 811 Virtual Debit"]
  },
  {
    name: "IDFC FIRST Bank",
    cards: ["IDFC FIRST Wealth", "IDFC FIRST Select", "Club Vistara IDFC", "IDFC FIRST WOW (FD Card)", "FIRST Classic"]
  },
  {
    name: "OneCard",
    cards: ["OneCard Metal Credit", "OneCard Lite (FD Backed)"]
  },
  {
    name: "AU Small Finance",
    cards: ["AU Zenith+", "AU Vetta", "AU Altura+", "AU LIT Customizable", "Ixigo AU Credit"]
  },
  {
    name: "Standard Chartered",
    cards: ["Ultimate", "Smart Credit Card", "Super Value Titanium", "DigiSmart"]
  },
  {
    name: "HSBC Bank",
    cards: ["HSBC Cashback", "HSBC Live+", "HSBC Premier Mastercard"]
  },
  {
    name: "RBL Bank",
    cards: ["RBL ShopRite", "RBL World Safari Forex", "Play Credit Card", "Bajaj Finserv RBL SuperCard"]
  },
  {
    name: "IndusInd Bank",
    cards: ["IndusInd Legend", "Tiger Credit Card", "Pinnacle", "Platinum Aura Edge", "EazyDiner IndusInd"]
  },
  {
    name: "Federal Bank",
    cards: ["Celesta", "Imperio", "Signet", "Scapia Federal Forex", "Fi Money Federal Debit"]
  },
  {
    name: "Niyo",
    cards: ["Niyo Global DCB Forex", "Niyo Global Equitas Forex", "BookMyForex Card"]
  },
  {
    name: "Jupiter / Fi",
    cards: ["Jupiter CSB Edge RuPay", "Fi Federal Credit", "Jupiter Visa Debit"]
  }
];

type CardDraft = Omit<CreditCard, "id">;

const emptyDraft = (): CardDraft => ({
  bankName: "HDFC Bank",
  cardName: "Regalia Gold",
  cardType: "credit",
  network: "visa",
  last4Digits: "",
  creditLimit: 250000,
  statementDate: 15,
  dueDate: 5,
  expiryMonth: "12",
  expiryYear: "28",
  annualFee: 0,
  isLifetimeFree: true,
  rewardType: "points",
  rewardRate: 3.3,
  color: CARD_THEMES[1].color,
  notes: "",
});

export function CreditCards({ onBack }: { onBack: () => void }) {
  const { creditCards, transactions, addCreditCard, updateCreditCard, removeCreditCard } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CreditCard | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Calculate monthly spend & utilization metrics for each card
  const metrics = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const result: Record<string, { spend: number; txCount: number; utilization: number }> = {};

    for (const card of creditCards) {
      const cardTxs = transactions.filter(
        (tx) => tx.creditCardId === card.id && tx.type === "expense" && new Date(tx.date) >= monthStart
      );
      const spend = cardTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      const limit = card.creditLimit || 0;
      const utilization = limit > 0 ? Math.min(100, (spend / limit) * 100) : 0;
      result[card.id] = { spend, txCount: cardTxs.length, utilization };
    }
    return result;
  }, [creditCards, transactions]);

  // Aggregate Portfolio Stats
  const portfolioStats = useMemo(() => {
    const creditCardsList = creditCards.filter((c) => !c.cardType || c.cardType === "credit" || c.cardType === "corporate" || c.cardType === "rupay_upi");
    const totalCreditLimit = creditCardsList.reduce((sum, c) => sum + (c.creditLimit || 0), 0);
    const totalSpend = creditCards.reduce((sum, c) => sum + (metrics[c.id]?.spend || 0), 0);
    const overallUtilization = totalCreditLimit > 0 ? Math.min(100, (totalSpend / totalCreditLimit) * 100) : 0;

    // Find closest upcoming due date
    let closestDue: { card: CreditCard; days: number; dateStr: string } | null = null;
    const now = new Date();
    const currentDay = now.getDate();

    for (const c of creditCardsList) {
      if (c.dueDate) {
        let diff = c.dueDate - currentDay;
        if (diff < 0) diff += 30; // next month
        if (!closestDue || diff < closestDue.days) {
          closestDue = {
            card: c,
            days: diff,
            dateStr: `Due ${c.dueDate}${getOrdinal(c.dueDate)}`
          };
        }
      }
    }

    return {
      totalCards: creditCards.length,
      creditCardsCount: creditCardsList.length,
      debitCardsCount: creditCards.filter(c => c.cardType === "debit").length,
      forexCardsCount: creditCards.filter(c => c.cardType === "forex").length,
      totalCreditLimit,
      totalSpend,
      overallUtilization,
      closestDue
    };
  }, [creditCards, metrics]);

  // Filtered cards
  const filteredCards = useMemo(() => {
    return creditCards.filter((card) => {
      // Tab filter
      if (activeTab === "credit") {
        if (card.cardType && card.cardType !== "credit" && card.cardType !== "rupay_upi") return false;
      } else if (activeTab === "debit") {
        if (card.cardType !== "debit") return false;
      } else if (activeTab === "forex") {
        if (card.cardType !== "forex") return false;
      } else if (activeTab === "rupay") {
        if (card.cardType !== "rupay_upi" && card.network !== "rupay") return false;
      } else if (activeTab === "corporate") {
        if (card.cardType !== "corporate" && card.cardType !== "fuel") return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesBank = (card.bankName || "").toLowerCase().includes(query);
        const matchesName = (card.cardName || "").toLowerCase().includes(query);
        const matchesDigits = (card.last4Digits || "").includes(query);
        const matchesType = (card.cardType || "").toLowerCase().includes(query);
        if (!matchesBank && !matchesName && !matchesDigits && !matchesType) return false;
      }

      return true;
    });
  }, [creditCards, activeTab, searchQuery]);

  const beginAdd = () => { setEditing(null); setOpen(true); };
  const beginEdit = (card: CreditCard) => { setEditing(card); setOpen(true); };

  return (
    <>
      <Header
        title="Card Desk"
        subtitle="Manage Credit, Debit, Forex & RuPay Cards"
        showBack
        onBack={onBack}
        right={
          <Button
            type="button"
            size="icon"
            className="rounded-full size-10 shadow-md bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={beginAdd}
          >
            <Plus className="size-5" />
          </Button>
        }
      />

      <Screen>
        <div className="px-5 pt-4 pb-12 space-y-4">
          
          {/* Security & Privacy Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-indigo-900/90 to-slate-900 p-4 border border-indigo-500/20 text-white shadow-md">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-400/30">
                <ShieldCheck className="size-4 text-indigo-400" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold text-indigo-200">Private &amp; Secure Card Desk</div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Track credit limits, billing dates, reward milestones and link cards to your expenses. 
                  <strong className="text-white"> LiveSync never asks for full card numbers, CVV, PIN or OTP.</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Portfolio Overview Hero Card */}
          {creditCards.length > 0 && (
            <div className="rounded-3xl bg-card border border-border/70 p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] uppercase font-extrabold tracking-wider text-muted-foreground">
                    Aggregated Card Spends (This Month)
                  </div>
                  <div className="font-display text-2xl font-black text-foreground mt-0.5">
                    {inr(portfolioStats.totalSpend)}
                  </div>
                  {portfolioStats.totalCreditLimit > 0 && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      of {inr(portfolioStats.totalCreditLimit)} combined limit
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    Credit Utilization
                  </div>
                  <div className={`text-base font-extrabold mt-0.5 ${
                    portfolioStats.overallUtilization > 50 ? "text-rose-600" :
                    portfolioStats.overallUtilization > 30 ? "text-amber-600" : "text-emerald-600"
                  }`}>
                    {portfolioStats.overallUtilization.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {portfolioStats.overallUtilization <= 30 ? "Optimal (<30%)" : "High (Impacts Score)"}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              {portfolioStats.totalCreditLimit > 0 && (
                <div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        portfolioStats.overallUtilization > 50 ? "bg-rose-500" :
                        portfolioStats.overallUtilization > 30 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, portfolioStats.overallUtilization)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 font-medium">
                    <span>Safe Zone: 0% – 30%</span>
                    <span>Available Credit: {inr(Math.max(0, portfolioStats.totalCreditLimit - portfolioStats.totalSpend))}</span>
                  </div>
                </div>
              )}

              {/* Quick stat chips */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50">
                <div className="bg-muted/40 rounded-xl p-2.5 flex items-center gap-2.5">
                  <div className="size-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                    <WalletCards className="size-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Total Cards</div>
                    <div className="text-xs font-bold text-foreground">
                      {portfolioStats.totalCards} ({portfolioStats.creditCardsCount} Credit, {portfolioStats.debitCardsCount} Debit)
                    </div>
                  </div>
                </div>

                <div className="bg-muted/40 rounded-xl p-2.5 flex items-center gap-2.5">
                  <div className="size-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <CalendarDays className="size-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Upcoming Bill</div>
                    <div className="text-xs font-bold text-foreground">
                      {portfolioStats.closestDue ? (
                        `${portfolioStats.closestDue.card.cardName} (${portfolioStats.closestDue.days === 0 ? "Today" : `in ${portfolioStats.closestDue.days}d`})`
                      ) : "No due dates"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filter Tabs & Search */}
          <div className="space-y-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {[
                { id: "all", label: `All (${creditCards.length})` },
                { id: "credit", label: `Credit (${creditCards.filter(c => !c.cardType || c.cardType === "credit").length})` },
                { id: "debit", label: `Debit (${creditCards.filter(c => c.cardType === "debit").length})` },
                { id: "forex", label: `Forex (${creditCards.filter(c => c.cardType === "forex").length})` },
                { id: "rupay", label: `RuPay UPI (${creditCards.filter(c => c.cardType === "rupay_upi" || c.network === "rupay").length})` },
                { id: "corporate", label: `Corporate (${creditCards.filter(c => c.cardType === "corporate" || c.cardType === "fuel").length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                    activeTab === tab.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-card border border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {creditCards.length > 3 && (
              <Input
                placeholder="Search card by bank, name or last 4 digits..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            )}
          </div>

          {/* Cards List or Empty State */}
          {filteredCards.length === 0 ? (
            creditCards.length === 0 ? (
              <EmptyState onAdd={beginAdd} />
            ) : (
              <div className="text-center py-10 rounded-2xl border border-dashed border-border bg-card p-6">
                <CreditCardIcon className="size-8 mx-auto text-muted-foreground opacity-40 mb-2" />
                <div className="font-bold text-sm">No cards match this filter</div>
                <p className="text-xs text-muted-foreground mt-1">Try selecting another filter or clear search.</p>
                <Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={() => { setActiveTab("all"); setSearchQuery(""); }}>
                  Clear Filters
                </Button>
              </div>
            )
          ) : (
            <div className="space-y-4">
              {filteredCards.map((card) => {
                const cardMetric = metrics[card.id] || { spend: 0, txCount: 0, utilization: 0 };
                return (
                  <CardTile
                    key={card.id}
                    card={card}
                    spend={cardMetric.spend}
                    txCount={cardMetric.txCount}
                    utilization={cardMetric.utilization}
                    onEdit={() => beginEdit(card)}
                    onRemove={() => removeCreditCard(card.id)}
                  />
                );
              })}

              <button
                onClick={beginAdd}
                className="w-full rounded-2xl border-2 border-dashed border-border py-4 text-xs font-bold text-muted-foreground hover:border-indigo-500/50 hover:text-indigo-600 hover:bg-indigo-500/5 transition flex items-center justify-center gap-2"
              >
                <Plus className="size-4" /> Add another card (Credit, Debit, Forex &amp; UPI)
              </button>
            </div>
          )}

        </div>
      </Screen>

      {/* Add / Edit Card Modal */}
      <CardForm
        open={open}
        onOpenChange={setOpen}
        card={editing}
        onSave={async (draft) => {
          if (editing) {
            await updateCreditCard({ ...draft, id: editing.id });
          } else {
            await addCreditCard(draft);
          }
          setOpen(false);
        }}
      />
    </>
  );
}

// ===================== INDIVIDUAL CARD TILE =====================
function CardTile({
  card,
  spend,
  txCount,
  utilization,
  onEdit,
  onRemove,
}: {
  card: CreditCard;
  spend: number;
  txCount: number;
  utilization: number;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const cardTypeInfo = CARD_TYPES.find((t) => t.id === card.cardType) || CARD_TYPES[0];
  const networkInfo = CARD_NETWORKS.find((n) => n.id === card.network) || CARD_NETWORKS[0];

  const isCredit = !card.cardType || card.cardType === "credit" || card.cardType === "corporate" || card.cardType === "rupay_upi";
  const dueInfo = card.dueDate ? dueText(card.dueDate) : null;
  const statusColor = utilization >= 50 ? "text-rose-600" : utilization >= 30 ? "text-amber-600" : "text-emerald-600";

  return (
    <div className="rounded-3xl bg-card border border-border/80 overflow-hidden shadow-sm hover:shadow-md transition-all">
      
      {/* Visual Realistic Credit Card */}
      <div
        className="relative p-5 text-white overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${card.color || "#4338CA"} 0%, #0F172A 100%)`
        }}
      >
        {/* Specular Card Shine overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/15 pointer-events-none" />
        
        {/* Top Card Row */}
        <div className="flex justify-between items-start relative z-10">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-white/80 font-bold">
              {card.bankName || "Bank"}
            </div>
            <div className="font-display font-black text-lg text-white tracking-wide mt-0.5">
              {card.cardName || "Payment Card"}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/20 backdrop-blur-md text-white border border-white/20">
              {cardTypeInfo.label}
            </span>
            {card.isLifetimeFree && (
              <span className="text-[9px] font-bold text-amber-300 flex items-center gap-0.5">
                👑 Lifetime Free
              </span>
            )}
          </div>
        </div>

        {/* Chip & Contactless Visual */}
        <div className="flex items-center gap-3 my-4 relative z-10">
          {/* EMV Chip */}
          <div className="w-9 h-7 rounded-md bg-gradient-to-br from-amber-200 via-amber-300 to-amber-400 p-0.5 shadow-inner flex flex-col justify-between border border-amber-500/40">
            <div className="w-full h-px bg-amber-600/40 mt-1" />
            <div className="w-full h-px bg-amber-600/40" />
            <div className="w-full h-px bg-amber-600/40 mb-1" />
          </div>
          {/* Contactless symbol */}
          <svg className="size-4 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M8.5 16.5a5 5 0 0 1 0-9" />
            <path d="M12 19a8.5 8.5 0 0 0 0-14" />
            <path d="M15.5 21.5a12 12 0 0 0 0-19" />
          </svg>
        </div>

        {/* Card Number & Expiry & Network */}
        <div className="flex justify-between items-end relative z-10 pt-1">
          <div>
            <div className="font-mono tracking-[0.25em] text-sm text-white/90 font-bold">
              •••• •••• •••• {card.last4Digits || "0000"}
            </div>
            {(card.expiryMonth || card.expiryYear) && (
              <div className="text-[10px] font-mono text-white/70 mt-1">
                VALID THRU: {card.expiryMonth || "MM"}/{card.expiryYear || "YY"}
              </div>
            )}
          </div>

          <div className="text-right">
            <div className="px-2.5 py-1 rounded-md bg-black/40 backdrop-blur-md text-[11px] font-black tracking-wider uppercase text-white border border-white/10">
              {networkInfo.label}
            </div>
          </div>
        </div>
      </div>

      {/* Card Info & Usage Metrics */}
      <div className="p-4 space-y-3">
        {/* Spend & Limit Usage */}
        <div className="flex justify-between items-baseline">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
              Tracked Spend This Month
            </div>
            <div className="font-display font-black text-lg text-foreground mt-0.5">
              {inr(spend)} <span className="text-xs font-normal text-muted-foreground">({txCount} txs)</span>
            </div>
          </div>

          {isCredit && card.creditLimit ? (
            <div className="text-right">
              <div className={`text-xs font-extrabold ${statusColor}`}>
                {utilization.toFixed(0)}% limit used
              </div>
              <div className="text-[10px] text-muted-foreground">
                Limit: {inr(card.creditLimit)}
              </div>
            </div>
          ) : (
            card.creditLimit ? (
              <div className="text-right">
                <div className="text-xs font-bold text-foreground">
                  Limit: {inr(card.creditLimit)}
                </div>
                <div className="text-[10px] text-muted-foreground">Daily / Per-tx</div>
              </div>
            ) : null
          )}
        </div>

        {/* Progress bar if limit exists */}
        {card.creditLimit ? (
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                utilization >= 50 ? "bg-rose-500" : utilization >= 30 ? "bg-amber-500" : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(100, utilization)}%` }}
            />
          </div>
        ) : null}

        {/* Card Features / Due Dates Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {isCredit && card.dueDate ? (
            <div className="rounded-xl bg-muted/50 p-2.5 border border-border/40">
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-semibold">
                <CalendarDays className="size-3.5 text-indigo-600" /> Payment Due
              </div>
              <div className="font-bold text-foreground mt-0.5">
                {card.dueDate}{getOrdinal(card.dueDate)} of month
                <span className="text-[10px] text-indigo-600 block font-normal">({dueInfo})</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-muted/50 p-2.5 border border-border/40">
              <div className="text-[11px] text-muted-foreground font-semibold">
                Card Type
              </div>
              <div className="font-bold text-foreground mt-0.5">
                {cardTypeInfo.label}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-muted/50 p-2.5 border border-border/40">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-semibold">
              <Percent className="size-3.5 text-amber-600" /> Reward Perk
            </div>
            <div className="font-bold text-foreground mt-0.5">
              {card.rewardRate ? (
                `${card.rewardRate}% ${card.rewardType || "Rewards"}`
              ) : (
                card.isLifetimeFree ? "Lifetime Free" : card.annualFee ? `₹${card.annualFee}/yr` : "Standard"
              )}
            </div>
          </div>
        </div>

        {/* Notes / Perks */}
        {card.notes && (
          <div className="text-xs bg-indigo-50/50 border border-indigo-100 rounded-xl p-2.5 text-indigo-950 flex items-start gap-2">
            <Sparkles className="size-3.5 text-indigo-600 shrink-0 mt-0.5" />
            <span className="text-[11px] leading-relaxed">{card.notes}</span>
          </div>
        )}

        {/* Tile Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onEdit}
            className="flex-1 border border-border rounded-xl py-2 text-xs font-bold flex justify-center items-center gap-1.5 hover:bg-muted transition text-foreground"
          >
            <Pencil className="size-3.5 text-muted-foreground" /> Edit Details
          </button>
          
          <button
            onClick={onRemove}
            className="px-3 border border-rose-200 text-rose-600 rounded-xl hover:bg-rose-50 transition flex items-center justify-center"
            aria-label={`Remove ${card.cardName}`}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}

// ===================== COMPREHENSIVE CARD FORM MODAL =====================
function CardForm({
  open,
  onOpenChange,
  card,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CreditCard | null;
  onSave: (draft: CardDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CardDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (card) {
        setDraft({ ...card });
      } else {
        setDraft(emptyDraft());
      }
    }
  }, [card, open]);

  const change = (key: keyof CardDraft, value: any) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const isCreditOrCorporate = !draft.cardType || draft.cardType === "credit" || draft.cardType === "corporate" || draft.cardType === "rupay_upi" || draft.cardType === "fuel";

  // Selected Bank's card presets
  const selectedBankObj = POPULAR_BANKS.find(b => b.name === draft.bankName);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!draft.bankName.trim()) {
      setError("Please specify the issuing bank or institution.");
      return;
    }
    if (!draft.cardName.trim()) {
      setError("Please provide a card name or tier.");
      return;
    }
    if (!draft.last4Digits || draft.last4Digits.length !== 4) {
      setError("Please enter the 4 digits shown on the front/back of the card.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...draft,
        bankName: draft.bankName.trim(),
        cardName: draft.cardName.trim(),
        last4Digits: draft.last4Digits.trim(),
        creditLimit: draft.creditLimit ? Number(draft.creditLimit) : undefined,
        statementDate: draft.statementDate ? Number(draft.statementDate) : undefined,
        dueDate: draft.dueDate ? Number(draft.dueDate) : undefined,
        annualFee: draft.annualFee ? Number(draft.annualFee) : 0,
        rewardRate: draft.rewardRate ? Number(draft.rewardRate) : undefined,
        notes: draft.notes ? draft.notes.trim() : undefined,
      });
    } catch (err: any) {
      setError(err?.message || "Could not save this card. Please check inputs and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      onClick={() => !saving && onOpenChange(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl bg-card p-5 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-200 space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div>
            <div className="font-display text-lg font-black text-foreground">
              {card ? "Edit Card Details" : "Add New Card to Desk"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Define credit, debit, forex, RuPay or corporate cards
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="size-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Live Card Preview */}
        <div
          className="rounded-2xl p-4 text-white shadow-md relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${draft.color || "#4338CA"} 0%, #0F172A 100%)` }}
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/70 font-bold">
                {draft.bankName || "Bank Name"}
              </div>
              <div className="font-display font-bold text-base text-white">
                {draft.cardName || "Card Tier / Name"}
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-white/20 border border-white/20">
              {CARD_TYPES.find(t => t.id === draft.cardType)?.label || "Credit"}
            </span>
          </div>

          <div className="flex justify-between items-end mt-6">
            <div className="font-mono tracking-[0.2em] text-xs text-white/90 font-bold">
              •••• •••• •••• {draft.last4Digits || "XXXX"}
            </div>
            <div className="text-[10px] uppercase font-bold text-white/80">
              {CARD_NETWORKS.find(n => n.id === draft.network)?.label || "Visa"}
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <form onSubmit={submit} className="space-y-4">
          
          {/* Card Category / Type Selector */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">
              1. Card Category &amp; Purpose
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CARD_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = (draft.cardType || "credit") === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => change("cardType", t.id)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold shadow-xs"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon className={`size-4 mb-1 ${isSelected ? "text-indigo-600" : "text-muted-foreground"}`} />
                    <span className="text-[11px] leading-tight font-semibold">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card Network Selector */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">
              2. Card Payment Network
            </label>
            <div className="flex gap-2 flex-wrap">
              {CARD_NETWORKS.map((net) => {
                const isSelected = (draft.network || "visa") === net.id;
                return (
                  <button
                    key={net.id}
                    type="button"
                    onClick={() => change("network", net.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {net.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Bank Presets */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-muted-foreground">
                3. Issuing Bank / FinTech
              </label>
              <span className="text-[10px] text-indigo-600 font-semibold">Tap to select preset</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {POPULAR_BANKS.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => {
                    change("bankName", b.name);
                    if (b.cards.length > 0 && !b.cards.includes(draft.cardName)) {
                      change("cardName", b.cards[0]);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap border transition ${
                    draft.bankName === b.name
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-bold"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <Field label="Bank / Institution Name">
                <Input
                  required
                  value={draft.bankName}
                  onChange={(e) => change("bankName", e.target.value)}
                  placeholder="e.g. HDFC Bank, SBI, ICICI"
                  className="rounded-xl"
                />
              </Field>

              <Field label="Card Model / Tier">
                <Input
                  required
                  value={draft.cardName}
                  onChange={(e) => change("cardName", e.target.value)}
                  placeholder="e.g. Infinia, Amazon Pay, Sapphiro"
                  className="rounded-xl"
                />
              </Field>
            </div>

            {/* Popular Card Model Suggestions */}
            {selectedBankObj && selectedBankObj.cards.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] text-muted-foreground mb-1">Popular {selectedBankObj.name} cards:</div>
                <div className="flex gap-1.5 flex-wrap">
                  {selectedBankObj.cards.map((cName) => (
                    <button
                      key={cName}
                      type="button"
                      onClick={() => change("cardName", cName)}
                      className={`text-[11px] px-2 py-0.5 rounded-md border transition ${
                        draft.cardName === cName
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-bold"
                          : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {cName}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Last 4 Digits & Limits */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Last 4 Digits (on card)">
              <Input
                required
                maxLength={4}
                inputMode="numeric"
                value={draft.last4Digits}
                onChange={(e) => change("last4Digits", e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="e.g. 4321"
                className="rounded-xl font-mono tracking-widest text-center font-bold text-base"
              />
            </Field>

            <Field label={isCreditOrCorporate ? "Total Credit Limit (₹)" : "Daily / Spend Limit (₹, Optional)"}>
              <Input
                type="number"
                inputMode="numeric"
                value={draft.creditLimit || ""}
                onChange={(e) => change("creditLimit", e.target.value)}
                placeholder={isCreditOrCorporate ? "e.g. 300000" : "Optional limit"}
                className="rounded-xl font-semibold"
              />
            </Field>
          </div>

          {/* Expiry Date (MM/YY) */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expiry Month (MM)">
              <Input
                maxLength={2}
                inputMode="numeric"
                value={draft.expiryMonth || ""}
                onChange={(e) => change("expiryMonth", e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="MM (e.g. 08)"
                className="rounded-xl text-center"
              />
            </Field>

            <Field label="Expiry Year (YY)">
              <Input
                maxLength={2}
                inputMode="numeric"
                value={draft.expiryYear || ""}
                onChange={(e) => change("expiryYear", e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="YY (e.g. 29)"
                className="rounded-xl text-center"
              />
            </Field>
          </div>

          {/* Statement & Due Dates (Only for Credit / Corporate cards) */}
          {isCreditOrCorporate && (
            <div className="bg-muted/40 rounded-2xl p-3 border border-border/60 space-y-3">
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <CalendarDays className="size-4 text-indigo-600" /> Billing Cycle &amp; Due Date Reminders
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Statement Date (Day of Month)">
                  <Input
                    min="1"
                    max="31"
                    type="number"
                    value={draft.statementDate || ""}
                    onChange={(e) => change("statementDate", e.target.value)}
                    placeholder="Day 1 to 31"
                    className="rounded-xl"
                  />
                </Field>

                <Field label="Payment Due Day (Day of Month)">
                  <Input
                    min="1"
                    max="31"
                    type="number"
                    value={draft.dueDate || ""}
                    onChange={(e) => change("dueDate", e.target.value)}
                    placeholder="Day 1 to 31"
                    className="rounded-xl"
                  />
                </Field>
              </div>
            </div>
          )}

          {/* Rewards & Lifetime Free */}
          <div className="bg-muted/40 rounded-2xl p-3 border border-border/60 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-foreground">Is this Lifetime Free (LTF)?</span>
              <button
                type="button"
                onClick={() => change("isLifetimeFree", !draft.isLifetimeFree)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                  draft.isLifetimeFree
                    ? "bg-amber-500 text-white shadow-xs"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                {draft.isLifetimeFree ? "👑 Yes, LTF" : "No, Has Annual Fee"}
              </button>
            </div>

            {!draft.isLifetimeFree && (
              <Field label="Annual Fee (₹)">
                <Input
                  type="number"
                  value={draft.annualFee || ""}
                  onChange={(e) => change("annualFee", e.target.value)}
                  placeholder="e.g. 1500"
                  className="rounded-xl"
                />
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <Field label="Reward Type">
                <select
                  value={draft.rewardType || "points"}
                  onChange={(e) => change("rewardType", e.target.value)}
                  className="w-full h-10 rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold outline-none"
                >
                  <option value="cashback">Cashback (%)</option>
                  <option value="points">Reward Points</option>
                  <option value="miles">Air Miles / Vistara</option>
                  <option value="fuel">Fuel Surcharge Waiver</option>
                  <option value="none">No Specific Rewards</option>
                </select>
              </Field>

              <Field label="Reward Rate (% or multiplier)">
                <Input
                  type="number"
                  step="0.1"
                  value={draft.rewardRate || ""}
                  onChange={(e) => change("rewardRate", e.target.value)}
                  placeholder="e.g. 3.3"
                  className="rounded-xl"
                />
              </Field>
            </div>
          </div>

          {/* Theme Color Picker */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">
              Card Color Skin
            </label>
            <div className="flex gap-2 flex-wrap">
              {CARD_THEMES.map((theme) => {
                const isSelected = draft.color === theme.color;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => change("color", theme.color)}
                    className={`size-8 rounded-full transition-transform border-2 ${
                      isSelected ? "border-foreground scale-110 shadow-md" : "border-transparent"
                    }`}
                    style={{ background: theme.color }}
                    title={theme.label}
                  />
                );
              })}
            </div>
          </div>

          {/* Notes / Lounge Perks */}
          <Field label="Notes, Lounge Access, Milestone Waivers (Optional)">
            <Input
              value={draft.notes || ""}
              onChange={(e) => change("notes", e.target.value)}
              placeholder="e.g. 4 complimentary lounge visits/quarter, waive fee on ₹3L spend"
              className="rounded-xl text-xs"
            />
          </Field>

          {/* Safety Notice */}
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-900 dark:text-amber-300 flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 text-amber-600 mt-0.5" />
            <span>
              <strong>Security reminder:</strong> Never enter your full 16-digit card number, CVV code, ATM PIN, or Netbanking passwords.
            </span>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
              <ShieldAlert className="size-4 shrink-0" /> {error}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl py-6 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Saving Card to Desk...
              </span>
            ) : (
              card ? "Save Card Changes" : "Add Card to Desk"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

// Helpers
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold text-muted-foreground space-y-1.5">
      <span>{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center rounded-3xl border-2 border-dashed border-border bg-card py-12 px-6 space-y-4">
      <div className="size-16 mx-auto bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center shadow-inner">
        <CreditCardIcon className="size-8" />
      </div>
      <div>
        <h2 className="font-display font-extrabold text-lg text-foreground">Welcome to Card Desk</h2>
        <p className="text-xs text-muted-foreground leading-relaxed mt-1 max-w-xs mx-auto">
          Add your credit, debit, forex, RuPay and corporate cards to track spend limits, utilization, and never miss a payment due date.
        </p>
      </div>
      <Button
        className="rounded-2xl px-6 py-5 font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/25"
        onClick={onAdd}
      >
        <Plus className="size-4 mr-1.5" /> Add Your First Card
      </Button>
    </div>
  );
}

function dueText(day: number) {
  const now = new Date();
  const today = now.getDate();
  let diff = day - today;
  if (diff < 0) diff += 30;

  if (diff === 0) return "Due Today";
  if (diff === 1) return "Due Tomorrow";
  return `Due in ${diff} days`;
}

function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
