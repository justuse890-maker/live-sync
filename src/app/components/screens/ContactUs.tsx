import { Mail, MessageCircle, Clock, MapPin, Shield, ExternalLink } from "lucide-react";
import { Header, Screen } from "../Shell";

const CONTACT_EMAIL = "mail.com"; // TODO: replace with actual email
const APP_NAME = "LiveSync AI";
const COMPANY = "LiveSync Technologies";

export function ContactUs({ onBack }: { onBack: () => void }) {
  return (
    <>
      <Header title="Contact Us" subtitle="We're here to help" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 pb-8 space-y-4">
          {/* Hero */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="size-5" />
              <span className="text-sm" style={{ fontWeight: 700 }}>Get In Touch</span>
            </div>
            <p className="text-xs text-white/80 leading-relaxed">
              Have a question, found a bug, or need help with your account? We'd love to hear from you. Reach out through any of the channels below.
            </p>
          </div>

          {/* Primary contact */}
          <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
            <div className="p-4 border-b border-border/60">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3" style={{ fontWeight: 600 }}>Primary contact</div>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl p-4 active:scale-[0.98] transition-transform"
              >
                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Mail className="size-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm" style={{ fontWeight: 700 }}>Email Support</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{CONTACT_EMAIL}</div>
                </div>
                <ExternalLink className="size-4 text-muted-foreground" />
              </a>
            </div>

            <div className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <Clock className="size-3.5" />
                <span style={{ fontWeight: 600 }}>Typical response time: 24–48 hours</span>
              </div>
            </div>
          </div>

          {/* What to include */}
          <div className="bg-card rounded-2xl border border-border/60 p-4">
            <div className="text-sm mb-3" style={{ fontWeight: 700 }}>When contacting us, please include:</div>
            <div className="space-y-2">
              <Tip emoji="📱" text="Your device model and OS version" />
              <Tip emoji="🔖" text="App version (visible at the bottom of Profile)" />
              <Tip emoji="📧" text="The email address associated with your account" />
              <Tip emoji="📝" text="A clear description of the issue or question" />
              <Tip emoji="📸" text="Screenshots or screen recordings (if applicable)" />
            </div>
          </div>

          {/* Topics we can help with */}
          <div className="bg-card rounded-2xl border border-border/60 p-4">
            <div className="text-sm mb-3" style={{ fontWeight: 700 }}>We can help with:</div>
            <div className="grid grid-cols-2 gap-2">
              <HelpTopic icon={<Shield className="size-4" />} label="Account & Security" />
              <HelpTopic icon={<MessageCircle className="size-4" />} label="Bug Reports" />
              <HelpTopic icon={<Mail className="size-4" />} label="Data Privacy Requests" />
              <HelpTopic icon={<Clock className="size-4" />} label="Feature Requests" />
            </div>
          </div>

          {/* Data protection */}
          <div className="bg-card rounded-2xl border border-border/60 p-4">
            <div className="text-sm mb-3" style={{ fontWeight: 700 }}>Data Protection Officer</div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-2">
              For privacy-related queries, data access requests, consent withdrawal, or grievances under the DPDP Act, 2023:
            </p>
            <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3.5 py-2.5">
              <Shield className="size-4 text-primary" />
              <div>
                <div className="text-xs" style={{ fontWeight: 600 }}>{COMPANY}</div>
                <div className="text-xs text-muted-foreground">{CONTACT_EMAIL}</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Response guaranteed within <span style={{ fontWeight: 600 }}>7 business days</span> as per DPDP Act requirements.
            </p>
          </div>

          {/* Future updates */}
          <div className="bg-muted/40 rounded-2xl p-4 text-xs text-muted-foreground leading-relaxed text-center">
            <p>In future updates, we'll add live chat support and a help centre. Stay tuned!</p>
            <p className="mt-1" style={{ fontWeight: 600 }}>App version: v1.0.0</p>
          </div>
        </div>
      </Screen>
    </>
  );
}

function Tip({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-base">{emoji}</span>
      <span className="text-xs text-muted-foreground">{text}</span>
    </div>
  );
}

function HelpTopic({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2.5">
      <div className="text-primary">{icon}</div>
      <span className="text-xs" style={{ fontWeight: 500 }}>{label}</span>
    </div>
  );
}
