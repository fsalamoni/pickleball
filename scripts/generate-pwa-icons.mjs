// Gera os ícones PNG do PWA a partir do desenho do favicon (pickleball).
// Sem dependências externas: desenha em um buffer RGBA e codifica PNG via zlib nativo.
// Uso: node scripts/generate-pwa-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../public');

// Paleta (mesma do favicon.svg)
const BG = [6, 95, 70]; // #065f46
const BALL = [245, 158, 11]; // #f59e0b
const HOLE = [6, 95, 70]; // #065f46

// Coordenadas normalizadas (viewBox 64x64 do favicon)
const BALL_C = [0.5, 0.5];
const BALL_R = 18 / 64;
const HOLE_R = 2.5 / 64;
const HOLES = [
  [24, 24], [32, 18], [40, 24],
  [24, 40], [32, 46], [40, 40],
].map(([x, y]) => [x / 64, y / 64]);

// CRC32 (tabela)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10,11,12 = compression, filter, interlace = 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filtro 0 (none)
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Cobertura de um disco no pixel (x,y) com supersampling 4x4 para suavizar bordas
function discCoverage(px, py, cx, cy, r, size) {
  const samples = 4;
  let hits = 0;
  for (let sx = 0; sx < samples; sx++) {
    for (let sy = 0; sy < samples; sy++) {
      const fx = (px + (sx + 0.5) / samples) / size;
      const fy = (py + (sy + 0.5) / samples) / size;
      const dx = fx - cx;
      const dy = fy - cy;
      if (dx * dx + dy * dy <= r * r) hits++;
    }
  }
  return hits / (samples * samples);
}

function blend(dst, i, color, alpha) {
  dst[i] = Math.round(dst[i] * (1 - alpha) + color[0] * alpha);
  dst[i + 1] = Math.round(dst[i + 1] * (1 - alpha) + color[1] * alpha);
  dst[i + 2] = Math.round(dst[i + 2] * (1 - alpha) + color[2] * alpha);
  dst[i + 3] = 255;
}

function drawIcon(size, { contentScale = 1 } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  // Fundo opaco preenchendo todo o quadrado (seguro para maskable e apple-touch)
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = BG[0];
    rgba[i * 4 + 1] = BG[1];
    rgba[i * 4 + 2] = BG[2];
    rgba[i * 4 + 3] = 255;
  }
  const scale = (v) => 0.5 + (v - 0.5) * contentScale;
  const ballC = [scale(BALL_C[0]), scale(BALL_C[1])];
  const ballR = BALL_R * contentScale;
  const holeR = HOLE_R * contentScale;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const ca = discCoverage(x, y, ballC[0], ballC[1], ballR, size);
      if (ca > 0) blend(rgba, i, BALL, ca);
    }
  }
  for (const [hx, hy] of HOLES) {
    const cx = scale(hx);
    const cy = scale(hy);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const ha = discCoverage(x, y, cx, cy, holeR, size);
        if (ha > 0) blend(rgba, i, HOLE, ha);
      }
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
const targets = [
  { file: 'pwa-192.png', size: 192, contentScale: 1 },
  { file: 'pwa-512.png', size: 512, contentScale: 1 },
  // Maskable: conteúdo dentro da safe zone (~80%)
  { file: 'pwa-maskable-512.png', size: 512, contentScale: 0.78 },
  { file: 'apple-touch-icon.png', size: 180, contentScale: 1 },
];
for (const t of targets) {
  const png = drawIcon(t.size, { contentScale: t.contentScale });
  writeFileSync(path.join(OUT_DIR, t.file), png);
  console.log(`gerado public/${t.file} (${t.size}x${t.size}, ${png.length} bytes)`);
}
