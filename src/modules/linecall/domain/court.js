/**
 * A quadra de pickleball em metros, no plano do chão (regras USA Pickleball /
 * CBP): 20 × 44 pés, cozinha (zona de não voleio) de 7 pés de cada lado da
 * rede. As medidas são até a BORDA EXTERNA das linhas: a linha faz parte da
 * área que ela delimita — bola na linha de fundo é DENTRO, pé na linha da
 * cozinha é DENTRO da cozinha.
 *
 * Coordenadas: x atravessa a largura (0 = lateral esquerda de quem olha da
 * câmera), y percorre o comprimento (0 = fundo do lado de LÁ, `LENGTH` = fundo
 * do lado da câmera).
 */

export const COURT = Object.freeze({
  WIDTH: 6.096,
  LENGTH: 13.411,
  NET_Y: 13.411 / 2,
  KITCHEN: 2.134,
  LINE: 0.0508,
});

/**
 * Os quatro cantos externos, na ordem em que a pessoa toca na imagem:
 * fundo de lá à esquerda, fundo de lá à direita, fundo de cá à direita,
 * fundo de cá à esquerda.
 */
export const CALIBRATION_CORNERS = Object.freeze([
  { x: 0, y: 0 },
  { x: COURT.WIDTH, y: 0 },
  { x: COURT.WIDTH, y: COURT.LENGTH },
  { x: 0, y: COURT.LENGTH },
]);

/**
 * Distância COM SINAL do ponto até o limite da quadra: positiva dentro
 * (quanto falta para sair), negativa fora (quanto passou).
 */
export function insideMargin({ x, y }) {
  return Math.min(x, COURT.WIDTH - x, y, COURT.LENGTH - y);
}

/**
 * Quanto o ponto está DENTRO da cozinha (positivo) ou fora dela (negativo).
 * A cozinha vai de lateral a lateral: pisar fora da quadra ao lado da
 * cozinha não é falta.
 */
export function kitchenDepth({ x, y }) {
  const along = COURT.KITCHEN - Math.abs(y - COURT.NET_Y);
  const across = Math.min(x, COURT.WIDTH - x);
  return Math.min(along, across);
}

/** As linhas da quadra, como segmentos no chão — para desenhar a conferência. */
export function courtSegments() {
  const { WIDTH: W, LENGTH: L, NET_Y: N, KITCHEN: K } = COURT;
  const h = (y) => [{ x: 0, y }, { x: W, y }];
  return [
    h(0), h(L), [{ x: 0, y: 0 }, { x: 0, y: L }], [{ x: W, y: 0 }, { x: W, y: L }],
    h(N - K), h(N), h(N + K),
    [{ x: W / 2, y: 0 }, { x: W / 2, y: N - K }],
    [{ x: W / 2, y: N + K }, { x: W / 2, y: L }],
  ];
}
