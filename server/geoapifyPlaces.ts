// Nearby venues via Geoapify's Places API — OpenStreetMap data served from a
// hosted, rate-limited service meant for apps. It's the primary live source
// when GEOAPIFY_API_KEY is set: the public Overpass servers turned away
// automated queries outright when busy ("intended for browser-based and
// human-operated tools"), which left nearby search empty for long stretches.
// Free plan: 3000 credits/day, 1 credit per 20 places returned; commercial
// use allowed with "Powered by Geoapify" attribution (shown in the client).

import { DEFAULT_TYPES, placeTypeInfo, type OsmNearbyResult } from "./osmPlaces.js";

const PLACES_URL = "https://api.geoapify.com/v2/places";
const MAX_RESULTS = 40;
const TIMEOUT_MS = 10_000;

// Geoapify category per nearby type. Parent keys include their children
// (catering.restaurant also covers catering.restaurant.pizza, …). Dance
// studios have no Geoapify category, so that filter only works via Overpass.
const CATEGORY_BY_TYPE: Record<string, string> = {
  restavracije: "catering.restaurant",
  kavarne: "catering.cafe",
  bari: "catering.bar",
  parki: "leisure.park",
  "naravni-kraji": "tourism.attraction",
  muzeji: "entertainment.museum",
  galerije: "entertainment.culture.gallery",
  gledalisca: "entertainment.culture.theatre",
  knjiznice: "education.library",
  vinarije: "production.winery",
  trznice: "commercial.marketplace",
  trgovine: "commercial",
  "rekreacijski-centri": "sport.fitness",
};

const OSM_TYPE_NAMES: Record<string, string> = { n: "node", w: "way", r: "relation", node: "node", way: "way", relation: "relation" };

type GeoapifyFeature = {
  properties: {
    name?: string;
    lat: number;
    lon: number;
    street?: string;
    housenumber?: string;
    city?: string;
    categories?: string[];
    website?: string;
    opening_hours?: string;
    contact?: { phone?: string };
    place_id: string;
    datasource?: { raw?: { osm_id?: number; osm_type?: string } };
  };
};

export function isGeoapifyConfigured(): boolean {
  return !!process.env.GEOAPIFY_API_KEY;
}

// Resolves to null when the lookup failed (or no key is set), so the caller
// can fall back to Overpass; [] means the area really has nothing.
export async function fetchNearbyGeoapifyPlaces(
  lat: number,
  lng: number,
  types: string[],
  radiusKm: number
): Promise<OsmNearbyResult[] | null> {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return null;
  const requestedTypes = (types.length > 0 ? types : DEFAULT_TYPES).filter((t) => CATEGORY_BY_TYPE[t]);
  if (requestedTypes.length === 0) return null;

  const params = new URLSearchParams({
    categories: requestedTypes.map((t) => CATEGORY_BY_TYPE[t]).join(","),
    filter: `circle:${lng},${lat},${Math.round(radiusKm * 1000)}`,
    // Nearest first, so the capped list is the closest places.
    bias: `proximity:${lng},${lat}`,
    limit: String(MAX_RESULTS),
    apiKey,
  });

  try {
    const res = await fetch(`${PLACES_URL}?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn("[geoapify] Places responded with status", res.status);
      return null;
    }
    const data = (await res.json()) as { features?: GeoapifyFeature[] };
    return (data.features || []).flatMap((f) => {
      const result = toResult(f, requestedTypes);
      return result ? [result] : [];
    });
  } catch (err) {
    console.warn("[geoapify] Places lookup failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export function toResult(feature: GeoapifyFeature, requestedTypes: string[]): OsmNearbyResult | null {
  const p = feature.properties;
  if (!p.name || p.lat == null || p.lon == null) return null;
  const cats = p.categories || [];
  const type = requestedTypes.find((t) => {
    const key = CATEGORY_BY_TYPE[t];
    return cats.some((c) => c === key || c.startsWith(`${key}.`));
  });
  const info = type && placeTypeInfo(type);
  if (!type || !info) return null;

  // Use the OSM id when Geoapify passes it through, so a place found here and
  // later via Overpass (or the other way round) is the same stored idea.
  const osmType = p.datasource?.raw?.osm_type && OSM_TYPE_NAMES[p.datasource.raw.osm_type];
  const osmId = p.datasource?.raw?.osm_id;
  const externalId = osmType && osmId != null ? `osm:${osmType}:${Math.abs(osmId)}` : `geoapify:${p.place_id}`;
  const address = [p.street, p.housenumber].filter(Boolean).join(" ");

  return {
    externalId,
    title: p.name,
    description: address,
    category: info.category,
    cost: info.costHint || "eur",
    duration: "1h",
    locationType: type,
    city: p.city || undefined,
    address: address || undefined,
    website: p.website || undefined,
    phone: p.contact?.phone || undefined,
    openingHours: p.opening_hours || undefined,
    lat: p.lat,
    lng: p.lon,
  };
}
