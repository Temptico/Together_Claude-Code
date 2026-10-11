// Free, keyless "real nearby venues" lookup via OpenStreetMap's Overpass API.
// This is the default enhancement for nearby search — unlike Google Places
// (see places.ts), it needs no account or billing, so it's always active.

type OsmMapping = { query: string; category: string; costHint?: string };

const OSM_TYPE_MAP: Record<string, OsmMapping> = {
  restavracije: { query: `node["amenity"="restaurant"]`, category: "sprosceno" },
  kavarne: { query: `node["amenity"="cafe"]`, category: "sprosceno" },
  parki: { query: `node["leisure"="park"]`, category: "na-prostem", costHint: "brezplacno" },
  "naravni-kraji": { query: `node["tourism"="attraction"]`, category: "na-prostem" },
  muzeji: { query: `node["tourism"="museum"]`, category: "kulturno" },
  galerije: { query: `node["tourism"="gallery"]`, category: "kulturno" },
  vinarije: { query: `node["craft"="winery"]`, category: "sprosceno" },
  bari: { query: `node["amenity"="bar"]`, category: "sprosceno" },
  trznice: { query: `node["amenity"="marketplace"]`, category: "sprosceno" },
  trgovine: { query: `node["shop"]`, category: "sprosceno" },
  "plesni-studii": { query: `node["leisure"="dance"]`, category: "aktivno" },
  "rekreacijski-centri": { query: `node["leisure"="fitness_centre"]`, category: "aktivno" },
};

const DEFAULT_TYPES = ["kavarne", "restavracije", "parki", "muzeji"];
// Independently-hosted Overpass instances with worldwide data. Every mirror
// here MUST cover the whole planet: a regional one (overpass.osm.ch, which
// used to be the fallback, only has Switzerland) answers anywhere else with
// a valid but empty result — indistinguishable from "nothing nearby", so
// searches outside its region silently came back empty (and got cached)
// whenever the primary was overloaded.
const OVERPASS_URLS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
// The public instances often take 10s+ or return 504 under load. If a mirror
// hasn't answered within this long, the next one is asked in parallel and
// the first successful answer wins — fast when the primary is healthy,
// without hitting every mirror on every search.
export const HEDGE_DELAY_MS = 2500;
const PER_MIRROR_TIMEOUT_MS = 15_000;

// A short cache so many people asking about the same area within a few
// minutes share one lookup. Only non-empty results are cached, so neither a
// failure nor an empty answer ever "sticks" for ten minutes.
const CACHE_TTL_MS = 10 * 60 * 1000;
const resultCache = new Map<string, { results: OsmNearbyResult[]; expiresAt: number }>();

function cacheKey(lat: number, lng: number, types: string[], radiusKm: number): string {
  // Round to ~1.1km so nearby requests for the same neighborhood share a
  // cache entry instead of each getting a slightly different grid cell.
  const rLat = Math.round(lat * 100) / 100;
  const rLng = Math.round(lng * 100) / 100;
  return `${rLat},${rLng}|${[...types].sort().join(",")}|${radiusKm}`;
}

export type OsmNearbyResult = {
  externalId: string;
  title: string;
  description: string;
  category: string;
  cost: string;
  duration: string;
  locationType: string;
  city?: string;
  address?: string;
  phone?: string;
  website?: string;
  lat: number;
  lng: number;
};

export async function fetchNearbyOsmPlaces(
  lat: number,
  lng: number,
  types: string[],
  radiusKm: number
): Promise<OsmNearbyResult[] | null> {
  const requestedTypes = (types.length > 0 ? types : DEFAULT_TYPES).filter((t) => OSM_TYPE_MAP[t]);
  if (requestedTypes.length === 0) return null;

  const key = cacheKey(lat, lng, requestedTypes, radiusKm);
  const cached = resultCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const results = await fetchFromMirrors(lat, lng, requestedTypes, radiusKm);
  if (results && results.length > 0) resultCache.set(key, { results, expiresAt: Date.now() + CACHE_TTL_MS });
  return results;
}

// Resolves with the first mirror's successful answer, or null once every
// mirror has failed. The next mirror starts after HEDGE_DELAY_MS — or right
// away if the current one fails sooner. Losing requests are aborted.
function fetchFromMirrors(
  lat: number,
  lng: number,
  requestedTypes: string[],
  radiusKm: number
): Promise<OsmNearbyResult[] | null> {
  return new Promise((resolve) => {
    const controllers: AbortController[] = [];
    let nextMirror = 0;
    let failed = 0;
    let settled = false;
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

    const settle = (results: OsmNearbyResult[] | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(hedgeTimer);
      for (const c of controllers) c.abort();
      resolve(results);
    };

    const launchNext = () => {
      if (settled || nextMirror >= OVERPASS_URLS.length) return;
      const url = OVERPASS_URLS[nextMirror++];
      const controller = new AbortController();
      controllers.push(controller);
      clearTimeout(hedgeTimer);
      hedgeTimer = setTimeout(launchNext, HEDGE_DELAY_MS);
      fetchOnce(url, lat, lng, requestedTypes, radiusKm, controller.signal).then((results) => {
        if (results !== null) settle(results);
        else if (++failed === OVERPASS_URLS.length) settle(null);
        else launchNext();
      });
    };

    launchNext();
  });
}

async function fetchOnce(
  url: string,
  lat: number,
  lng: number,
  requestedTypes: string[],
  radiusKm: number,
  raceSignal: AbortSignal
): Promise<OsmNearbyResult[] | null> {
  const radiusMeters = Math.round(radiusKm * 1000);
  const around = `(around:${radiusMeters},${lat},${lng})`;
  const clauses = requestedTypes.map((t) => `${OSM_TYPE_MAP[t].query}${around};`).join("\n  ");
  // Now that a failed attempt falls through to a second endpoint rather than
  // being the only shot, each individual attempt gets a shorter budget so a
  // stuck first endpoint doesn't eat the whole request.
  const query = `[out:json][timeout:12];\n(\n  ${clauses}\n);\nout center 30;`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PER_MIRROR_TIMEOUT_MS);
  const abortOnRaceLost = () => controller.abort();
  raceSignal.addEventListener("abort", abortOnRaceLost);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Overpass's Apache front-end 406s requests without a normal Accept
        // header and blocks generic/missing User-Agents as abuse prevention.
        Accept: "*/*",
        "User-Agent": "Together-App/1.0 (contact: info@temptico.com)",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn("[osmPlaces] Overpass responded with status", res.status, url);
      return null;
    }

    const data = (await res.json()) as {
      elements?: Array<{
        type: string;
        id: number;
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }>;
    };

    const results: OsmNearbyResult[] = [];
    for (const el of data.elements || []) {
      const tags = el.tags;
      const name = tags?.name;
      if (!tags || !name) continue;

      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (elLat == null || elLng == null) continue;

      const matchedType = requestedTypes.find((t) => {
        const mapping = OSM_TYPE_MAP[t];
        const [key, value] = mapping.query.replace(/^node\[/, "").replace(/\]$/, "").split("=");
        const tagKey = key.replace(/"/g, "");
        const tagValue = value?.replace(/"/g, "");
        return tagValue ? tags[tagKey] === tagValue : !!tags[tagKey];
      });
      if (!matchedType) continue;

      const mapping = OSM_TYPE_MAP[matchedType];
      const address = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
      const website = tags.website || tags["contact:website"];
      const phone = tags.phone || tags["contact:phone"];

      results.push({
        externalId: `osm:${el.type}:${el.id}`,
        title: name,
        description: address || "",
        category: mapping.category,
        cost: mapping.costHint || "eur",
        duration: "1h",
        locationType: matchedType,
        address: address || undefined,
        website: website || undefined,
        phone: phone || undefined,
        lat: elLat,
        lng: elLng,
      });
    }
    return results;
  } catch (err) {
    // Aborted because another mirror answered first — not a failure.
    if (!raceSignal.aborted) {
      console.warn("[osmPlaces] Overpass lookup failed:", url, err instanceof Error ? err.message : err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
    raceSignal.removeEventListener("abort", abortOnRaceLost);
  }
}
