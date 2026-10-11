import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchNearbyPlaces } from "./places.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function stubGoogle(response: Response) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const CAFE = {
  id: "ChIJ-cafe",
  displayName: { text: "Kafana Kod Bake" },
  shortFormattedAddress: "Gospodska 1, Banja Luka",
  location: { latitude: 44.773, longitude: 17.19 },
  types: ["cafe", "food", "point_of_interest"],
};

// Distinct coordinates per test keep the in-module cache from leaking.
describe("Google Places (New) nearby search", () => {
  it("does nothing without an API key", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    const fetchMock = stubGoogle(new Response("{}"));
    expect(await fetchNearbyPlaces(44.1, 17.1, ["kavarne"], 5)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends one Places API (New) request with key, basic field mask and a radius", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const fetchMock = stubGoogle(new Response(JSON.stringify({ places: [CAFE] })));

    const results = await fetchNearbyPlaces(44.2, 17.2, ["kavarne", "parki"], 5, "sl");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://places.googleapis.com/v1/places:searchNearby");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Goog-Api-Key"]).toBe("test-key");
    expect(headers["X-Goog-FieldMask"]).not.toMatch(/priceLevel|rating|website|phone/);
    expect(JSON.parse(init.body as string)).toEqual({
      includedTypes: ["cafe", "coffee_shop", "park"],
      maxResultCount: 20,
      locationRestriction: { circle: { center: { latitude: 44.2, longitude: 17.2 }, radius: 5000 } },
      languageCode: "sl",
    });
    expect(results).toEqual([
      expect.objectContaining({ externalId: "ChIJ-cafe", title: "Kafana Kod Bake", locationType: "kavarne", lat: 44.773 }),
    ]);
  });

  it("skips Google for types it can't map, leaving them to OpenStreetMap", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const fetchMock = stubGoogle(new Response("{}"));
    expect(await fetchNearbyPlaces(44.3, 17.3, ["trgovine", "trznice"], 5)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports failure (null), not an empty list, when Google rejects the request", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "bad-key");
    stubGoogle(new Response(JSON.stringify({ error: { status: "PERMISSION_DENIED" } }), { status: 403 }));
    expect(await fetchNearbyPlaces(44.4, 17.4, ["kavarne"], 5)).toBeNull();
  });

  it("treats an area with no places as a valid empty answer", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    stubGoogle(new Response("{}"));
    expect(await fetchNearbyPlaces(44.5, 17.5, ["kavarne"], 5)).toEqual([]);
  });

  it("serves a repeat search of the same area from cache", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ places: [CAFE] })));
    vi.stubGlobal("fetch", fetchMock);
    await fetchNearbyPlaces(44.6, 17.6, ["kavarne"], 5);
    await fetchNearbyPlaces(44.6, 17.6, ["kavarne"], 5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
