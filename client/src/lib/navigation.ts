// Turn-by-turn directions to a place in the maps app the user picks. The
// choice is asked each time unless they chose "always", which is kept here
// and can be changed back in Profile.

export type MapsApp = "google" | "apple";

const PREFERENCE_KEY = "together:mapsApp";
const CHANGE_EVENT = "together:mapsAppChange";

export function directionsUrl(app: MapsApp, lat: number, lng: number, name?: string): string {
  if (app === "apple") {
    const params = new URLSearchParams({ daddr: `${lat},${lng}` });
    if (name) params.set("q", name);
    return `https://maps.apple.com/?${params.toString()}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function getMapsPreference(): MapsApp | null {
  try {
    const v = localStorage.getItem(PREFERENCE_KEY);
    return v === "google" || v === "apple" ? v : null;
  } catch {
    return null;
  }
}

export function setMapsPreference(app: MapsApp | null) {
  try {
    if (app) localStorage.setItem(PREFERENCE_KEY, app);
    else localStorage.removeItem(PREFERENCE_KEY);
  } catch {
    // Without storage it just asks every time.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// For useSyncExternalStore: every directions link on screen follows a change
// made from one of them (or from Profile) right away.
export function subscribeMapsPreference(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}
