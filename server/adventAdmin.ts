import type { Express, Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db.js";
import { users, ADVENT_TYPES } from "../shared/schema.js";
import { addAdventCodes, adventSeason, getAdventDays, getAdventStats, updateAdventDay } from "./advent.js";

type Helpers = {
  ah: (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => void;
  adminAuthorized: (req: Request) => boolean;
  escapeHtml: (s: string) => string;
};

const TYPE_LABELS: Record<string, string> = { task: "Naloga", question: "Vprašanje", temptico: "Temptico dan" };

// /admin/advent — edit the 24 windows (SL/EN/HR text, type, offer links per
// language), upload discount codes, and see participation. Same admin auth
// as /admin (the httpOnly cookie set there).
export function registerAdventAdmin(app: Express, { ah, adminAuthorized, escapeHtml: esc }: Helpers) {
  app.get(
    "/admin/advent",
    ah(async (req, res) => {
      if (!adminAuthorized(req)) {
        res.status(404).send("Not found");
        return;
      }
      const { year } = adventSeason();
      const [days, stats, consent] = await Promise.all([
        getAdventDays(),
        getAdventStats(year),
        db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(users).where(sql`${users.marketingConsent} = true`),
      ]);
      const field = (name: string, label: string, value: string | null, multiline = false) =>
        multiline
          ? `<label>${label}<textarea name="${name}" rows="2">${esc(value || "")}</textarea></label>`
          : `<label>${label}<input name="${name}" value="${esc(value || "")}" /></label>`;
      const dayForms = days
        .map(
          (d: any) => `
      <form class="day" data-day="${d.day}">
        <div class="day-head">
          <strong>${d.day}. december</strong>
          <select name="type">${ADVENT_TYPES.map((t) => `<option value="${t}"${t === d.type ? " selected" : ""}>${TYPE_LABELS[t]}</option>`).join("")}</select>
          <span class="count">${stats.perDay.get(d.day) || 0}× opravljeno</span>
        </div>
        <div class="grid">
          <div><h4>SL</h4>${field("title", "Naslov", d.title)}${field("text", "Besedilo", d.text, true)}${field("offerUrl", "Povezava »Poglej ponudbo«", d.offerUrl)}</div>
          <div><h4>EN</h4>${field("titleEn", "Title", d.titleEn)}${field("textEn", "Text", d.textEn, true)}${field("offerUrlEn", "Offer link", d.offerUrlEn)}</div>
          <div><h4>HR</h4>${field("titleHr", "Naslov", d.titleHr)}${field("textHr", "Tekst", d.textHr, true)}${field("offerUrlHr", "Poveznica", d.offerUrlHr)}</div>
        </div>
        <div class="grid">
          <div>${field("giftCode", "Koda za darilo (neobvezno)", d.giftCode)}${field("giftNote", "Opis darila SL", d.giftNote, true)}</div>
          <div>${field("giftNoteEn", "Gift note EN", d.giftNoteEn, true)}</div>
          <div>${field("giftNoteHr", "Opis dara HR", d.giftNoteHr, true)}</div>
        </div>
        <div class="actions"><button type="submit">Shrani</button><span class="msg"></span></div>
      </form>`
        )
        .join("");

      res.send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Together — Adventni koledar</title>
<style>
  body { font-family: system-ui, sans-serif; background: #f8f5f2; color: #2a2320; padding: 2rem; max-width: 1100px; margin: 0 auto; }
  a { color: #cc3a3a; }
  .cards { display: flex; gap: 1rem; flex-wrap: wrap; margin: 1rem 0 2rem; }
  .card { background: white; border-radius: 16px; padding: 1rem 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); min-width: 140px; }
  .card .value { font-size: 1.6rem; font-weight: 800; }
  .card .label { font-size: 0.8rem; color: #7a6f68; }
  .day, .codes { background: white; border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1rem; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
  .day-head { display: flex; gap: 1rem; align-items: center; margin-bottom: 0.5rem; }
  .count { color: #7a6f68; font-size: 0.85rem; margin-left: auto; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; }
  h4 { margin: 0 0 0.25rem; color: #a1948c; font-size: 0.75rem; }
  label { display: block; font-size: 0.75rem; color: #7a6f68; margin-bottom: 0.4rem; }
  input, textarea, select { width: 100%; box-sizing: border-box; padding: 0.4rem 0.6rem; border: 1px solid #ddd; border-radius: 8px; font: inherit; font-size: 0.9rem; color: #2a2320; }
  select { width: auto; }
  .actions { display: flex; gap: 0.75rem; align-items: center; margin-top: 0.5rem; }
  button { padding: 0.45rem 1rem; border: none; border-radius: 8px; background: #cc3a3a; color: white; font-weight: 700; cursor: pointer; }
  .msg { font-size: 0.85rem; }
  .ok { color: #2a7a4a; } .err { color: #c0392b; }
  p.hint { font-size: 0.85rem; color: #7a6f68; }
</style></head>
<body>
  <p><a href="/admin">← Nazaj na admin</a></p>
  <h1>🎄 Adventni koledar ${year}</h1>
  <div class="cards">
    <div class="card"><div class="value">${stats.participants}</div><div class="label">Prijavljenih (oseb)</div></div>
    <div class="card"><div class="value">${stats.completions}</div><div class="label">Opravljenih okenc</div></div>
    <div class="card"><div class="value">${stats.codesAssigned} / ${stats.codesTotal}</div><div class="label">Podeljenih kod / vseh kod</div></div>
    <div class="card"><div class="value">${consent[0]?.n ?? 0}</div><div class="label">Z marketinško privolitvijo</div></div>
  </div>

  <div class="codes">
    <h3 style="margin-top:0">Kode za popust (20 %)</h3>
    <p class="hint">Kode najprej ustvari v Shopifyju (vsaka za enkratno uporabo), nato jih prilepi sem — ena na vrstico. Podvojene se preskočijo. Ko kod zmanjka, pari, ki dosežejo cilj, dobijo kodo samodejno, ko dodaš nove.</p>
    <form id="codes-form">
      <textarea name="codes" rows="5" placeholder="TOGETHER-ADV-ABC123&#10;TOGETHER-ADV-DEF456"></textarea>
      <div class="actions"><button type="submit">Dodaj kode</button><span class="msg"></span></div>
    </form>
  </div>

  <h2>Okenca</h2>
  <p class="hint">Spremembe veljajo takoj. Povezava »Poglej ponudbo« se prikaže samo pri Temptico dnevih; UTM parametri se dodajo samodejno.</p>
  ${dayForms}

<script>
  document.querySelectorAll('form.day').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = form.querySelector('.msg');
      const body = Object.fromEntries(new FormData(form).entries());
      body.day = Number(form.dataset.day);
      msg.textContent = 'Shranjujem…'; msg.className = 'msg';
      try {
        const res = await fetch('/api/admin/advent/day', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || res.status);
        msg.textContent = 'Shranjeno ✓'; msg.className = 'msg ok';
      } catch (err) { msg.textContent = 'Napaka: ' + err.message; msg.className = 'msg err'; }
    });
  });
  document.getElementById('codes-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target; const msg = form.querySelector('.msg');
    const codes = form.codes.value.split(/\\s+/).filter(Boolean);
    msg.textContent = 'Dodajam…'; msg.className = 'msg';
    try {
      const res = await fetch('/api/admin/advent/codes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codes }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.status);
      msg.textContent = 'Dodanih ' + data.added + ' kod ✓ (osveži stran za števce)'; msg.className = 'msg ok';
      form.codes.value = '';
    } catch (err) { msg.textContent = 'Napaka: ' + err.message; msg.className = 'msg err'; }
  });
</script>
</body></html>`);
    })
  );

  app.post(
    "/api/admin/advent/day",
    ah(async (req, res) => {
      if (!adminAuthorized(req)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const b = req.body || {};
      const day = Number(b.day);
      if (!Number.isInteger(day) || day < 1 || day > 24) {
        res.status(400).json({ error: "Neveljaven dan" });
        return;
      }
      if (!(ADVENT_TYPES as readonly string[]).includes(b.type)) {
        res.status(400).json({ error: "Neveljaven tip" });
        return;
      }
      const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
      const opt = (v: unknown, max: number) => str(v, max) || null;
      const url = (v: unknown) => {
        const s = str(v, 500);
        return /^https:\/\//.test(s) ? s : null;
      };
      if (!str(b.title, 120) || !str(b.text, 400)) {
        res.status(400).json({ error: "Naslov in besedilo (SL) sta obvezna" });
        return;
      }
      const row = await updateAdventDay(day, {
        type: b.type,
        title: str(b.title, 120),
        titleEn: opt(b.titleEn, 120),
        titleHr: opt(b.titleHr, 120),
        text: str(b.text, 400),
        textEn: opt(b.textEn, 400),
        textHr: opt(b.textHr, 400),
        offerUrl: url(b.offerUrl),
        offerUrlEn: url(b.offerUrlEn),
        offerUrlHr: url(b.offerUrlHr),
        giftCode: opt(b.giftCode, 60),
        giftNote: opt(b.giftNote, 300),
        giftNoteEn: opt(b.giftNoteEn, 300),
        giftNoteHr: opt(b.giftNoteHr, 300),
      });
      res.json({ ok: true, day: row?.day });
    })
  );

  app.post(
    "/api/admin/advent/codes",
    ah(async (req, res) => {
      if (!adminAuthorized(req)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const codes = Array.isArray(req.body?.codes) ? req.body.codes.filter((c: unknown) => typeof c === "string").slice(0, 5000) : [];
      const added = await addAdventCodes(codes, adventSeason().year);
      res.json({ ok: true, added });
    })
  );
}
