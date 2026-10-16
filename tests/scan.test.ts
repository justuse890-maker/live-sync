import { describe, expect, it } from "vitest";
import { classifyScan, parseScan } from "../src/app/lib/capture";

const GPAY_SENT = `Google Pay
₹1,250
Payment successful
Paid to
Sharma Medical Store
UPI ID: sharmamed@oksbi
8 Oct 2026, 3:45 PM
UPI transaction ID
426891234567
Paid from HDFC Bank 1234`;

const PHONEPE_RECEIVED = `PhonePe
Received from
Rahul Verma
₹5,000
Money received successfully
10 Oct 2026 11:02 AM
UTR: 428811223344`;

const ELECTRICITY = `BESCOM
Electricity Bill
Consumer No: 1234567890
Bill Date: 01/10/2026
Due Date: 18/10/2026
Units consumed 312
Amount Payable  ₹ 2,845.00`;

const PAYSLIP = `Acme Technologies Pvt Ltd
Pay Slip for Sep 2026
Basic 40,000
HRA 20,000
PF 4,800
Total Deductions 6,200
Net Pay 53,800.00`;

const RECEIPT = `Hotel Saravana Bhavan
GSTIN 29ABCDE1234F1Z5
Masala Dosa  2  240.00
Filter Coffee 2  80.00
Sub Total 320.00
CGST 2.5% 8.00
SGST 2.5% 8.00
Grand Total 336.00
Date: 09/10/2026`;

describe("document classification", () => {
  it("recognises each document type", () => {
    expect(classifyScan(GPAY_SENT)).toBe("upi_sent");
    expect(classifyScan(PHONEPE_RECEIVED)).toBe("upi_received");
    expect(classifyScan(ELECTRICITY)).toBe("utility_bill");
    expect(classifyScan(PAYSLIP)).toBe("salary");
    expect(classifyScan(RECEIPT)).toBe("receipt");
  });
});

describe("scan extraction", () => {
  it("UPI payment → expense with merchant, amount, date and reference", () => {
    const r = parseScan(GPAY_SENT)!;
    expect(r.type).toBe("expense");
    expect(r.amount).toBe(1250);
    expect(r.merchant).toMatch(/Sharma Medical Store/i);
    expect(r.date).toBe("2026-10-08");
    expect(r.category).toBe("Medical");
    expect(r.notes).toContain("426891234567");
    expect(r.paymentMode).toBe("UPI");
  });
  it("money received → income", () => {
    const r = parseScan(PHONEPE_RECEIVED)!;
    expect(r.type).toBe("income");
    expect(r.amount).toBe(5000);
    expect(r.merchant).toMatch(/Rahul Verma/i);
  });
  it("utility bill → Bills expense using the amount payable, not the consumer number or units", () => {
    const r = parseScan(ELECTRICITY)!;
    expect(r.amount).toBe(2845);
    expect(r.category).toBe("Bills");
    expect(r.merchant).toMatch(/bescom/i);
    expect(r.notes).toContain("Due 2026-10-18");
    expect(r.warnings?.join(" ")).toMatch(/may not be paid/);
  });
  it("salary slip → income Salary from net pay, not gross or deductions", () => {
    const r = parseScan(PAYSLIP)!;
    expect(r.type).toBe("income");
    expect(r.category).toBe("Salary");
    expect(r.amount).toBe(53800);
  });
  it("shop receipt still uses the grand total, with tax split", () => {
    const r = parseScan(RECEIPT)!;
    expect(r.amount).toBe(336);
    expect(r.tax?.totalTax).toBe(16);
    expect(r.docType).toBe("receipt");
  });
  it("returns null for text with no amount", () => {
    expect(parseScan("hello world")).toBeNull();
  });
});
