export const APP_VERSION = "2.2.0";

// AI Coach suggestion prompts — used to populate the coach screen with starter questions
export const coachSuggestions = [
  "Can I afford a new phone?",
  "How can I save more this month?",
  "Why am I overspending on food?",
  "Can I retire at 50?",
  "Should I cancel a subscription?",
];

export const coachInitial = [
  { role: "assistant" as const, text: "Hi 👋  I'm your AI financial coach. Ask me anything about your money — affordability, savings, goals, or where you might be leaking cash." },
];

