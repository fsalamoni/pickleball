/**
 * Texturas do avatar 3D, pintadas em canvas (nenhuma imagem de fora: o
 * resultado continua exportável e o pacote não carrega arquivo de arte).
 */
import * as THREE from 'three';
import { mix, readableOn, shade } from '../domain/color.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function texture(c, { srgb = true, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** O olho (equirretangular; a íris fica no centro, virada para a frente). */
export function eyeTexture(irisHex) {
  const [c, g] = canvas(512, 256);
  const sclera = g.createRadialGradient(256, 128, 40, 256, 128, 200);
  sclera.addColorStop(0, '#ffffff');
  sclera.addColorStop(0.6, '#f4f2ee');
  sclera.addColorStop(1, '#d9cfc8');
  g.fillStyle = sclera;
  g.fillRect(0, 0, 512, 256);
  const R = 62;
  const iris = g.createRadialGradient(256, 136, 6, 256, 128, R);
  iris.addColorStop(0, shade(irisHex, 0.28));
  iris.addColorStop(0.55, irisHex);
  iris.addColorStop(0.9, shade(irisHex, -0.45));
  iris.addColorStop(1, shade(irisHex, -0.7));
  g.fillStyle = iris;
  g.beginPath();
  g.arc(256, 128, R, 0, Math.PI * 2);
  g.fill();
  // Raios da íris (dão vida de perto).
  g.strokeStyle = shade(irisHex, 0.35);
  g.globalAlpha = 0.28;
  g.lineWidth = 1.5;
  for (let i = 0; i < 36; i += 1) {
    const a = (i / 36) * Math.PI * 2;
    g.beginPath();
    g.moveTo(256 + Math.cos(a) * 26, 128 + Math.sin(a) * 26);
    g.lineTo(256 + Math.cos(a) * (R - 8), 128 + Math.sin(a) * (R - 8));
    g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = '#0d0a0c';
  g.beginPath();
  g.arc(256, 128, 27, 0, Math.PI * 2);
  g.fill();
  // Brilhos pintados: o olho fica vivo em qualquer luz.
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(236, 106, 13, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 0.75;
  g.beginPath();
  g.arc(278, 150, 6, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  return texture(c);
}

/** Relevo de fios: riscos ao longo de `v` (do topo da cabeça para a ponta). */
export function hairBumpTexture() {
  const [c, g] = canvas(512, 64);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 512, 64);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 260; i += 1) {
    const x = rnd() * 512;
    const w = 1 + rnd() * 3;
    const v = Math.round(90 + rnd() * 120);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(x, 0, w, 64);
  }
  const t = texture(c, { srgb: false, repeat: true });
  return t;
}

/** Tecido: trama bem fina (relevo), para a roupa não parecer plástico. */
export function fabricBumpTexture() {
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 2) {
    for (let x = 0; x < 64; x += 2) {
      const v = (x + y) % 4 === 0 ? 150 : 110;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  const t = texture(c, { srgb: false, repeat: true });
  t.repeat.set(18, 18);
  return t;
}

function ballIcon(g, x, y, r, color) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = shade(color, -0.45);
  [[0, 0], [-0.45, -0.3], [0.45, -0.3], [-0.45, 0.35], [0.45, 0.35], [0, -0.62], [0, 0.66]].forEach(([dx, dy]) => {
    g.beginPath();
    g.arc(x + dx * r, y + dy * r, r * 0.12, 0, Math.PI * 2);
    g.fill();
  });
}

function bolt(g, x, y, s, color) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x + 0.15 * s, y - 0.5 * s);
  g.lineTo(x - 0.3 * s, y + 0.08 * s);
  g.lineTo(x - 0.02 * s, y + 0.08 * s);
  g.lineTo(x - 0.15 * s, y + 0.5 * s);
  g.lineTo(x + 0.3 * s, y - 0.08 * s);
  g.lineTo(x + 0.02 * s, y - 0.08 * s);
  g.closePath();
  g.fill();
}

/**
 * A camisa (mapa em volta do tronco: o centro do canvas é o peito).
 * `v` cresce para CIMA no tronco, então o canvas é pintado com o topo = gola.
 */
export function topTexture({ color, color2, pattern, mark, number, ballColor, polo }) {
  const W = 1024;
  const H = 512;
  const [c, g] = canvas(W, H);
  g.fillStyle = color;
  g.fillRect(0, 0, W, H);
  g.fillStyle = color2;
  if (pattern === 'side') {
    // Faixas nas laterais (u = 0,25 e 0,75).
    g.fillRect(W * 0.25 - 26, 0, 52, H);
    g.fillRect(W * 0.75 - 26, 0, 52, H);
  } else if (pattern === 'band') {
    g.fillRect(0, H * 0.4, W, H * 0.13);
  } else if (pattern === 'chevron') {
    for (let k = 0; k < 2; k += 1) {
      const cx = W * (0.5 + k * 0.5);
      g.beginPath();
      g.moveTo(cx - W * 0.25, H * 0.3);
      g.lineTo(cx, H * 0.56);
      g.lineTo(cx + W * 0.25, H * 0.3);
      g.lineTo(cx + W * 0.25, H * 0.44);
      g.lineTo(cx, H * 0.7);
      g.lineTo(cx - W * 0.25, H * 0.44);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(cx - W * 0.75, H * 0.3);
      g.lineTo(cx - W * 0.5, H * 0.56);
      g.lineTo(cx - W * 0.25, H * 0.3);
      g.lineTo(cx - W * 0.25, H * 0.44);
      g.lineTo(cx - W * 0.5, H * 0.7);
      g.lineTo(cx - W * 0.75, H * 0.44);
      g.closePath();
      g.fill();
    }
  } else if (pattern === 'split') {
    g.fillRect(W * 0.5, 0, W * 0.5, H);
  }
  // Gola (o topo do canvas é o pescoço).
  g.fillStyle = pattern === 'solid' ? shade(color, -0.18) : color2;
  g.fillRect(0, 0, W, 16);
  if (polo) {
    g.fillStyle = shade(color, -0.22);
    g.fillRect(W * 0.5 - 5, 16, 10, H * 0.26);
    g.fillStyle = '#ffffff';
    [0.1, 0.19].forEach((y) => {
      g.beginPath();
      g.arc(W * 0.5, 16 + H * y, 5, 0, Math.PI * 2);
      g.fill();
    });
  }
  const ink = pattern === 'solid' || color2 === color ? readableOn(color) : color2;
  const mx = W * 0.5 + (mark === 'number' ? 0 : 74);
  const my = H * 0.3;
  if (mark === 'ball') ballIcon(g, mx, my, 22, ballColor);
  if (mark === 'rush') {
    g.fillStyle = '#0b0f19';
    g.beginPath();
    g.roundRect(mx - 26, my - 20, 52, 40, 9);
    g.fill();
    bolt(g, mx, my, 30, '#d4f82e');
  }
  if (mark === 'number' && number) {
    g.fillStyle = pattern === 'band' || pattern === 'chevron' ? readableOn(color2) : ink;
    g.font = '900 150px "Arial Black", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(number), W * 0.5, H * 0.47);
    // Número nas costas também.
    g.fillText(String(number), W * 0.02, H * 0.47);
    g.fillText(String(number), W * 1.02, H * 0.47);
  }
  return texture(c);
}

/** A face da raquete (o canvas cobre a caixa da face). */
export function paddleTexture({ art, color, color2, wordmark, ink }) {
  const W = 512;
  const H = 640;
  const [c, g] = canvas(W, H);
  g.fillStyle = color;
  g.fillRect(0, 0, W, H);
  if (art === 'fade') {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, color);
    gr.addColorStop(1, color2);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  } else if (art === 'stripes') {
    g.fillStyle = color2;
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(-0.5);
    [-150, -40, 70].forEach((y, i) => g.fillRect(-W, y, W * 2, [54, 30, 14][i]));
    g.restore();
  } else if (art === 'flame') {
    g.fillStyle = color2;
    g.beginPath();
    g.moveTo(0, H);
    g.lineTo(0, H * 0.62);
    g.bezierCurveTo(W * 0.2, H * 0.5, W * 0.1, H * 0.3, W * 0.3, H * 0.4);
    g.bezierCurveTo(W * 0.42, H * 0.46, W * 0.4, H * 0.2, W * 0.55, H * 0.3);
    g.bezierCurveTo(W * 0.68, H * 0.4, W * 0.7, H * 0.25, W * 0.8, H * 0.45);
    g.bezierCurveTo(W * 0.9, H * 0.6, W, H * 0.5, W, H * 0.7);
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  } else if (art === 'carbon') {
    g.fillStyle = mix(color, '#000000', 0.25);
    for (let y = 0; y < H; y += 16) {
      for (let x = (y / 16) % 2 ? 8 : 0; x < W; x += 16) g.fillRect(x, y, 8, 8);
    }
    g.fillStyle = color2;
    g.fillRect(0, H * 0.82, W, 14);
  } else if (art === 'rush') {
    bolt(g, W / 2, H * 0.46, 320, color2);
  } else if (art === 'brand_stripe') {
    g.fillStyle = color2;
    g.fillRect(0, H * 0.64, W, H * 0.16);
  } else if (art === 'brand_split') {
    g.fillStyle = color2;
    g.beginPath();
    g.moveTo(0, H);
    g.lineTo(0, H * 0.6);
    g.lineTo(W, H * 0.34);
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  }
  if (wordmark) {
    g.fillStyle = ink;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 110;
    g.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
    const w = g.measureText(wordmark).width;
    if (w > W * 0.8) size = Math.floor((size * W * 0.8) / w);
    g.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
    g.fillText(wordmark, W / 2, H * 0.4);
  }
  // Textura de areia da face (fosco granulado das raquetes de verdade).
  let seed = 3;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.globalAlpha = 0.05;
  for (let i = 0; i < 2600; i += 1) {
    g.fillStyle = rnd() > 0.5 ? '#ffffff' : '#000000';
    g.fillRect(rnd() * W, rnd() * H, 2, 2);
  }
  g.globalAlpha = 1;
  return texture(c);
}

/** A bola: cor + furos (o mesmo canvas serve de relevo). */
export function ballTexture(color) {
  const [c, g] = canvas(256, 128);
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = shade(color, -0.55);
  for (let row = 0; row < 4; row += 1) {
    const y = 20 + row * 29;
    const n = row === 0 || row === 3 ? 6 : 9;
    for (let i = 0; i < n; i += 1) {
      g.beginPath();
      g.ellipse(((i + (row % 2) * 0.5) / n) * 256, y, row === 0 || row === 3 ? 9 : 6.5, 6.5, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  return texture(c);
}

/** Bochecha rosada: mancha suave com transparência. */
export function blushTexture() {
  const [c, g] = canvas(64, 64);
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,90,110,0.5)');
  gr.addColorStop(0.6, 'rgba(255,90,110,0.18)');
  gr.addColorStop(1, 'rgba(255,90,110,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return texture(c);
}

/** Sardas ou barba por fazer: pontinhos sobre transparente. */
export function specksTexture({ color, count, size, fade }) {
  const [c, g] = canvas(256, 128);
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  g.fillStyle = color;
  for (let i = 0; i < count; i += 1) {
    const x = rnd() * 256;
    const y = rnd() * 128;
    // `fade`: some para as bordas (a mancha não tem contorno).
    const dx = (x - 128) / 128;
    const dy = (y - 64) / 64;
    g.globalAlpha = fade ? Math.max(0, 1 - (dx * dx + dy * dy)) * 0.85 : 0.7;
    g.beginPath();
    g.arc(x, y, size * (0.6 + rnd() * 0.6), 0, Math.PI * 2);
    g.fill();
  }
  return texture(c);
}

/** O fundo da cena: degradê, luzes suaves e, na quadra, as linhas em perspectiva. */
export function backgroundTexture(bg, aspect = 0.654) {
  const H = 768;
  const W = Math.round(H * aspect);
  const [c, g] = canvas(W, H);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, bg.from);
  gr.addColorStop(1, bg.to);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W * 0.5, H * 0.38, 10, W * 0.5, H * 0.38, H * 0.6);
  glow.addColorStop(0, 'rgba(255,255,255,0.45)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  if (bg.court) {
    const y0 = H * 0.62;
    g.fillStyle = 'rgba(11,15,25,0.12)';
    g.fillRect(0, y0, W, H - y0);
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(0, y0);
    g.lineTo(W, y0);
    g.moveTo(-W * 0.3, H * 0.86);
    g.lineTo(W * 1.3, H * 0.86);
    g.moveTo(W * 0.5, H * 0.86);
    g.lineTo(W * 0.5, H);
    g.stroke();
    // Rede ao fundo.
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 2;
    for (let x = 0; x < W; x += 14) {
      g.beginPath();
      g.moveTo(x, y0 - 64);
      g.lineTo(x, y0);
      g.stroke();
    }
    for (let y = y0 - 64; y < y0; y += 12) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fillRect(0, y0 - 70, W, 7);
  }
  return texture(c);
}

/** Sombra de contato no chão (mancha macia). */
export function contactShadowTexture() {
  const [c, g] = canvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(10,12,30,0.5)');
  gr.addColorStop(0.5, 'rgba(10,12,30,0.2)');
  gr.addColorStop(1, 'rgba(10,12,30,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return texture(c);
}
