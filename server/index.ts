import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { runMigrations } from "./migrate.js";
import { runSeed } from "./seed.js";
import { registerRoutes } from "./routes.js";
import { getUserByConnectCode, getAdminStats, resetPinByEmail } from "./storage.js";
import { startScheduler } from "./scheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  await runMigrations();
  await runSeed();

  const app = express();
  app.use(express.json({ limit: "8mb" })); // accommodates base64-encoded date photos

  registerRoutes(app);

  app.post("/api/admin/reset-pin", async (req, res) => {
    const secret = process.env.ADMIN_SECRET;
    const { key, email } = req.body || {};
    if (!secret || key !== secret) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (typeof email !== "string" || !email) {
      res.status(400).json({ error: "Manjka e-poštni naslov" });
      return;
    }
    const user = await resetPinByEmail(email.trim().toLowerCase());
    if (!user) {
      res.status(404).json({ error: "Računa s tem e-poštnim naslovom ne najdemo" });
      return;
    }
    res.json({ ok: true, name: user.name, email: user.email });
  });

  app.get("/admin", async (req, res) => {
    const secret = process.env.ADMIN_SECRET;
    if (!secret || req.query.key !== secret) {
      res.status(404).send("Not found");
      return;
    }
    const key = String(req.query.key);
    const stats = await getAdminStats();
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
    const rows = stats.recentUsers
      .map(
        (u) =>
          `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.connected ? "✅" : "—"}</td><td>${new Date(u.createdAt).toLocaleDateString("sl-SI")}</td></tr>`
      )
      .join("");
    res.set("Content-Type", "text/html").send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Together — Admin</title>
<style>
  body { font-family: system-ui, sans-serif; background: #f8f5f2; color: #2a2320; padding: 2rem; }
  h1 { margin-bottom: 1.5rem; }
  .cards { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem; }
  .card { background: white; border-radius: 16px; padding: 1.25rem 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); min-width: 140px; }
  .card .value { font-size: 2rem; font-weight: 800; }
  .card .label { font-size: 0.8rem; color: #7a6f68; }
  table { border-collapse: collapse; width: 100%; background: white; border-radius: 12px; overflow: hidden; }
  th, td { text-align: left; padding: 0.6rem 1rem; border-bottom: 1px solid #eee; font-size: 0.9rem; }
  th { background: #efe7e1; }
  .tool { background: white; border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 2rem; max-width: 420px; }
  .tool h2 { margin-top: 0; }
  .tool form { display: flex; gap: 0.5rem; }
  .tool input { flex: 1; padding: 0.5rem 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 0.9rem; }
  .tool button { padding: 0.5rem 1rem; border: none; border-radius: 8px; background: #d9635a; color: white; font-weight: 700; cursor: pointer; }
  .tool button:disabled { opacity: 0.6; cursor: default; }
  .tool p { font-size: 0.85rem; margin: 0.75rem 0 0; }
  .tool p.ok { color: #2a7a4a; }
  .tool p.err { color: #c0392b; }
</style></head>
<body>
  <h1>💗 Together — Admin</h1>
  <div class="cards">
    <div class="card"><div class="value">${stats.totalUsers}</div><div class="label">Uporabnikov</div></div>
    <div class="card"><div class="value">${stats.connectedCouples}</div><div class="label">Povezanih parov</div></div>
    <div class="card"><div class="value">${stats.activeToday}</div><div class="label">Aktivnih danes</div></div>
    <div class="card"><div class="value">${stats.activeThisWeek}</div><div class="label">Aktivnih ta teden</div></div>
    <div class="card"><div class="value">${stats.newThisWeek}</div><div class="label">Novih ta teden</div></div>
  </div>
  <div class="cards">
    <div class="card"><div class="value">${stats.totals.moods}</div><div class="label">Razpoloženj skupaj</div></div>
    <div class="card"><div class="value">${stats.totals.answers}</div><div class="label">Odgovorov skupaj</div></div>
    <div class="card"><div class="value">${stats.totals.completions}</div><div class="label">Izzivov opravljenih</div></div>
    <div class="card"><div class="value">${stats.totals.completedDates}/${stats.totals.plannedDates}</div><div class="label">Zmenkov opravljenih/načrtovanih</div></div>
    <div class="card"><div class="value">${stats.totals.wishlistItems}</div><div class="label">Želja na seznamih</div></div>
  </div>
  <div class="cards">
    <div class="card"><div class="value">${stats.notificationsOptedIn}/${stats.totalUsers}</div><div class="label">Obvestila omogočena</div></div>
    <div class="card"><div class="value">${stats.usersWithPushSub}</div><div class="label">Z aktivno naročnino</div></div>
    <div class="card"><div class="value" style="font-size:1.15rem">${Object.entries(stats.languageCounts).map(([l, n]) => `${l.toUpperCase()}: ${n}`).join(" · ") || "–"}</div><div class="label">Po jeziku</div></div>
  </div>
  <div class="tool">
    <h2>Ponastavi PIN</h2>
    <form id="reset-form">
      <input type="email" id="reset-email" placeholder="uporabnik@posta.si" required />
      <button type="submit">Ponastavi</button>
    </form>
    <p id="reset-result"></p>
  </div>
  <h2>Zadnji registrirani</h2>
  <table>
    <thead><tr><th>Ime</th><th>E-pošta</th><th>Povezan/a</th><th>Registriran/a</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <script>
    document.getElementById('reset-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button');
      const result = document.getElementById('reset-result');
      const email = document.getElementById('reset-email').value;
      btn.disabled = true;
      result.textContent = '';
      result.className = '';
      try {
        const res = await fetch('/api/admin/reset-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: ${JSON.stringify(key)}, email }),
        });
        const data = await res.json();
        if (res.ok) {
          result.textContent = 'PIN ponastavljen za ' + data.name + ' (' + data.email + '). Ob naslednji prijavi lahko izbere novega.';
          result.className = 'ok';
        } else {
          result.textContent = data.error || 'Napaka';
          result.className = 'err';
        }
      } catch {
        result.textContent = 'Napaka pri povezavi';
        result.className = 'err';
      } finally {
        btn.disabled = false;
      }
    });
  </script>
</body></html>`);
  });

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
