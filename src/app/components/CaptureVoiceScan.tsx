// Voice + Scan capture tabs for QuickAdd. Voice uses the browser's Web
// Speech API. Scan uses Tesseract OCR bundled in the app (lib/ocr.ts) — no API
// key, no upload, works offline. Both feed the parser in lib/capture.ts and
// produce drafts the user reviews before saving.
import { todayISO } from "../lib/dateUtils";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Camera, Loader2, Sparkles, X, Check, Image as ImageIcon, Trash2, Pencil } from "lucide-react";
import { useStore } from "../store";
import { parseUtterance, parseScan, SCAN_DOC_LABEL, type CapturedTx } from "../lib/capture";
import { preprocess, recognize, type OcrLang } from "../lib/ocr";
import { useVoiceLang } from "../lib/voiceLangs";
import { VoiceLangPicker } from "./VoiceLangPicker";

type Mode = "voice" | "scan";

export function CaptureVoiceScan({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const { addTransaction, categories } = useStore();
  const [drafts, setDrafts] = useState<CapturedTx[]>([]);
  const [transcript, setTranscript] = useState("");
  const [savingAll, setSavingAll] = useState(false);

  const commitAll = async () => {
    if (drafts.length === 0 || savingAll) return;
    setSavingAll(true);
    try {
      for (const d of drafts) {
        await addTransaction({
          title: (d.merchant || d.category || (d.type === "income" ? "Income" : "Expense")).trim(),
          category: d.category ?? (d.type === "income" ? "Income" : "Other"),
          amount: d.type === "income" ? d.amount : -d.amount,
          type: d.type,
          date: d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : todayISO(),
          merchant: d.merchant ? d.merchant.trim() : undefined,
          notes: (d.notes || transcript || "").trim() || undefined,
          source: mode,
        });
      }
      onClose();
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <div>
      {mode === "voice"
        ? <VoicePanel onTranscript={(t) => { setTranscript(t); setDrafts(parseUtterance(t)); }} transcript={transcript} />
        : <ScanPanel onText={(t, conf) => { setTranscript(""); const r = parseScan(t, [], conf); setDrafts(r ? [r] : []); }} />}

      {drafts.length > 0 && (
        <>
          <div className="mt-4 mb-2 flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: 600 }}>
              {drafts.length === 1 ? "Detected" : `${drafts.length} detected`}
            </div>
            <button onClick={() => setDrafts([])} className="text-[11px] text-muted-foreground hover:text-rose-600" style={{ fontWeight: 600 }}>
              Clear
            </button>
          </div>
          <div className="space-y-2 mb-4">
            {drafts.map((d, i) => (
              <DraftRow
                key={i}
                draft={d}
                categories={categories}
                onChange={(patch) => setDrafts((xs) => xs.map((x, idx) => idx === i ? { ...x, ...patch } : x))}
                onRemove={() => setDrafts((xs) => xs.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>
          <button
            onClick={commitAll}
            disabled={savingAll}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-sm flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ fontWeight: 700 }}
          >
            {savingAll ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Save {drafts.length} transaction{drafts.length === 1 ? "" : "s"}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Voice panel ────────────────────────────────────────────────────────────

function VoicePanel({ onTranscript, transcript }: { onTranscript: (t: string) => void; transcript: string }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [partial, setPartial] = useState("");
  const [lang, setLang] = useVoiceLang();
  const recRef = useRef<any>(null);

  useEffect(() => {
    const W: any = typeof window !== "undefined" ? window : {};
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;
    r.onresult = (ev: any) => {
      let finalT = "", interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalT += t; else interim += t;
      }
      if (finalT) onTranscript((transcript ? transcript + " " : "") + finalT.trim());
      setPartial(interim);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recRef.current = r;
    return () => { try { r.stop(); } catch {} };
    // transcript intentionally excluded — handler reads latest via closure prop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const toggle = () => {
    const r = recRef.current; if (!r) return;
    if (listening) { r.stop(); setListening(false); }
    else { try { r.start(); setListening(true); setPartial(""); } catch {} }
  };

  if (!supported) {
    return (
      <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-sm text-amber-900 dark:text-amber-200">
        Voice capture needs a browser with Web Speech API (Chrome, Edge, Safari). You can type the expense in the Manual tab instead.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3">
        <VoiceLangPicker value={lang} onChange={setLang} />
      </div>
      <div className="bg-muted/40 rounded-2xl p-5 text-center">
        <button
          onClick={toggle}
          className={`size-20 rounded-full mx-auto flex items-center justify-center transition-all ${
            listening ? "bg-rose-500 text-white animate-pulse" : "bg-primary text-primary-foreground"
          }`}
          aria-label={listening ? "Stop" : "Start"}
        >
          {listening ? <MicOff className="size-8" /> : <Mic className="size-8" />}
        </button>
        <div className="text-sm mt-3" style={{ fontWeight: 700 }}>
          {listening ? "Listening…" : "Tap to speak"}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1 px-2">
          Try: "Coffee 250 at Starbucks, Uber 340, lunch 480"
        </div>
      </div>

      {(transcript || partial) && (
        <div className="mt-3 bg-card border border-border rounded-2xl p-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ fontWeight: 600 }}>Transcript</span>
          </div>
          <div className="text-sm leading-relaxed">
            <span>{transcript}</span>
            {partial && <span className="text-muted-foreground italic"> {partial}</span>}
          </div>
          {transcript && (
            <button onClick={() => onTranscript("")} className="text-[11px] text-muted-foreground mt-2 hover:text-rose-600" style={{ fontWeight: 600 }}>
              Clear transcript
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Image preprocessor for high-res mobile photos ─────────────────────────

// ─── Scan panel ─────────────────────────────────────────────────────────────

function ScanPanel({ onText }: { onText: (t: string, ocrConfidence?: number) => void }) {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [ocrConf, setOcrConf] = useState<number | null>(null);
  const [lang, setLang] = useState<OcrLang>(() => { try { return (localStorage.getItem("ls_ocr_lang") as OcrLang) || "eng"; } catch { return "eng"; } });
  const lastFile = useRef<File | null>(null);

  const pick = async (file: File, langOverride?: OcrLang) => {
    const useLang = langOverride ?? lang;
    lastFile.current = file;
    setBusy(true);
    setError(null);
    setProgress(0);
    setOcrConf(null);
    setStage("Preparing image…");
    try {
      // 1. On-device clean-up: rotate, scale to ~300 DPI, grayscale, auto-contrast
      const { blob, previewUrl } = await preprocess(file);
      setPreview(previewUrl);
      // 2. On-device Tesseract OCR (bundled with the app — works offline)
      const res = await recognize(blob, useLang, (p) => { setStage(p.stage); setProgress(p.pct); });
      setOcrConf(res.confidence);
      if (!res.text) {
        setError("No text found. Hold the phone flat over the receipt, in good light, and fill the frame.");
      } else {
        setExtracted(res.text);
        onText(res.text, res.confidence);
        if (res.confidence < 45) setError("The photo is hard to read — please check the amount below, or retake in better light.");
      }
    } catch (e: any) {
      console.error("OCR failed", e);
      setError("Couldn't read this image. Try a clearer, well-lit photo — or type the total below.");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const switchLang = (l: OcrLang) => {
    setLang(l);
    try { localStorage.setItem("ls_ocr_lang", l); } catch {}
    if (lastFile.current && !busy) void pick(lastFile.current, l);
  };

  const reset = () => {
    setPreview(null);
    setExtracted("");
    setError(null);
    setProgress(0);
    setStage("");
    onText("");
  };

  return (
    <div>
      {!preview ? (
        <div className="bg-muted/40 rounded-2xl p-5">
          <div className="flex flex-col items-center text-center">
            <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
              <Camera className="size-6" />
            </div>
            <div className="text-sm" style={{ fontWeight: 700 }}>Scan a receipt or tax invoice</div>
            <div className="text-[11px] text-muted-foreground mt-1 px-4">
              Snap a photo or upload an image. We read the total, GST, date, shop and bill number right on your phone — the photo never leaves your device.
            </div>
            <div className="mt-3 flex gap-1 bg-card border border-border rounded-full p-0.5 text-[11px]" role="radiogroup" aria-label="Receipt language">
              {([["eng", "English receipt"], ["eng+hin", "English + हिन्दी"]] as const).map(([v, label]) => (
                <button key={v} role="radio" aria-checked={lang === v} onClick={() => switchLang(v)}
                  className={`px-3 py-1 rounded-full font-semibold ${lang === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{label}</button>
              ))}
            </div>
            <label className="mt-4 w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:opacity-95 transition-opacity" style={{ fontWeight: 700 }}>
              <Camera className="size-4" />
              Take photo
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
            </label>
            <label className="mt-2 w-full border border-border bg-card rounded-xl py-2.5 text-xs text-muted-foreground flex items-center justify-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors" style={{ fontWeight: 600 }}>
              <ImageIcon className="size-3.5" />
              Upload from gallery
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
            </label>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="relative aspect-[4/3] bg-black">
            <img src={preview} alt="receipt" className="w-full h-full object-contain" />
            <button onClick={reset} className="absolute top-2 right-2 size-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
              <X className="size-4" />
            </button>
            {busy && (
              <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-white px-6 text-center">
                <Loader2 className="size-7 animate-spin mb-2.5 text-primary" />
                <div className="text-sm" style={{ fontWeight: 700 }}>{stage || "Reading receipt…"}</div>
                {progress > 0 && <div className="text-xs text-primary-foreground/80 mt-1 font-mono">{progress}%</div>}
              </div>
            )}
          </div>
          {error && (
            <div className="px-4 py-3 text-xs text-rose-600 border-t border-border/60 bg-rose-50/50">{error}</div>
          )}
          {extracted && (
            <div className="p-3 border-t border-border/60">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ fontWeight: 600 }}>
                  Text read from receipt{ocrConf != null && <span className={`ml-1.5 normal-case tracking-normal ${ocrConf >= 70 ? "text-emerald-600" : ocrConf >= 45 ? "text-amber-600" : "text-rose-600"}`}>· {ocrConf}% clear</span>}
                </div>
                <button
                  onClick={() => onText(extracted, ocrConf ?? undefined)}
                  className="text-[10px] text-primary hover:underline"
                  style={{ fontWeight: 600 }}
                >
                  Re-parse details
                </button>
              </div>
              <textarea
                value={extracted}
                onChange={(e) => { setExtracted(e.target.value); onText(e.target.value, ocrConf ?? undefined); }}
                className="w-full bg-muted/40 rounded-lg p-2.5 text-xs outline-none resize-none font-mono"
                rows={4}
              />
              <div className="text-[10px] text-muted-foreground mt-1">Edit or paste text to trace every detail — the transaction card below updates in real time.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Draft row ──────────────────────────────────────────────────────────────

function DraftRow({
  draft, categories, onChange, onRemove,
}: {
  draft: CapturedTx;
  categories: string[];
  onChange: (patch: Partial<CapturedTx>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const tax = draft.tax;

  return (
    <div className="bg-card border border-border rounded-2xl p-3.5 space-y-2.5 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className="size-9 rounded-xl flex items-center justify-center text-xs shrink-0"
          style={{
            background: draft.type === "income" ? "#10B98115" : "#EF444415",
            color: draft.type === "income" ? "#059669" : "#DC2626",
            fontWeight: 700,
          }}
        >
          {draft.type === "income" ? "+" : "−"}
        </div>
        <div className="flex-1 min-w-0">
          {!editing ? (
            <>
              <div className="text-sm truncate" style={{ fontWeight: 700 }}>{draft.merchant || draft.category || "Untitled Store"}</div>
              {draft.docType && (
                <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Detected: {SCAN_DOC_LABEL[draft.docType]}
                </span>
              )}
              <div className="text-[11px] text-muted-foreground truncate">
                {draft.category ?? "Other"}{draft.date ? ` · ${draft.date}` : ""}
                {draft.paymentMode ? ` · ${draft.paymentMode}` : ""}
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <input
                value={draft.merchant ?? ""}
                onChange={(e) => onChange({ merchant: e.target.value })}
                placeholder="Merchant / Store Name"
                className="w-full bg-muted/40 rounded-md px-2 py-1 text-xs outline-none"
              />
              <select
                value={draft.category ?? ""}
                onChange={(e) => onChange({ category: e.target.value })}
                className="w-full bg-muted/40 rounded-md px-2 py-1 text-xs outline-none"
              >
                <option value="">Category</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 justify-end">
            <span className="text-sm text-muted-foreground" style={{ fontWeight: 700 }}>₹</span>
            <input
              inputMode="decimal"
              value={draft.amount || ""}
              onChange={(e) => onChange({ amount: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })}
              className="w-20 bg-transparent text-right text-sm outline-none font-mono"
              style={{ fontWeight: 700 }}
            />
          </div>
          <div className={`text-[10px] mt-0.5 ${draft.confidence >= 0.75 ? "text-emerald-600" : draft.confidence >= 0.5 ? "text-amber-600" : "text-rose-600"}`} style={{ fontWeight: 600 }}>
            {draft.confidence >= 0.75 ? "Looks right" : "Please check"}
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={() => setEditing((v) => !v)} className="size-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground">
            <Pencil className="size-3" />
          </button>
          <button onClick={onRemove} className="size-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-rose-600">
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      {draft.warnings && draft.warnings.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200/70 px-2.5 py-1.5 text-[11px] text-amber-800 space-y-0.5">
          {draft.warnings.map((w) => <div key={w}>• {w}</div>)}
        </div>
      )}

      {/* Traced tax & receipt metadata badges */}
      {(tax?.totalTax != null || draft.invoiceNumber || draft.subtotal != null || tax?.gstin) && (
        <div className="pt-2 border-t border-border/50 flex flex-wrap gap-1.5 text-[10px]">
          {draft.invoiceNumber && (
            <span className="px-2 py-0.5 rounded-md bg-muted text-foreground/80 font-mono" style={{ fontWeight: 600 }}>
              Inv #{draft.invoiceNumber}
            </span>
          )}
          {draft.subtotal != null && (
            <span className="px-2 py-0.5 rounded-md bg-muted/70 text-muted-foreground">
              Subtotal: ₹{draft.subtotal}
            </span>
          )}
          {tax?.totalTax != null && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60" style={{ fontWeight: 600 }}>
              GST: ₹{tax.totalTax}
              {tax.cgst != null && tax.sgst != null ? ` (CGST: ₹${tax.cgst} + SGST: ₹${tax.sgst})` : ""}
            </span>
          )}
          {draft.discount != null && draft.discount > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
              Disc: −₹{draft.discount}
            </span>
          )}
          {tax?.gstin && (
            <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200/60 font-mono text-[9px]">
              GSTIN: {tax.gstin}
            </span>
          )}
        </div>
      )}

      {/* Detected line items snippet */}
      {draft.items && draft.items.length > 0 && (
        <div className="bg-muted/30 rounded-xl p-2 text-[11px] text-muted-foreground space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70" style={{ fontWeight: 600 }}>
            Detected Items ({draft.items.length})
          </div>
          {draft.items.slice(0, 3).map((it, idx) => (
            <div key={idx} className="flex items-center justify-between text-foreground/80">
              <span className="truncate">{it.name} {it.qty && it.qty > 1 ? `× ${it.qty}` : ""}</span>
              {it.price != null && <span className="font-mono text-xs">₹{it.price}</span>}
            </div>
          ))}
          {draft.items.length > 3 && (
            <div className="text-[10px] text-muted-foreground italic">+{draft.items.length - 3} more items</div>
          )}
        </div>
      )}
    </div>
  );
}

