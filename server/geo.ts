// Great-circle distance in km between two lat/lng points.
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Lat/lng box that fully contains a circle of radiusKm — a cheap SQL
// prefilter before the exact haversine check.
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

// Radii offered in nearby search. Anything else is snapped to the default,
// so a crafted request can't ask Overpass for a city-sized area.
export const NEARBY_RADII_KM = [1, 5, 20] as const;
export const DEFAULT_NEARBY_RADIUS_KM = 5;

export function parseRadiusKm(raw: unknown): number {
  const n = Number(raw);
  return (NEARBY_RADII_KM as readonly number[]).includes(n) ? n : DEFAULT_NEARBY_RADIUS_KM;
}
