/**
 * Settings compiled only into the investor-demo APK. These credentials are
 * intentionally not secrets: every recipient of the demo receives them.
 * Do not use this mode with a real customer or employee account.
 */
export const isInvestorDemo = import.meta.env.VITE_INVESTOR_DEMO === "true";

export const investorDemoCredentials = {
  email: import.meta.env.VITE_DEMO_EMAIL ?? "",
  password: import.meta.env.VITE_DEMO_PASSWORD ?? "",
};
