import { BlockList, isIP } from "node:net";

// Express `trust proxy` callback. Traffic to the custom domain arrives
// through two hops — Cloudflare's edge, then Render's own load balancer —
// so the real client IP is two entries from the right of X-Forwarded-For.
// A fixed hop count of 2 was wrong for requests that hit the *.onrender.com
// hostname directly: there Render is the only hop, and the "second hop" is
// whatever the caller put in X-Forwarded-For, which let a script pick its
// own IP and dodge the per-IP login/register limits. So the first hop is
// always trusted (it's Render) and the second only when it really is a
// Cloudflare address.
//
// Published ranges: https://www.cloudflare.com/ips/ (they change rarely;
// an unlisted edge only means that visitor is seen as the edge IP, i.e.
// shares a rate-limit bucket — never a security hole).
const CLOUDFLARE_RANGES = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

const cloudflare = new BlockList();
for (const range of CLOUDFLARE_RANGES) {
  const [addr, bits] = range.split("/");
  cloudflare.addSubnet(addr, Number(bits), addr.includes(":") ? "ipv6" : "ipv4");
}

export function isCloudflareIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return cloudflare.check(ip, "ipv4");
  if (v === 6) return cloudflare.check(ip, "ipv6");
  return false;
}

export function trustProxy(ip: string, hop: number): boolean {
  if (hop === 0) return true;
  if (hop === 1) return isCloudflareIp(ip);
  return false;
}
