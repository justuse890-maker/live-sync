import { Scale, AlertTriangle, Mail } from "lucide-react";
import { Header, Screen } from "../Shell";

const LAST_UPDATED = "July 17, 2026";
const APP_NAME = "LiveSync AI";
const COMPANY = "LiveSync Technologies";
const CONTACT_EMAIL = "mail.com"; // TODO: replace with actual email

export function TermsConditions({ onBack }: { onBack: () => void }) {
  return (
    <>
      <Header title="Terms & Conditions" subtitle={`Last updated · ${LAST_UPDATED}`} showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 pb-8 space-y-5">
          {/* Hero */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white p-5">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="size-5" />
              <span className="text-sm" style={{ fontWeight: 700 }}>Terms of Service</span>
            </div>
            <p className="text-xs text-white/80 leading-relaxed">
              These Terms & Conditions ("Terms") govern your use of {APP_NAME} ("the App"), operated by {COMPANY} ("we", "us", "our"). By creating an account or using the App, you agree to these Terms in full.
            </p>
          </div>

          <Section title="1. Acceptance of Terms">
            <P>
              By accessing, downloading, installing, or using {APP_NAME}, you agree to be bound by these Terms and our Privacy Policy. If you do not agree, you must not use the App. We reserve the right to update these Terms at any time; continued use after changes constitutes acceptance.
            </P>
          </Section>

          <Section title="2. Eligibility">
            <P>You must be at least <B>18 years of age</B> to use {APP_NAME}. By creating an account, you represent and warrant that you meet this requirement and that the information you provide is accurate and complete.</P>
          </Section>

          <Section title="3. Account Responsibilities">
            <P>• You are responsible for maintaining the confidentiality of your login credentials.</P>
            <P>• You are responsible for all activities that occur under your account.</P>
            <P>• You agree to notify us immediately of any unauthorized use of your account.</P>
            <P>• We are not liable for any loss or damage arising from your failure to safeguard your credentials.</P>
          </Section>

          <Section title="4. Nature of the Service">
            <P>
              {APP_NAME} is a <B>personal financial management tool</B> that helps users track expenses, set budgets, plan goals, and receive AI-generated financial insights. The App is designed for informational and organizational purposes only.
            </P>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 my-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-rose-600 mt-0.5 shrink-0" />
                <p className="text-xs text-rose-800 leading-relaxed" style={{ fontWeight: 600 }}>
                  {APP_NAME} does NOT provide professional financial advice, tax consulting, investment recommendations, or legal counsel. All AI-generated content is for informational purposes only and should not be relied upon as a substitute for professional advice.
                </p>
              </div>
            </div>
          </Section>

          <Section title="5. AI-Powered Features — Disclaimer">
            <P>
              {APP_NAME} uses third-party artificial intelligence models to provide coaching, insights, category suggestions, and fraud alerts. By opting into AI features, you acknowledge and agree that:
            </P>
            <P>• AI outputs may contain <B>errors, inaccuracies, or incomplete information</B>.</P>
            <P>• AI-generated advice does <B>not constitute professional financial, tax, investment, or legal advice</B>.</P>
            <P>• You are solely responsible for any decisions made based on AI outputs.</P>
            <P>• We make <B>no warranties or guarantees</B> regarding the accuracy, reliability, or completeness of AI-generated content.</P>
            <P>• Aggregated, anonymised financial summaries may be sent to third-party AI providers (Anthropic, Google) for processing. Full details are in our Privacy Policy.</P>
            <P>• We implement reasonable security measures but <B>cannot guarantee that AI-processed data is 100% secure</B>. By using AI features, you accept this inherent risk.</P>
            <P className="mt-2">
              <B>You may disable AI features at any time</B> through Security & Privacy settings. Disabling AI features will stop all data sharing with AI providers.
            </P>
          </Section>

          <Section title="6. User Data & Content">
            <P>• You retain full ownership of your financial data and content uploaded to {APP_NAME}.</P>
            <P>• By using the App, you grant us a limited, non-exclusive license to process your data solely for the purpose of providing the service.</P>
            <P>• You agree not to upload illegal, malicious, or fraudulent content.</P>
            <P>• We reserve the right to remove content that violates these Terms.</P>
          </Section>

          <Section title="7. News & Third-Party Content">
            <P>
              The Financial News Hub aggregates headlines and short snippets from publicly available RSS feeds (PIB, RBI, SEBI, UN News) and licensed APIs (The Guardian). {APP_NAME}:
            </P>
            <P>• Does not claim authorship of third-party news content.</P>
            <P>• Provides links to original publisher URLs for full articles.</P>
            <P>• Operates under fair dealing provisions (Section 52(1)(a), Indian Copyright Act, 1957) for reporting current events.</P>
          </Section>

          <Section title="8. Limitation of Liability">
            <P>To the maximum extent permitted by applicable law:</P>
            <P>• {APP_NAME} is provided <B>"AS IS" and "AS AVAILABLE"</B> without warranties of any kind, express or implied.</P>
            <P>• We are not liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or financial losses arising from your use of the App.</P>
            <P>• Our total liability for any claim shall not exceed the amount you paid us (if any) in the 12 months preceding the claim.</P>
            <P>• We are not responsible for any financial decisions made based on information provided by the App or its AI features.</P>
          </Section>

          <Section title="9. Indemnification">
            <P>
              You agree to indemnify, defend, and hold harmless {COMPANY}, its officers, directors, employees, and agents from any claims, liabilities, damages, losses, or expenses (including legal fees) arising from:
            </P>
            <P>• Your use of the App or violation of these Terms.</P>
            <P>• Your reliance on AI-generated content for financial decisions.</P>
            <P>• Any third-party claims relating to your use of the App.</P>
          </Section>

          <Section title="10. Subscription & Payments">
            <P>• {APP_NAME} may offer free and premium tiers. Premium features and pricing are displayed in the App.</P>
            <P>• Subscriptions auto-renew unless cancelled before the renewal date.</P>
            <P>• Refunds are handled as per the applicable app store's refund policy (Google Play / Apple App Store).</P>
            <P>• We reserve the right to modify pricing with 30 days' notice.</P>
          </Section>

          <Section title="11. Account Termination">
            <P>• You may delete your account at any time via Security → Delete my account.</P>
            <P>• We may suspend or terminate your account for violations of these Terms, fraudulent activity, or as required by law.</P>
            <P>• Upon termination, your data will be permanently deleted within 30 days per our retention policy.</P>
          </Section>

          <Section title="12. Governing Law & Dispute Resolution">
            <P>• These Terms are governed by the laws of <B>India</B>.</P>
            <P>• Any disputes shall be subject to the exclusive jurisdiction of the courts in <B>New Delhi, India</B>.</P>
            <P>• Before filing any claim, you agree to attempt resolution through good-faith negotiation by contacting us at <B>{CONTACT_EMAIL}</B>.</P>
          </Section>

          <Section title="13. Intellectual Property">
            <P>
              All content, features, design, code, and trademarks of {APP_NAME} are the intellectual property of {COMPANY}. You may not copy, modify, distribute, or reverse-engineer any part of the App without our written consent.
            </P>
          </Section>

          <Section title="14. Force Majeure">
            <P>
              We shall not be liable for any failure or delay in performing our obligations due to causes beyond our reasonable control, including but not limited to natural disasters, pandemics, government actions, cyber-attacks, or infrastructure failures.
            </P>
          </Section>

          <Section title="15. Severability">
            <P>
              If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect. The invalid provision shall be modified to the minimum extent necessary to make it enforceable.
            </P>
          </Section>

          <Section title="16. Contact">
            <P>For questions about these Terms:</P>
            <div className="flex items-center gap-2 mt-2 bg-muted/60 rounded-xl px-3.5 py-2.5">
              <Mail className="size-4 text-primary" />
              <span className="text-sm" style={{ fontWeight: 600 }}>{CONTACT_EMAIL}</span>
            </div>
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
