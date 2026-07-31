import { ChevronLeft, Shield, Mail, ExternalLink } from "lucide-react";
import { Header, Screen } from "../Shell";

const LAST_UPDATED = "July 17, 2026";
const APP_NAME = "LiveSync AI";
const COMPANY = "LiveSync Technologies";
const CONTACT_EMAIL = "mail.com"; // TODO: replace with actual email

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
              <B>Financial Data:</B> Transactions, income, expenses, budgets, goals, investments, insurance policies, loans, and other financial records you manually enter or import. This data is stored securely in your account and is only accessible by you.
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
              When you opt into AI features (Coach, Insights, Fraud Alerts, Category Suggestions), {APP_NAME} sends <B>aggregated, anonymised summaries</B> of your financial data (category totals, budget progress, goal metrics) to third-party AI providers for processing. We <B>never</B> send:
            </P>
            <P>• Your full name, email, or account credentials to AI providers</P>
            <P>• Individual transaction descriptions or merchant names (unless you explicitly share them in a coaching prompt)</P>
            <P>• Bank account numbers, UPI IDs, or payment instrument details</P>
            <P className="mt-3">
              <B>Third-party AI providers currently used:</B>
            </P>
            <P>• Anthropic (Claude) — for financial coaching and insights</P>
            <P>• Google (Gemini) — for document analysis in the Document Vault</P>
            <P className="mt-3">
              We implement reasonable administrative, technical, and organizational safeguards to protect user information. However, <B>no digital platform or AI service can guarantee absolute security or error-free operation</B>. By choosing to use AI-powered features, you acknowledge these inherent limitations and consent to the processing of your information as described herein.
            </P>
            <P>
              AI-generated content (coaching advice, spending insights, fraud alerts) is for informational purposes only and <B>does not constitute professional financial, tax, or legal advice</B>. We make no representations regarding the accuracy, completeness, or reliability of AI outputs.
            </P>
          </Section>

          <Section title="4. Data Storage & Security">
            <P>Your data is stored on <B>Supabase</B> infrastructure (Mumbai, India region) with:</P>
            <P>• AES-256 encryption at rest</P>
            <P>• TLS 1.3 encryption in transit</P>
            <P>• Row-level security (RLS) — your data is cryptographically isolated from other users</P>
            <P>• Automated encrypted backups rotated every 30 days</P>
            <P className="mt-2">Authentication is handled via Supabase Auth (GoTrue) with bcrypt-hashed passwords. We never store your password in plaintext.</P>
          </Section>

          <Section title="5. Data Retention">
            <P>• <B>Financial data:</B> Retained until you delete it or close your account.</P>
            <P>• <B>AI prompts/responses:</B> Retained for 90 days for safety review, then permanently purged.</P>
            <P>• <B>Auth logs:</B> 12 months for fraud investigation.</P>
            <P>• <B>Account deletion:</B> All personal data is permanently deleted within 30 days of account closure per DPDP Act §12.</P>
          </Section>

          <Section title="6. Third-Party Services">
            <P>{APP_NAME} integrates with the following third-party services:</P>
            <P>• <B>Supabase:</B> Database, authentication, and file storage</P>
            <P>• <B>Vercel:</B> Web application hosting</P>
            <P>• <B>Anthropic / Google:</B> AI model providers (only when you opt in)</P>
            <P>• <B>RSS2JSON:</B> News feed aggregation (no personal data transmitted)</P>
            <P>• <B>The Guardian Open Platform:</B> News content (no personal data transmitted)</P>
            <P className="mt-2">We do <B>not</B> sell, rent, or share your personal data with third parties for advertising purposes.</P>
          </Section>

          <Section title="7. Your Rights (DPDP Act, 2023)">
            <P>Under the Digital Personal Data Protection Act, 2023, you have the right to:</P>
            <P>• <B>Access:</B> Request a copy of all personal data we hold about you.</P>
            <P>• <B>Correction:</B> Request correction of inaccurate or incomplete data.</P>
            <P>• <B>Erasure:</B> Request deletion of your personal data (via Security → Delete my account).</P>
            <P>• <B>Withdraw consent:</B> Withdraw consent for AI processing at any time (via Security → AI settings).</P>
            <P>• <B>Grievance redressal:</B> Contact our Data Protection Officer at <B>{CONTACT_EMAIL}</B>. We respond within 7 business days.</P>
            <P>• <B>Nominate:</B> Nominate another person to exercise your rights in case of death or incapacity.</P>
          </Section>

          <Section title="8. Children's Privacy">
            <P>
              {APP_NAME} is not intended for users under the age of 18. We do not knowingly collect personal data from minors. If you believe a child has provided us data, please contact us immediately.
            </P>
          </Section>

          <Section title="9. Changes to This Policy">
            <P>
              We may update this Privacy Policy from time to time. Material changes will be communicated via in-app notification and/or email. Your continued use of {APP_NAME} after changes constitutes acceptance of the updated policy.
            </P>
          </Section>

          <Section title="10. Contact Us">
            <P>For privacy-related questions, data access requests, or complaints:</P>
            <div className="flex items-center gap-2 mt-2 bg-muted/60 rounded-xl px-3.5 py-2.5">
              <Mail className="size-4 text-primary" />
              <span className="text-sm" style={{ fontWeight: 600 }}>{CONTACT_EMAIL}</span>
            </div>
            <P className="mt-2">
              Data Protection Officer: {COMPANY}<br />
              Response time: Within 7 business days.
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
