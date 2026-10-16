import { ArrowDownLeft, ArrowRightLeft, CreditCard } from "lucide-react";
import { KIND_BADGE, txKind } from "../lib/txKind";

const ICONS = { "arrow-right-left": ArrowRightLeft, "credit-card": CreditCard, "arrow-down-left": ArrowDownLeft } as const;
const STYLE = {
  transfer: "bg-sky-50 text-sky-800 border-sky-200",
  card_bill: "bg-violet-50 text-violet-800 border-violet-200",
  income: "bg-emerald-50 text-emerald-800 border-emerald-200",
} as const;

/** Word + icon (never colour alone) saying what kind of row this is. Plain spending shows no badge. */
export function TxKindBadge({ tx }: { tx: Parameters<typeof txKind>[0] }) {
  const kind = txKind(tx);
  const b = KIND_BADGE[kind];
  if (!b || kind === "spend") return null;
  const Icon = ICONS[b.icon as keyof typeof ICONS];
  return (
    <span title={b.hint} className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${STYLE[kind as keyof typeof STYLE]}`}>
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      {b.label}{kind === "transfer" ? " · not counted" : ""}
    </span>
  );
}
