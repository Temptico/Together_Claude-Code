import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

// Opt-in like the server side (server/sentry.ts): without VITE_SENTRY_DSN
// baked in at build time, this is a no-op and the app behaves exactly as
// before. Tracing/replay are left off — this is here for error capture,
// not full APM, so it doesn't pull extra weight into the bundle.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
  });
}

function ErrorFallback() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-together-gradient px-6 text-center">
      <div className="text-4xl">💔</div>
      <p className="font-bold text-foreground">Nekaj je šlo narobe.</p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground"
      >
        Osveži stran
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
    <App />
  </Sentry.ErrorBoundary>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}
