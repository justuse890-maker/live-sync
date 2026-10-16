/**
 * statementPdf.ts — read a bank statement PDF the user picks, entirely on the device.
 *
 *  1. readPdfRows()      pdf.js pulls the text out of the file, grouped into table rows (loaded only when needed)
 *  2. parseStatementRows()  turns those rows into dated entries — pure, so it is unit-tested without a PDF
 *
 * Nothing is uploaded and a statement password is used once, in memory, and never stored.
 * Image-only (scanned) PDFs have no text to read; those need the screenshot scanner instead.
 */
export type Cell = { x: number; w?: number; text: string };
export type PdfRow = Cell[];

export type StatementEntry = {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  /** "unknown" when neither the columns, the running balance nor wording told us — the importer then asks. */
  type: "income" | "expense" | "unknown";
  balance?: number;
};

export type StatementParse = { entries: StatementEntry[]; headerFound: boolean; ignoredRows: number };

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");

const DATE_FULL = /^(?:\d{1,2}[-/. ](?:\d{1,2}|[A-Za-z]{3,9})[-/. ,]*\d{2,4})$/;
const AMOUNT = /^\(?-?(?:₹|rs\.?|inr)?\s*\d{1,3}(?:,\d{2,3})*\.\d{2}\)?(?:\s?(?:cr|dr))?$|^\(?-?\d+\.\d{2}\)?(?:\s?(?:cr|dr))?$/i;

function toISO(raw: string): string | undefined {
  const t = raw.trim().replace(/\s+/g, " ");
  let m = t.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2}|\d{4})$/);
  let d: number, mo: number, y: number;
  if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else if ((m = t.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,9})[-/. ,]*(\d{2}|\d{4})$/))) { d = +m[1]; mo = MONTHS[m[2].slice(0, 3).toLowerCase()]; y = +m[3]; }
  else return undefined;
  if (y < 100) y += 2000;
  if (!mo || mo < 1 || mo > 12 || d < 1 || d > new Date(y, mo, 0).getDate()) return undefined;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

function money(text: string): { value: number; dir?: "cr" | "dr" } {
  const dir = /\bcr$/i.test(text.trim()) ? "cr" : /\bdr$/i.test(text.trim()) ? "dr" : undefined;
  const n = Number(text.replace(/[^\d.]/g, ""));
  return { value: isFinite(n) ? n : 0, dir };
}

/** If the row starts with a date, return it and how many cells it used. */
function leadingDate(row: PdfRow): { iso: string; used: number } | null {
  let acc = "";
  for (let i = 0; i < Math.min(3, row.length); i++) {
    acc = (acc ? acc + " " : "") + row[i].text.trim();
    if (DATE_FULL.test(acc)) { const iso = toISO(acc); if (iso) return { iso, used: i + 1 }; }
  }
  return null;
}

type Columns = { debit?: number; credit?: number; balance?: number };
const right = (c: Cell) => c.x + (c.w ?? 0);

function readHeader(row: PdfRow): Columns | null {
  const texts = row.map((c) => c.text.trim().toLowerCase());
  const has = (rx: RegExp) => texts.some((t) => rx.test(t));
  if (!(has(/^(narration|description|particulars|details|transaction (?:details|remarks)|remarks)$/) || has(/narration|particulars/)) || !has(/balance/)) return null;
  const find = (rx: RegExp) => row.find((c) => rx.test(c.text.trim().toLowerCase()));
  const d = find(/withdraw|debit|^dr\b/), c = find(/deposit|credit|^cr\b/), b = find(/balance/);
  if (!d && !c) return null;
  return { debit: d ? right(d) : undefined, credit: c ? right(c) : undefined, balance: b ? right(b) : undefined };
}

const CREDIT_WORDS = /\b(salary|sal\b|interest\s+(?:credit|paid)|refund|reversal|cashback|dividend|deposit|upi\/cr|neft\s*cr|imps\s*cr|by\s+transfer|credit)\b/i;
const DEBIT_WORDS = /\b(upi\/dr|atm|pos\b|emi|ach\s*d|nach|withdrawal|debit|purchase|bill\s*pay|charges?|fee)\b/i;
const FOOTER = /page\s+\d|statement\s+(?:of|period|summary)|closing\s+balance|opening\s+balance|total\b|computer[-\s]generated|registered\s+office|legend|toll\s*free/i;

export function parseStatementRows(rows: PdfRow[]): StatementParse {
  const entries: StatementEntry[] = [];
  let cols: Columns | null = null;
  let headerFound = false;
  let ignored = 0;
  let prevBalance: number | undefined;
  let last: StatementEntry | null = null;

  for (const row of rows) {
    if (!row.length) continue;
    const hdr = readHeader(row);
    if (hdr) { cols = hdr; headerFound = true; last = null; continue; }

    const dt = leadingDate(row);
    if (!dt) {
      // wrapped narration: only extend the previous entry with short, non-footer, amount-free text
      const text = row.map((c) => c.text.trim()).join(" ").trim();
      if (last && text && text.length < 80 && !FOOTER.test(text) && !row.some((c) => AMOUNT.test(c.text.trim()))) last.description = `${last.description} ${text}`.replace(/\s+/g, " ").trim();
      else ignored++;
      continue;
    }

    const rest = row.slice(dt.used);
    const amountCells = rest.filter((c) => AMOUNT.test(c.text.trim()));
    const description = rest.filter((c) => !AMOUNT.test(c.text.trim()) && !DATE_FULL.test(c.text.trim())).map((c) => c.text.trim()).join(" ").replace(/\s+/g, " ").trim();
    if (!amountCells.length || !description) { ignored++; last = null; continue; }

    // Last amount is the running balance when the row carries two or more.
    let balanceCell: Cell | undefined;
    let txnCells = amountCells;
    if (amountCells.length >= 2) { balanceCell = amountCells[amountCells.length - 1]; txnCells = amountCells.slice(0, -1); }
    const balance = balanceCell ? money(balanceCell.text).value : undefined;

    let type: StatementEntry["type"] = "unknown";
    let amount = 0;

    if (cols && (cols.debit !== undefined || cols.credit !== undefined)) {
      // choose by the nearest header column (amounts are right-aligned under their headings)
      for (const c of txnCells) {
        const dDist = cols.debit !== undefined ? Math.abs(right(c) - cols.debit) : Infinity;
        const cDist = cols.credit !== undefined ? Math.abs(right(c) - cols.credit) : Infinity;
        if (dDist === Infinity && cDist === Infinity) continue;
        amount = money(c.text).value;
        type = cDist < dDist ? "income" : "expense";
        break;
      }
    }

    if (type === "unknown" && txnCells.length) {
      const m = money(txnCells[0].text);
      amount = m.value;
      if (prevBalance !== undefined && balance !== undefined) {
        const delta = Math.round((balance - prevBalance) * 100) / 100;
        if (Math.abs(Math.abs(delta) - amount) < 0.011) type = delta > 0 ? "income" : "expense";
      }
      if (type === "unknown" && m.dir) type = m.dir === "cr" ? "income" : "expense";
      if (type === "unknown") {
        const c = CREDIT_WORDS.test(description), d = DEBIT_WORDS.test(description);
        if (c && !d) type = "income"; else if (d && !c) type = "expense";
      }
    }

    if (!(amount > 0)) { ignored++; last = null; continue; }
    if (balance !== undefined) prevBalance = balance;
    last = { date: dt.iso, description, amount, type, balance };
    entries.push(last);
  }
  return { entries, headerFound, ignoredRows: ignored };
}

// ── PDF → rows (pdf.js, loaded on demand) ───────────────────────────────────
export class PdfReadError extends Error {
  constructor(public kind: "needs_password" | "wrong_password" | "no_text" | "unreadable", message: string) { super(message); this.name = "PdfReadError"; }
}

export async function readPdfRows(data: ArrayBuffer, password?: string): Promise<PdfRow[]> {
  const pdfjs: any = await import("pdfjs-dist");
  const worker: any = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  let doc: any;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(data), password, isEvalSupported: false }).promise;
  } catch (e: any) {
    if (e?.name === "PasswordException") {
      throw new PdfReadError(e.code === 2 ? "wrong_password" : "needs_password", e.code === 2 ? "That password didn't open the PDF." : "This statement is password-protected.");
    }
    throw new PdfReadError("unreadable", "Couldn't open this PDF. Is it a bank statement downloaded from your bank?");
  }

  const rows: PdfRow[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const byLine = new Map<number, Cell[]>();
    for (const it of content.items as any[]) {
      const text = String(it.str ?? "").trim();
      if (!text) continue;
      const y = Math.round(it.transform[5] / 3); // items within ~3pt belong to one line
      const cells = byLine.get(y) ?? [];
      cells.push({ x: it.transform[4], w: it.width, text });
      byLine.set(y, cells);
    }
    [...byLine.entries()].sort((a, b) => b[0] - a[0]).forEach(([, cells]) => rows.push(cells.sort((a, b) => a.x - b.x)));
  }
  if (!rows.length) throw new PdfReadError("no_text", "This PDF has no readable text (it may be a scanned image). Try the screenshot scanner instead.");
  return rows;
}

/** Entries → the CSV-shaped table the existing importer already understands. */
export function entriesToTable(entries: StatementEntry[], unknownAs: "expense" | "income" = "expense"): { headers: string[]; rows: string[][] } {
  return {
    headers: ["Date", "Description", "Debit", "Credit"],
    rows: entries.map((e) => {
      const t = e.type === "unknown" ? unknownAs : e.type;
      return [e.date, e.description, t === "expense" ? e.amount.toFixed(2) : "", t === "income" ? e.amount.toFixed(2) : ""];
    }),
  };
}
