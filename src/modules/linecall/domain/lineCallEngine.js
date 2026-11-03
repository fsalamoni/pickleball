/**
 * O motor de decisão do controle de linhas — puro, quadro a quadro, UM por
 * câmera.
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
 * Quique e batida são as duas MUDANÇAS BRUSCAS de direção da bola (a
 * gravidade muda a direção devagar, quadro a quadro). A que acontece colada a
 * um punho é batida; a outra é quique. O ponto do quique é a interseção da
 * trajetória de antes com a de depois (precisão abaixo de um quadro), levado
 * ao chão pela homografia da calibração.
 *
 * Câmera de CIMA (`mode: 'overhead'`) não vê a bola descer — a altura não
 * aparece na imagem. Nela o motor trabalha no CHÃO: batida é a bola que
 * inverte o sentido; quique é a bola que segue no mesmo rumo e FREIA de
 * repente (o atrito com o piso). Menos certo que a quina vista de lado; por
 * isso a câmera de cima é melhor como complemento (ver `cameraLayouts.js`).
 *
 * Toda medida sai com a sua INCERTEZA, em metros: o tamanho do pixel naquele
 * ponto do chão, o deslocamento da bola em meio quadro e o erro da
 * calibração. Se a bola caiu a 8 cm da linha com incerteza de 3 cm, é FORA;
 * a 2 cm com incerteza de 3 cm, o motor NÃO inventa — diz "revisar".
 *
 * Pé na cozinha: depois de um voleio a pessoa não pode tocar a cozinha (a
 * linha inclusa) nem enquanto bate nem pelo impulso logo depois. O motor
 * acompanha os pés DAQUELA pessoa por `momentumS` segundos. Pé só conta
 * quando está APOIADO (parado na imagem entre dois quadros): pé no ar,
 * projetado no chão, cairia num lugar falso — e aí o motor diz "revisar".
 */

import { applyHomography, metersPerPixel } from './homography.js';
import { insideMargin, kitchenDepth, serviceBoxMargin, courtSide } from './court.js';

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
  /** `image` (de lado ou de trás) ou `overhead` (de cima) */
  mode: 'image',
  /** modo `overhead`: mudança brusca mínima da velocidade no chão, em m/s */
  kinkMS: 2.5,
  /** modo `overhead`: quanto a bola perde, no mínimo, de velocidade no quique */
  bounceSlowdown: 0.15,
  /** o 1º quique depois do saque vale contra a área de saque em diagonal */
  serveRule: true,
  /** raio da marca que a bola deixa no chão ao quicar (bola dura, achata pouco), em metros */
  contactPatchM: 0.01,
});

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const centroid = (pts) => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});
const quad = (...xs) => Math.sqrt(xs.reduce((s, v) => s + v * v, 0));
const vel = (a, b) => ({ x: (b.x - a.x) / (b.t - a.t), y: (b.y - a.y) / (b.t - a.t) });

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
 *   `H` leva a IMAGEM ao CHÃO (metros, coordenadas comuns de `court.js`).
 */
export function createLineCallEngine({ H, options = {} }) {
  const o = { ...ENGINE_DEFAULTS, ...options };
  const overhead = o.mode === 'overhead';
  let track = [];
  let lastKinkT = -Infinity;
  let lastContact = null; // { t, bouncedSince }
  let serve = null; // o saque da jogada, até o primeiro quique: { side, x }
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
    const base = { type: 'volley', t: watch.t, imagePoint: watch.imagePoint, point: watch.point };
    if (player) {
      const s = footState(player, watch.prevFeet);
      watch.prevFeet = player.feet;
      watch.feetAt = centroid(player.feet);
      if (s.depth > -s.u) {
        if (s.grounded && s.depth >= s.u) {
          events.push({ ...base, call: VOLLEY_CALL.FAULT, depthM: s.depth, uncertaintyM: s.u });
          watch = null;
          return;
        }
        if (!watch.near || s.depth > watch.near.depth) watch.near = s;
      }
    }
    if (frame.t - watch.t >= o.momentumS) {
      events.push(watch.near
        ? { ...base, call: VOLLEY_CALL.REVIEW, depthM: watch.near.depth, uncertaintyM: watch.near.u }
        : { ...base, call: VOLLEY_CALL.CLEAN });
      watch = null;
    }
  }

  function bounce(k, ground, u, events) {
    // O primeiro quique depois do saque vale contra a ÁREA DE SAQUE, não a quadra.
    const s = serve && lastContact && !lastContact.bouncedSince ? serve : null;
    serve = null;
    if (lastContact) lastContact.bouncedSince = true;
    // Bola que TOCA a linha é dentro: a margem é a da borda da MARCA que a
    // bola deixa no chão (o centro do toque mais o raio da área de contato).
    const marginM = (s ? serviceBoxMargin(ground, s) : insideMargin(ground)) + o.contactPatchM;
    events.push({ type: 'bounce', t: k.t, call: decide(marginM, u), marginM, uncertaintyM: u, point: ground, imagePoint: k, serve: Boolean(s) });
  }

  /** Câmera de cima: tudo no chão. Batida inverte o sentido; quique freia. */
  function kinkOverhead(events) {
    if (track.length < 4) return;
    const [a, b, c, d] = track.slice(-4).map((p) => ({ ...applyHomography(H, p), t: p.t, img: p }));
    const vin = vel(a, b);
    const vout = vel(c, d);
    if (Math.hypot(vout.x - vin.x, vout.y - vin.y) < o.kinkMS) return;
    if (b.t <= lastKinkT) return;
    lastKinkT = c.t;
    const sin = Math.hypot(vin.x, vin.y);
    const sout = Math.hypot(vout.x, vout.y);
    const cos = (vin.x * vout.x + vin.y * vout.y) / ((sin * sout) || 1);
    if (cos < 0) {
      lastContact = { t: c.t, bouncedSince: false };
      serve = null;
      return;
    }
    if (cos < 0.7 || sout > sin * (1 - o.bounceSlowdown)) return;
    // O ponto é o fim da trajetória de chegada (a bola no chão).
    const t = (b.t + c.t) / 2;
    const ground = { x: b.x + vin.x * (t - b.t), y: b.y + vin.y * (t - b.t) };
    const mpp = metersPerPixel(H, b.img);
    const u = quad(mpp * o.ballPx, sin * (c.t - b.t) / 4, o.calibrationM);
    bounce({ t, x: (b.img.x + c.img.x) / 2, y: (b.img.y + c.img.y) / 2 }, ground, u, events);
  }

  function kink(frame, events) {
    if (track.length < 4) return;
    const [a, b, c, d] = track.slice(-4);
    const vin = vel(a, b);
    const vout = vel(c, d);
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
      const isServe = !lastContact && o.serveRule;
      lastContact = { t: k.t, bouncedSince: false };
      serve = null;
      if (isServe && hitter.p.feet?.length) {
        const at = applyHomography(H, centroid(hitter.p.feet));
        serve = { side: courtSide(at), x: at.x };
      }
      if (isVolley && hitter.p.feet?.length) {
        const feetAt = centroid(hitter.p.feet);
        watch = { t: k.t, imagePoint: k, point: applyHomography(H, feetAt), feetAt, prevFeet: null, near: null };
      }
      return;
    }
    // QUIQUE: só a bola descendo na imagem que passa a subir.
    if (!(vin.y > 0 && vout.y < 0)) return;
    const mpp = metersPerPixel(H, k);
    const speed = Math.hypot(vin.x, vin.y);
    const u = quad(mpp * o.ballPx, mpp * speed * (c.t - b.t) / 4, o.calibrationM);
    bounce(k, applyHomography(H, k), u, events);
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
          serve = null;
        }
        lastBallT = frame.t;
        track.push({ t: frame.t, x: frame.ball.x, y: frame.ball.y });
        if (track.length > 8) track.shift();
        if (overhead) kinkOverhead(events);
        else kink(frame, events);
      } else if (track.length && frame.t - track[track.length - 1].t > 0.1) {
        track = []; // buraco no rastro: não liga pontos de antes e depois dele
      }
      followVolley(frame, events);
      return events;
    },
  };
}
