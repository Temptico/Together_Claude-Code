import { haversineKm } from "./geo.js";

// Two entries this close with matching names are the same venue.
const SAME_PLACE_KM = 0.15;

type Place = { id: number; title: string; lat: number | null; lng: number | null; externalId?: string | null; distanceKm: number };

// "Kavarna Moderna" / "kavarna moderna!" / "Café Moderna" → comparable keys.
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function namesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && ` ${long} `.includes(` ${short} `);
}

// Merges catalog ideas and live OSM places into one list, nearest first,
// without showing the same venue twice — OSM often has a café both as its
// own node and again under a slightly different name, and a catalog idea
// for a venue also shows up in OSM. Catalog entries win over live ones
// since they carry our own description.
export function mergeNearby<T extends Place>(catalog: T[], live: T[]): T[] {
  const byId = new Map<number, T>();
  for (const p of [...catalog, ...live]) byId.set(p.id, p);
  const preferred = [...byId.values()].sort(
    (a, b) => Number(!!a.externalId) - Number(!!b.externalId) || a.distanceKm - b.distanceKm
  );

  const kept: { place: T; key: string }[] = [];
  for (const place of preferred) {
    const key = normalizeName(place.title);
    const duplicate = kept.some(
      (k) =>
        place.lat != null &&
        place.lng != null &&
        k.place.lat != null &&
        k.place.lng != null &&
        namesMatch(k.key, key) &&
        haversineKm(k.place.lat, k.place.lng, place.lat, place.lng) <= SAME_PLACE_KM
    );
    if (!duplicate) kept.push({ place, key });
  }
  return kept.map((k) => k.place).sort((a, b) => a.distanceKm - b.distanceKm);
}
