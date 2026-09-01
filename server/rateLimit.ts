// Minimal in-memory rate limiter — no extra dependency, fine for a single
// Render instance. Two independent limiters are exposed:
//  - checkLoginIpLimit()/checkRegisterIpLimit(): a plain sliding-window
//    counter per IP, for blocking high-volume abuse regardless of outcome.
//  - isEmailLockedOut()/recordLoginFailure()/clearLoginFailures(): counts
//    only failed PIN attempts per email, so legitimate repeated logins
//    (multiple devices, a typo followed by the correct PIN) never trip it,
//    while a targeted brute-force of one account's 4-6 digit PIN does, even
//    if the attacker rotates IPs to dodge the IP limiter.
// Entries are swept lazily as they're accessed so memory never grows
// unbounded — fine at this app's scale, and avoids a background timer.

type Bucket = { count: number; resetAt: number };

function makeStore() {
  const store = new Map<string, Bucket>();
  return {
    // Read-only: how many hits are on record right now, without counting
    // this call as one.
    peek(key: string): number {
      const existing = store.get(key);
      if (!existing || existing.resetAt <= Date.now()) return 0;
      return existing.count;
    },
    // Records one hit and reports whether the key is still under `max`.
    hit(key: string, windowMs: number, max: number): { allowed: boolean; retryAfterSec: number } {
      const now = Date.now();
      const existing = store.get(key);
      if (!existing || existing.resetAt <= now) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfterSec: 0 };
      }
      existing.count++;
      const allowed = existing.count <= max;
      return { allowed, retryAfterSec: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000) };
    },
    retryAfterSec(key: string): number {
      const existing = store.get(key);
      if (!existing || existing.resetAt <= Date.now()) return 0;
      return Math.ceil((existing.resetAt - Date.now()) / 1000);
    },
    reset(key: string) {
      store.delete(key);
    },
  };
}

const loginIpLimiter = makeStore();
const registerIpLimiter = makeStore();
const emailFailureLimiter = makeStore();

const FAILURE_WINDOW_MS = 30 * 60 * 1000;
const FAILURE_MAX = 8;

export function checkLoginIpLimit(ip: string) {
  // 20 attempts / 15 min per IP — generous for a shared household connection
  // logging in and out repeatedly, restrictive for a brute-force script.
  return loginIpLimiter.hit(`ip:${ip}`, 15 * 60 * 1000, 20);
}

export function checkRegisterIpLimit(ip: string) {
  // 8 new accounts / hour per IP is plenty for real signups (including
  // shared NAT/office wifi) and blocks bulk fake-account creation.
  return registerIpLimiter.hit(`ip:${ip}`, 60 * 60 * 1000, 8);
}

export function isEmailLockedOut(email: string): { lockedOut: boolean; retryAfterSec: number } {
  const key = `email:${email.toLowerCase()}`;
  const count = emailFailureLimiter.peek(key);
  if (count < FAILURE_MAX) return { lockedOut: false, retryAfterSec: 0 };
  return { lockedOut: true, retryAfterSec: emailFailureLimiter.retryAfterSec(key) };
}

export function recordLoginFailure(email: string) {
  emailFailureLimiter.hit(`email:${email.toLowerCase()}`, FAILURE_WINDOW_MS, FAILURE_MAX);
}

export function clearLoginFailures(email: string) {
  emailFailureLimiter.reset(`email:${email.toLowerCase()}`);
}
