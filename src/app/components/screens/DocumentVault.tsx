import { useEffect, useRef, useState } from "react";
import {
  Upload,
  FileText,
  ShieldCheck,
  X,
  Download,
  Trash2,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Lock,
  Eye,
  CheckCircle2,
  FileCheck,
  Scale,
  Calendar,
  Layers,
  Image as ImageIcon,
  File,
  Sparkles,
} from "lucide-react";
import { Header, Screen } from "../Shell";
import { api } from "../../lib/api";

type Doc = {
  id: string;
  name: string;
  category: string;
  expiry?: string;
  size: number;
  mime?: string;
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

const fmtSize = (b: number) =>
  b < 1024
    ? `${b} B`
    : b < 1024 * 1024
    ? `${(b / 1024).toFixed(1)} KB`
    : `${(b / 1024 / 1024).toFixed(1)} MB`;

export function DocumentVault({ onBack }: { onBack: () => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewErr, setPreviewErr] = useState<string | null>(null);

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

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string, name: string) => {
    if (confirm(`Permanently delete "${name}" from your secure vault? This will erase both the record and the cloud storage file.`)) {
      try {
        await api.remove("documents", id);
        setDocs((p) => p.filter((d) => d.id !== id));
        if (previewDoc?.id === id) {
          setPreviewDoc(null);
          setPreviewUrl(null);
        }
      } catch (e) {
        console.error("Delete document failed:", e);
        alert("Failed to delete document. Please try again.");
      }
    }
  };

  const handlePreview = async (doc: Doc) => {
    setPreviewDoc(doc);
    setPreviewUrl(null);
    setPreviewLoading(true);
    setPreviewErr(null);
    try {
      const url = await api.documentUrl(doc.id);
      setPreviewUrl(url);
    } catch (e: any) {
      console.error("Get document URL failed:", e);
      setPreviewErr(e.message || "Failed to load secure document preview.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const expiringSoon = docs.filter((d) => {
    if (!d.expiry) return false;
    const days = (new Date(d.expiry).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 60;
  });

  return (
    <>
      <Header title="Document Vault" subtitle="Private cloud storage" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4 pb-20">
          
          {/* Top Security & Storage Banner */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 shadow-lg space-y-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Private Cloud Vault</div>
                <div className="text-[10px] text-slate-300">Authenticated access · short-lived preview links</div>
              </div>
            </div>
            <p className="text-xs text-slate-300/90 leading-relaxed">
              Uploaded files are stored in a <strong>non-public cloud bucket</strong>. The app requests access through an authenticated endpoint and creates a <strong>60-second signed preview link</strong>. Do not upload documents unless you are comfortable storing them with our cloud provider.
            </p>
            <a
              href="https://www.digilocker.gov.in/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-white underline pt-1 font-semibold"
            >
              Need official govt-issued copies? Open DigiLocker <ExternalLink className="size-3" />
            </a>
          </div>

          {/* Upload Button */}
          <button
            onClick={() => setUploadOpen(true)}
            className="w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary py-3.5 flex items-center justify-center gap-2 transition bg-card hover:bg-primary/5 active:scale-[0.99]"
          >
            <Upload className="size-4" />
            <span className="text-sm font-bold">Upload a document to Vault</span>
          </button>

          {/* Expiring Soon Alerts */}
          {expiringSoon.length > 0 && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1 font-bold text-amber-950">
                <AlertTriangle className="size-3.5 text-amber-600" /> Documents Expiring Soon (60 Days)
              </div>
              {expiringSoon.map((d) => (
                <div key={d.id} className="text-[11px] text-amber-800">
                  • {d.name} — Expires on {d.expiry}
                </div>
              ))}
            </div>
          )}

          {/* Document List */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border/60 p-6 space-y-2">
              <FileText className="size-10 text-muted-foreground/40 mx-auto mb-1" />
              <div className="text-sm font-bold text-slate-800">Your Document Vault is Empty</div>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Safely upload PAN cards, Aadhaar, insurance policies, ITR acknowledgments, or vehicle papers.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {docs.map((d) => (
                <DocRow
                  key={d.id}
                  doc={d}
                  onPreview={() => handlePreview(d)}
                  onRemove={() => remove(d.id, d.name)}
                />
              ))}
            </div>
          )}

          {/* Vault Security & Legal Disclaimers */}
          <div className="bg-card rounded-2xl p-4 border border-border/70 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-slate-800">
              <Scale className="size-4 text-primary" />
              <div className="text-xs font-bold uppercase tracking-wider">Vault Security & Legal Architecture</div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 leading-relaxed border-t border-border/40 pt-2.5">
              <div className="flex items-start gap-2">
                <span className="font-bold text-slate-800 shrink-0">1. Storage Location:</span>
                <span>Files are stored in a non-public Supabase Storage bucket and are served through authenticated application endpoints.</span>
              </div>

              <div className="flex items-start gap-2">
                <span className="font-bold text-slate-800 shrink-0">2. AI processing:</span>
                <span>This version does not send vault file contents to the AI endpoints used by the app. Do not treat the vault as a legal archive or a substitute for DigiLocker.</span>
              </div>

              <div className="flex items-start gap-2">
                <span className="font-bold text-slate-800 shrink-0">3. Important:</span>
                <span>We do not authenticate or certify uploaded documents. Keep original and statutory documents in an appropriate official service, such as DigiLocker, and maintain your own backup.</span>
              </div>
            </div>
          </div>
        </div>
      </Screen>

      {/* Upload Document Modal */}
      {uploadOpen && (
        <UploadSheet
          onClose={() => setUploadOpen(false)}
          onDone={(d) => {
            setDocs((p) => [d, ...p]);
            setUploadOpen(false);
          }}
        />
      )}

      {/* In-App Document Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          url={previewUrl}
          loading={previewLoading}
          error={previewErr}
          onClose={() => {
            setPreviewDoc(null);
            setPreviewUrl(null);
          }}
          onDelete={() => remove(previewDoc.id, previewDoc.name)}
        />
      )}
    </>
  );
}

function DocRow({
  doc,
  onPreview,
  onRemove,
}: {
  doc: Doc;
  onPreview: () => void;
  onRemove: () => void;
}) {
  const expDays = doc.expiry ? Math.ceil((new Date(doc.expiry).getTime() - Date.now()) / 86400000) : null;
  const isImage = doc.name.match(/\.(jpg|jpeg|png|webp|gif)$/i);
  const isPdf = doc.name.match(/\.pdf$/i);

  return (
    <div
      onClick={onPreview}
      className="bg-card rounded-2xl p-4 border border-border/60 shadow-sm hover:border-primary/40 cursor-pointer transition active:scale-[0.99] group"
    >
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {isImage ? <ImageIcon className="size-5" /> : isPdf ? <FileCheck className="size-5" /> : <FileText className="size-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-800 truncate group-hover:text-primary transition">
            {doc.name}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <span className="font-medium">{categories.find((c) => c.id === doc.category)?.label.split(" ")[0] || doc.category}</span>
            <span>&middot;</span>
            <span>{fmtSize(doc.size)}</span>
            <span>&middot;</span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.2 rounded">
              Private storage
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            title="Preview Document"
            className="size-9 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10"
          >
            <Eye className="size-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Delete Document"
            className="size-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {doc.expiry && (
        <div className="mt-2.5 pt-2 border-t border-border/40 text-[11px] font-semibold flex items-center justify-between">
          <span className="text-muted-foreground">Expiry Date:</span>
          <span className={expDays! < 0 ? "text-rose-600 font-bold" : expDays! < 60 ? "text-amber-700 font-bold" : "text-slate-700"}>
            {expDays! < 0 ? `Expired ${-expDays!}d ago (${doc.expiry})` : `Expires in ${expDays} days (${doc.expiry})`}
          </span>
        </div>
      )}
    </div>
  );
}

function DocumentPreviewModal({
  doc,
  url,
  loading,
  error,
  onClose,
  onDelete,
}: {
  doc: Doc;
  url: string | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onDelete: () => void;
}) {
  const isImage = doc.name.match(/\.(jpg|jpeg|png|webp|gif)$/i) || doc.mime?.startsWith("image/");
  const isPdf = doc.name.match(/\.pdf$/i) || doc.mime?.includes("pdf");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-card rounded-3xl overflow-hidden shadow-2xl border border-border flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/60 bg-card">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Lock className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 truncate">{doc.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {categories.find((c) => c.id === doc.category)?.label.split(" ")[0]} · {fmtSize(doc.size)}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full bg-muted flex items-center justify-center text-slate-500 hover:text-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 overflow-y-auto bg-slate-900/5 p-4 flex items-center justify-center min-h-[300px]">
          {loading ? (
            <div className="text-center py-12 space-y-2">
              <Loader2 className="size-8 animate-spin text-primary mx-auto" />
              <div className="text-xs font-semibold text-muted-foreground">Loading encrypted preview...</div>
            </div>
          ) : error ? (
            <div className="text-center py-8 p-4 text-xs text-rose-600 bg-rose-50 rounded-2xl border border-rose-200">
              <AlertTriangle className="size-6 text-rose-500 mx-auto mb-2" />
              {error}
            </div>
          ) : url ? (
            <div className="w-full flex items-center justify-center">
              {isImage ? (
                <img
                  src={url}
                  alt={doc.name}
                  className="max-h-[60vh] max-w-full rounded-xl object-contain shadow-md border border-border"
                />
              ) : isPdf ? (
                <iframe
                  src={url}
                  title={doc.name}
                  className="w-full h-[60vh] rounded-xl border border-border bg-white"
                />
              ) : (
                <div className="text-center py-10 space-y-3">
                  <File className="size-16 text-primary/60 mx-auto" />
                  <div className="text-sm font-bold text-slate-800">{doc.name}</div>
                  <p className="text-xs text-muted-foreground">Direct in-app rendering not supported for this file type.</p>
                  <a
                    href={url}
                    download={doc.name}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-4 py-2.5 rounded-xl text-xs shadow-sm"
                  >
                    <Download className="size-4" /> Download File
                  </a>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Security & Action Footer */}
        <div className="p-4 border-t border-border/60 bg-card space-y-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-slate-50 p-2.5 rounded-xl border border-border/40">
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <ShieldCheck className="size-3.5" /> Private SSL Bucket
            </span>
            <span>Not sent to this app's AI endpoints</span>
          </div>

          <div className="flex gap-2">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                download={doc.name}
                className="flex-1 bg-primary text-primary-foreground font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition hover:bg-primary/95"
              >
                <Download className="size-3.5" /> Download / Open
              </a>
            )}
            <button
              onClick={onDelete}
              className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadSheet({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (d: Doc) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[0].id);
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) {
      setErr("File too large (max 25 MB)");
      return;
    }
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
      setErr(e.message || "Upload failed. Please check network connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 animate-in fade-in" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[92%] overflow-y-auto bg-card rounded-t-3xl p-5 pb-8 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200"
      >
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-border/50">
          <div className="font-bold text-base text-slate-900">Upload to Private Vault</div>
          <button
            onClick={onClose}
            className="size-8 rounded-full bg-muted flex items-center justify-center text-slate-500"
          >
            <X className="size-4" />
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0] || null)}
        />
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/50 py-6 mb-4 text-sm text-muted-foreground hover:bg-muted/40 transition flex flex-col items-center justify-center gap-1.5"
        >
          <Upload className="size-6 text-primary mb-1" />
          {file ? (
            <span className="text-slate-900 font-bold text-xs">{file.name} · {fmtSize(file.size)}</span>
          ) : (
            <>
              <span className="font-bold text-slate-800 text-xs">Tap to choose a document</span>
              <span className="text-[11px] text-muted-foreground">Supports PDF, JPG, PNG, WebP (Max 25 MB)</span>
            </>
          )}
        </button>

        <div className="space-y-3.5">
          <div>
            <label className="text-xs text-muted-foreground font-bold block mb-1">Document Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. PAN Card, Health Insurance"
              className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm border border-border outline-none font-medium"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-bold block mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm border border-border outline-none font-medium"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-bold block mb-1">Expiry Date (Optional)</label>
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm border border-border outline-none font-medium"
            />
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-[11px] text-emerald-800 flex items-center gap-2">
            <Lock className="size-4 shrink-0 text-emerald-600" />
            <span>Files are uploaded to private cloud storage. This upload flow does not send file contents to the app's AI endpoints.</span>
          </div>

          {err && <div className="text-xs text-rose-600 bg-rose-50 rounded-xl p-2.5 border border-rose-200">{err}</div>}

          <button
            onClick={submit}
            disabled={!file || busy}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2 shadow-sm transition hover:bg-primary/95"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            {busy ? "Uploading..." : "Upload to Private Vault"}
          </button>
        </div>
      </div>
    </div>
  );
}
