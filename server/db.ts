import path from "path";

let db: any;

if (process.env.DATABASE_URL) {
  // Production / real Postgres (e.g. Neon serverless). Uses Neon's HTTP driver
  // rather than the WebSocket-pooled one — no extra runtime configuration
  // needed, and this app only ever does simple single-statement queries.
  const { drizzle } = await import("drizzle-orm/neon-http");
  const { neon } = await import("@neondatabase/serverless");
  const schema = await import("../shared/schema.js");
  const sql = neon(process.env.DATABASE_URL);
  db = drizzle(sql, { schema });
  console.log("[db] Using Neon Postgres via DATABASE_URL.");
} else {
  // Local dev: embedded Postgres-compatible database, no external service needed.
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const schema = await import("../shared/schema.js");
  // Resolved from the working directory (not __dirname) so the store lives at
  // the project root whether running from source (tsx) or from dist/ (build) —
  // otherwise a build would nest it inside dist/ and wipe it on every rebuild.
  // PGLITE_DATA_DIR=memory:// gives tests a throwaway in-memory database.
  const dataDir = process.env.PGLITE_DATA_DIR || path.resolve(process.cwd(), ".pgdata");
  const client = new PGlite(dataDir);
  db = drizzle(client, { schema });
  if (!process.env.PGLITE_DATA_DIR) {
    console.log("[db] Using local embedded PGlite database (.pgdata). Set DATABASE_URL to use Neon/Postgres.");
  }
}

export { db };
