// One-off: moves date photos stored as base64 in the database to object
// storage (R2), leaving only the public URL in the row. Safe to re-run —
// rows that already hold a URL are skipped; a row is only updated after
// its upload succeeded.
//
//   DATABASE_URL=... R2_...=... npx tsx server/scripts/migratePhotos.ts
//
import "../tz.js";
import { and, eq, isNotNull, like } from "drizzle-orm";
import { db } from "../db.js";
import { plannedDates } from "../../shared/schema.js";
import { isPhotoStorageConfigured, storePhoto } from "../photoStorage.js";

async function main() {
  if (!isPhotoStorageConfigured()) {
    console.error("R2 is not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL).");
    process.exit(1);
  }
  const rows = await db
    .select({ id: plannedDates.id })
    .from(plannedDates)
    .where(and(isNotNull(plannedDates.photo), like(plannedDates.photo, "data:image/%")));
  console.log(`${rows.length} photo(s) to move`);
  let moved = 0;
  for (const { id } of rows) {
    const [row] = await db.select({ photo: plannedDates.photo }).from(plannedDates).where(eq(plannedDates.id, id));
    if (!row?.photo?.startsWith("data:image/")) continue;
    try {
      const url = await storePhoto(row.photo, id);
      await db.update(plannedDates).set({ photo: url }).where(eq(plannedDates.id, id));
      moved++;
      console.log(`#${id} → ${url}`);
    } catch (err) {
      console.error(`#${id} failed:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`done, ${moved}/${rows.length} moved`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
