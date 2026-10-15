import { afterEach, describe, expect, it, vi } from "vitest";
import { toResult } from "./geoapifyPlaces.js";
import { fetchNearbyPlaces } from "./nearbyPlaces.js";

const feature = (props: Record<string, unknown>) => ({
  properties: { name: "Kafe Tirana", lat: 41.33, lon: 19.82, place_id: "abc", categories: ["catering", "catering.cafe"], ...props },
});

describe("toResult (Geoapify → nearby place)", () => {
  it("maps fields and keeps the OSM id when Geoapify passes it through", () => {
    const r = toResult(
      feature({
        street: "Rruga Myslym Shyri",
        housenumber: "5",
        opening_hours: "Mo-Su 07:00-23:00",
        website: "https://kafe.al",
        contact: { phone: "+355 4 000" },
        datasource: { raw: { osm_id: 123, osm_type: "n" } },
      }) as any,
      ["kavarne", "restavracije"]
    );
    expect(r).toMatchObject({
      externalId: "osm:node:123",
      title: "Kafe Tirana",
      locationType: "kavarne",
      address: "Rruga Myslym Shyri 5",
      openingHours: "Mo-Su 07:00-23:00",
      website: "https://kafe.al",
      phone: "+355 4 000",
      lat: 41.33,
      lng: 19.82,
    });
  });

  it("matches child categories and falls back to the Geoapify id", () => {
    const r = toResult(feature({ categories: ["catering.restaurant.pizza"] }) as any, ["restavracije"]);
    expect(r).toMatchObject({ externalId: "geoapify:abc", locationType: "restavracije" });
  });

  it("drops unnamed places and ones outside the requested types", () => {
    expect(toResult(feature({ name: undefined }) as any, ["kavarne"])).toBeNull();
    expect(toResult(feature({}) as any, ["parki"])).toBeNull();
  });
});

describe("fetchNearbyPlaces source selection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const stubFetch = (geoapify: "ok" | "fail", overpass: "ok" | "fail") => {
    const hosts: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        const host = new URL(url).hostname;
        hosts.push(host);
        if (host === "api.geoapify.com") {
          return Promise.resolve(
            geoapify === "ok"
              ? new Response(JSON.stringify({ features: [feature({})] }), { status: 200 })
              : new Response("err", { status: 500 })
          );
        }
        return Promise.resolve(
          overpass === "ok"
            ? new Response(
                JSON.stringify({ elements: [{ type: "node", id: 9, lat: 41.33, lon: 19.82, tags: { amenity: "cafe", name: "Osm Kafe" } }] }),
                { status: 200 }
              )
            : new Response("busy", { status: 502 })
        );
      })
    );
    return hosts;
  };

  it("uses Geoapify when a key is set", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test");
    const hosts = stubFetch("ok", "ok");
    const { results, source } = await fetchNearbyPlaces(41.1, 19.1, ["kavarne"], 5);
    expect(source).toBe("geoapify");
    expect(results?.map((r) => r.title)).toEqual(["Kafe Tirana"]);
    expect(hosts).toEqual(["api.geoapify.com"]);
  });

  it("falls back to Overpass when Geoapify fails", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test");
    stubFetch("fail", "ok");
    const { results, source } = await fetchNearbyPlaces(41.2, 19.2, ["kavarne"], 5);
    expect(source).toBe("overpass");
    expect(results?.map((r) => r.title)).toEqual(["Osm Kafe"]);
  });

  it("goes straight to Overpass without a key", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "");
    const hosts = stubFetch("ok", "ok");
    const { source } = await fetchNearbyPlaces(41.3, 19.3, ["kavarne"], 5);
    expect(source).toBe("overpass");
    expect(hosts).not.toContain("api.geoapify.com");
  });

  it("reports failure when every source fails", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test");
    stubFetch("fail", "fail");
    const { results, source } = await fetchNearbyPlaces(41.4, 19.4, ["kavarne"], 5);
    expect(results).toBeNull();
    expect(source).toBeNull();
  });
});
