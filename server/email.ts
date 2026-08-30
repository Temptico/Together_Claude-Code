// Transactional email via Resend's HTTP API — plain fetch, no SDK dependency
// needed for a single call. Entirely opt-in: without RESEND_API_KEY set,
// sendWelcomeEmail silently no-ops (mirrors the VAPID-keys-optional pattern
// in push.ts), so local dev and any deploy that hasn't configured it yet
// behave exactly as before.

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = "Together <info@temptico.com>";
const APP_URL = "https://together.temptico.com";

type Lang = "sl" | "en" | "hr";

function normLang(lang: string): Lang {
  return lang === "en" || lang === "hr" ? lang : "sl";
}

const SUBJECTS: Record<Lang, string> = {
  sl: "Dobrodošli v Together 💞",
  en: "Welcome to Together 💞",
  hr: "Dobrodošli u Together 💞",
};

const COPY: Record<
  Lang,
  { greeting: string; intro: string; bullets: string[]; cta: string; tip: string; signoff: string }
> = {
  sl: {
    greeting: "Pozdravljeni",
    intro: "Veseli nas, da sta se odločila ostati še bolj povezana. Together vama vsak dan prinese:",
    bullets: [
      "🥰 Deljenje razpoloženja s partnerjem",
      "💬 Vprašanje dneva za pogovor",
      "🏆 Majhen skupen izziv",
    ],
    cta: "Odpri Together",
    tip: "Nasvet: za najboljšo izkušnjo (in da obvestila sploh delujejo) si aplikacijo namestita na domači zaslon telefona — ob prvem odprtju vaju bomo vodili skozi to.",
    signoff: "Lep pozdrav,<br>ekipa Temptico",
  },
  en: {
    greeting: "Hi",
    intro: "We're glad you've decided to stay even more connected. Every day, Together brings you:",
    bullets: ["🥰 Sharing your mood with your partner", "💬 A question of the day to talk about", "🏆 A small shared challenge"],
    cta: "Open Together",
    tip: "Tip: for the best experience (and so notifications actually work), install the app to your phone's home screen — we'll walk you through it the first time you open it.",
    signoff: "Best,<br>the Temptico team",
  },
  hr: {
    greeting: "Pozdrav",
    intro: "Drago nam je što ste odlučili ostati još povezaniji. Together vam svaki dan donosi:",
    bullets: ["🥰 Dijeljenje raspoloženja s partnerom", "💬 Pitanje dana za razgovor", "🏆 Mali zajednički izazov"],
    cta: "Otvori Together",
    tip: "Savjet: za najbolje iskustvo (i da obavijesti uopće rade) instalirajte aplikaciju na početni zaslon telefona — provest ćemo vas kroz to kod prvog otvaranja.",
    signoff: "Lijep pozdrav,<br>tim Temptico",
  },
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function welcomeHtml(name: string, lang: Lang): string {
  const c = COPY[lang];
  const safeName = escapeHtml(name);
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8f5f2;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5f2;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:24px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#ff6b6b 0%,#ffa94d 100%);padding:40px 32px;text-align:center;">
          <div style="font-size:40px;line-height:1;">💞</div>
          <div style="color:#ffffff;font-size:22px;font-weight:800;margin-top:8px;">Together</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:18px;font-weight:800;color:#2a2320;">${c.greeting}, ${safeName}! 👋</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a3f3a;">${c.intro}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            ${c.bullets.map((b) => `<tr><td style="padding:4px 0;font-size:14px;color:#4a3f3a;">${b}</td></tr>`).join("")}
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="border-radius:999px;background:#ff6b6b;">
              <a href="${APP_URL}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;">${c.cta}</a>
            </td></tr>
          </table>
          <p style="margin:0;padding:16px;background:#f8f5f2;border-radius:16px;font-size:13px;line-height:1.5;color:#7a6f68;">${c.tip}</p>
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#7a6f68;">${c.signoff}</p>
          <p style="margin:12px 0 0;font-size:11px;color:#b0a59d;">Enigma 101 global j.d.o.o. · info@temptico.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

let warnedMissingKey = false;

export async function sendWelcomeEmail(to: string, name: string, language: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (!warnedMissingKey) {
      console.log("[email] No RESEND_API_KEY set, welcome emails disabled.");
      warnedMissingKey = true;
    }
    return;
  }
  const lang = normLang(language);
  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        subject: SUBJECTS[lang],
        html: welcomeHtml(name, lang),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("[email] Resend API error:", res.status, body);
    }
  } catch (err) {
    console.warn("[email] Failed to send welcome email:", err);
  }
}
