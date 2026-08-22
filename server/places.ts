// Optional live nearby-places integration. When GOOGLE_PLACES_API_KEY is set,
// nearby search results are enriched with real venues from Google Places.
// Without a key the app keeps working exactly as before, using only the
// seeded local date-idea catalog — this module simply returns null.

const GOOGLE_TYPE_MAP: Record<string, { googleType?: string; keyword?: string; category: string; costHint?: string }> = {
  restavracije: { googleType: "restaurant", category: "sprosceno" },
  kavarne: { googleType: "cafe", category: "sprosceno" },
  parki: { googleType: "park", category: "na-prostem", costHint: "brezplacno" },
  "naravni-kraji": { googleType: "tourist_attraction", category: "na-prostem" },
  muzeji: { googleType: "museum", category: "kulturno" },
  galerije: { googleType: "art_gallery", category: "kulturno" },
  vinarije: { keyword: "vinarija", category: "sprosceno" },
  bari: { googleType: "bar", category: "sprosceno" },
  trznice: { keyword: "tržnica", category: "sprosceno" },
  trgovine: { googleType: "clothing_store", category: "sprosceno" },
  "plesni-studii": { keyword: "plesni studio", category: "aktivno" },
  "rekreacijski-centri": { googleType: "gym", category: "aktivno" },
};

const DEFAULT_TYPES = ["restavracije", "kavarne", "parki", "muzeji"];

function priceLevelToCost(level: number | undefined): string {
  if (level === undefined || level === 0) return "brezplacno";
  if (level === 1) return "eur";
  if (level === 2) return "eur2";
  return "eur3";
}

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

export async function fetchNearbyPlaces(
  lat: number,
  lng: number,
  types: string[],
  radiusKm: number
): Promise<GoogleNearbyResult[] | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const requestedTypes = types.length > 0 ? types : DEFAULT_TYPES;
  const radiusMeters = Math.round(radiusKm * 1000);
  const results: GoogleNearbyResult[] = [];
  const seen = new Set<string>();

  for (const type of requestedTypes) {
    const mapping = GOOGLE_TYPE_MAP[type];
    if (!mapping) continue;

    const params = new URLSearchParams({
      location: `${lat},${lng}`,
      radius: String(radiusMeters),
      key: apiKey,
    });
    if (mapping.googleType) params.set("type", mapping.googleType);
    if (mapping.keyword) params.set("keyword", mapping.keyword);

    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        status: string;
        error_message?: string;
        results?: Array<{
          place_id: string;
          name: string;
          vicinity?: string;
          price_level?: number;
          geometry?: { location?: { lat: number; lng: number } };
        }>;
      };
      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        console.warn("[places] Google Places API error:", data.status, data.error_message);
        continue;
      }
      for (const place of data.results || []) {
        if (seen.has(place.place_id)) continue;
        const lat = place.geometry?.location?.lat;
        const lng = place.geometry?.location?.lng;
        if (lat == null || lng == null) continue;
        seen.add(place.place_id);
        results.push({
          externalId: place.place_id,
          title: place.name,
          description: place.vicinity || "",
          category: mapping.category,
          cost: mapping.costHint || priceLevelToCost(place.price_level),
          duration: "1h",
          locationType: type,
          address: place.vicinity,
          lat,
          lng,
        });
      }
    } catch (err) {
      console.warn("[places] fetch failed for type", type, err);
    }
  }

  return results;
}
