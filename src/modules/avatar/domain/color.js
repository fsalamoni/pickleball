/**
 * Cores do avatar (puro). Cada parte do avatar 3D recebe UMA
 * cor; os tons de apoio (dobra da roupa, sombra do cabelo, contorno) saem daqui, sem
 * ninguém escolher três tons de pele.
 */

const HEX = /^#[0-9a-f]{6}$/i;

/** `#rrggbb` válido (é o único formato gravado na receita). */
export function isHexColor(value) {
  return typeof value === 'string' && HEX.test(value);
}

function toRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mistura `a` com `b` (`t` = 0 → a, 1 → b). */
export function mix(a, b, t) {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

/** Clareia (`amount` > 0, para o branco) ou escurece (< 0, para um tom frio). */
export function shade(hex, amount) {
  if (!isHexColor(hex)) return hex;
  // Escurecer para o preto puro deixa a sombra "suja"; um azul-escuro dá a
  // sombra fria das ilustrações 3D.
  return amount >= 0 ? mix(hex, '#ffffff', amount) : mix(hex, '#1b1530', -amount);
}

/** Luminância relativa (WCAG), 0–1. */
export function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A cor de texto que se lê sobre `bg` (o nome da marca na raquete). */
export function readableOn(bg) {
  if (!isHexColor(bg)) return '#ffffff';
  return luminance(bg) > 0.45 ? '#0b0f19' : '#ffffff';
}
