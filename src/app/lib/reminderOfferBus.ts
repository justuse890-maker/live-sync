import type { OfferInput } from "./billSuggest";

/** Lets Quick Add hand a just-saved expense to the "remind me next time?" sheet without prop-drilling. */
let listener: ((tx: OfferInput) => void) | null = null;
export const offerReminder = (tx: OfferInput) => listener?.(tx);
export const onReminderOffer = (cb: (tx: OfferInput) => void) => { listener = cb; return () => { if (listener === cb) listener = null; }; };
