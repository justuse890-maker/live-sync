/**
 * promoConfig.ts
 * ──────────────
 * Global promotional offer configuration.
 *
 * ADMIN SWITCH: Set PROMO_ACTIVE = false (or update PROMO_CUTOFF_DATE)
 * to end the promotion for new signups. Existing users who signed up
 * during the active window continue to enjoy their 84 days.
 *
 * All new signups while PROMO_ACTIVE = true get 84 days of LiveSync Pro free.
 */

/** Master on/off switch — set to false to end the promotion. */
export const PROMO_ACTIVE = true;

/** Duration of the free Pro trial for new users (days). */
export const PROMO_DAYS = 84;

/** Internal key used to store whether the celebration was shown. */
export const PROMO_SEEN_KEY = "livesync_promo_celebrated";

/**
 * Returns true if the given account creation date falls within the
 * active promotional window AND the promo is still enabled.
 */
export function isEligibleForPromo(accountCreatedAt: string | undefined | null): boolean {
  if (!PROMO_ACTIVE) return false;
  if (!accountCreatedAt) return false;
  try {
    const created = new Date(accountCreatedAt).getTime();
    const now = Date.now();
    const ageMs = now - created;
    return ageMs >= 0 && ageMs <= PROMO_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Returns how many days remain in the promo for this user.
 * Returns 0 if the promo has expired.
 */
export function promoDaysRemaining(accountCreatedAt: string | undefined | null): number {
  if (!accountCreatedAt) return 0;
  try {
    const created = new Date(accountCreatedAt).getTime();
    const expiry = created + PROMO_DAYS * 24 * 60 * 60 * 1000;
    const remaining = Math.max(0, Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000)));
    return remaining;
  } catch {
    return 0;
  }
}
