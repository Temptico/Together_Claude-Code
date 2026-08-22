import { deflateSync } from "zlib";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../client/public/icons");
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

// Renders a rounded-square gradient background with a simple heart glyph on top.
function makeIcon(size, { padded = false } = {}) {
  const from = hexToRgb("#ff9a9e");
  const to = hexToRgb("#fecfef");
  const margin = padded ? Math.round(size * 0.15) : 0;
  const radius = Math.round(size * 0.22);

  const inside = (x, y) => {
    // rounded rect test
    const rx = Math.max(margin, Math.min(x, size - 1 - margin));
    const ry = Math.max(margin, Math.min(y, size - 1 - margin));
    const cx = Math.min(Math.max(x, margin + radius), size - margin - radius);
    const cy = Math.min(Math.max(y, margin + radius), size - margin - radius);
    if (x < margin || y < margin || x >= size - margin || y >= size - margin) return false;
    const cornerX = x < margin + radius ? margin + radius : x > size - margin - radius ? size - margin - radius : x;
    const cornerY = y < margin + radius ? margin + radius : y > size - margin - radius ? size - margin - radius : y;
    const dx = x - cornerX;
    const dy = y - cornerY;
    if (Math.abs(dx) <= 0 || Math.abs(dy) <= 0) return true;
    return dx * dx + dy * dy <= radius * radius;
  };

  // simple heart shape via implicit equation, centered
  const heartAt = (x, y) => {
    const nx = ((x - size / 2) / (size * 0.28));
    const ny = ((y - size / 2 + size * 0.06) / (size * 0.28)) * -1;
    const eq = Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * ny * ny * ny;
    return eq <= 0;
  };

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (size * 2);
      let r = lerp(from[0], to[0], t);
      let g = lerp(from[1], to[1], t);
      let b = lerp(from[2], to[2], t);
      let a = 255;
      if (!inside(x, y)) {
        a = 0;
      } else if (heartAt(x, y)) {
        r = 255;
        g = 255;
        b = 255;
      }
      const idx = 1 + x * 4;
      row[idx] = r;
      row[idx + 1] = g;
      row[idx + 2] = b;
      row[idx + 3] = a;
    }
    rows.push(row);
  }

  const raw = Buffer.concat(rows);
  const compressed = deflateSync(raw);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  writeFileSync(path.join(outDir, `icon-${size}.png`), makeIcon(size));
}
writeFileSync(path.join(outDir, "icon-maskable-512.png"), makeIcon(512, { padded: true }));

console.log("Icons generated in", outDir);
