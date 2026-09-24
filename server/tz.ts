// Must stay the first import of the server entrypoint. Everything
// date-related — reminder hours, what "today" is, parsing a planned date's
// wall-clock "19:00" — runs in the server's local time, and Render defaults
// to UTC (two hours behind Slovenia/Croatia in summer). An explicit TZ in
// the environment still wins.
process.env.TZ ||= "Europe/Ljubljana";

export {};
