// Place-name → coordinates lookup for nearby search ("search Banja Luka"
// instead of using GPS), via OpenStreetMap's Nominatim. Its public usage
// policy requires an identifying User-Agent, at most one request per second
// from the whole app, and no search-as-you-type — so lookups run only on
// submit, go through one throttled queue here, and are cached.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const MIN_INTERVAL_MS = 1100;
const MAX_QUEUED = 10;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

export type GeocodeResult = { name: string; label: string; lat: number; lng: number };

const cache = new Map<string, { results: GeocodeResult[]; expiresAt: number }>();
let lastRequestAt = 0;
let queueTail: Promise<unknown> = Promise.resolve();
let queued = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return fn();
  });
  queueTail = run.catch(() => undefined);
  return run;
}

// Resolves to null when the lookup failed (network, rate limit, too many
// lookups already waiting), [] when nothing matched.
export async function geocode(query: string, language?: string): Promise<GeocodeResult[] | null> {
  const q = query.trim().replace(/\s+/g, " ");
  const key = `${q.toLowerCase()}|${language || ""}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  if (queued >= MAX_QUEUED) return null;
  queued++;
  try {
    const results = await throttled(() => fetchOnce(q, language));
    if (results) {
      if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!);
      cache.set(key, { results, expiresAt: Date.now() + CACHE_TTL_MS });
    }
    return results;
  } finally {
    queued--;
  }
}

async function fetchOnce(q: string, language?: string): Promise<GeocodeResult[] | null> {
  const params = new URLSearchParams({ q, format: "jsonv2", limit: "5" });
  if (language) params.set("accept-language", language);
  try {
    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { "User-Agent": "Together-App/1.0 (contact: info@temptico.com)", Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn("[geocode] Nominatim responded with status", res.status);
      return null;
    }
    const data = (await res.json()) as Array<{ name?: string; display_name: string; lat: string; lon: string }>;
    return data.map((d) => ({
      name: d.name || d.display_name.split(",")[0],
      label: d.display_name,
      lat: Number(d.lat),
      lng: Number(d.lon),
    }));
  } catch (err) {
    console.warn("[geocode] Nominatim lookup failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
