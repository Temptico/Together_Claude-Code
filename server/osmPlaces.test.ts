import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchNearbyOsmPlaces } from "./osmPlaces.js";

const PRIMARY = "overpass-api.de";
const SECONDARY = "overpass.private.coffee";

type MirrorBehavior = "cafe" | "empty" | "fail" | "hang";

function cafeResponse() {
  return new Response(
    JSON.stringify({ elements: [{ type: "node", id: 1, lat: 44.77, lon: 17.19, tags: { amenity: "cafe", name: "Kava" } }] }),
    { status: 200 }
  );
}

// Stubs fetch so each mirror behaves as given; "hang" never answers until
// the request is aborted. Returns the hostnames contacted, in order.
function stubMirrors(behavior: Record<string, MirrorBehavior>) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit) => {
      const host = new URL(url).hostname;
      calls.push(host);
      switch (behavior[host]) {
        case "cafe":
          return Promise.resolve(cafeResponse());
        case "empty":
          return Promise.resolve(new Response(JSON.stringify({ elements: [] }), { status: 200 }));
        case "fail":
          return Promise.resolve(new Response("Gateway Timeout", { status: 504 }));
        default:
          return new Promise((_, reject) =>
            init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
          );
      }
    })
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// Distinct coordinates per test so the in-module result cache never leaks
// one test's answer into another.
describe("nearby search across Overpass mirrors", () => {
  it("uses the primary alone when it answers", async () => {
    const calls = stubMirrors({ [PRIMARY]: "cafe", [SECONDARY]: "cafe" });
    const results = await fetchNearbyOsmPlaces(44.1, 17.1, ["kavarne"], 5);
    expect(results?.map((r) => r.title)).toEqual(["Kava"]);
    expect(calls).toEqual([PRIMARY]);
  });

  it("falls through to the secondary at once when the primary fails", async () => {
    const calls = stubMirrors({ [PRIMARY]: "fail", [SECONDARY]: "cafe" });
    const results = await fetchNearbyOsmPlaces(44.2, 17.2, ["kavarne"], 5);
    expect(results).toHaveLength(1);
    expect(calls).toEqual([PRIMARY, SECONDARY]);
  });

  it("asks the secondary in parallel when the primary is too slow", async () => {
    const calls = stubMirrors({ [PRIMARY]: "hang", [SECONDARY]: "cafe" });
    const results = await fetchNearbyOsmPlaces(44.3, 17.3, ["kavarne"], 5);
    expect(results).toHaveLength(1);
    expect(calls).toEqual([PRIMARY, SECONDARY]);
  });

  it("reports failure (null), not an empty list, when every mirror fails", async () => {
    stubMirrors({ [PRIMARY]: "fail", [SECONDARY]: "fail" });
    expect(await fetchNearbyOsmPlaces(44.4, 17.4, ["kavarne"], 5)).toBeNull();
  });

  it("does not cache an empty answer", async () => {
    const calls = stubMirrors({ [PRIMARY]: "empty", [SECONDARY]: "empty" });
    expect(await fetchNearbyOsmPlaces(44.5, 17.5, ["kavarne"], 5)).toEqual([]);
    await fetchNearbyOsmPlaces(44.5, 17.5, ["kavarne"], 5);
    expect(calls.filter((h) => h === PRIMARY)).toHaveLength(2);
  });

  it("caches a non-empty answer", async () => {
    const calls = stubMirrors({ [PRIMARY]: "cafe", [SECONDARY]: "cafe" });
    await fetchNearbyOsmPlaces(44.6, 17.6, ["kavarne"], 5);
    await fetchNearbyOsmPlaces(44.6, 17.6, ["kavarne"], 5);
    expect(calls).toEqual([PRIMARY]);
  });
});
