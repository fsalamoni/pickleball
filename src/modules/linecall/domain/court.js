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
export function kitchenDepth(p) {
  return kitchenMargin(p).depthM;
}

/**
 * Entre as linhas que valem para o lance, a que DECIDE. Cada candidata leva a
 * margem e o EIXO em que ela é medida: `x` nas laterais e na central, `y` no
 * fundo, na cozinha e na rede. Com a incerteza de cada eixo (`u = { x, y }`),
 * decide a de menor margem medida em incertezas: perto de um canto, a linha
 * mais longe pode ser a mais duvidosa — e "dentro" exige todas folgadas.
 */
function binding(cands) {
  const z = (c) => (c.u ? c.marginM / c.u[c.axis] : c.marginM);
  let best = cands[0];
  cands.forEach((c) => { if (z(c) < z(best)) best = c; });
  return { marginM: best.marginM, reason: best.reason, axis: best.axis, uncertaintyM: best.u ? best.u[best.axis] : undefined };
}

/**
 * O mesmo de `kitchenDepth`, pela linha que decide: a da cozinha (`y`) ou a
 * lateral (`x`). Com `u` (a incerteza de cada eixo) devolve a dela também.
 */
export function kitchenMargin({ x, y }, u = null) {
  const b = binding([
    { marginM: K - Math.abs(y - N), axis: 'y', u },
    { marginM: Math.min(x, W - x), axis: 'x', u },
  ]);
  return { depthM: b.marginM, axis: b.axis, uncertaintyM: b.uncertaintyM };
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

/** Raio da bola de pickleball (diâmetro oficial 7,3–7,5 cm), em metros. */
export const BALL_RADIUS = 0.037;

/** Altura da rede no poste (36 pol.), em metros: o que ela esconde de cada câmera. */
export const NET_HEIGHT = 0.914;

const other = (side) => (side === 'A' ? 'B' : 'A');
export { other as otherSide };

/**
 * Onde a bola TINHA de cair e quanto sobrou (com sinal: positiva dentro).
 * Devolve também o MOTIVO — a linha que decide: `long` (fundo), `wide`
 * (lateral), `short` (linha da cozinha, no saque), `wrong_box` (linha
 * central, no saque) e `net` (não passou da rede).
 *
 * A marca da bola no chão (`patchM`, o raio do toque) entra a FAVOR em toda
 * linha que é da área — tocar o fundo, a lateral ou a central é dentro — e
 * CONTRA na linha da cozinha no saque: tocar nela é saque curto.
 *
 * @param {{x:number,y:number}} p o centro do toque
 * @param {{ target?: 'A'|'B'|null, serveHalf?: 'low'|'high'|null, patchM?: number, u?: {x:number,y:number} }} [o]
 *   `target`: o lado em que a bola tem de cair (`null` = a quadra inteira, quando
 *   não se sabe quem bateu); `serveHalf`: no saque, a metade da largura da área
 *   de saque em diagonal (`low` = x < meio); `u`: a incerteza do toque em cada
 *   eixo — com ela a linha que decide é a de menor margem em incertezas, e ela
 *   volta em `uncertaintyM`.
 */
export function landingMargin(p, { target = null, serveHalf = null, serve = Boolean(serveHalf), patchM = 0, u = null } = {}) {
  const half = COURT.LINE / 2;
  const c = (reason, marginM, axis) => ({ reason, marginM, axis, u });
  const opts = [];
  if (target !== 'A') opts.push(c('long', L - p.y + patchM, 'y'));
  if (target !== 'B') opts.push(c('long', p.y + patchM, 'y'));
  if (target && serveHalf === 'high') opts.push(c('wide', W - p.x + patchM, 'x'), c('wrong_box', p.x - (W / 2 - half) + patchM, 'x'));
  else if (target && serveHalf === 'low') opts.push(c('wide', p.x + patchM, 'x'), c('wrong_box', W / 2 + half - p.x + patchM, 'x'));
  else opts.push(c('wide', p.x + patchM, 'x'), c('wide', W - p.x + patchM, 'x'));
  // No saque a cozinha inteira (e a linha dela) é curta, saiba-se ou não a área em diagonal.
  if (target && serve) opts.push(c('short', (target === 'B' ? p.y - (N + K) : N - K - p.y) - patchM, 'y'));
  else if (target) opts.push(c('net', target === 'B' ? p.y - N : N - p.y, 'y'));
  return binding(opts);
}

/**
 * O pé do SACADOR no instante da batida (USA Pickleball 7.A): atrás da linha
 * de fundo sem tocá-la (a linha é da quadra), entre os prolongamentos
 * imaginários da lateral e da central. Os prolongamentos SÃO da área de saque
 * (3.A.4.g): pisar neles vale, passar deles é falta — por isso a divisa da
 * central fica na borda de LÁ da linha (a central tem 5 cm, e o prolongamento
 * dela vale para os dois lados) e a da lateral na borda de fora.
 * Recebe os pontos APOIADOS (no ar não contam) já no chão — cada um pode levar
 * a sua incerteza por eixo (`u`) — e devolve a margem da linha que decide
 * (positiva = dentro da regra), o motivo, o eixo e a metade da largura de onde
 * o saque saiu. A metade é a que deixa o pé mais folgado (sem o placar não se
 * sabe de que lado a pessoa devia sacar): quem pisa dos dois lados do
 * prolongamento da central erra nas duas.
 *
 * @param {Array<{x:number,y:number,u?:{x:number,y:number}}>} pts
 * @param {'A'|'B'} side o lado de quem saca
 */
export function serveFootMargin(pts, side) {
  if (!pts.length) return null;
  const half = COURT.LINE / 2;
  const forHalf = (h) => ({
    ...binding(pts.flatMap((p) => [
      { reason: 'baseline', marginM: side === 'A' ? -p.y : p.y - L, axis: 'y', u: p.u },
      { reason: 'sideline', marginM: Math.min(p.x, W - p.x), axis: 'x', u: p.u },
      { reason: 'centerline', marginM: h === 'low' ? W / 2 + half - p.x : p.x - (W / 2 - half), axis: 'x', u: p.u },
    ])),
    half: h,
  });
  const z = (m) => (m.uncertaintyM ? m.marginM / m.uncertaintyM : m.marginM);
  const lo = forHalf('low');
  const hi = forHalf('high');
  return z(lo) >= z(hi) ? lo : hi;
}

/**
 * A rede esconde este ponto do chão para a câmera em `cam` ({x, y, z})? A
 * linha de visão passa pelo plano da rede abaixo da fita. Da câmera de fundo,
 * a cozinha do OUTRO lado quase sempre fica escondida: com a câmera a 4 m de
 * altura e 3 m atrás do fundo, o chão some até 2,9 m depois da rede.
 */
export function netHides(cam, p, marginM = 0.03) {
  if (!cam) return false;
  const dy = p.y - cam.y;
  if (Math.abs(dy) < 1e-9) return false;
  const s = (N - cam.y) / dy;
  if (!(s > 0 && s < 1)) return false;
  return cam.z * (1 - s) < NET_HEIGHT + marginM;
}

/**
 * A linha da quadra mais perto do quique — para desenhar a MARCA (estilo
 * Hawk-Eye): qual linha, a margem com sinal (positiva dentro) e onde, ao longo
 * dela, a bola tocou. As linhas de limite são retas nos eixos.
 */
export function nearestBoundary({ x, y }) {
  const options = [
    { line: 'fundo_a', marginM: y, along: x, axis: 'h' },
    { line: 'fundo_b', marginM: L - y, along: x, axis: 'h' },
    { line: 'lateral_1', marginM: x, along: y, axis: 'v' },
    { line: 'lateral_2', marginM: W - x, along: y, axis: 'v' },
  ];
  return options.sort((a, b) => Math.abs(a.marginM) - Math.abs(b.marginM))[0];
}

/**
 * Margem do quique do SAQUE: a bola tem de cair na área de saque em DIAGONAL,
 * do outro lado da rede e além da cozinha. A linha da cozinha é da cozinha
 * (bola nela, no saque, é FORA); a central, a de fundo e a lateral são da
 * área (bola nelas é DENTRO).
 *
 * @param {{x:number,y:number}} p  o quique
 * @param {{ side: 'A'|'B', x: number }} server  de que lado da rede e em que
 *   ponto da largura (x dos pés no chão) saiu o saque
 */
export function serviceBoxMargin(p, server) {
  // diagonal: a metade OPOSTA da largura, do outro lado da rede
  const serveHalf = server.x < W / 2 ? 'high' : 'low';
  return landingMargin(p, { target: server.side === 'A' ? 'B' : 'A', serveHalf }).marginM;
}
