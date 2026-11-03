/**
 * A quadra de pickleball em metros, no plano do chão (regras USA Pickleball /
 * CBP): 20 × 44 pés, cozinha (zona de não voleio) de 7 pés de cada lado da
 * rede. As medidas são até a BORDA EXTERNA das linhas: a linha faz parte da
 * área que ela delimita — bola na linha de fundo é DENTRO, pé na linha da
 * cozinha é DENTRO da cozinha.
 *
 * Coordenadas COMUNS a todas as câmeras (é o que deixa juntar o que cada uma
 * viu): x atravessa a largura (0 = lateral do LADO 1), y percorre o
 * comprimento (0 = fundo do LADO A, `LENGTH` = fundo do LADO B). Quem está no
 * lado A olhando para a rede tem o lado 1 à esquerda. Nos desenhos, o lado A
 * fica embaixo.
 */

export const COURT = Object.freeze({
  WIDTH: 6.096,
  LENGTH: 13.411,
  NET_Y: 13.411 / 2,
  KITCHEN: 2.134,
  LINE: 0.0508,
});

const { WIDTH: W, LENGTH: L, NET_Y: N, KITCHEN: K } = COURT;

/**
 * Os pontos que a pessoa toca na imagem para calibrar. Cada posição de câmera
 * usa quatro deles (ver `cameraLayouts.js`): os cantos da quadra, ou — na
 * câmera baixa da lateral da rede, que não vê bem os fundos — os cantos das
 * duas cozinhas. O `id` é contrato (fica na calibração guardada no aparelho).
 */
export const COURT_POINTS = Object.freeze({
  A1: Object.freeze({ x: 0, y: 0 }),
  A2: Object.freeze({ x: W, y: 0 }),
  B1: Object.freeze({ x: 0, y: L }),
  B2: Object.freeze({ x: W, y: L }),
  KA1: Object.freeze({ x: 0, y: N - K }),
  KA2: Object.freeze({ x: W, y: N - K }),
  KB1: Object.freeze({ x: 0, y: N + K }),
  KB2: Object.freeze({ x: W, y: N + K }),
});

/** Os quatro cantos da quadra e os quatro cantos das cozinhas, na ordem de toque. */
export const CORNER_SET = Object.freeze({
  court: Object.freeze(['A1', 'A2', 'B2', 'B1']),
  kitchens: Object.freeze(['KA1', 'KA2', 'KB2', 'KB1']),
});

/**
 * Distância COM SINAL do ponto até o limite da quadra: positiva dentro
 * (quanto falta para sair), negativa fora (quanto passou).
 */
export function insideMargin({ x, y }) {
  return Math.min(x, W - x, y, L - y);
}

/**
 * Quanto o ponto está DENTRO da cozinha (positivo) ou fora dela (negativo).
 * A cozinha vai de lateral a lateral: pisar fora da quadra ao lado da
 * cozinha não é falta.
 */
export function kitchenDepth({ x, y }) {
  const along = K - Math.abs(y - N);
  const across = Math.min(x, W - x);
  return Math.min(along, across);
}

/** De que lado da rede o ponto está. */
export const courtSide = ({ y }) => (y < N ? 'A' : 'B');

/** As linhas da quadra, como segmentos no chão — para desenhar a conferência. */
export function courtSegments() {
  const h = (y) => [{ x: 0, y }, { x: W, y }];
  return [
    h(0), h(L), [{ x: 0, y: 0 }, { x: 0, y: L }], [{ x: W, y: 0 }, { x: W, y: L }],
    h(N - K), h(N), h(N + K),
    [{ x: W / 2, y: 0 }, { x: W / 2, y: N - K }],
    [{ x: W / 2, y: N + K }, { x: W / 2, y: L }],
  ];
}
