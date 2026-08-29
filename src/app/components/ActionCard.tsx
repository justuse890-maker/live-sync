// [P1] One-Tap Agentic Action Card — turns an insight into something the
// user can actually DO in one tap, instead of advice they have to go act
// on elsewhere. Two action kinds, both deliberately kept inside the
// existing, already-legal surface area of the app:
//
//   "move_to_bucket"  → moves money between the user's OWN in-app tracked
//                        buckets via the existing addBucketContribution()
//                        call. NOT a real bank transfer — no payment
//                        aggregator license needed.
//   "draft_message"   → asks Gemini (via api.negotiationScript) to draft a
//                        cancellation/negotiation message. The app never
//                        sends anything itself — the user copies and sends
//                        it, which keeps LiveSync out of "acting on your
//                        behalf" territory.
import { useState } from "react";
import { Check, Copy, Loader2, PiggyBank, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { inr } from "./types";

type MoveToBucketAction = {
  kind: "move_to_bucket";
  amount: number;
  bucketId: string;
  bucketName: string;
  onConfirm: (bucketId: string, amount: number) => Promise<void>;
};

type DraftMessageAction = {
  kind: "draft_message";
  negotiationKind: "credit_card_rate" | "insurance_premium" | "loan_rate" | "subscription_cancel";
  context: {
    name: string;
    currentAmount: number;
    currentRatePct?: number;
    marketBenchmarkPct?: number;
    tenureMonths?: number;
    hasGoodPaymentHistory?: boolean;
  };
};

export type AgenticAction = MoveToBucketAction | DraftMessageAction;

export function ActionCard({ title, subtitle, action }: { title: string; subtitle: string; action: AgenticAction }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [draftText, setDraftText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const runMoveToBucket = async (a: MoveToBucketAction) => {
    setStatus("loading");
    try {
      await a.onConfirm(a.bucketId, a.amount);
      setStatus("done");
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e?.message || "Couldn't complete this action.");
    }
  };

  const runDraftMessage = async (a: DraftMessageAction) => {
    setStatus("loading");
    try {
      const result = await api.negotiationScript(a.negotiationKind, a.context);
      setDraftText(result.text);
      setStatus("done");
    } catch (e: any) {
      setStatus("error");
      const msg: string = e?.message || "Couldn't draft this message.";
      setErrorMsg(msg.startsWith("RATE_LIMIT:") ? msg.replace("RATE_LIMIT: ", "") : msg);
    }
  };

  const handleClick = () => {
    if (action.kind === "move_to_bucket") runMoveToBucket(action);
    else runDraftMessage(action);
  };

  const copyDraft = async () => {
    if (!draftText) return;
    try {
      await navigator.clipboard.writeText(draftText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard permission denied — draft is still visible to select/copy manually */
    }
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {action.kind === "move_to_bucket" ? <PiggyBank className="size-4" /> : <Sparkles className="size-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm" style={{ fontWeight: 700 }}>{title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>

          {status === "idle" && (
            <button
              onClick={handleClick}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-primary text-white text-xs px-3 py-1.5"
              style={{ fontWeight: 600 }}
            >
              {action.kind === "move_to_bucket" ? `Move ${inr(action.amount)} to ${action.bucketName}` : "Draft message"}
            </button>
          )}

          {status === "loading" && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Working…
            </div>
          )}

          {status === "error" && (
            <div className="mt-2.5 text-xs text-rose-600">{errorMsg} <button onClick={() => setStatus("idle")} className="underline">Try again</button></div>
          )}

          {status === "done" && action.kind === "move_to_bucket" && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-emerald-700" style={{ fontWeight: 600 }}>
              <Check className="size-3.5" /> Moved {inr(action.amount)} to {action.bucketName}
            </div>
          )}

          {status === "done" && action.kind === "draft_message" && draftText && (
            <div className="mt-2.5">
              <div className="rounded-lg bg-white border border-border/60 p-2.5 text-xs text-slate-700 whitespace-pre-wrap">{draftText}</div>
              <button
                onClick={copyDraft}
                className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-primary"
                style={{ fontWeight: 600 }}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy message"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
