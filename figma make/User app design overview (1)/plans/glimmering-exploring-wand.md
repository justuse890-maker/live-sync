# Transaction Import + Country-aware Tax + Premium Gating

## Context

Users coming from other finance apps (Walnut, Money Manager, bank exports) currently have no way to seed LiveSync with their history — they would have to retype every row. We need a CSV/Excel importer that:

- Parses common shapes (date, description, amount, optional category/type).
- **De-duplicates merchant names** so "Flipkart", "flipkart", "Flpkart", "FLIPKART INDIA PVT LTD" collapse into one canonical merchant — not three rows in the dropdown.
- Maps each row to an existing category, or lets the user pick / create a custom one inline. No silent "Other" dumping.
- Uses AI **only** for the ambiguous remainder (merchant normalisation + category suggestion) after local heuristics run, and only sends merchant strings — never amounts.

Separately, the app currently hard-codes Indian tax assumptions (₹, FY, slabs). Users abroad have asked for country selection. This is a **paid-only** feature: free users see a paywall. Switching country wipes cloud-synced data (with a typed-confirm warning) but leaves device-local data untouched, matching the local-first stance.

Both features reinforce the local-first/privacy posture: imported rows stay local-first, AI sees minimum payload, and the warning copy makes the cloud/local distinction visible.

---

## Feature 1 — Transaction Import

### Entry point
- Add **"Import transactions"** action on `src/app/components/screens/Transactions.tsx` header and in Profile → "Import data".
- Opens new screen `src/app/components/screens/ImportTransactions.tsx`, routed via the existing `screen === "import"` pattern in `src/app/UserApp.tsx` (same pattern as the 23 other screens).

### Flow (4 steps in one screen, stepper at top)

1. **Upload** — file input accepts `.csv, .xlsx`. Parse with:
   - CSV: `papaparse` (install)
   - Excel: `xlsx` (install, SheetJS)
   Detect delimiter and header row automatically; show first 5 parsed rows.

2. **Column mapping** — dropdowns to map source columns → `{date, description, amount, type?, category?}`. Auto-guess based on header names (`date|txn date|posting`, `amount|debit|credit`, `description|narration|merchant`, etc.). If only debit/credit columns exist, derive `type` and signed amount.

3. **Merchant + category review** — the heart of the feature. See dedicated section below.

4. **Confirm** — show summary (N income, M expense, total ₹X), commit via `store.addTransaction()` in a loop. Each row gets `createdAt: Date.now()` so the existing 5-min edit window doesn't fire on imported history.

### Merchant normalisation (the "no flipkart/flkart mess" requirement)

New module `src/app/lib/merchantNormalize.ts`:

- **Step A — strip noise**: uppercase, drop common bank-statement prefixes (`UPI/`, `POS `, `NEFT/`, `IMPS/`, `*XXXX`), trailing IDs/dates, location suffixes (`MUMBAI`, `BLR`), legal suffixes (`PVT LTD`, `LIMITED`, `INDIA`).
- **Step B — known-brand dictionary**: ship a small JSON of ~150 Indian merchants (`flipkart, amazon, swiggy, zomato, blinkit, zepto, bigbasket, ola, uber, irctc, …`) mapped to canonical name + default category. Exact match after Step A wins.
- **Step C — fuzzy cluster**: for remaining unmatched strings, group rows whose normalised forms have Levenshtein distance ≤ 2 (use `fast-levenshtein` or a tiny inline implementation — no need for a heavyweight dep). Pick the highest-frequency variant as the canonical name for the cluster.
- **Step D — AI fallback (paid users only, opt-in)**: for clusters still ambiguous, batch-send **only the merchant strings** (no amounts, no dates, no user identity) to a new edge function route `POST /make-server-a3fe149f/ai/normalize-merchants` returning `{canonical, category}` per input. Gated by the existing `aiOptIn` setting in `Security.tsx` and by entitlements (see Feature 3). Falls back gracefully to "Uncategorised" if the user declines or is on free.

The review UI shows one row per **cluster** (not per transaction): canonical name, count, suggested category, plus an expander to inspect raw variants. The user can rename the canonical, reassign category, or split the cluster. Category dropdown lists existing categories from `store.categories` (DEFAULT_CATEGORIES + custom) with an inline **"+ Create category"** action that writes via `api.create("categories", …)`.

### Server: AI normalize route

`supabase/functions/server/index.tsx`:

- Add `POST /ai/normalize-merchants` accepting `{ merchants: string[] }` (cap at 100 per call). Verifies auth, checks the caller's entitlements (importer is a paid feature; see Feature 3), reads `OPENAI_API_KEY` from env (use `create_supabase_secret` if not set), and calls a cheap model with a strict JSON-schema prompt returning `[{input, canonical, category}]`. Log token usage to `ai-cost:${userId}:${day}` KV key for the existing AI Cost dashboard slot.
- Reuse the auth + CORS + error patterns already in `index.tsx`.

---

## Feature 2 — Country selector (paid)

### Where
- New section in `src/app/components/screens/Security.tsx` titled **"Region & tax"** (or a new `Preferences.tsx` if Security gets crowded — Security is already ~25 settings so a sibling screen is cleaner). Routed alongside Privacy.
- Top-5 country list: **India (default), United States, United Kingdom, United Arab Emirates, Singapore**. Stored on the existing `preferences` settings record as `country: "IN"|"US"|"GB"|"AE"|"SG"`. Default `"IN"` when unset.

### Tax pack per country
- New module `src/app/lib/taxPacks.ts` exporting `TAX_PACKS: Record<CountryCode, TaxPack>` with: currency symbol + locale, fiscal-year boundaries, income-tax slabs (old + new regime where applicable), standard deductions, capital-gains rules, and any country-specific bits the existing `intelligence.ts` and Tax screen consume.
- Update `src/app/lib/intelligence.ts` and `src/app/components/screens/Tax.tsx` to look up the active pack via a new `useCountry()` hook (reads from settings store) instead of hard-coded INR/FY constants. Currency formatter `inr()` becomes `fmt(amount, country)` — a thin shim so existing call sites can be swapped incrementally.

### Switch warning
- Changing country pops a modal with a **typed confirmation** ("type the new country name to confirm"). Copy:
  > "Switching to {Country}. **Cloud-synced data will be cleared** to keep your books consistent with {Country}'s tax year and currency. Data stored only on this device is unaffected — it's like opening a fresh book."
- On confirm: call new server route `POST /me/switch-country` that wipes the user's KV prefixes (`transactions:`, `goals:`, `loans:`, `assets:`, `liabs:`, `categories:` — not `settings:`, not `subscription:`). Re-seed default categories for the new country.

### Premium gate
- The country picker itself is locked for free users: show a `<PremiumLock feature="country" />` overlay (see Feature 3). Importer is also locked the same way.

---

## Feature 3 — Reusable premium gating (prerequisite for 1 & 2)

Right now the user app has no entitlement checking — admin can assign plans but the client doesn't enforce. We need this for the importer and country picker.

- **Hook**: `src/app/lib/useEntitlements.ts` — fetches `api.subscription()` (already exists at `src/app/lib/api.ts:78`, returns `{subscription, offer, plan, entitlements, inTrial}` per the server contract). Cache in a React context provider mounted in `UserApp.tsx`. Re-fetches on focus and after plan changes.
- **Component**: `src/app/components/PremiumLock.tsx` — wraps children, renders blur overlay + "Upgrade to Pro" CTA when `!entitlements[feature] && !inTrial`. CTA routes to a new `Pricing.tsx` screen.
- Add the two new feature keys to the server's `ALL_FEATURES` constant in `index.tsx`: `"import"`, `"country"`. Both are included in Pro and in the 7-day Free trial. The admin Feature toggle UI in `UserDetail.tsx` will pick these up automatically.

---

## Files to create

- `src/app/components/screens/ImportTransactions.tsx`
- `src/app/components/screens/Pricing.tsx`
- `src/app/components/PremiumLock.tsx`
- `src/app/lib/useEntitlements.ts`
- `src/app/lib/merchantNormalize.ts`
- `src/app/lib/merchantDictionary.json`
- `src/app/lib/taxPacks.ts`
- `src/app/lib/useCountry.ts`

## Files to modify

- `src/app/UserApp.tsx` — register `"import"`, `"pricing"` screens; mount `<EntitlementsProvider>`.
- `src/app/components/screens/Transactions.tsx` — header "Import" button.
- `src/app/components/screens/Profile.tsx` — "Import data" row.
- `src/app/components/screens/Security.tsx` — add Region & tax section (or split into `Preferences.tsx`).
- `src/app/components/screens/Tax.tsx` — consume `useCountry()` + `TAX_PACKS`.
- `src/app/lib/intelligence.ts` — country-aware constants.
- `src/app/store.tsx` — expose `addTransactionsBulk()` for the importer commit step.
- `supabase/functions/server/index.tsx` — add `/ai/normalize-merchants`, `/me/switch-country`; add `"import"` and `"country"` to `ALL_FEATURES` + default Pro/trial plans.

## Dependencies to install (pnpm)

- `papaparse` + `@types/papaparse`
- `xlsx`
- `fast-levenshtein` + `@types/fast-levenshtein` (or inline ~20-line implementation to avoid the dep)

Server side: no new deps — fetch the OpenAI API directly with `fetch()` following the existing edge-function pattern.

## Reuse — do not re-implement

- `store.addTransaction()` and `api.create("categories", …)` for bulk commit and custom-category creation.
- `Security.tsx` settings save pattern (`api.create("settings", {id: "preferences", …})`) for the country field.
- Admin `/admin/users/:id/features` flow already supports per-user overrides — the new `import`/`country` features slot in for free.
- `redact()` pattern from `Coach.tsx:20` for stripping merchant detail when `aiShareCategoriesOnly` is on.
- Existing `notify:${userId}:…` notification pattern to confirm "Import complete: N transactions added".

## Verification

1. **Importer happy path**
   - Export sample CSV from any bank (or use a hand-rolled one with `date, description, amount` columns including duplicates: `flipkart`, `Flipkart`, `FLIPKART INDIA PVT LTD`, `flpkart`).
   - Walk through upload → mapping → review → confirm. Confirm all four spellings collapse into one **Flipkart** cluster with default category Shopping. Confirm rows land in Transactions screen with correct sign + date.
2. **Custom category creation** — in review step, type a brand-new category name, save, confirm it appears in `store.categories` and on subsequent rows' dropdown.
3. **AI fallback** — turn off `aiOptIn` in Security; re-run import with ambiguous merchants; confirm UI falls back to manual category picker with no network call to `/ai/normalize-merchants` (check devtools network tab).
4. **Premium gate** — sign in as a free user with no trial; open `/import` route; confirm `<PremiumLock>` overlay blocks the form. Admin-assign the Pro plan via the admin panel; re-open; confirm unlock.
5. **Country switch** — change country from India → United States; confirm typed-confirm modal copy includes "Cloud-synced data will be cleared"; confirm Transactions screen empties, Tax screen now shows US slabs and `$` formatting, but device-stored preferences/passkey survive.
6. **No regressions** — Dashboard, Coach, Profile render unchanged for users who never touch import or country.
