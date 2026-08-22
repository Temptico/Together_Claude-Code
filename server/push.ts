import webpush from "web-push";
import { getPushSubscriptionsForUser } from "./storage.js";

let configured = false;

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
  webpush.setVapidDetails("mailto:together@example.com", publicKey, privateKey);
  (globalThis as any).__VAPID_PUBLIC_KEY__ = publicKey;
  configured = true;
}

export function getVapidPublicKey(): string {
  ensureConfigured();
  return (globalThis as any).__VAPID_PUBLIC_KEY__;
}

export async function notifyUser(userId: string, payload: { title: string; body: string; tag?: string }) {
  ensureConfigured();
  const subs = await getPushSubscriptionsForUser(userId);
  await Promise.all(
    subs.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
      webpush
        .sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        )
        .catch((err) => {
          console.warn("[push] failed to send notification:", err?.message || err);
        })
    )
  );
}
