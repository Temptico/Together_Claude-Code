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
// Two independently-hosted Overpass instances, tried in order. Each enforces
// a fair-use concurrent-slot limit per source IP — since every user's
// request comes from this one server's IP, a burst of people tapping "Find
// nearby" close together (e.g. right after a mass email) can get each other
// rate-limited on whichever instance they land on. overpass.osm.ch is a
// separate deployment (not just a load-balanced alias of overpass-api.de),
// so it isn't sharing the same rate-limit bucket when the primary is under
// pressure.
const OVERPASS_URLS = ["https://overpass-api.de/api/interpreter", "https://overpass.osm.ch/api/interpreter"];

// Two more mitigations beyond the dual endpoints: a short cache so many
// people asking about the same area within a few minutes share one lookup,
// and caching only successful results so a failure never "sticks".
const CACHE_TTL_MS = 10 * 60 * 1000;
const resultCache = new Map<string, { results: OsmNearbyResult[]; expiresAt: number }>();

function cacheKey(lat: number, lng: number, types: string[], radiusKm: number): string {
  // Round to ~1.1km so nearby requests for the same neighborhood share a
  // cache entry instead of each getting a slightly different grid cell.
  const rLat = Math.round(lat * 100) / 100;
  const rLng = Math.round(lng * 100) / 100;
  return `${rLat},${rLng}|${[...types].sort().join(",")}|${radiusKm}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  let results: OsmNearbyResult[] | null = null;
  for (let i = 0; i < OVERPASS_URLS.length; i++) {
    results = await fetchOnce(OVERPASS_URLS[i], lat, lng, requestedTypes, radiusKm);
    if (results !== null) break;
    // A short delay before falling through to the next endpoint (or retrying
    // the last one) — enough to ride out a momentary blip without meaningfully
    // slowing down the common (already working) case, which never reaches
    // this branch.
    if (i < OVERPASS_URLS.length - 1) await sleep(800);
  }

  if (results !== null) resultCache.set(key, { results, expiresAt: Date.now() + CACHE_TTL_MS });
  return results;
}

async function fetchOnce(
  url: string,
  lat: number,
  lng: number,
  requestedTypes: string[],
  radiusKm: number
): Promise<OsmNearbyResult[] | null> {
  const radiusMeters = Math.round(radiusKm * 1000);
  const around = `(around:${radiusMeters},${lat},${lng})`;
  const clauses = requestedTypes.map((t) => `${OSM_TYPE_MAP[t].query}${around};`).join("\n  ");
  // Now that a failed attempt falls through to a second endpoint rather than
  // being the only shot, each individual attempt gets a shorter budget so a
  // stuck first endpoint doesn't eat the whole request.
  const query = `[out:json][timeout:12];\n(\n  ${clauses}\n);\nout center 30;`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

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
      console.warn("[osmPlaces] Overpass responded with status", res.status);
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
    console.warn("[osmPlaces] Overpass lookup failed:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
