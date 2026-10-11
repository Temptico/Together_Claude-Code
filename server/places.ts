// Optional Google Places layer for nearby search, on top of the always-on
// OpenStreetMap lookup (osmPlaces.ts). Active only when
// GOOGLE_PLACES_API_KEY is set; otherwise fetchNearbyPlaces returns null and
// nothing else changes.
//
// Uses Places API (New) — Google stopped enabling the legacy
// /maps/api/place/nearbysearch endpoint for new projects in March 2025, so a
// freshly created key only works here. One request per search (all types
// combined), asking only for basic fields: the field mask decides the
// billing tier, and price level, rating, website or phone would each move
// every call into a pricier tier with a much smaller free monthly quota.

const SEARCH_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const FIELD_MASK = "places.id,places.displayName,places.shortFormattedAddress,places.location,places.types";
const MAX_RESULTS = 20; // the API's ceiling per request

// Only Google place types we can map with confidence; anything else
// (markets, dance studios, generic shops) is left to OpenStreetMap — an
// unknown type in includedTypes fails the whole request.
const GOOGLE_TYPE_MAP: Record<string, { includedTypes: string[]; category: string; costHint?: string }> = {
  restavracije: { includedTypes: ["restaurant"], category: "sprosceno" },
  kavarne: { includedTypes: ["cafe", "coffee_shop"], category: "sprosceno" },
  parki: { includedTypes: ["park"], category: "na-prostem", costHint: "brezplacno" },
  "naravni-kraji": { includedTypes: ["tourist_attraction"], category: "na-prostem" },
  muzeji: { includedTypes: ["museum"], category: "kulturno" },
  galerije: { includedTypes: ["art_gallery"], category: "kulturno" },
  vinarije: { includedTypes: ["winery"], category: "sprosceno" },
  bari: { includedTypes: ["bar"], category: "sprosceno" },
  "rekreacijski-centri": { includedTypes: ["gym"], category: "aktivno" },
};

const DEFAULT_TYPES = ["restavracije", "kavarne", "parki", "muzeji"];

// Same idea as the OSM cache: nearby searches of the same neighborhood
// within a few minutes share one billable call. Only non-empty answers are
// kept, so a failure or empty answer never sticks.
const CACHE_TTL_MS = 10 * 60 * 1000;
const resultCache = new Map<string, { results: GoogleNearbyResult[]; expiresAt: number }>();

export type GoogleNearbyResult = {
  externalId: string;
  title: string;
  description: string;
  category: string;
  cost: string;
  duration: string;
  locationType: string;
  city?: string;
  address?: string;
  lat: number;
  lng: number;
};

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
};

export async function fetchNearbyPlaces(
  lat: number,
  lng: number,
  types: string[],
  radiusKm: number,
  language?: string
): Promise<GoogleNearbyResult[] | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const requestedTypes = (types.length > 0 ? types : DEFAULT_TYPES).filter((t) => GOOGLE_TYPE_MAP[t]);
  if (requestedTypes.length === 0) return null;

  const cacheKey = `${Math.round(lat * 100) / 100},${Math.round(lng * 100) / 100}|${[...requestedTypes].sort().join(",")}|${radiusKm}|${language || ""}`;
  const cached = resultCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const includedTypes = [...new Set(requestedTypes.flatMap((t) => GOOGLE_TYPE_MAP[t].includedTypes))];

  try {
    const res = await fetch(SEARCH_NEARBY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes,
        maxResultCount: MAX_RESULTS,
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius: Math.round(radiusKm * 1000) },
        },
        ...(language ? { languageCode: language } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[places] Google Places API error:", res.status, body.slice(0, 300));
      return null;
    }

    const data = (await res.json()) as { places?: GooglePlace[] };
    const results: GoogleNearbyResult[] = [];
    for (const place of data.places || []) {
      const name = place.displayName?.text;
      const placeLat = place.location?.latitude;
      const placeLng = place.location?.longitude;
      if (!name || placeLat == null || placeLng == null) continue;
      const matchedType = requestedTypes.find((t) =>
        GOOGLE_TYPE_MAP[t].includedTypes.some((gt) => place.types?.includes(gt))
      );
      if (!matchedType) continue;
      const mapping = GOOGLE_TYPE_MAP[matchedType];
      results.push({
        // Same place IDs as the legacy API, so ideas already stored from it
        // keep matching instead of duplicating.
        externalId: place.id,
        title: name,
        description: place.shortFormattedAddress || "",
        category: mapping.category,
        cost: mapping.costHint || "eur",
        duration: "1h",
        locationType: matchedType,
        address: place.shortFormattedAddress,
        lat: placeLat,
        lng: placeLng,
      });
    }

    if (results.length > 0) resultCache.set(cacheKey, { results, expiresAt: Date.now() + CACHE_TTL_MS });
    return results;
  } catch (err) {
    console.warn("[places] Google Places request failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
