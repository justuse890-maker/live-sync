# LiveSync product roadmap PRD

**Prepared:** 25 August 2026  
**Product promise:** LiveSync is a private financial-organising companion. It turns records that the user chooses to add into clear, explainable next steps.

## Original-product principles

- Build from user needs, not another product’s UI, copy, branding, screens, or proprietary methodology.
- Use original names, visual design, information hierarchy, and interaction patterns.
- Every insight must identify the user-recorded data behind it and link to a useful in-app action.
- Keep financial data under user control. Request only the minimum data needed for the feature.
- Be precise about boundaries: a tracker and calculator are not a bank, payment service, lender, broker, insurer, tax filer, or financial adviser.

## User needs we are solving

| Need | LiveSync response |
| --- | --- |
| “What needs my attention today?” | A concise Financial Focus feed with factual, explainable signals. |
| “Where did my money go?” | Transaction categorisation, month comparisons, budgets, recurring-charge detection and reports. |
| “Can I meet my goals?” | Goal progress, a cash-flow view, emergency runway and scenario tools. |
| “What should I remember before a bill is due?” | Private card, insurance, loan and subscription date tracking. |
| “Can I see everything in one place?” | User-entered assets, liabilities, holdings and documents, with transparent data freshness. |

## Scope boundaries

### Included

- Manual tracking, CSV imports, calculations, reminders, visualisation and educational explanations.
- AI wording grounded in the user’s own recorded aggregate data and marked as an estimate when appropriate.

### Excluded until separately designed, partnered, and reviewed

- Money movement, trade execution, lending, underwriting, insurance distribution, tax return submission, bureau reporting or financial-product recommendations.
- Bank credentials, full payment-card details, CVV, PIN, OTP, PAN or Aadhaar collection.
- Claims that a calculated balance or reward is the official amount from an issuer.

## Delivery order

| Phase | Original feature | Outcome | Status |
| --- | --- | --- | --- |
| 1 | **Card Desk** | Private card records, tracked monthly spend, utilisation, payment-day countdown and optional user-defined reward estimate. | In progress |
| 2 | **Financial Focus** | A small dashboard feed of factual signals with a direct route to resolve each item. | In progress |
| 3 | **Import Confidence** | Column preview, duplicate detection, clear source labels and a last-updated time for imported records. | Planned |
| 4 | **Money Lab** | Educational calculators and scenario comparisons with assumptions visible to the user. | In progress |

## Phase 1: Card Desk flow

```text
Profile → Card Desk
              │
              ├─ No cards → Add card details safe to store → card list
              └─ Existing cards → current-month tracked spend
                               → limit-usage indicator
                               → payment-day countdown
                               → optional reward estimate

Quick Add → Expense → Credit payment mode → Select a stored card
          → card-linked transaction → Card Desk and Financial Focus update
```

### Acceptance criteria

1. The user can add, edit, and remove their own card records.
2. The screen requests no full card number, CVV, PIN, OTP, or bank password.
3. Monthly spend is derived only from transactions linked to that card in LiveSync.
4. Reward values are shown only when the user supplied a rate; they are labelled estimates.
5. A payment countdown is a reminder, never confirmation that a bill is paid or a statement is exact.

## Phase 2: Financial Focus flow

```text
Dashboard → Financial Focus
                   │
                   ├─ low savings signal → Budgets
                   ├─ recurring-cost signal → Subscription Shield
                   ├─ goal-progress signal → Savings Goals
                   └─ card-usage signal → Card Desk
```

### Acceptance criteria

1. Each card states the recorded data condition that triggered it.
2. Each card has one working in-app action.
3. The feed stays short (maximum three highest-priority items).
4. It makes no product recommendation or guarantee.

## Measures

- At least 60% of card creators link a later expense to a stored card.
- At least 40% of users with an open focus item use its linked action within 30 days.
- Fewer than 2% of card records are abandoned before completion.
- Zero flows initiate financial transactions or request sensitive banking/payment credentials.
