// Turn-by-turn directions link to a place: Apple Maps on iPhone/iPad (it
// opens the native app there), Google Maps everywhere else (the Android app
// handles these links, and on desktop it's the web version).
export function directionsUrl(lat: number, lng: number, name?: string): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isApple =
    /iPhone|iPad|iPod/.test(ua) ||
    // iPadOS reports itself as a Mac with touch.
    (/Macintosh/.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
  if (isApple) {
    const params = new URLSearchParams({ daddr: `${lat},${lng}` });
    if (name) params.set("q", name);
    return `https://maps.apple.com/?${params.toString()}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
