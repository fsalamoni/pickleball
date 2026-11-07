/**
 * A ÁREA que uma câmera vigia — a quadra inteira ou só uma parte dela.
 *
 * Com várias câmeras, cada uma pode cuidar de um pedaço: a lateral da rede só
 * das cozinhas, a do fundo só do fundo daquele lado. Quem filma escolhe a
 * área e marca os quatro cantos DELA (o retângulo pintado mais próximo), e a
 * câmera só marca lances que caem nela. Fora da área ela fica calada — quem
 * cuida dali é outra câmera.
 *
 * Toda área vai de lateral a lateral; muda só o trecho do comprimento
 * (`y0`–`y1`, nas coordenadas de `court.js`). Uma borda que é linha de FUNDO
 * fica aberta para fora: a bola longa cai além dela e é dessa área.
 *
 * O `id` é contrato (fica na calibração guardada no aparelho): nunca renomeie.
 */

import { tk } from '@/core/i18n';
import { COURT, COURT_POINTS } from './court.js';

const { WIDTH: W, LENGTH: L, NET_Y: N, KITCHEN: K } = COURT;

/** Quanto além da borda (que não é fundo) um quique ainda é desta área, em metros. */
export const ZONE_EDGE_M = 0.3;

const zone = (id, label, y0, y1, points, check) => Object.freeze({ id, label, y0, y1, points: Object.freeze(points), check });

/**
 * `points`: os quatro cantos tocados, na ordem do desenho (`null` = os da
 * posição, como sempre foi). `check`: o 5º ponto da conferência (`null` = o
 * da posição).
 */
export const CAMERA_ZONES = Object.freeze([
  zone('full', tk('Quadra inteira'), 0, L, null, null),
  zone('half_a', tk('Lado A inteiro'), 0, N, ['A1', 'A2', 'N2', 'N1'], 'KTA'),
  zone('half_b', tk('Lado B inteiro'), N, L, ['N1', 'N2', 'B2', 'B1'], 'KTB'),
  zone('back_a', tk('Fundo do lado A'), 0, N - K, ['A1', 'A2', 'KA2', 'KA1'], 'TA'),
  zone('back_b', tk('Fundo do lado B'), N + K, L, ['B1', 'B2', 'KB2', 'KB1'], 'TB'),
  zone('kitchens', tk('As duas cozinhas'), N - K, N + K, ['KA1', 'KA2', 'KB2', 'KB1'], 'KTA'),
  zone('kitchen_a', tk('Cozinha do lado A'), N - K, N, ['KA1', 'KA2', 'N2', 'N1'], 'KTA'),
  zone('kitchen_b', tk('Cozinha do lado B'), N, N + K, ['N1', 'N2', 'KB2', 'KB1'], 'KTB'),
]);

export const DEFAULT_ZONE = 'full';

/** A área pelo id (desconhecida ou ausente ⇒ a quadra inteira). */
export function zoneById(id) {
  return CAMERA_ZONES.find((z) => z.id === id) || CAMERA_ZONES[0];
}

/** Os pontos de conferência que não são cantos de área. */
export const CHECK_POINTS = Object.freeze({
  KTA: Object.freeze({ x: W / 2, y: N - K }),
  KTB: Object.freeze({ x: W / 2, y: N + K }),
  TA: Object.freeze({ x: W / 2, y: 0 }),
  TB: Object.freeze({ x: W / 2, y: L }),
});

/** Os quatro cantos que se tocam nesta área, ou `null` para usar os da posição. */
export function zoneCalibrationPoints(zoneId) {
  const z = zoneById(zoneId);
  return z.points ? z.points.map((id) => ({ id, ...COURT_POINTS[id] })) : null;
}

/** O 5º ponto da área, ou `null` para usar o da posição. */
export function zoneCheckPoint(zoneId) {
  const z = zoneById(zoneId);
  return z.check ? { id: z.check, ...CHECK_POINTS[z.check] } : null;
}

/** A área cobre a cozinha deste lado inteira? */
const coversKitchen = (z, side) => (side === 'A' ? z.y0 <= N - K && z.y1 >= N : z.y0 <= N && z.y1 >= N + K);
/** A área chega à linha de fundo deste lado? */
const coversBaseline = (z, side) => (side === 'A' ? z.y0 === 0 : z.y1 === L);

/** O ponto do chão (metros) cai nesta área? Borda de fundo aberta, as outras com folga. */
export function pointInZone(p, zoneId) {
  const z = zoneById(zoneId);
  const lo = z.y0 === 0 ? -Infinity : z.y0 - ZONE_EDGE_M;
  const hi = z.y1 === L ? Infinity : z.y1 + ZONE_EDGE_M;
  return p.y >= lo && p.y <= hi;
}

/**
 * Este lance é desta câmera? O quique, pelo ponto onde caiu; o pé na
 * cozinha, se a área cobre a cozinha daquele lado; o pé de quem saca, se a
 * área chega à linha de fundo dele. Sem ponto conhecido, fica (melhor
 * perguntar do que calar um lance).
 */
export function eventInZone(event, zoneId) {
  const z = zoneById(zoneId);
  if (z.id === 'full') return true;
  const p = event?.point;
  if (!p || !Number.isFinite(p.y)) return true;
  if (event.type === 'volley') return coversKitchen(z, p.y < N ? 'A' : 'B');
  if (event.type === 'serve_foot') return coversBaseline(z, p.y < N ? 'A' : 'B');
  return pointInZone(p, z.id);
}
