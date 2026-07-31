import { useEffect, useState } from "react";
import { FileText, Download, ShieldCheck, Clock, Building2, FolderLock, Brain, Loader2, ChevronRight, Trash2 } from "lucide-react";
import { Header, Screen } from "../Shell";
import { api } from "../../lib/api";
import { useStore } from "../../store";

type ConsentReceipt = {
  id: string;
  type: "account" | "document" | "ai" | "auth";
  subject: string;
  purpose: string;
  scope: string[];
  grantedAt: string;
  expiresAt?: string;
  processor: string;
  status: "active" | "expired" | "revoked";
};

const icons = { account: Building2, document: FolderLock, ai: Brain, auth: ShieldCheck };

export function Privacy({ onBack }: { onBack: () => void }) {
  const [receipts, setReceipts] = useState<ConsentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<ConsentReceipt | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [accounts, docs] = await Promise.all([
          api.list<any>("accounts"),
          api.list<any>("documents"),
        ]);

        const r: ConsentReceipt[] = [];

        for (const a of accounts) {
          r.push({
            id: `acc-${a.id}`,
            type: "account",
            subject: `${a.bank} · ${a.maskedNumber}`,
            purpose: "Personal finance management — read-only transaction & balance access",
            scope: a.scope || [],
            grantedAt: a.id.includes("-") ? new Date().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            expiresAt: a.consentExpiry,
            processor: `${a.aggregator} (RBI-licensed AA)`,
            status: a.status || "active",
          });
        }

        for (const d of docs) {
          r.push({
            id: `doc-${d.id}`,
            type: "document",
            subject: d.name,
            purpose: "Encrypted personal storage for retrieval by you",
            scope: ["Read by you only", "Encrypted at rest"],
            grantedAt: d.uploadedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            expiresAt: d.expiry,
            processor: "Supabase Storage (Mumbai)",
            status: "active",
          });
        }

        r.push({
          id: "ai-default",
          type: "ai",
          subject: "AI Coach & Insights",
          purpose: "Generate personalised financial coaching and category suggestions",
          scope: ["Aggregated category totals", "Goal & budget progress", "Runway metrics"],
          grantedAt: "2026-01-01",
          processor: "Google Gemini (via LiveSync)",
          status: "active",
        });

        r.push({
          id: "auth-default",
          type: "auth",
          subject: "Account authentication",
          purpose: "Verify identity and maintain a logged-in session",
          scope: ["Email", "Hashed password", "Session tokens"],
          grantedAt: "2026-01-01",
          processor: "Supabase Auth (GoTrue)",
          status: "active",
        });

        setReceipts(r);
      } catch (e) {
        console.error("Loading consent receipts failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const { deleteAllData } = useStore();
  const [wiping, setWiping] = useState(false);

  const exportReceipts = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), receipts }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `livesync-consent-receipts-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleWipe = async () => {
    if (window.confirm("Are you absolutely sure you want to WIPE all your financial data?\n\nThis will permanently delete all custom transactions, goals, budgets, sips, insurance, properties, and investments from your account. It will reset back to original seed data.")) {
      setWiping(true);
      try {
        await deleteAllData();
        alert("All custom databases successfully wiped and reset to seed defaults!");
      } catch (e) {
        console.error("Wipe failed:", e);
        alert("Failed to wipe data. Please check your internet connection.");
      } finally {
        setWiping(false);
      }
    }
  };

  return (
    <>
      <Header title="Privacy & Data" subtitle="Your data overview" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-indigo-700 text-white p-5">
            <div className="flex items-center gap-2">
              <FileText className="size-5" />
              <div className="text-sm" style={{ fontWeight: 700 }}>Your data at a glance</div>
            </div>
            <p className="text-xs text-white/80 mt-2 leading-relaxed">
              See exactly what data LiveSync processes, why, and by whom. Every data source — bank connections, documents, AI, auth — is listed below and can be downloaded.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={exportReceipts} className="bg-card border border-border rounded-xl py-3 text-xs flex items-center justify-center gap-1.5 hover:bg-muted/40 font-bold" style={{ fontWeight: 700 }}>
              <Download className="size-3.5" /> Download receipts
            </button>
            <button 
              onClick={handleWipe} 
              disabled={wiping}
              className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl py-3 text-xs flex items-center justify-center gap-1.5 hover:bg-rose-100/50 disabled:opacity-50 font-bold" 
              style={{ fontWeight: 700 }}
            >
              {wiping ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} 
              Wipe All Data
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <Section title={`Data sources · ${receipts.length}`}>
              {receipts.map((r) => {
                const Icon = icons[r.type];
                return (
                  <button key={r.id} onClick={() => setOpen(r)} className="w-full flex items-center gap-3 p-3.5 border-b border-border/60 last:border-0 hover:bg-muted/40 transition text-left">
                    <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate" style={{ fontWeight: 600 }}>{r.subject}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.processor}</div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                );
              })}
            </Section>
          )}

          <Section title="Your data rights">
            <RightRow title="Export your data" body="Download all your personal data as JSON from Security → Export." />
            <RightRow title="Edit your data" body="Edit transactions for 5 minutes after creation. For older entries, add an offsetting transaction or contact support." />
            <RightRow title="Delete your data" body="Delete your account and all data from Security → Delete my account. Deletion is immediate and irreversible." />
            <RightRow title="Get support" body="Email privacy@livesync.app for any data-related questions. We respond within 7 business days." />
          </Section>

          <div className="bg-card rounded-2xl p-4 border border-border/60 text-xs text-muted-foreground leading-relaxed">
            <div className="flex items-center gap-2 text-foreground mb-2" style={{ fontWeight: 700 }}>
              <Clock className="size-3.5 text-primary" /> Retention
            </div>
            Transactions and goals: stored until you delete them or close your account.
            AI prompts: not stored after processing — responses are ephemeral.
            Auth sessions: managed by Supabase Auth, invalidated on sign-out.
          </div>
        </div>
      </Screen>

      {open && <ReceiptSheet r={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function ReceiptSheet({ r, onClose }: { r: ConsentReceipt; onClose: () => void }) {
  const download = () => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `receipt-${r.id}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="absolute inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-h-[92%] overflow-y-auto bg-card rounded-t-3xl p-5 pb-8">
        <div className="font-display mb-1" style={{ fontSize: 18, fontWeight: 700 }}>Consent receipt</div>
        <div className="text-xs text-muted-foreground mb-4">Receipt ID · {r.id}</div>

        <Field label="Subject" value={r.subject} />
        <Field label="Purpose" value={r.purpose} />
        <Field label="Processor" value={r.processor} />
        <Field label="Granted on" value={r.grantedAt} />
        {r.expiresAt && <Field label="Expires on" value={r.expiresAt} />}
        <Field label="Status" value={r.status} />

        <div className="text-xs text-muted-foreground mb-1.5 mt-3" style={{ fontWeight: 600 }}>Scope</div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {r.scope.map((s) => <span key={s} className="text-[11px] bg-muted px-2 py-1 rounded-full" style={{ fontWeight: 600 }}>{s}</span>)}
        </div>

        <button onClick={download} className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm flex items-center justify-center gap-2" style={{ fontWeight: 700 }}>
          <Download className="size-4" /> Download receipt
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3">
      <div className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{label}</div>
      <div className="text-sm mt-0.5" style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function RightRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-3.5 border-b border-border/60 last:border-0">
      <div className="text-sm" style={{ fontWeight: 700 }}>{title}</div>
      <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">{body}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1" style={{ fontWeight: 600 }}>{title}</div>
      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">{children}</div>
    </div>
  );
}
