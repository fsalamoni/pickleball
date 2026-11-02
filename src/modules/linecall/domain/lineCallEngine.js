/**
 * O motor de decisão do controle de linhas — puro, quadro a quadro.
 *
 * Recebe, a cada quadro do vídeo, onde a bola está NA IMAGEM (ou `null`) e os
 * pés e punhos de quem está em quadra (do detector de pose), e devolve os
 * EVENTOS que aconteceram:
 *
 * · `bounce` — a bola quicou: dentro, fora ou REVISAR;
 * · `volley` — alguém bateu na bola antes de ela quicar: falta de pé na
 *   cozinha, voleio limpo ou REVISAR.
 *
 * ## Como ele decide (e por que às vezes diz "revisar")
 *
 * Quique e batida são as duas MUDANÇAS BRUSCAS de direção da bola na imagem
 * (a gravidade muda a direção devagar, quadro a quadro). A que acontece
 * colada a um punho é batida; a outra é quique. O ponto do quique é a
 * interseção da trajetória de antes com a de depois (precisão abaixo de um
 * quadro), levado ao chão pela homografia da calibração.
 *
 * Toda medida sai com a sua INCERTEZA, em metros: o tamanho do pixel naquele
 * ponto do chão, o deslocamento da bola em meio quadro e o erro da
 * calibração. Se a bola caiu a 8 cm da linha com incerteza de 3 cm, é FORA;
 * a 2 cm com incerteza de 3 cm, o motor NÃO inventa — diz "revisar". Com uma
 * câmera só, a 60 quadros, a faixa de "revisar" fica em poucos centímetros
 * em volta da linha; é exatamente a bola NA linha, que não importa em si.
 *
 * Pé na cozinha: depois de um voleio a pessoa não pode tocar a cozinha (a
 * linha inclusa) nem enquanto bate nem pelo impulso logo depois. O motor
 * acompanha os pés DAQUELA pessoa por `momentumS` segundos. Pé só conta
 * quando está APOIADO (parado na imagem entre dois quadros): pé no ar,
 * projetado no chão, cairia num lugar falso — e aí o motor diz "revisar".
 */

import { applyHomography, metersPerPixel } from './homography.js';
import { insideMargin, kitchenDepth } from './court.js';

export const LINE_CALL = Object.freeze({ IN: 'in', OUT: 'out', REVIEW: 'review' });
export const VOLLEY_CALL = Object.freeze({ FAULT: 'fault', CLEAN: 'clean', REVIEW: 'review' });

/** Ajustes do motor — botões de calibração do mundo real, não constantes. */
export const ENGINE_DEFAULTS = Object.freeze({
  /** erro típico do detector de bola, em pixels */
  ballPx: 3,
  /** erro típico do ponto do pé no detector de pose, em pixels */
  footPx: 6,
  /** distância entre o ponto do pé no modelo e a borda do tênis, em metros */
  footModelM: 0.04,
  /** erro da calibração (toques nos cantos), em metros */
  calibrationM: 0.015,
  /** mudança brusca: variação mínima da velocidade na imagem, em px/s */
  kinkPxS: 250,
  /** batida: a bola a até este raio (px) de um punho */
  wristPx: 90,
  /** quanto tempo depois do voleio o impulso ainda conta, em segundos */
  momentumS: 1.0,
  /** pé "apoiado": moveu menos que isto (px) desde o quadro anterior */
  groundPx: 4,
  /** sem bola por mais que isto, a jogada acabou (s) */
  rallyGapS: 2,
});

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const centroid = (pts) => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});
const quad = (...xs) => Math.sqrt(xs.reduce((s, v) => s + v * v, 0));

/** Decide dentro/fora/revisar por margem e incerteza (metros). */
export function decide(marginM, uncertaintyM) {
  if (marginM >= uncertaintyM) return LINE_CALL.IN;
  if (marginM <= -uncertaintyM) return LINE_CALL.OUT;
  return LINE_CALL.REVIEW;
}

/**
 * Onde, entre os pontos b (antes) e c (depois) da quina, a bola tocou: a
 * interseção das retas a→b e c→d no eixo vertical da imagem.
 */
export function kinkPoint(a, b, c, d) {
  const vin = (b.y - a.y) / (b.t - a.t);
  const vout = (d.y - c.y) / (d.t - c.t);
  let t = vin === vout ? (b.t + c.t) / 2 : (c.y - b.y + vin * b.t - vout * c.t) / (vin - vout);
  t = Math.min(Math.max(t, b.t), c.t);
  const vx = (b.x - a.x) / (b.t - a.t);
  return { t, x: b.x + vx * (t - b.t), y: b.y + vin * (t - b.t) };
}

/**
 * @param {{ H: number[], options?: Partial<typeof ENGINE_DEFAULTS> }} cfg
 *   `H` leva a IMAGEM ao CHÃO (metros).
 */
export function createLineCallEngine({ H, options = {} }) {
  const o = { ...ENGINE_DEFAULTS, ...options };
  let track = [];
  let lastKinkT = -Infinity;
  let lastContact = null; // { t, bouncedSince }
  let watch = null; // voleio em observação
  let lastBallT = -Infinity;

  function footState(player, prevFeet) {
    let deepest = null;
    player.feet.forEach((f, i) => {
      const grounded = prevFeet?.[i] ? dist(f, prevFeet[i]) <= o.groundPx : false;
      const depth = kitchenDepth(applyHomography(H, f));
      const u = quad(metersPerPixel(H, f) * o.footPx, o.footModelM, o.calibrationM);
      if (!deepest || depth > deepest.depth) deepest = { depth, u, grounded };
    });
    return deepest;
  }

  function followVolley(frame, events) {
    if (!watch) return;
    // A mesma pessoa no quadro seguinte é a pose cujos pés estão mais perto.
    const player = (frame.players || [])
      .filter((p) => p.feet?.length)
      .map((p) => ({ p, d: dist(centroid(p.feet), watch.feetAt) }))
      .sort((a, b) => a.d - b.d)[0]?.p;
    if (player) {
      const s = footState(player, watch.prevFeet);
      watch.prevFeet = player.feet;
      watch.feetAt = centroid(player.feet);
      if (s.depth > -s.u) {
        if (s.grounded && s.depth >= s.u) {
          events.push({ type: 'volley', t: watch.t, call: VOLLEY_CALL.FAULT, depthM: s.depth, uncertaintyM: s.u, imagePoint: watch.imagePoint });
          watch = null;
          return;
        }
        if (!watch.near || s.depth > watch.near.depth) watch.near = s;
      }
    }
    if (frame.t - watch.t >= o.momentumS) {
      events.push(watch.near
        ? { type: 'volley', t: watch.t, call: VOLLEY_CALL.REVIEW, depthM: watch.near.depth, uncertaintyM: watch.near.u, imagePoint: watch.imagePoint }
        : { type: 'volley', t: watch.t, call: VOLLEY_CALL.CLEAN, imagePoint: watch.imagePoint });
      watch = null;
    }
  }

  function kink(frame, events) {
    if (track.length < 4) return;
    const [a, b, c, d] = track.slice(-4);
    const vin = { x: (b.x - a.x) / (b.t - a.t), y: (b.y - a.y) / (b.t - a.t) };
    const vout = { x: (d.x - c.x) / (d.t - c.t), y: (d.y - c.y) / (d.t - c.t) };
    if (Math.hypot(vout.x - vin.x, vout.y - vin.y) < o.kinkPxS) return;
    if (b.t <= lastKinkT) return; // a mesma quina, vista de novo
    lastKinkT = c.t;
    const k = kinkPoint(a, b, c, d);
    const wrists = (frame.players || []).flatMap((p) => (p.wrists || []).map((w) => ({ w, p })));
    const hitter = wrists.map(({ w, p }) => ({ p, d: dist(w, k) })).sort((x, y) => x.d - y.d)[0];
    if (hitter && hitter.d <= o.wristPx) {
      // BATIDA. É voleio se a bola não quicou desde a batida anterior (a
      // primeira batida da jogada é o saque, que nunca é voleio).
      const isVolley = lastContact && !lastContact.bouncedSince;
      lastContact = { t: k.t, bouncedSince: false };
      if (isVolley && hitter.p.feet?.length) {
        watch = { t: k.t, imagePoint: k, feetAt: centroid(hitter.p.feet), prevFeet: null, near: null };
      }
      return;
    }
    // QUIQUE: só a bola descendo na imagem que passa a subir.
    if (!(vin.y > 0 && vout.y < 0)) return;
    if (lastContact) lastContact.bouncedSince = true;
    const ground = applyHomography(H, k);
    const mpp = metersPerPixel(H, k);
    const speed = Math.hypot(vin.x, vin.y);
    const frameDt = c.t - b.t;
    const u = quad(mpp * o.ballPx, mpp * speed * frameDt / 4, o.calibrationM);
    const marginM = insideMargin(ground);
    events.push({ type: 'bounce', t: k.t, call: decide(marginM, u), marginM, uncertaintyM: u, point: ground, imagePoint: k });
  }

  return {
    /**
     * @param {{ t: number, ball: {x:number,y:number}|null,
     *   players?: Array<{ feet: Array<{x,y}>, wrists: Array<{x,y}> }> }} frame
     *   `t` em segundos; coordenadas em pixels da imagem.
     * @returns {Array<object>} eventos novos
     */
    push(frame) {
      const events = [];
      if (frame.ball) {
        if (frame.t - lastBallT > o.rallyGapS) {
          track = [];
          lastContact = null;
        }
        lastBallT = frame.t;
        track.push({ t: frame.t, x: frame.ball.x, y: frame.ball.y });
        if (track.length > 8) track.shift();
        kink(frame, events);
      } else if (track.length && frame.t - track[track.length - 1].t > 0.1) {
        track = []; // buraco no rastro: não liga pontos de antes e depois dele
      }
      followVolley(frame, events);
      return events;
    },
  };
}
