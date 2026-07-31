import { useEffect, useRef, useState } from "react";
import { Upload, FileText, ShieldCheck, X, Download, Trash2, Loader2, AlertTriangle, ExternalLink, Lock } from "lucide-react";
import { Header, Screen } from "../Shell";
import { api } from "../../lib/api";

type Doc = {
  id: string;
  name: string;
  category: string;
  expiry?: string;
  size: number;
  mime: string;
  uploadedAt: string;
};

const categories = [
  { id: "identity", label: "Identity (PAN, Aadhaar, Passport, DL)" },
  { id: "tax", label: "Tax (ITR, Form-16, 26AS, AIS)" },
  { id: "insurance", label: "Insurance (Health, Term, Vehicle)" },
  { id: "property", label: "Property & Rent Agreements" },
  { id: "banking", label: "Banking (Statements, Cheques)" },
  { id: "investment", label: "Investments (MF, Stocks, NPS)" },
  { id: "medical", label: "Medical Records" },
  { id: "other", label: "Other" },
];

const fmtSize = (b: number) => b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

export function DocumentVault({ onBack }: { onBack: () => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = async () => {
    try {
      const items = await api.list<Doc>("documents");
      setDocs(items.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1)));
    } catch (e) {
      console.error("Loading documents failed:", e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    try {
      await api.remove("documents", id);
      setDocs((p) => p.filter((d) => d.id !== id));
    } catch (e) {
      console.error("Delete document failed:", e);
    }
  };

  const open = async (id: string) => {
    try {
      const url = await api.documentUrl(id);
      window.open(url, "_blank");
    } catch (e) {
      console.error("Get document URL failed:", e);
    }
  };

  const expiringSoon = docs.filter((d) => {
    if (!d.expiry) return false;
    const days = (new Date(d.expiry).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 60;
  });

  return (
    <>
      <Header title="Document Vault" subtitle="Secure private storage" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-indigo-700 text-white p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5" />
              <div className="text-sm" style={{ fontWeight: 700 }}>Private document storage</div>
            </div>
            <p className="text-xs text-white/80 mt-2 leading-relaxed">
              Files are stored in a private cloud bucket and accessed via time-limited signed URLs (60s). Only you can view them. Documents are never shared with third parties or AI models.
            </p>
            <a href="https://www.digilocker.gov.in/" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/95 underline">
              Prefer govt-issued copies? Use DigiLocker <ExternalLink className="size-3" />
            </a>
          </div>

          <button onClick={() => setUploadOpen(true)} className="w-full rounded-2xl border-2 border-dashed border-border text-muted-foreground py-3 flex items-center justify-center gap-2 hover:bg-card transition">
            <Upload className="size-4" />
            <span className="text-sm" style={{ fontWeight: 600 }}>Upload a document</span>
          </button>

          {expiringSoon.length > 0 && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
              <div className="flex items-center gap-1.5 mb-1" style={{ fontWeight: 700 }}>
                <AlertTriangle className="size-3.5" /> Expiring within 60 days
              </div>
              {expiringSoon.map((d) => (
                <div key={d.id}>• {d.name} — {d.expiry}</div>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : docs.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              No documents yet. Upload PAN, Aadhaar, insurance papers, ITR receipts and more.
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <DocRow key={d.id} doc={d} onOpen={() => open(d.id)} onRemove={() => remove(d.id)} />
              ))}
            </div>
          )}

          <div className="bg-card rounded-2xl p-4 border border-border/60 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-2 text-foreground mb-1" style={{ fontWeight: 700 }}>
              <Lock className="size-3.5 text-primary" /> Storage hygiene
            </div>
            <div>• Max 25 MB per file. PDF, JPG, PNG accepted.</div>
            <div>• Expired consent or deletion removes both metadata and the file blob.</div>
            <div>• You can export or erase your vault at any time from Security → Your data.</div>
          </div>
        </div>
      </Screen>
      {uploadOpen && <UploadSheet onClose={() => setUploadOpen(false)} onDone={(d) => { setDocs((p) => [d, ...p]); setUploadOpen(false); }} />}
    </>
  );
}

function DocRow({ doc, onOpen, onRemove }: { doc: Doc; onOpen: () => void; onRemove: () => void }) {
  const expDays = doc.expiry ? Math.ceil((new Date(doc.expiry).getTime() - Date.now()) / 86400000) : null;
  return (
    <div className="bg-card rounded-2xl p-4 border border-border/60">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <FileText className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate" style={{ fontWeight: 700 }}>{doc.name}</div>
          <div className="text-xs text-muted-foreground">{categories.find((c) => c.id === doc.category)?.label.split(" ")[0] || doc.category} · {fmtSize(doc.size)}</div>
        </div>
        <button onClick={onOpen} className="size-9 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10">
          <Download className="size-4" />
        </button>
        <button onClick={onRemove} className="size-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-600">
          <Trash2 className="size-4" />
        </button>
      </div>
      {doc.expiry && (
        <div className="mt-2 text-[11px]" style={{ fontWeight: 600 }}>
          <span className={expDays! < 0 ? "text-rose-600" : expDays! < 60 ? "text-amber-700" : "text-muted-foreground"}>
            {expDays! < 0 ? `Expired ${-expDays!}d ago` : `Expires in ${expDays} days (${doc.expiry})`}
          </span>
        </div>
      )}
    </div>
  );
}

function UploadSheet({ onClose, onDone }: { onClose: () => void; onDone: (d: Doc) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[0].id);
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { setErr("File too large (max 25 MB)"); return; }
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
    setErr(null);
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const item = await api.uploadDocument(file, category, name || file.name, expiry || undefined);
      onDone(item);
    } catch (e: any) {
      setErr(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-h-[92%] overflow-y-auto bg-card rounded-t-3xl p-5 pb-8">
        <div className="flex justify-between items-center mb-4">
          <div className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>Upload document</div>
          <button onClick={onClose} className="size-8 rounded-full bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>

        <input ref={inputRef} type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={(e) => pick(e.target.files?.[0] || null)} />
        <button onClick={() => inputRef.current?.click()} className="w-full rounded-2xl border-2 border-dashed border-border py-6 mb-4 text-sm text-muted-foreground hover:bg-muted/40">
          {file ? <span className="text-foreground" style={{ fontWeight: 600 }}>{file.name} · {fmtSize(file.size)}</span> : "Tap to choose a file (PDF, JPG, PNG)"}
        </button>

        <Field label="Document name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. PAN Card" className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm" />
        </Field>
        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm">
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Expiry date (optional)">
          <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm" />
        </Field>

        {err && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2.5 mb-3">{err}</div>}

        <button onClick={submit} disabled={!file || busy} className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm disabled:opacity-40 flex items-center justify-center gap-2" style={{ fontWeight: 700 }}>
          {busy && <Loader2 className="size-4 animate-spin" />} Upload securely
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}
