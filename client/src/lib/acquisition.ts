import { apiRequest } from "./queryClient";

const STORAGE_KEY = "together:acqSource";

// Captures a ?src=... tag from the URL (e.g. a QR code on Temptico
// packaging) on first load: records the visit server-side immediately (so
// scans count even if the visitor never registers), and remembers it in
// localStorage so Register.tsx can attribute the account to it if they do
// sign up. A visit with no ?src= is not a tagged acquisition event, so it's
// left alone rather than overwriting a source captured earlier in this
// browser.
export function trackLandingVisit() {
  const source = new URLSearchParams(window.location.search).get("src");
  if (!source) return;
  localStorage.setItem(STORAGE_KEY, source.slice(0, 64));
  apiRequest("POST", "/api/track/visit", { source: source.slice(0, 64) }).catch(() => {});
}

export function getStoredAcquisitionSource(): string | undefined {
  return localStorage.getItem(STORAGE_KEY) || undefined;
}
