// Tracks the last partner state this device has seen, so the "you're
// connected!" celebration fires only on an observed transition from not
// connected (stored as "") to connected. A missing key means this device
// never recorded a state — e.g. a couple connected long before this shipped
// — and must not trigger a celebration out of the blue.
const LAST_SEEN_PARTNER_KEY = "together:lastSeenPartnerId";
export const CELEBRATION_DONE_EVENT = "together:celebrationDone";

export function isNewConnection(partnerId: string | null | undefined): boolean {
  if (!partnerId) return false;
  try {
    return localStorage.getItem(LAST_SEEN_PARTNER_KEY) === "";
  } catch {
    return false;
  }
}

export function recordPartnerState(partnerId: string | null | undefined) {
  try {
    localStorage.setItem(LAST_SEEN_PARTNER_KEY, partnerId ?? "");
  } catch {
    // Storage unavailable (private mode) — worst case, no celebration.
  }
}

export function finishCelebration(partnerId: string | null | undefined) {
  recordPartnerState(partnerId);
  window.dispatchEvent(new Event(CELEBRATION_DONE_EVENT));
}
