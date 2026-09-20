// Runs `fn` over `items` in fixed-size batches with a pause between
// batches. A plain Promise.all fires every request in the same instant,
// which is fine for our own DB/push calls but blows straight through a
// third-party API's requests-per-second cap (discovered the hard way: a
// full-user Resend broadcast hit "429 rate_limit_exceeded" — Resend allows
// 10 req/s — and a chunk of recipients silently never got the email).
export async function sendInBatches<T>(
  items: T[],
  batchSize: number,
  delayMs: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map((item) => fn(item)));
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
