// Live nearby venues: Geoapify when configured (reliable, hosted), falling
// back to the public Overpass servers — which are often at capacity, so they
// alone can't be relied on.

import { fetchNearbyGeoapifyPlaces } from "./geoapifyPlaces.js";
import { fetchNearbyOsmPlaces, type OsmNearbyResult } from "./osmPlaces.js";

export type NearbySource = "geoapify" | "overpass";

// The same short shared cache idea as Overpass's: many people looking at the
// same area within minutes share one lookup (and one batch of credits).
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { results: OsmNearbyResult[]; expiresAt: number }>();

export async function fetchNearbyPlaces(
  lat: number,
  lng: number,
  types: string[],
  radiusKm: number
): Promise<{ results: OsmNearbyResult[] | null; source: NearbySource | null }> {
  const key = `${Math.round(lat * 100) / 100},${Math.round(lng * 100) / 100}|${[...types].sort().join(",")}|${radiusKm}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { results: cached.results, source: "geoapify" };

  const geoapify = await fetchNearbyGeoapifyPlaces(lat, lng, types, radiusKm);
  if (geoapify) {
    if (geoapify.length > 0) {
      if (cache.size > 500) cache.delete(cache.keys().next().value!);
      cache.set(key, { results: geoapify, expiresAt: Date.now() + CACHE_TTL_MS });
    }
    return { results: geoapify, source: "geoapify" };
  }

  const overpass = await fetchNearbyOsmPlaces(lat, lng, types, radiusKm);
  return { results: overpass, source: overpass ? "overpass" : null };
}
