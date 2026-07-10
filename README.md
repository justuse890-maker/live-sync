# LiveSync AI — Financial Operating System

> Your Private AI Financial Operating System

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open **http://localhost:5173/** in your browser.

---

## 📱 What is LiveSync AI?

LiveSync AI is an AI-powered Financial Operating System that helps individuals and families **understand, predict, optimize, and grow** their financial life. Unlike traditional expense trackers, LiveSync combines:

- **Financial Timeline** — Unified view of all money events
- **Health Score Engine** — Real-time financial health scoring (0-100)
- **Wealth Intelligence** — Detect leaks, waste, and optimization opportunities
- **AI Personal CFO** — Chat-based financial coach
- **Prediction Engine** — Forecast balances, goals, retirement

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS v4 + shadcn/ui + Radix UI |
| **Charts** | Recharts |
| **Animations** | Framer Motion (`motion`) |
| **Backend** | Supabase (Auth + PostgreSQL + Edge Functions + Storage) |
| **AI** | Google Gemini (Free tier, privacy-first) |
| **Voice/OCR** | Web Speech API + Tesseract.js |
| **Mobile Shell** | Capacitor.js (Android APK compiler) |
| **Icons** | Lucide React |

---

## 📂 Project Structure

```
src/
├── main.tsx                    # App entry point
├── styles/
│   ├── index.css               # Main CSS entry (imports all)
│   ├── tokens → theme.css      # Design tokens (colors, spacing, radius)
│   ├── fonts.css               # Google Fonts (Inter + Plus Jakarta Sans)
│   └── tailwind.css            # Tailwind v4 + animations
├── app/
│   ├── App.tsx                 # Router provider
│   ├── UserApp.tsx             # Main app shell + screen routing
│   ├── routes.tsx              # Hash-based routes
│   ├── store.tsx               # React Context state management
│   ├── data.ts                 # Seed/mock data
│   ├── components/
│   │   ├── ui/                 # 48 shadcn/ui components
│   │   ├── screens/            # 30 screen components
│   │   ├── Shell.tsx           # Header + Screen layout
│   │   ├── BottomNav.tsx       # 5-tab bottom navigation
│   │   ├── QuickAdd.tsx        # Transaction entry (manual/voice/scan)
│   │   ├── Auth.tsx            # Login/signup
│   │   ├── Onboarding.tsx      # New user setup
│   │   └── PremiumLock.tsx     # Feature gate overlay
│   ├── lib/
│   │   ├── api.ts              # Supabase API layer
│   │   ├── intelligence.ts     # Financial computation engine
│   │   ├── capture.ts          # Voice/receipt NLP parsing
│   │   ├── merchantNormalize.ts # Bank statement cleanup
│   │   ├── taxPacks.ts         # Multi-country tax slabs
│   │   ├── useEntitlements.ts  # Subscription/feature gating
│   │   ├── useCountry.ts       # Country/currency hook
│   │   ├── track.ts            # Analytics tracking
│   │   ├── voiceLangs.ts       # 25 voice languages
│   │   └── webauthn.ts         # Biometric auth
│   └── admin/                  # Admin dashboard panel
├── supabase/functions/server/  # Backend edge functions
└── utils/supabase/             # Supabase credentials
```

---

## 📱 Screens (30 total)

### Primary Navigation (Bottom Tab Bar)
| Tab | Screen | Description |
|-----|--------|-------------|
| 🏠 Home | Dashboard | Health score, net worth, cash flow, AI insights |
| 📊 Activity | Transactions | Full transaction history with search/filters |
| 🎯 Goals | Goals | Savings goals with progress tracking |
| 🤖 Coach | AI Coach | AI financial advisor chat |
| 👤 Profile | Profile | Settings hub + secondary screen links |

### Secondary Screens
| Screen | Description |
|--------|-------------|
| Budgets | Category-wise monthly budget tracking |
| Subscriptions | Subscription Shield — detect & manage recurring |
| Health | Financial health score breakdown (6 dimensions) |
| Emergency | Emergency survival runway calculator |
| Reports | Weekly/monthly financial analytics |
| Loans | Borrowed/lent money tracker with EMI dates |
| Categories | Custom category management |
| Connected Accounts | Bank account connections |
| Document Vault | Secure document storage (PAN, Aadhaar, etc.) |
| Tax Assistant | Multi-country tax calculator |
| Security | WebAuthn, passkey, PIN, session management |
| Privacy | Data export, account deletion |
| Net Worth | Asset/liability command center |
| Financial Timeline | Unified financial event calendar |
| Life Calendar | Life events planning |
| Notifications | In-app notification center |
| Family | Family finance coordination |
| Cash Wallet | Cash tracking with pockets/envelopes |
| Wealth Leakage | Money leak detection |
| Lifestyle Inflation | Expense vs income growth tracking |
| FIRE | Financial Independence calculator |
| Simulator | "Can I afford this?" decision engine |
| Import Transactions | CSV bank statement import |
| Pricing | Subscription plans (Free/Pro/Lifetime) |
| Feedback | Bug report & feature request |

---

## 🎨 Design System

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#1E40AF` | Deep Financial Blue — buttons, links, accents |
| `--success` | `#10B981` | Emerald — income, positive states |
| `--warning` | `#F59E0B` | Amber — alerts, caution |
| `--destructive` | `#EF4444` | Red — expenses, danger, deletions |
| `--background` | `#F8FAFC` | Light slate background |
| `--card` | `#FFFFFF` | Card backgrounds |
| `--foreground` | `#0F172A` | Primary text |
| `--muted-foreground` | `#64748B` | Secondary text |
| `--border` | `#E2E8F0` | Borders and dividers |

### Typography
- **Headings**: Plus Jakarta Sans (600-700 weight)
- **Body**: Inter (400-500 weight)
- **Base size**: 15px

### Spacing & Layout
- **Grid**: 8px spacing system
- **Border radius**: 16px cards, 12px buttons, 8px inputs
- **Shadows**: Soft, professional card shadows
- **Layout**: Mobile-first, phone-frame wrapper on desktop

### Adding New Components
1. Create a new file in `src/app/components/ui/`
2. Follow the shadcn/ui pattern with CVA variants
3. Use design tokens via Tailwind classes (`bg-primary`, `text-muted-foreground`, etc.)
4. Import and use anywhere

### Adding New Screens
1. Create a new file in `src/app/components/screens/`
2. Add the screen to `UserApp.tsx` (import + render + screenId)
3. Add navigation trigger (profile link, button, etc.)
4. Use `<Header>` + `<Screen>` layout components

---

## 🔧 Backend (Supabase)

### Architecture
- **Auth**: Email/password with auto-confirm
- **Database**: KV-store pattern on PostgreSQL
- **Edge Functions**: Single Hono server handling all API routes
- **Storage**: Bucket for document uploads

### Subscription Tiers
| Plan | Price | Features |
|------|-------|----------|
| Free (7-day trial) | ₹0 | All features for 7 days |
| Pro | ₹99/month | All features |
| Lifetime | ₹4,999 | One-time, forever |

### Key API Endpoints
- `POST /signup` — User registration
- `GET /{collection}` — List collection items
- `POST /{collection}` — Create item
- `DELETE /{collection}/{id}` — Delete item
- `POST /ai/coach` — AI coach chat
- `GET /me/subscription` — Subscription status

---

## 📋 MVP Modules (Phase 1)

1. ✅ Dashboard
2. ✅ Financial Timeline
3. ✅ Transactions
4. ✅ Budgets
5. ✅ Goals
6. ✅ Net Worth
7. ✅ Financial Health Score
8. ✅ Subscription Shield
9. ✅ Emergency Survival
10. ✅ AI Coach

## 🗺️ Roadmap

### Phase 2
- Family Finance
- Tax Assistant
- Document Vault
- FIRE Planning

### Phase 3
- Credit Card Reward Optimizer
- Wealth Growth Radar
- Opportunity Cost Engine
- Decision Simulator

### Phase 4
- AI Personal CFO Automation
- Investment Automation
- Advanced Tax Optimization

---

## ⚖️ Legal & Privacy

> LiveSync AI provides financial organization, estimates, reminders, and AI-generated educational insights. It does not provide legal, investment, tax, or accounting advice. Users should verify outputs and consult qualified professionals before making financial decisions.

### Privacy Principles
- No `READ_SMS` permission
- No bank credential storage
- No bank scraping
- Consent-first document handling
- Local-first data architecture
- AI receives summaries, not raw data

---

## 🤖 Compiling as Android APK (Web-to-APK)

You can wrap LiveSync AI as a native Android App using the included Capacitor setup:

1. **Initialize Android Platform**:
   ```bash
   npx cap add android
   ```

2. **Sync and Compile Code**:
   Build the production web assets first, then sync them to the Android native project folder:
   ```bash
   npm run build
   npx cap sync
   ```

3. **Open in Android Studio & Build APK**:
   ```bash
   npx cap open android
   ```
   In Android Studio, click **Build > Build Bundle(s) / APK(s) > Build APK(s)**. The APK will be compiled and ready to install on any Android device!
