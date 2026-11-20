// Instagram-story-sized (1080×1920) share images, drawn on a canvas in the
// browser: the brand gradient, a white card with the moment (an emoji, a
// title, a few lines, optionally a photo) and the app's address at the
// bottom, so everyone who sees the story knows where it came from.

export type StoryCard = {
  emoji: string;
  kicker: string; // small line above the title ("Our advent 2026")
  title: string;
  subtitle?: string;
  chips?: string[]; // short tags under the subtitle
  big?: string; // a large number/score ("82 %", "17/24")
  photo?: string | null;
  footer: string; // call to action above the address
};

const W = 1080;
const H = 1920;
const ADDRESS = "together.temptico.com";

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, "") + " …";
    return kept;
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Loads a photo for drawing, or gives up (null) if it can't be loaded, so a
// missing photo never breaks the card.
function loadPhoto(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    // Stored photos come through our own server, so they are same-origin.
    img.src = /^https?:/.test(src) ? `/api/photo?src=${encodeURIComponent(src)}` : src;
    setTimeout(() => resolve(null), 8000);
  });
}

async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load('800 96px "Baloo 2"'),
      document.fonts.load('700 44px "Mulish"'),
      document.fonts.load('800 44px "Mulish"'),
    ]);
  } catch {
    /* system fonts are fine too */
  }
}

export async function renderStoryCard(card: StoryCard): Promise<Blob> {
  await fontsReady();
  const photo = card.photo ? await loadPhoto(card.photo) : null;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background: brand gradient with soft light circles and a few hearts.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#d4553f");
  bg.addColorStop(0.5, "#c74034");
  bg.addColorStop(1, "#b8322f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (const [x, y, r] of [[120, 260, 220], [980, 520, 280], [160, 1650, 260], [940, 1800, 200]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 0.25;
  ctx.font = "64px sans-serif";
  for (const [x, y] of [[110, 430], [960, 300], [990, 1480], [90, 1260]]) ctx.fillText("💗", x, y);
  ctx.globalAlpha = 1;

  // Header.
  ctx.fillStyle = "#ffffff";
  ctx.font = '800 92px "Baloo 2", "Mulish", sans-serif';
  ctx.fillText("Together", W / 2, 200);
  ctx.font = '700 34px "Mulish", sans-serif';
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("by Temptico", W / 2, 250);

  // Measure the card's content first so it can sit centred.
  const pad = 80;
  const cardX = 60;
  const cardW = W - 120;
  const inner = cardW - pad * 2;
  ctx.font = '800 104px "Baloo 2", "Mulish", sans-serif';
  const titleLines = wrap(ctx, card.title, inner, 3);
  ctx.font = '600 48px "Mulish", sans-serif';
  const subLines = card.subtitle ? wrap(ctx, card.subtitle, inner, photo ? 3 : 6) : [];
  const photoH = photo ? 520 : 0;
  const parts = [
    photo ? photoH + 50 : 0,
    200, // emoji
    70, // kicker
    titleLines.length * 112 + 10,
    card.big ? 165 : 0,
    subLines.length ? subLines.length * 66 + 20 : 0,
    card.chips?.length ? 120 : 0,
  ];
  const cardH = pad * 2 + parts.reduce((a, b) => a + b, 0);
  const top = 320;
  const bottomSpace = 260;
  const cardY = Math.max(top, top + (H - top - bottomSpace - cardH) / 2);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = "#fffaf6";
  roundRect(ctx, cardX, cardY, cardW, cardH, 64);
  ctx.fill();
  ctx.restore();

  let y = cardY + pad;
  if (photo) {
    ctx.save();
    roundRect(ctx, cardX + pad, y, inner, photoH, 40);
    ctx.clip();
    const scale = Math.max(inner / photo.width, photoH / photo.height);
    const dw = photo.width * scale;
    const dh = photo.height * scale;
    ctx.drawImage(photo, cardX + pad + (inner - dw) / 2, y + (photoH - dh) / 2, dw, dh);
    ctx.restore();
    y += photoH + 50;
  }

  ctx.font = "170px sans-serif";
  ctx.fillText(card.emoji, W / 2, y + 165);
  y += 200;

  ctx.fillStyle = "#c74034";
  ctx.font = '800 40px "Mulish", sans-serif';
  ctx.fillText(card.kicker.toUpperCase(), W / 2, y + 46);
  y += 70;

  ctx.fillStyle = "#2b1d1a";
  ctx.font = '800 104px "Baloo 2", "Mulish", sans-serif';
  for (const line of titleLines) {
    ctx.fillText(line, W / 2, y + 98);
    y += 112;
  }
  y += 10;

  if (card.big) {
    ctx.fillStyle = "#c74034";
    ctx.font = '800 150px "Baloo 2", "Mulish", sans-serif';
    ctx.fillText(card.big, W / 2, y + 140);
    y += 165;
  }

  if (subLines.length) {
    ctx.fillStyle = "#5c4a45";
    ctx.font = '600 48px "Mulish", sans-serif';
    y += 10;
    for (const line of subLines) {
      ctx.fillText(line, W / 2, y + 52);
      y += 66;
    }
    y += 10;
  }

  if (card.chips?.length) {
    ctx.font = '800 40px "Mulish", sans-serif';
    const widths = card.chips.map((c) => ctx.measureText(c).width + 56);
    const gap = 18;
    const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
    let x = W / 2 - Math.min(total, inner) / 2;
    for (let i = 0; i < card.chips.length; i++) {
      ctx.fillStyle = "#fde3dc";
      roundRect(ctx, x, y + 20, widths[i], 80, 40);
      ctx.fill();
      ctx.fillStyle = "#a8352b";
      ctx.fillText(card.chips[i], x + widths[i] / 2, y + 74);
      x += widths[i] + gap;
    }
  }

  // Footer: call to action and the address.
  ctx.fillStyle = "#ffffff";
  ctx.font = '800 50px "Mulish", sans-serif';
  ctx.fillText(card.footer, W / 2, H - 170);
  ctx.font = '800 44px "Mulish", sans-serif';
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(ADDRESS, W / 2, H - 100);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.92)
  );
}

// Opens the phone's share sheet with the image (Instagram → Story), or
// downloads it where sharing files isn't supported (most desktops).
export async function shareStoryImage(blob: Blob, filename = "together-story.jpg"): Promise<"shared" | "saved" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/jpeg" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return "cancelled";
      // Fall through to a download.
    }
  }
  saveStoryImage(blob, filename);
  return "saved";
}

export function saveStoryImage(blob: Blob, filename = "together-story.jpg") {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
