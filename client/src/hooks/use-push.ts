import { apiRequest } from "@/lib/queryClient";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const registration = await navigator.serviceWorker.ready;
  const { key } = await apiRequest<{ key: string }>("GET", "/api/push/vapid-public-key");
  const existing = await registration.pushManager.getSubscription();

  // A subscription's key is pinned at creation time. If the server's VAPID
  // key ever changed (e.g. before it was pinned to a stable env var), an
  // existing subscription silently keeps pointing at the old, now-invalid
  // key — reusing it as-is would resend dead credentials. Re-subscribing
  // fresh whenever the keys don't match lets a user self-recover just by
  // toggling notifications off and back on.
  const existingKey = existing ? btoa(String.fromCharCode(...new Uint8Array(existing.options.applicationServerKey!))) : null;
  const wantedKey = btoa(String.fromCharCode(...urlBase64ToUint8Array(key)));
  if (existing && existingKey !== wantedKey) {
    await existing.unsubscribe();
  }

  const subscription =
    existing && existingKey === wantedKey
      ? existing
      : await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });

  await apiRequest("POST", "/api/push/subscribe", { userId, subscription: subscription.toJSON() });
  return true;
}
