import { describe, it, expect } from "vitest";
import { boundingBox, haversineKm, parseRadiusKm } from "./geo.js";

describe("parseRadiusKm", () => {
  it("accepts the offered radii", () => {
    expect(parseRadiusKm("1")).toBe(1);
    expect(parseRadiusKm("20")).toBe(20);
  });
  it("snaps anything else to the default", () => {
    expect(parseRadiusKm(undefined)).toBe(5);
    expect(parseRadiusKm("500")).toBe(5);
    expect(parseRadiusKm("abc")).toBe(5);
  });
});

describe("boundingBox", () => {
  it("contains points just inside the radius in every direction", () => {
    const [lat, lng, r] = [44.77, 17.19, 5];
    const box = boundingBox(lat, lng, r);
    for (const [dLat, dLng] of [[0.044, 0], [-0.044, 0], [0, 0.062], [0, -0.062]]) {
      const p = { lat: lat + dLat, lng: lng + dLng };
      expect(haversineKm(lat, lng, p.lat, p.lng)).toBeLessThan(r);
      expect(p.lat).toBeGreaterThanOrEqual(box.minLat);
      expect(p.lat).toBeLessThanOrEqual(box.maxLat);
      expect(p.lng).toBeGreaterThanOrEqual(box.minLng);
      expect(p.lng).toBeLessThanOrEqual(box.maxLng);
    }
  });
});
