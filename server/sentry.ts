import * as Sentry from "@sentry/node";

// Error tracking is entirely opt-in: without SENTRY_DSN set, every function
// here is a no-op, so local dev and any deploy that hasn't configured it yet
// behave exactly as before (mirrors the VAPID-keys-optional pattern in push.ts).
let enabled = false;

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log("[sentry] No SENTRY_DSN set, server error tracking disabled.");
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    // Keep tracing light — this app doesn't need full APM, just error capture,
    // and a low sample rate avoids burning through the free-tier event quota.
    tracesSampleRate: 0.1,
  });
  enabled = true;
  console.log("[sentry] Server error tracking initialized.");
}

export function isSentryEnabled() {
  return enabled;
}

export { Sentry };
