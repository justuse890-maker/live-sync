import { useEffect, useMemo, useState } from "react";
import {
  Users, UserPlus, Crown, Shield, Eye, Copy, Check, X, Loader2,
  Target, Wallet, PiggyBank, TrendingUp, MoreVertical, Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { inr } from "../types";
import { netWorth } from "../../lib/intelligence";
import { api } from "../../lib/api";

type Role = "owner" | "partner" | "viewer";
type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  contributionThisMonth?: number;
  joinedAt: string;
};

const roleMeta: Record<Role, { label: string; icon: any; tint: string; desc: string }> = {
  owner:   { label: "Owner",   icon: Crown,  tint: "#F59E0B", desc: "Full access, can invite & remove" },
  partner: { label: "Partner", icon: Shield, tint: "#1E40AF", desc: "Edit goals, budgets & transactions" },
  viewer:  { label: "Viewer",  icon: Eye,    tint: "#64748B", desc: "Read-only access" },
};

export function Family({ onBack }: { onBack: () => void }) {
  const { transactions, goals, budgets, assets, liabilities } = useStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = async () => {
    try {
      const items = await api.list<Member>("family");
      setMembers(items.length ? items : seedSelf());
    } catch (e) {
      console.warn("family load failed", e);
      setMembers(seedSelf());
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    try { await api.remove("family", id); setMembers((m) => m.filter((x) => x.id !== id)); }
    catch (e) { console.warn("remove failed", e); }
  };

  // Shared financial snapshot — same intelligence pipeline as personal screens,
  // but framed as a household view. In a real multi-user setup each member's
  // contributions would be aggregated server-side; here we render the owner's
  // numbers and the (mock) per-member contribution split.
  const monthIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const monthExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
  const monthSavings = monthIncome - monthExpense;
  const nw = useMemo(() => netWorth(assets, liabilities), [assets, liabilities]);

  const sharedGoals = goals.slice(0, 3);
  const sharedBudgets = budgets.slice(0, 3);

  return (
    <>
      <Header
        title="Family Finance"
        subtitle="Shared household money"
        showBack
        onBack={onBack}
        right={
          <button
            onClick={() => setInviteOpen(true)}
            className="text-[11px] text-primary flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted"
            style={{ fontWeight: 600 }}
          >
            <UserPlus className="size-3.5" /> Invite
          </button>
        }
      />
      <Screen>
        <div className="px-5 pt-4 space-y-5">
          {/* Household hero */}
          <div className="rounded-3xl p-5 text-white" style={{ background: "linear-gradient(135deg,#1E40AF 0%,#7C3AED 100%)" }}>
            <div className="flex items-center gap-2">
              <Users className="size-5" />
              <div className="text-sm" style={{ fontWeight: 700 }}>Household net worth</div>
            </div>
            <div className="text-3xl mt-2" style={{ fontWeight: 700 }}>{inr(nw.netWorth)}</div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <Tile label="Income" value={inr(monthIncome)} />
              <Tile label="Expense" value={inr(monthExpense)} />
              <Tile label="Saved" value={inr(monthSavings)} positive={monthSavings >= 0} />
            </div>
          </div>

          {/* Members */}
          <section>
            <SectionTitle icon={Users}>Members</SectionTitle>
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {members.map((m) => (
                  <MemberRow key={m.id} member={m} onRemove={() => remove(m.id)} />
                ))}
                <button
                  onClick={() => setInviteOpen(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-t border-border/60 text-primary hover:bg-primary/5"
                  style={{ fontWeight: 600 }}
                >
                  <div className="size-9 rounded-full border border-dashed border-primary/50 flex items-center justify-center">
                    <UserPlus className="size-4" />
                  </div>
                  <span className="text-sm">Invite partner or family member</span>
                </button>
              </div>
            )}
          </section>

          {/* Shared goals */}
          {sharedGoals.length > 0 && (
            <section>
              <SectionTitle icon={Target}>Shared goals</SectionTitle>
              <div className="space-y-2">
                {sharedGoals.map((g: any) => {
                  const pct = Math.min(100, Math.round((g.current / g.target) * 100));
                  return (
                    <div key={g.id} className="bg-card border border-border rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm truncate" style={{ fontWeight: 700 }}>{g.name}</div>
                        <div className="text-xs text-muted-foreground">{inr(g.current)} / {inr(g.target)}</div>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: g.color ?? "#1E40AF" }} />
                      </div>
                      <div className="flex justify-between mt-1.5">
                        <div className="text-[11px] text-muted-foreground">By {g.deadline}</div>
                        <div className="text-[11px]" style={{ fontWeight: 600, color: g.color ?? "#1E40AF" }}>{pct}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Shared budgets */}
          {sharedBudgets.length > 0 && (
            <section>
              <SectionTitle icon={Wallet}>Shared budgets</SectionTitle>
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {sharedBudgets.map((b: any) => {
                  const pct = Math.min(100, Math.round((b.spent / b.limit) * 100));
                  return (
                    <div key={b.category} className="px-4 py-3 border-b border-border/60 last:border-0">
                      <div className="flex items-center justify-between text-sm">
                        <span style={{ fontWeight: 600 }}>{b.category}</span>
                        <span className="text-muted-foreground">{inr(b.spent)} / {inr(b.limit)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 90 ? "#EF4444" : b.color ?? "#1E40AF" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Contribution split */}
          {members.length > 1 && (
            <section>
              <SectionTitle icon={PiggyBank}>This month's contributions</SectionTitle>
              <div className="bg-card border border-border rounded-2xl p-4">
                {members.map((m, i) => {
                  const c = m.contributionThisMonth ?? Math.round(monthIncome / members.length);
                  const pct = monthIncome > 0 ? Math.round((c / monthIncome) * 100) : 0;
                  return (
                    <div key={m.id} className={i ? "mt-3" : ""}>
                      <div className="flex items-center justify-between text-sm">
                        <span style={{ fontWeight: 600 }}>{m.name}</span>
                        <span>{inr(c)} · {pct}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <div className="bg-card border border-border/60 rounded-2xl p-4 text-xs text-muted-foreground leading-relaxed flex gap-2">
            <TrendingUp className="size-3.5 mt-0.5 text-primary shrink-0" />
            <div>
              Family Finance keeps each member's personal accounts private. Only shared goals, budgets, and explicitly-tagged transactions are visible to the household. Owners can change roles or revoke access at any time.
            </div>
          </div>
        </div>
      </Screen>

      <AnimatePresence>
        {inviteOpen && <InviteSheet onClose={() => setInviteOpen(false)} onInvited={(m) => { setMembers((xs) => [...xs, m]); setInviteOpen(false); }} />}
      </AnimatePresence>
    </>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-1 mb-2">
      <Icon className="size-3.5 text-muted-foreground" />
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ fontWeight: 600 }}>{children}</div>
    </div>
  );
}

function Tile({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur-sm p-2 text-center">
      <div className="text-sm" style={{ fontWeight: 700, color: positive === false ? "#FCA5A5" : undefined }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-80" style={{ fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function MemberRow({ member, onRemove }: { member: Member; onRemove: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const meta = roleMeta[member.role];
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 last:border-0">
      <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm" style={{ fontWeight: 700 }}>
        {member.initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate" style={{ fontWeight: 700 }}>{member.name}</div>
        <div className="text-[11px] text-muted-foreground truncate">{member.email}</div>
      </div>
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: meta.tint + "15", color: meta.tint }}>
        <Icon className="size-3" />
        <span className="text-[10px] uppercase tracking-wider" style={{ fontWeight: 700 }}>{meta.label}</span>
      </div>
      {member.role !== "owner" && (
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="size-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground">
            <MoreVertical className="size-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-10 bg-card border border-border rounded-xl shadow-lg w-32 overflow-hidden" onMouseLeave={() => setMenuOpen(false)}>
              <button onClick={() => { setMenuOpen(false); onRemove(); }} className="w-full px-3 py-2 text-xs text-left text-rose-600 hover:bg-rose-500/10 flex items-center gap-2">
                <Trash2 className="size-3" /> Remove
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InviteSheet({ onClose, onInvited }: { onClose: () => void; onInvited: (m: Member) => void }) {
  const [step, setStep] = useState<"form" | "link">("form");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("partner");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const inviteLink = useMemo(
    () => `https://livesync.app/invite?token=${Math.random().toString(36).slice(2, 12)}`,
    [],
  );

  const send = async () => {
    if (!email || !name) return;
    setSaving(true);
    try {
      const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
      const member = await api.create<Member>("family", {
        name, email, role, initials,
        joinedAt: new Date().toISOString(),
      });
      onInvited(member);
    } catch (e) {
      console.warn("invite failed", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-end" onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <motion.div
        initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-h-[92%] overflow-y-auto bg-card rounded-t-3xl p-5 pb-8"
      >
        <div className="flex justify-between items-center mb-4">
          <div className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>Invite to household</div>
          <button onClick={onClose} className="size-8 rounded-full bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>

        {step === "form" ? (
          <>
            <Label>Name</Label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Sharma" className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm mb-3 outline-none" />
            <Label>Email</Label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@email.com" className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm mb-3 outline-none" />
            <Label>Role</Label>
            <div className="space-y-2 mb-4">
              {(Object.keys(roleMeta) as Role[]).filter((r) => r !== "owner").map((r) => {
                const meta = roleMeta[r];
                const Icon = meta.icon;
                const on = role === r;
                return (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left ${on ? "border-primary bg-primary/5" : "border-border bg-muted/40"}`}
                  >
                    <div className="size-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: meta.tint + "15", color: meta.tint }}>
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm" style={{ fontWeight: 700 }}>{meta.label}</div>
                      <div className="text-[11px] text-muted-foreground">{meta.desc}</div>
                    </div>
                    {on && <Check className="size-4 text-primary" />}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep("link")}
                className="flex-1 border border-border rounded-xl py-3 text-sm"
                style={{ fontWeight: 600 }}
              >
                Share link
              </button>
              <button
                onClick={send}
                disabled={saving || !email || !name}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 text-sm disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ fontWeight: 700 }}
              >
                {saving && <Loader2 className="size-4 animate-spin" />} Send invite
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-xs text-muted-foreground mb-3">
              Share this link with anyone you want to add. The invite expires in 24 hours.
            </div>
            <div className="bg-muted/40 rounded-xl p-3 flex items-center gap-2 mb-4">
              <code className="text-[11px] flex-1 break-all">{inviteLink}</code>
              <button
                onClick={() => { navigator.clipboard?.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </button>
            </div>
            <button onClick={() => setStep("form")} className="w-full text-xs text-muted-foreground py-2" style={{ fontWeight: 600 }}>
              ← Back to invite by email
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>{children}</div>;
}

function seedSelf(): Member[] {
  return [{
    id: "self",
    name: "You",
    email: "you@livesync.app",
    role: "owner",
    initials: "ME",
    joinedAt: new Date().toISOString(),
  }];
}
