import { describe, expect, it } from "vitest";
import { findDuplicates, isSkipped, matchInstrument, parseDate, parseMessage, parsePasted, splitMessages, type ParsedMessage } from "../src/app/lib/messageParser";

const NOW = new Date(2026, 9, 10);
const ok = (s: string): ParsedMessage => {
  const r = parseMessage(s, NOW);
  if (isSkipped(r)) throw new Error(`skipped: ${r.reason} — ${s}`);
  return r;
};

describe("parseDate", () => {
  it("reads the formats banks use", () => {
    expect(parseDate("on 10-10-26 at")).toBe("2026-10-10");
    expect(parseDate("on 10/10/2026")).toBe("2026-10-10");
    expect(parseDate("dated 05-Oct-26.")).toBe("2026-10-05");
    expect(parseDate("on 05 Oct 2026")).toBe("2026-10-05");
    expect(parseDate("trf on 5Oct26 Refno")).toBe("2026-10-05");
  });
  it("rejects impossible dates and text without one", () => {
    expect(parseDate("on 31-02-26")).toBeUndefined();
    expect(parseDate("no date here")).toBeUndefined();
  });
});

describe("UPI debits", () => {
  it("bank-style 'debited from a/c … to VPA …'", () => {
    const m = ok("Rs.1,250.00 debited from a/c XX1234 on 10-10-26 to VPA swiggy@icici (UPI Ref No 628199301234). Not you? Call the bank.");
    expect(m).toMatchObject({ direction: "debit", kind: "expense", amount: 1250, date: "2026-10-10", last4: "1234", instrument: "upi", ref: "628199301234", merchant: "Swiggy", category: "Food" });
  });

  it("'debited by … trf to …'", () => {
    const m = ok("Dear UPI user A/C X4321 debited by 250.0 on date 10Oct26 trf to AMAZON Refno 628199301235. If not u? call 1800");
    expect(m).toMatchObject({ amount: 250, date: "2026-10-10", last4: "4321", merchant: "Amazon", category: "Shopping" });
  });

  it("'… debited for Rs … ; MERCHANT credited'", () => {
    const m = ok("ICICI Bank Acct XX987 debited for Rs 499.00 on 09-Oct-26; ZOMATO credited. UPI:628199301236.");
    expect(m).toMatchObject({ direction: "debit", amount: 499, date: "2026-10-09", last4: "987", merchant: "Zomato" });
  });
});

describe("cards", () => {
  it("credit-card spend", () => {
    const m = ok("Rs 2,345.00 spent on HDFC Bank Credit Card XX5678 at NETFLIX on 08-Oct-26. Avl limit Rs 1,00,000.");
    expect(m).toMatchObject({ kind: "expense", amount: 2345, instrument: "card", last4: "5678", merchant: "Netflix", date: "2026-10-08" });
  });

  it("'Txn of INR … on … Card ending …'", () => {
    const m = ok("Txn of INR 799 on SBI Card ending 4455 at BIGBASKET on 07/10/26. Available limit INR 50,000.");
    expect(m).toMatchObject({ amount: 799, last4: "4455", merchant: "BigBasket", category: "Grocery" });
  });
});

describe("credits", () => {
  it("salary by NEFT", () => {
    const m = ok("Rs.1,20,000.00 credited to a/c XX1234 on 01-10-26 by NEFT-ACME CORP-SALARY OCT. Avl Bal Rs.1,45,000.50");
    expect(m).toMatchObject({ direction: "credit", kind: "income", amount: 120000, category: "Salary", date: "2026-10-01", balance: 145000.5 });
  });

  it("UPI money received", () => {
    const m = ok("Rs 500.00 received in a/c XX1234 from VPA rohan@okhdfc on 10-10-26. UPI Ref 628199301240.");
    expect(m).toMatchObject({ kind: "income", amount: 500, merchant: "Rohan", ref: "628199301240" });
  });

  it("refund is flagged", () => {
    const m = ok("Refund of Rs 899.00 credited to a/c XX1234 on 10-10-26 by FLIPKART.");
    expect(m).toMatchObject({ kind: "income", category: "Refund" });
    expect(m.warnings.join(" ")).toMatch(/refund/i);
  });
});

describe("more bank styles", () => {
  it("names the payee after 'towards', ignores generic words like 'Mobile no'", () => {
    expect(ok("UPI mandate: Rs 649.00 debited towards NETFLIX COM from A/c XX1234 on 10-10-26. UMN 123").merchant).toBe("Netflix");
    expect(ok("Your a/c no. XXXXXXXX1234 is debited for Rs. 3,200.00 on 10-10-26 and a/c linked to Mobile no. 98XXXXXX10 credited (IMPS Ref no 628199301300)").merchant).toBeUndefined();
  });

  it("'Sent Rs. … to name@bank' and dates without a year", () => {
    const m = ok("Sent Rs.500.00 from Kotak Bank AC X1234 to rahul.k@okaxis on 10-10-26.UPI Ref 628199301299.");
    expect(m).toMatchObject({ amount: 500, merchant: "Rahul", last4: "1234" });
    expect(ok("Amt Sent Rs.80.00 From HDFC Bank A/C *1234 To MR CHAI WALA On 10/10 Ref 628199301301").date).toBe("2026-10-10");
  });

  it("a year-less date that would be in the future is read as last year", () => {
    expect(parseDate("debited on 25/12", new Date(2026, 9, 10))).toBe("2025-12-25");
  });
});

describe("special cases", () => {
  it("ATM withdrawal becomes a cash withdrawal, not spending", () => {
    const m = ok("Rs.5,000.00 withdrawn from a/c XX1234 at ATM on 10-10-26. Avl Bal Rs 20,000.");
    expect(m).toMatchObject({ kind: "cash_withdrawal", amount: 5000, instrument: "atm" });
  });

  it("card-bill payments carry a warning and the debt-service category", () => {
    const m = ok("Rs.15,000.00 debited from a/c XX1234 on 10-10-26 towards HDFC credit card bill payment. UPI Ref 628199301241");
    expect(m.category).toBe("Credit Card Bill");
    expect(m.warnings.join(" ")).toMatch(/card-bill/i);
  });

  it("the transaction amount is used, not the balance", () => {
    const m = ok("Avl Bal Rs 90,000.00. Rs 300.00 debited from a/c XX1234 on 10-10-26 to VPA chai@ybl.");
    expect(m.amount).toBe(300);
  });

  it("no date → warns and leaves the date for the caller", () => {
    const m = ok("Rs 120.00 debited from a/c XX1234 to VPA kirana@paytm");
    expect(m.date).toBeUndefined();
    expect(m.warnings.join(" ")).toMatch(/today/i);
  });
});

describe("what must be ignored", () => {
  const reasons = (s: string) => { const r = parseMessage(s, NOW); return isSkipped(r) ? r.reason : null; };
  it("OTPs", () => expect(reasons("123456 is your OTP for txn of Rs 500.00 at AMAZON. Do not share it.")).toMatch(/one-time/i));
  it("failed and declined payments", () => expect(reasons("Txn of Rs 500 on card XX1234 at AMAZON declined due to insufficient funds.")).toMatch(/failed|declined/i));
  it("offers", () => expect(reasons("Pre-approved loan up to Rs 5,00,000! Apply now, click link")).toMatch(/offer/i));
  it("bill reminders", () => expect(reasons("Your EMI of Rs 24,000 for loan A/c XX1234 is due on 05-11-26.")).toMatch(/reminder/i));
  it("balance-only and text with no money", () => {
    expect(reasons("Hello, your statement is ready")).toBeTruthy();
    expect(reasons("Avl Bal Rs 12,000.00 as on 10-10-26")).toBeTruthy();
  });
});

describe("pasting several messages", () => {
  const blob = [
    "Rs.250.00 debited from a/c XX1234 on 10-10-26 to VPA chai@ybl (UPI Ref No 111111111111).",
    "",
    "Rs.1,000.00 credited to a/c XX1234 on 10-10-26 by NEFT-ACME-SALARY.",
    "",
    "123456 is your OTP. Do not share.",
  ].join("\n");

  it("splits on blank lines and sorts parsed from skipped", () => {
    const r = parsePasted(blob, NOW);
    expect(r.messages).toHaveLength(2);
    expect(r.skipped).toHaveLength(1);
  });

  it("splits one-alert-per-line pastes too", () => {
    const lines = "Rs.100.00 debited from a/c XX1234 on 10-10-26 to VPA a@ybl.\nRs.200.00 debited from a/c XX1234 on 10-10-26 to VPA b@ybl.";
    expect(splitMessages(lines)).toHaveLength(2);
  });

  it("keeps a wrapped single message together", () => {
    expect(splitMessages("Rs.100.00 debited from\na/c XX1234 on 10-10-26")).toHaveLength(1);
  });
});

describe("findDuplicates", () => {
  const a = ok("Rs.250.00 debited from a/c XX1234 on 10-10-26 to VPA chai@ybl (UPI Ref No 111111111111).");
  const b = ok("Rs.250.00 debited from a/c XX1234 on 10-10-26 to VPA chai@ybl (UPI Ref No 111111111111).");
  const c = ok("Rs.900.00 debited from a/c XX1234 on 10-10-26 to VPA shop@ybl (UPI Ref No 222222222222).");

  it("flags a repeat inside the same paste", () => {
    expect([...findDuplicates([a, b, c], [], NOW)]).toEqual([1]);
  });

  it("flags an entry already in the ledger (same amount & direction within a day)", () => {
    const dups = findDuplicates([a, c], [{ type: "expense", amount: -250, date: "2026-10-09" }], NOW);
    expect([...dups]).toEqual([0]);
  });

  it("income is not a duplicate of an expense of the same size", () => {
    const inc = ok("Rs.250.00 credited to a/c XX1234 on 10-10-26 by NEFT-FRIEND.");
    expect(findDuplicates([inc], [{ type: "expense", amount: -250, date: "2026-10-10" }], NOW).size).toBe(0);
  });
});

describe("matchInstrument", () => {
  const accounts = [{ id: "a1", maskedNumber: "••1234" }, { id: "a2", maskedNumber: "XXXX9876" }];
  const cards = [{ id: "c1", last4Digits: "5678" }];
  it("links by last four digits", () => {
    expect(matchInstrument({ last4: "1234", instrument: "upi" }, accounts, cards)).toEqual({ accountId: "a1" });
    expect(matchInstrument({ last4: "5678", instrument: "card" }, accounts, cards)).toEqual({ creditCardId: "c1" });
  });
  it("a debit-card alert falls back to the account", () => {
    expect(matchInstrument({ last4: "9876", instrument: "card" }, accounts, cards)).toEqual({ accountId: "a2" });
  });
  it("links nothing when unknown or ambiguous", () => {
    expect(matchInstrument({ last4: "0000", instrument: "upi" }, accounts, cards)).toEqual({});
    expect(matchInstrument({ last4: "1234", instrument: "upi" }, [...accounts, { id: "a3", maskedNumber: "••1234" }], cards)).toEqual({});
    expect(matchInstrument({ instrument: "upi" }, accounts, cards)).toEqual({});
  });
});
