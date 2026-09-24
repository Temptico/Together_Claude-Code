import { runMigrations } from "./migrate.js";
import { runSeed } from "./seed.js";
import * as storage from "./storage.js";
import type { User } from "../shared/schema.js";

let ready: Promise<void> | undefined;

// Migrates and seeds this test file's in-memory database once.
export function setupDatabase(): Promise<void> {
  ready ??= (async () => {
    await runMigrations();
    await runSeed();
  })();
  return ready;
}

let counter = 0;

export async function createTestUser(name = "Test"): Promise<User> {
  counter++;
  return storage.createUser(`${name}${counter}`, `${name.toLowerCase()}${counter}@test.local`, "sl");
}

export async function createTestCouple(): Promise<{ a: User; b: User }> {
  const a = await createTestUser("Ana");
  const b = await createTestUser("Bor");
  const result = await storage.connectPartner(b.id, a.connectCode);
  if (!result.ok) throw new Error(result.error);
  return { a: (await storage.getUserById(a.id))!, b: (await storage.getUserById(b.id))! };
}
