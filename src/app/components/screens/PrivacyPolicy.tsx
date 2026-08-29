import { ChevronLeft, Shield, Mail, ExternalLink, Lock, Smartphone } from "lucide-react";
import { Header, Screen } from "../Shell";

const LAST_UPDATED = "August 11, 2026";
const APP_NAME = "LiveSync AI";
const COMPANY = "LiveSync Technologies";
const CONTACT_EMAIL = "niteshjha.uiux@yahoo.com";

export function PrivacyPolicy({ onBack }: { onBack: () => void }) {
  return (
    <>
      <Header title="Privacy Policy" subtitle={`Last updated · ${LAST_UPDATED}`} showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 pb-8 space-y-5">
          {/* Hero */}
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-5">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="size-5" />
              <span className="text-sm" style={{ fontWeight: 700 }}>Your Privacy Matters</span>
            </div>
            <p className="text-xs text-white/80 leading-relaxed">
              {APP_NAME} is committed to protecting your personal and financial information. This policy explains what we collect, why, how we use it, and your rights under applicable laws including India's Digital Personal Data Protection (DPDP) Act, 2023.
            </p>
          </div>

          <Section title="1. Information We Collect">
            <P>
              <B>Account Data:</B> Name, email address, and hashed password when you create an account.
            </P>
            <P>
              <B>Financial Data:</B> Transactions, income, expenses, budgets, goals, investments, insurance policies, loans, and other financial records you manually enter or import. The app encrypts supported sensitive fields on your device before upload; structural data needed to operate the service may remain unencrypted.
            </P>
            <P>
              <B>Onboarding Data:</B> Age band, occupation, income band, and primary financial goal — used solely to personalise the app experience.
            </P>
            <P>
              <B>Device Data:</B> Device type, operating system version, and app version for crash reporting and compatibility. We do not collect device identifiers for advertising.
            </P>
            <P>
              <B>Usage Analytics:</B> Anonymous, aggregated usage patterns (e.g., which screens are visited) to improve the product. No personally identifiable information is included.
            </P>
          </Section>

          <Section title="2. How We Use Your Information">
            <P>• To provide, maintain, and improve {APP_NAME}'s core features (expense tracking, budgeting, goal planning, financial health scoring).</P>
            <P>• To generate AI-powered financial insights, coaching, and category suggestions — only when you have opted into AI features.</P>
            <P>• To send you notifications you've enabled (bill reminders, goal milestones, daily news digests).</P>
            <P>• To process support requests and respond to feedback.</P>
            <P>• To detect and prevent fraud, abuse, or security incidents.</P>
            <P>• To comply with legal obligations.</P>
          </Section>

          <Section title="3. AI-Powered Features & Data Processing">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-3">
              <p className="text-xs text-amber-800 leading-relaxed" style={{ fontWeight: 600 }}>
                ⚠️ Important: AI features are optional and require your explicit consent.
              </p>
            </div>
            <P>
              When you opt into an AI feature, {APP_NAME} sends the information needed for that feature to its AI provider. This can include category totals, budget progress, goal metrics and, when you choose to share them, merchant names or your message. We do not request bank passwords or OTPs.
            </P>
            <P>• The app does not intentionally include your account password, bank password, or OTP in AI requests.</P>
            <P>• AI Coach hides merchant names by default; you can change that setting before using it.</P>
            <P>• Do not include account numbers, UPI IDs, card data, or other sensitive identifiers in an AI prompt.</P>
            <P className="mt-3">
              <B>Third-party AI providers currently used:</B>
            </P>
            <P>• Groq (Llama) — when you configure and use the bring-your-own-key AI Coach; requests go directly from the app to Groq.</P>
            <P>• Google (Gemini) — merchant normalisation, when that feature is enabled and available.</P>
            <P className="mt-3">
              We implement reasonable administrative, technical, and organizational safeguards to protect user information. However, <B>no digital platform or AI service can guarantee absolute security or error-free operation</B>. By choosing to use AI-powered features, you acknowledge these inherent limitations and consent to the processing of your information as described herein.
            </P>
            <P>
              AI-generated content (coaching advice, spending insights, fraud alerts) is for informational purposes only and <B>does not constitute professional financial, tax, or legal advice</B>. We make no representations regarding the accuracy, completeness, or reliability of AI outputs.
            </P>
          </Section>

          <Section title="4. Data Storage & Security">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 mb-3">
              <div className="flex items-start gap-2">
                <Lock className="size-4 text-emerald-700 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-800 leading-relaxed" style={{ fontWeight: 600 }}>
                  The app encrypts supported sensitive fields using AES-256-GCM before upload. This is not a guarantee of absolute security.
                </p>
              </div>
            </div>
            <P><B>Client-side encryption:</B> The app encrypts selected sensitive fields such as transaction amounts, names and notes on the device before upload. It derives the key from a device-local secret; some structural fields needed to operate the service are not encrypted by this app.</P>
            <P><B>What this means:</B> Application-level encryption reduces exposure of those selected fields in our data store. It does not make the service risk-free, and users should not rely on it as the sole protection for sensitive documents or credentials.</P>
            <P className="mt-2"><B>Additional layers of protection:</B></P>
            <P>• Authenticated application endpoints limit access to signed-in users.</P>
            <P>• Key derivation uses PBKDF2 with 300,000 iterations for the app-level encrypted fields.</P>
            <P>• Supabase provides the cloud database, authentication and object storage used by the app.</P>
            <P className="mt-2">Authentication is handled by Supabase Auth. Never share passwords, OTPs, full card numbers, or recovery codes with any person or AI feature.</P>
          </Section>

          <Section title="5. Local Cache & Offline Access">
            <div className="flex items-start gap-2 mb-2">
              <Smartphone className="size-4 text-indigo-600 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed" style={{ fontWeight: 600 }}>
                <span className="text-foreground">Cloud + Local Cache architecture</span> — your data lives in the cloud, with a fast local copy on your device.
              </p>
            </div>
            <P>{APP_NAME} uses a <B>cloud + local cache</B> architecture:</P>
            <P>• Your primary data is stored in a secure cloud database (Supabase), encrypted with your device key.</P>
            <P>• A local copy is cached on your device (IndexedDB) for instant loading and offline browsing of previously loaded data.</P>
            <P>• Every write is saved to the cloud immediately. The local cache is updated in sync.</P>
            <P>• The local cache is cleared when you sign out to prevent data leakage between accounts on shared devices.</P>
            <P>• The local cache survives app restarts and APK updates, but not app uninstall. For uninstall-proof protection, use Cloud Backup or Google Drive backup.</P>
          </Section>

          <Section title="6. Data Retention">
            <P>• <B>Financial data:</B> Retained (in encrypted form) until you delete it or close your account.</P>
            <P>• <B>AI requests:</B> are handled by the relevant AI provider under its own retention policy; read that provider's policy before use.</P>
            <P>• <B>Account deletion:</B> the app requests deletion of its user records and vault files when you delete your account. Some provider backups or legally required records may persist for a limited period.</P>
          </Section>

          <Section title="7. Third-Party Services">
            <P>{APP_NAME} integrates with the following third-party services:</P>
            <P>• <B>Supabase:</B> Database, authentication, and file storage</P>
            <P>• <B>Groq / Google:</B> AI providers when you choose to use the relevant AI feature</P>
            <P>• <B>RSS2JSON:</B> News feed aggregation (no personal data transmitted)</P>
            <P>• <B>The Guardian Open Platform:</B> News content (no personal data transmitted)</P>
            <P className="mt-2">We do not use financial records for advertising. Service providers process data as necessary to provide their services, and AI providers process the content sent to their features.</P>
          </Section>

          <Section title="8. Your Rights (DPDP Act, 2023)">
            <P>Under the Digital Personal Data Protection Act, 2023, you have the right to:</P>
            <P>• <B>Access:</B> Request a copy of all personal data we hold about you.</P>
            <P>• <B>Correction:</B> Request correction of inaccurate or incomplete data.</P>
            <P>• <B>Erasure:</B> Request deletion of your personal data (via Security → Delete my account).</P>
            <P>• <B>Withdraw consent:</B> Withdraw consent for AI processing at any time (via Security → AI settings).</P>
            <P>• <B>Grievance redressal:</B> Contact us at <B>{CONTACT_EMAIL}</B>. We aim to respond within 7 business days.</P>
            <P>• <B>Nominate:</B> Nominate another person to exercise your rights in case of death or incapacity.</P>
          </Section>

          <Section title="9. Children's Privacy">
            <P>
              {APP_NAME} is not intended for users under the age of 18. We do not knowingly collect personal data from minors. If you believe a child has provided us data, please contact us immediately.
            </P>
          </Section>

          <Section title="10. Changes to This Policy">
            <P>
              We may update this Privacy Policy from time to time. Material changes will be communicated via in-app notification and/or email. Your continued use of {APP_NAME} after changes constitutes acceptance of the updated policy.
            </P>
          </Section>

          <Section title="11. Contact Us">
            <P>For privacy-related questions, data access requests, or complaints:</P>
            <div className="flex items-center gap-2 mt-2 bg-muted/60 rounded-xl px-3.5 py-2.5">
              <Mail className="size-4 text-primary" />
              <span className="text-sm" style={{ fontWeight: 600 }}>{CONTACT_EMAIL}</span>
            </div>
            <P className="mt-2">
              Contact: {CONTACT_EMAIL}<br />
              Response target: Within 7 business days.
            </P>
          </Section>

          <div className="text-center text-xs text-muted-foreground pt-4 pb-2">
            © {new Date().getFullYear()} {COMPANY}. All rights reserved.
          </div>
        </div>
      </Screen>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border border-border/60 p-4">
      <div className="text-sm mb-3" style={{ fontWeight: 700 }}>{title}</div>
      {children}
    </div>
  );
}

function P({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs text-muted-foreground leading-relaxed mb-1.5 ${className}`}>{children}</p>;
}

function B({ children }: { children: React.ReactNode }) {
  return <span className="text-foreground" style={{ fontWeight: 600 }}>{children}</span>;
}
