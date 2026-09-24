import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["server/**/*.test.ts"],
    environment: "node",
    // Each test file runs in its own process, so each gets its own
    // in-memory database (see PGLITE_DATA_DIR in server/db.ts) and never
    // touches the dev .pgdata store or a real DATABASE_URL.
    pool: "forks",
    env: {
      TZ: "Europe/Ljubljana",
      PGLITE_DATA_DIR: "memory://",
      DATABASE_URL: "",
    },
    // Migrations + seeding an in-memory Postgres takes a few seconds.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
