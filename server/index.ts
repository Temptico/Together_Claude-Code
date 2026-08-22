import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { runMigrations } from "./migrate.js";
import { runSeed } from "./seed.js";
import { registerRoutes } from "./routes.js";
import { getUserByConnectCode } from "./storage.js";
import { startScheduler } from "./scheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  await runMigrations();
  await runSeed();

  const app = express();
  app.use(express.json({ limit: "8mb" })); // accommodates base64-encoded date photos

  registerRoutes(app);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Prišlo je do napake na strežniku" });
  });

  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    const publicDir = path.resolve(__dirname, "../public");
    const indexPath = path.join(publicDir, "index.html");
    const { readFile } = await import("fs/promises");
    const indexHtmlTemplate = await readFile(indexPath, "utf-8");

    // Server-render Open Graph tags for invite links so link previews in
    // WhatsApp/Telegram/Facebook show the inviter's name.
    app.get("/invite/:code", async (req, res) => {
      const inviter = await getUserByConnectCode(req.params.code.toUpperCase());
      const title = inviter ? `${inviter.name} te vabi na Together` : "Together — Ostanita povezana";
      const description = inviter
        ? `${inviter.name} te vabi, da se povežeta na Together in ostaneta bližje vsak dan.`
        : "Together je aplikacija za pare, ki jima pomaga ostati povezana vsak dan.";
      const html = indexHtmlTemplate
        .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
        .replace(/(<meta property="og:title" content=").*?(")/, `$1${title}$2`)
        .replace(/(<meta property="og:description" content=").*?(")/, `$1${description}$2`);
      res.set("Content-Type", "text/html").send(html);
    });

    app.use(express.static(publicDir));
    app.get("*", (_req, res) => {
      res.sendFile(indexPath);
    });
  }

  const port = Number(process.env.PORT) || 3210;
  app.listen(port, () => {
    console.log(`[server] Together API running on http://localhost:${port}`);
  });

  startScheduler();
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
