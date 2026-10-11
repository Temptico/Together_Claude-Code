import { describe, it, expect } from "vitest";
import { mergeNearby, normalizeName } from "./nearbyMerge.js";

const place = (id: number, title: string, lat: number, lng: number, distanceKm: number, externalId?: string) => ({
  id,
  title,
  lat,
  lng,
  distanceKm,
  externalId: externalId ?? null,
});

describe("normalizeName", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normalizeName("Café  Moderna!")).toBe("cafe moderna");
    expect(normalizeName("Kavarna Čokolada")).toBe("kavarna cokolada");
  });
});

describe("mergeNearby", () => {
  it("drops a live place that duplicates a nearby catalog idea", () => {
    const catalog = [place(1, "Kavarna Moderna", 46.05, 14.5, 0.5)];
    const live = [place(2, "Moderna", 46.0505, 14.5005, 0.4, "osm:node:1")];
    expect(mergeNearby(catalog, live).map((p) => p.id)).toEqual([1]);
  });

  it("drops duplicate live places, keeping the nearer one", () => {
    const live = [
      place(3, "Bar Central", 46.05, 14.5, 0.9, "osm:node:2"),
      place(4, "bar central", 46.0502, 14.5, 0.8, "osm:node:3"),
    ];
    expect(mergeNearby([], live).map((p) => p.id)).toEqual([4]);
  });

  it("keeps same-named places that are far apart", () => {
    const live = [
      place(5, "Hiša kave", 46.05, 14.5, 0.3, "osm:node:4"),
      place(6, "Hiša kave", 46.06, 14.5, 1.4, "osm:node:5"),
    ];
    expect(mergeNearby([], live).map((p) => p.id)).toEqual([5, 6]);
  });

  it("keeps different venues next door to each other", () => {
    const live = [
      place(7, "Pizzeria Napoli", 46.05, 14.5, 0.2, "osm:node:6"),
      place(8, "Kavarna Lipa", 46.0501, 14.5, 0.21, "osm:node:7"),
    ];
    expect(mergeNearby([], live)).toHaveLength(2);
  });

  it("does not match on very short names", () => {
    const live = [
      place(9, "Bar", 46.05, 14.5, 0.2, "osm:node:8"),
      place(10, "Bar Lipa", 46.0501, 14.5, 0.21, "osm:node:9"),
    ];
    expect(mergeNearby([], live)).toHaveLength(2);
  });

  it("collapses the same id coming from both sources and sorts by distance", () => {
    const stored = place(11, "Park Tivoli", 46.05, 14.5, 1.2, "osm:node:10");
    const near = place(12, "Muzej", 46.05, 14.51, 0.3, "osm:node:11");
    expect(mergeNearby([stored], [stored, near]).map((p) => p.id)).toEqual([12, 11]);
  });
});
