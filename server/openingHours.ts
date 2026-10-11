import opening_hours from "opening_hours";

// Whether a venue is open at `at`, from its OSM opening_hours tag. null when
// it's unknown: no tag, a tag the parser can't read, or one whose state is
// "unknown" (e.g. "off" with a comment, or open-ended ranges). Times are
// read in the server's zone (Europe/Ljubljana, see tz.ts), which is right for
// Slovenia, Croatia and Bosnia; elsewhere it can be off by the time difference.
export function isOpenAt(tag: string | undefined, at: Date = new Date()): boolean | null {
  if (!tag) return null;
  try {
    const oh = new opening_hours(tag, null, 0);
    if (oh.getUnknown(at)) return null;
    return oh.getState(at);
  } catch {
    return null;
  }
}
