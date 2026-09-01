import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { initSentry, Sentry } from "./sentry.js";
import { runMigrations } from "./migrate.js";
import { runSeed } from "./seed.js";
import { registerRoutes } from "./routes.js";
import {
  getUserByConnectCode,
  getAdminStats,
  resetPinByEmail,
  getUserByEmail,
  deleteUserAccount,
  getAllFeedbackWithUsers,
  getAllUsers,
  getPlannedDatesDebug,
} from "./storage.js";
import { notifyAllWithNotifications } from "./push.js";
import { sendWelcomeEmail } from "./email.js";
import { startScheduler } from "./scheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  initSentry();
  await runMigrations();
  await runSeed();

  const app = express();
  // Render sits in front of the app as a single reverse-proxy hop — without
  // this, req.ip resolves to Render's internal edge IP for every request,
  // which would make the login rate limiter treat all users as one caller.
  app.set("trust proxy", 1);
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

  app.post("/api/admin/broadcast", async (req, res) => {
    const secret = process.env.ADMIN_SECRET;
    const { key, title, body } = req.body || {};
    if (!secret || key !== secret) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (typeof body !== "string" || !body.trim()) {
      res.status(400).json({ error: "Manjka besedilo obvestila" });
      return;
    }
    const result = await notifyAllWithNotifications({
      title: typeof title === "string" && title.trim() ? title.trim() : "Together",
      body: body.trim(),
      tag: "admin-broadcast",
    });
    res.json({ ok: true, recipients: result.recipients });
  });

  app.post("/api/admin/send-welcome-emails", async (req, res) => {
    const secret = process.env.ADMIN_SECRET;
    const { key } = req.body || {};
    if (!secret || key !== secret) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const allUsers = await getAllUsers();
    // Each send is already localized to that user's own language and
    // fire-and-forget internally (sendWelcomeEmail never throws), so a
    // simple Promise.all is safe — one bad address can't take down the rest.
    await Promise.all(allUsers.map((u) => sendWelcomeEmail(u.email, u.name, u.language)));
    res.json({ ok: true, recipients: allUsers.length });
  });

  app.post("/api/admin/delete-user", async (req, res) => {
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
    const user = await getUserByEmail(email.trim().toLowerCase());
    if (!user) {
      res.status(404).json({ error: "Računa s tem e-poštnim naslovom ne najdemo" });
      return;
    }
    await deleteUserAccount(user);
    res.json({ ok: true, name: user.name, email: user.email });
  });

  // Read-only diagnostic used to investigate "my date photos disappeared"
  // reports — returns whether each planned date has a photo, not the photo
  // data itself. Temporary tool, safe to leave in place.
  app.get("/api/admin/planned-dates-debug", async (req, res) => {
    const secret = process.env.ADMIN_SECRET;
    if (!secret || req.query.key !== secret) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: "Manjka e-poštni naslov" });
      return;
    }
    const user = await getUserByEmail(email);
    if (!user) {
      res.status(404).json({ error: "Računa s tem e-poštnim naslovom ne najdemo" });
      return;
    }
    const rows = await getPlannedDatesDebug(user);
    res.json({ ok: true, name: user.name, email: user.email, count: rows.length, rows });
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
          `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.connected ? "✅" : "—"}</td><td>${new Date(u.createdAt).toLocaleDateString("sl-SI")}</td><td><button class="del-btn" data-email="${esc(u.email)}" data-name="${esc(u.name)}">Izbriši</button></td></tr>`
      )
      .join("");

    const FEEDBACK_LABELS: Record<string, string> = {
      praise: "💛 Pohvala",
      suggestion: "💡 Predlog",
      problem: "⚠️ Težava",
      other: "💬 Drugo",
    };
    const allFeedback = await getAllFeedbackWithUsers();
    const feedbackRows = allFeedback
      .map(
        (f: { category: string; userName: string | null; userEmail: string | null; text: string; createdAt: Date }) =>
          `<tr><td>${FEEDBACK_LABELS[f.category] || esc(f.category)}</td><td>${esc(f.userName || "?")}<br><span style="color:#7a6f68;font-size:0.8rem">${esc(f.userEmail || "")}</span></td><td>${esc(f.text)}</td><td>${new Date(f.createdAt).toLocaleDateString("sl-SI")}</td></tr>`
      )
      .join("");

    const milestoneBreakdown = Object.entries(stats.milestonesByType)
      .sort(([a], [b]) => Number(a.replace("streak_", "")) - Number(b.replace("streak_", "")))
      .map(([type, n]) => `${type.replace("streak_", "")}d: ${n}`)
      .join(" · ");
    const CLICK_SOURCE_LABELS: Record<string, string> = { date_idea: "ideja", milestone: "mejnik" };
    const clicksBreakdown = Object.entries(stats.tempticoClicksBySource)
      .map(([source, n]) => `${CLICK_SOURCE_LABELS[source] || source}: ${n}`)
      .join(" · ");

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
  .del-btn { padding: 0.3rem 0.7rem; border: none; border-radius: 6px; background: #c0392b; color: white; font-weight: 700; cursor: pointer; font-size: 0.8rem; }
  .del-btn:disabled { opacity: 0.6; cursor: default; }
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
    <div class="card"><div class="value">${stats.usersWithPushSub}</div><div class="label">Naprave z obvestili</div></div>
    <div class="card"><div class="value">${stats.pwaInstalledCount}/${stats.totalUsers}</div><div class="label">Namestili na telefon</div></div>
    <div class="card"><div class="value" style="font-size:1.15rem">${Object.entries(stats.languageCounts).map(([l, n]) => `${l.toUpperCase()}: ${n}`).join(" · ") || "–"}</div><div class="label">Po jeziku</div></div>
  </div>
  <div class="cards">
    <div class="card">
      <div class="value" style="font-size:1rem">0: ${stats.streakDistribution.zero} · 1-6: ${stats.streakDistribution.d1to6} · 7-29: ${stats.streakDistribution.d7to29} · 30-59: ${stats.streakDistribution.d30to59} · 60-99: ${stats.streakDistribution.d60to99} · 100+: ${stats.streakDistribution.d100plus}</div>
      <div class="label">Porazdelitev nizov (dni)</div>
    </div>
    <div class="card">
      <div class="value">${stats.milestonesTotal}</div>
      <div class="label">Doseženih mejnikov${milestoneBreakdown ? ` <span style="font-weight:400">(${milestoneBreakdown})</span>` : ""}</div>
    </div>
    <div class="card">
      <div class="value">${stats.tempticoClicksTotal}</div>
      <div class="label">Kliki na Temptico ponudbo${clicksBreakdown ? ` <span style="font-weight:400">(${clicksBreakdown})</span>` : ""}</div>
    </div>
  </div>
  <div class="tool">
    <h2>Ponastavi PIN</h2>
    <form id="reset-form">
      <input type="email" id="reset-email" placeholder="uporabnik@posta.si" required />
      <button type="submit">Ponastavi</button>
    </form>
    <p id="reset-result"></p>
  </div>
  <div class="tool">
    <h2>Pošlji obvestilo vsem</h2>
    <form id="broadcast-form" style="flex-direction: column; align-items: stretch;">
      <input type="text" id="broadcast-title" placeholder="Naslov (privzeto: Together)" style="margin-bottom: 0.5rem;" />
      <textarea id="broadcast-body" placeholder="Besedilo obvestila..." required rows="3" style="padding: 0.5rem 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 0.9rem; font-family: inherit; margin-bottom: 0.5rem; resize: vertical;"></textarea>
      <button type="submit">Pošlji vsem (${stats.notificationsOptedIn})</button>
    </form>
    <p id="broadcast-result"></p>
  </div>
  <div class="tool">
    <h2>Pošlji welcome email vsem</h2>
    <p style="margin:0 0 0.75rem;font-size:0.85rem;color:#7a6f68;">Vsak uporabnik ga dobi v svojem jeziku (SL/EN/HR). Uporabno za obstoječe račune, ki so se registrirali pred to funkcijo.</p>
    <button id="send-welcome-emails" type="button">Pošlji vsem (${stats.totalUsers})</button>
    <p id="welcome-email-result"></p>
  </div>
  <h2 style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
    Vsi računi
    <button id="export-csv" style="padding: 0.4rem 0.9rem; border: none; border-radius: 8px; background: #2a2320; color: white; font-weight: 700; cursor: pointer; font-size: 0.85rem;">⬇ Izvozi CSV</button>
  </h2>
  <table>
    <thead><tr><th>Ime</th><th>E-pošta</th><th>Povezan/a</th><th>Registriran/a</th><th>Dejanja</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <h2 style="margin-top: 2rem;">Povratne informacije (${allFeedback.length})</h2>
  <table>
    <thead><tr><th>Kategorija</th><th>Od</th><th>Besedilo</th><th>Datum</th></tr></thead>
    <tbody>${feedbackRows || `<tr><td colspan="4" style="color:#7a6f68">Še ni povratnih informacij.</td></tr>`}</tbody>
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
    document.getElementById('broadcast-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('broadcast-title').value;
      const body = document.getElementById('broadcast-body').value;
      if (!confirm('Poslati obvestilo vsem uporabnikom z omogočenimi obvestili?\\n\\n"' + (title || 'Together') + '"\\n' + body)) return;
      const btn = e.target.querySelector('button');
      const result = document.getElementById('broadcast-result');
      btn.disabled = true;
      result.textContent = '';
      result.className = '';
      try {
        const res = await fetch('/api/admin/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: ${JSON.stringify(key)}, title, body }),
        });
        const data = await res.json();
        if (res.ok) {
          result.textContent = 'Poslano ' + data.recipients + ' uporabnikom.';
          result.className = 'ok';
          e.target.reset();
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
    document.getElementById('send-welcome-emails').addEventListener('click', async (e) => {
      if (!confirm('Poslati welcome email VSEM ${stats.totalUsers} registriranim uporabnikom, vsakemu v njegovem jeziku? Tega ni mogoče preklicati.')) return;
      const btn = e.target;
      const result = document.getElementById('welcome-email-result');
      btn.disabled = true;
      result.textContent = '';
      result.className = '';
      try {
        const res = await fetch('/api/admin/send-welcome-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: ${JSON.stringify(key)} }),
        });
        const data = await res.json();
        if (res.ok) {
          result.textContent = 'Poslano ' + data.recipients + ' uporabnikom.';
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
    document.querySelector('table tbody').addEventListener('click', async (e) => {
      const btn = e.target.closest('.del-btn');
      if (!btn) return;
      const email = btn.dataset.email;
      const name = btn.dataset.name;
      if (!confirm('Trajno izbrišem račun "' + name + '" (' + email + ')?\\n\\nTega dejanja ni mogoče razveljaviti.')) return;
      btn.disabled = true;
      btn.textContent = '...';
      try {
        const res = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: ${JSON.stringify(key)}, email }),
        });
        const data = await res.json();
        if (res.ok) {
          btn.closest('tr').remove();
        } else {
          alert(data.error || 'Napaka');
          btn.disabled = false;
          btn.textContent = 'Izbriši';
        }
      } catch {
        alert('Napaka pri povezavi');
        btn.disabled = false;
        btn.textContent = 'Izbriši';
      }
    });
    document.getElementById('export-csv').addEventListener('click', () => {
      const csvEscape = (s) => '"' + String(s).replace(/"/g, '""') + '"';
      const lines = ['Ime,E-pošta'];
      document.querySelectorAll('table tbody tr').forEach((tr) => {
        const cells = tr.querySelectorAll('td');
        const name = cells[0] ? cells[0].textContent.trim() : '';
        const email = cells[1] ? cells[1].textContent.trim() : '';
        lines.push(csvEscape(name) + ',' + csvEscape(email));
      });
      // Leading BOM so Excel opens the UTF-8 file with šumniki intact instead of mangling them.
      const blob = new Blob(['\\uFEFF' + lines.join('\\r\\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'together-racuni-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  </script>
</body></html>`);
  });

  // Reports anything that reaches Express's error pipeline to Sentry (a
  // no-op chain when SENTRY_DSN isn't set), then falls through to our own
  // handler below so the client still gets the same JSON error response.
  Sentry.setupExpressErrorHandler(app);

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

main().catch(async (err) => {
  console.error("Fatal startup error:", err);
  Sentry.captureException(err);
  await Sentry.flush(2000).catch(() => {}); // give the event a moment to actually send before the process dies
  process.exit(1);
});
