// Date photos in object storage (Cloudflare R2, S3-compatible). Each photo
// used to be stored as a base64 string in the planned_dates row, so every
// list of dates or memories pulled every photo along and the database grew
// with each upload. With R2 configured the row holds only the public URL;
// without it (local dev, or R2 not set up yet) the base64 fallback still
// works, so nothing breaks either way. Old base64 rows keep working too —
// the client renders a data: URL and an https: URL the same way.
//
// Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
// R2_PUBLIC_URL (the bucket's public base URL, e.g. https://pub-xxx.r2.dev
// or a custom domain, no trailing slash).

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { nanoid } from "nanoid";

let client: S3Client | undefined;

function config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_URL) return null;
  return { accountId: R2_ACCOUNT_ID, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, bucket: R2_BUCKET, publicUrl: R2_PUBLIC_URL.replace(/\/$/, "") };
}

export function isPhotoStorageConfigured(): boolean {
  return config() !== null;
}

function getClient(cfg: NonNullable<ReturnType<typeof config>>): S3Client {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
  return client;
}

const DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/s;

// Stores a data: URL photo and returns its public URL. Returns the data URL
// itself when storage isn't configured, so callers can save whichever they
// get. Throws on an upload failure (the caller reports it to the user).
export async function storePhoto(dataUrl: string, plannedDateId: number): Promise<string> {
  const cfg = config();
  if (!cfg) return dataUrl;
  const m = DATA_URL.exec(dataUrl);
  if (!m) throw new Error("Neveljavna slika");
  const [, contentType, base64] = m;
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const key = `dates/${plannedDateId}/${nanoid(12)}.${ext}`;
  await getClient(cfg).send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: Buffer.from(base64, "base64"),
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return `${cfg.publicUrl}/${key}`;
}

// Best-effort removal of a stored photo (replaced, removed, or its date
// deleted). Base64 photos and anything not ours are ignored.
export async function deleteStoredPhoto(photo: string | null | undefined): Promise<void> {
  const cfg = config();
  if (!cfg || !photo || !photo.startsWith(`${cfg.publicUrl}/`)) return;
  const key = photo.slice(cfg.publicUrl.length + 1);
  try {
    await getClient(cfg).send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
  } catch (err) {
    console.warn("[photos] failed to delete", key, err instanceof Error ? err.message : err);
  }
}
