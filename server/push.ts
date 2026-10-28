import webpush from "web-push";
import { getPushSubscriptionsForUser, getUserById, getAllUsers, deletePushSubscriptionByEndpoint } from "./storage.js";
import { Sentry } from "./sentry.js";

let configured = false;

// A push service that never answers must not stall the scheduler's loop
// over users, so every send has a deadline.
const SEND_OPTIONS = { timeout: 10_000, TTL: 24 * 60 * 60 };

type Sub = { endpoint: string; p256dh: string; auth: string };

// Sends to one subscription; never throws. Endpoints the push service says
// are gone (unsubscribed, app uninstalled) are deleted so they aren't
// retried on every reminder; other failures go to Sentry.
async function sendToSubscription(sub: Sub, payload: string, logLabel: string) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, SEND_OPTIONS);
  } catch (err: any) {
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      await deletePushSubscriptionByEndpoint(sub.endpoint).catch(() => {});
      return;
    }
    console.warn(`[push] ${logLabel} failed:`, err?.message || err);
    Sentry.captureException(err, { tags: { area: "push" } });
  }
}

function ensureConfigured() {
  if (configured) return;
  let publicKey = process.env.VAPID_PUBLIC_KEY;
  let privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    // Dev fallback: generate an ephemeral key pair so push still works locally
    // without extra setup. In production, set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.
    const generated = webpush.generateVAPIDKeys();
    publicKey = generated.publicKey;
    privateKey = generated.privateKey;
    console.log("[push] No VAPID keys set, generated ephemeral dev keys.");
  }
  webpush.setVapidDetails("mailto:info@temptico.com", publicKey, privateKey);
  (globalThis as any).__VAPID_PUBLIC_KEY__ = publicKey;
  configured = true;
}

export function getVapidPublicKey(): string {
  ensureConfigured();
  return (globalThis as any).__VAPID_PUBLIC_KEY__;
}

export async function notifyUser(
  userId: string,
  buildPayload: (recipientLanguage: string) => { title: string; body: string; tag?: string }
) {
  ensureConfigured();
  const user = await getUserById(userId);
  if (!user?.notificationsEnabled) return;
  const payload = JSON.stringify(buildPayload(user.language));
  const subs = await getPushSubscriptionsForUser(userId);
  await Promise.all(subs.map((sub: Sub) => sendToSubscription(sub, payload, "notification")));
}

// Localized broadcast tool (used by the admin dashboard for prewritten
// announcements, e.g. a new-feature launch) — same idea as notifyUser's
// per-recipient-language callback, but looped over every user with
// notifications enabled instead of a single userId.
export async function notifyAllLocalized(
  buildPayload: (recipientLanguage: string) => { title: string; body: string; tag?: string }
): Promise<{ recipients: number }> {
  ensureConfigured();
  const allUsers = await getAllUsers();
  const targets = allUsers.filter((u) => u.notificationsEnabled);
  await Promise.all(
    targets.map(async (user) => {
      const payload = buildPayload(user.language);
      const subs = await getPushSubscriptionsForUser(user.id);
      await Promise.all(subs.map((sub: Sub) => sendToSubscription(sub, JSON.stringify(payload), "broadcast")));
    })
  );
  return { recipients: targets.length };
}

// Manual broadcast tool (used by the admin dashboard) — sends the same
// title/body to every user who has notifications enabled, regardless of
// their language, since the admin composes the exact text themselves.
export async function notifyAllWithNotifications(payload: { title: string; body: string; tag?: string }): Promise<{
  recipients: number;
}> {
  ensureConfigured();
  const allUsers = await getAllUsers();
  const targets = allUsers.filter((u) => u.notificationsEnabled);
  await Promise.all(
    targets.map(async (user) => {
      const subs = await getPushSubscriptionsForUser(user.id);
      await Promise.all(subs.map((sub: Sub) => sendToSubscription(sub, JSON.stringify(payload), "broadcast")));
    })
  );
  return { recipients: targets.length };
}
