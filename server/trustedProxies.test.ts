import { describe, expect, it } from "vitest";
import { isCloudflareIp, trustProxy } from "./trustedProxies.js";

describe("trustProxy", () => {
  it("always trusts the first hop (Render's load balancer)", () => {
    expect(trustProxy("10.0.0.1", 0)).toBe(true);
  });

  it("trusts a Cloudflare edge as the second hop", () => {
    expect(trustProxy("104.16.1.1", 1)).toBe(true);
    expect(trustProxy("2606:4700::1", 1)).toBe(true);
  });

  it("does not trust a caller-supplied second hop", () => {
    expect(trustProxy("8.8.8.8", 1)).toBe(false);
    expect(trustProxy("not-an-ip", 1)).toBe(false);
    expect(trustProxy("104.16.1.1", 2)).toBe(false);
  });

  it("recognizes Cloudflare ranges only", () => {
    expect(isCloudflareIp("172.70.1.1")).toBe(true);
    expect(isCloudflareIp("172.16.0.1")).toBe(false);
  });
});
