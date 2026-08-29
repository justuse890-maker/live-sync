// Voice + Scan capture tabs for QuickAdd. Voice uses the browser's Web
// Speech API (free, on-device on Chrome/Edge/Safari). Scan uses Tesseract.js
// for client-side OCR — no API key, no upload, runs in WASM. Both feed the
// same parser in lib/capture.ts and produce reviewable transaction drafts.

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Camera, Loader2, Sparkles, X, Check, Image as ImageIcon, Trash2, Pencil } from "lucide-react";
import { useStore } from "../store";
import { parseUtterance, parseReceipt, type CapturedTx } from "../lib/capture";
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
          date: d.date ? new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "2-digit" })
                       : new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit" }),
          merchant: d.merchant ? d.merchant.trim() : undefined,
          notes: transcript ? transcript.trim() : undefined,
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
        : <ScanPanel onText={(t) => { setTranscript(t); const r = parseReceipt(t); setDrafts(r ? [r] : []); }} />}

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

// ─── Scan panel ─────────────────────────────────────────────────────────────

function ScanPanel({ onText }: { onText: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File) => {
    setBusy(true); setError(null); setProgress(0);
    setPreview(URL.createObjectURL(file));
    try {
      const Tesseract = (await import("tesseract.js")).default;
      const { data } = await Tesseract.recognize(file, "eng", {
        logger: (m: any) => { if (m?.progress != null) setProgress(Math.round(m.progress * 100)); },
      });
      const text = data?.text?.trim() ?? "";
      setExtracted(text);
      onText(text);
    } catch (e: any) {
      console.error("OCR failed", e);
      setError("Couldn't read this image. Try a clearer photo or paste the text below.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setPreview(null); setExtracted(""); setError(null); setProgress(0); onText(""); };

  return (
    <div>
      {!preview ? (
        <div className="bg-muted/40 rounded-2xl p-5">
          <div className="flex flex-col items-center text-center">
            <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
              <Camera className="size-6" />
            </div>
            <div className="text-sm" style={{ fontWeight: 700 }}>Scan a receipt</div>
            <div className="text-[11px] text-muted-foreground mt-1 px-4">
              Snap a photo or upload an image. We extract total, merchant, and category on-device — your receipt never leaves your phone.
            </div>
            <label className="mt-4 w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm flex items-center justify-center gap-2 cursor-pointer" style={{ fontWeight: 700 }}>
              <Camera className="size-4" />
              Take photo
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
            </label>
            <label className="mt-2 w-full border border-border rounded-xl py-2.5 text-xs text-muted-foreground flex items-center justify-center gap-2 cursor-pointer" style={{ fontWeight: 600 }}>
              <ImageIcon className="size-3.5" />
              Upload from gallery
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
            </label>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="relative aspect-[4/3] bg-black">
            <img src={preview} alt="receipt" className="w-full h-full object-contain" />
            <button onClick={reset} className="absolute top-2 right-2 size-8 rounded-full bg-black/60 text-white flex items-center justify-center">
              <X className="size-4" />
            </button>
            {busy && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white">
                <Loader2 className="size-6 animate-spin mb-2" />
                <div className="text-sm" style={{ fontWeight: 700 }}>Reading receipt…</div>
                <div className="text-xs opacity-70 mt-1">{progress}%</div>
              </div>
            )}
          </div>
          {error && (
            <div className="px-4 py-3 text-xs text-rose-600 border-t border-border/60">{error}</div>
          )}
          {extracted && (
            <div className="p-3 border-t border-border/60">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>Extracted text</div>
              <textarea
                value={extracted}
                onChange={(e) => { setExtracted(e.target.value); onText(e.target.value); }}
                className="w-full bg-muted/40 rounded-lg p-2.5 text-xs outline-none resize-none font-mono"
                rows={5}
              />
              <div className="text-[10px] text-muted-foreground mt-1">Edit the text if OCR missed something — the draft below will update.</div>
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
  return (
    <div className="bg-card border border-border rounded-2xl p-3">
      <div className="flex items-center gap-3">
        <div
          className="size-9 rounded-lg flex items-center justify-center text-xs"
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
              <div className="text-sm truncate" style={{ fontWeight: 700 }}>{draft.merchant || draft.category || "Untitled"}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {draft.category ?? "Other"}{draft.date ? ` · ${draft.date}` : ""}
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <input
                value={draft.merchant ?? ""}
                onChange={(e) => onChange({ merchant: e.target.value })}
                placeholder="Merchant"
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
        <div className="text-right">
          <div className="flex items-center gap-1 justify-end">
            <span className="text-sm" style={{ fontWeight: 700 }}>₹</span>
            <input
              inputMode="decimal"
              value={draft.amount || ""}
              onChange={(e) => onChange({ amount: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })}
              className="w-20 bg-transparent text-right text-sm outline-none"
              style={{ fontWeight: 700 }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{Math.round(draft.confidence * 100)}% conf.</div>
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={() => setEditing((v) => !v)} className="size-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground">
            <Pencil className="size-3" />
          </button>
          <button onClick={onRemove} className="size-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-rose-600">
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
