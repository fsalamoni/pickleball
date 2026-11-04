/**
 * O motor de decisão do controle de linhas — puro, quadro a quadro, UM por
 * câmera (docs/53 §3 e §10). As regras são as da USA Pickleball 2026, que a
 * CBP segue (os números entre parênteses são das regras).
 *
 * Recebe, a cada quadro do vídeo, onde a bola está NA IMAGEM (ou `null`) e os
 * pés e punhos de quem está em quadra (do detector de pose), e devolve as
 * MARCAÇÕES que aconteceram:
 *
 * · `bounce` — a bola quicou: dentro, fora ou REVISAR (com o motivo: fundo,
 *   lateral, curta — na cozinha ou na linha dela, no saque —, área errada no
 *   saque, rede);
 * · `volley` — alguém bateu na bola antes de ela quicar: pé na cozinha (na
 *   batida, no impulso depois dela, ou sem ter voltado com os dois pés para
 *   fora), voleio sem falta ou REVISAR (11.A);
 * · `serve_foot` — o pé de quem saca no instante da batida: na linha de
 *   fundo, na quadra, fora do prolongamento da lateral ou da central, ou com
 *   os dois pés no ar (7.A);
 * · `two_bounce` — a regra dos dois quiques: devolução do saque ou 3ª bola
 *   batidas antes de quicar (10.A).
 *
 * ## O ponto, do saque ao fim
 *
 * O motor sabe em que parte do ponto está. O SAQUE é a batida de quem está
 * atrás (ou quase) da linha de fundo, com a bola PERTO dela antes (vinda de
 * longe é devolução, não saque); o 1º quique dele vale contra a área de saque
 * em diagonal — e a cozinha inteira, com a linha, é curta (7.E). Depois, em
 * cada batida, só o 1º quique é julgado (10.C.1), contra a metade do OUTRO
 * lado; o 2º quique encerra o ponto sem marcação. Bola que cai do lado de
 * quem bateu não passou da rede. Quique antes do saque nunca é marcação
 * (7.D.4). Ponto encerrado (fora, falta, 2º quique) não é mais julgado até o
 * próximo saque. Sem ver o saque, o motor só começa a julgar quando vê uma
 * troca de verdade (batida de um lado, batida do outro).
 *
 * Quique do outro lado sem a batida à vista é alguém de lá que bateu sem
 * esta câmera ver (longe, de costas, escondido): o ponto segue, e a regra dos
 * dois quiques deixa de ser julgada até o próximo saque — sem a sequência
 * inteira não se sabe qual é a 2ª e qual a 3ª bola. A bola que cai do lado de
 * quem bateu só é REDE se cair logo (`netBallS`), ou um pouco depois e perto
 * da rede (`netLateS`, `netZoneM`); mais tarde, alguém devolveu sem ser visto.
 *
 * Quando a câmera não pega a batida do saque (a bola parada na mão não
 * aparece), o saque é a bola que APARECE perto de quem está atrás do fundo.
 * Na câmera de lado, que nem sempre vê quem saca, é a primeira bola depois de
 * a quadra ficar parada — aí o motor sabe de que lado saiu, mas não a área em
 * diagonal: julga curta, longa e lateral, não "área errada".
 *
 * ## Quique ou batida
 *
 * São as duas MUDANÇAS BRUSCAS de direção da bola. Na câmera de LADO (a
 * linha da quadra corre de lado na imagem), batida é a bola que volta para o
 * lado de onde veio, ou que dispara de quase parada perto de um punho; quique
 * é a que segue e sobe. Na câmera de FUNDO, a altura e a profundidade se
 * misturam na imagem: perto de um punho — ou, sem punho, à altura do corpo de
 * quem é a vez de bater —, a bola que descia e passa a subir pode ser as duas
 * coisas. Aí o motor ESPERA o lance seguinte (até `resolveS`): se a mesma
 * pessoa bate logo depois, foi quique; se a bola vai para o outro lado, foi
 * batida — e se nada vier (o lance de lá ficou longe ou atrás da rede), vale
 * o rumo: a bola que passou para o outro lado foi batida. Batidas também se
 * alternam de lado: "batida" do mesmo lado que a anterior é quique. Bola que cai ao pé de quem acabou de bater encerra o
 * ponto SEM marcação: pode ter batido no corpo (10.C.3), e aí a falta é de
 * quem foi atingido — chamar "fora" daria o ponto ao time errado.
 *
 * ## Altura e o que a câmera não vê
 *
 * Com o tamanho da imagem (`imageSize`) o motor tira da calibração ONDE a
 * câmera está (`estimateCamera`) e corrige o que não está no chão — o centro
 * da bola no quique (3,7 cm) e os pontos do pé (≈3 cm) —, que projetados como
 * se estivessem no chão cairiam até 15 cm longe demais (só o ponto de CONTATO
 * conta, 8.E). E sabe o que a REDE esconde: da câmera de fundo, o chão da
 * cozinha do outro lado não aparece; o pé lá não é julgado por ela (nem
 * "falta" nem "sem falta"), e a bola perto da fita pode ter batido na rede.
 *
 * ## A câmera de cima
 *
 * Ela não vê a altura, e a altura mexe no rastro: a bola no ar aparece
 * afastada do ponto embaixo da câmera, tanto mais quanto mais alta. No quique
 * a altura vai a zero e volta a crescer, e a velocidade aparente dá um PULO
 * PARA FORA — é isso que marca o quique; a freada sozinha é ruído ou a bola
 * caindo (a gravidade puxa o rastro sempre para dentro). A batida inverte o
 * rumo, ou parece PARAR (o "voltar" e o "subir" se anulam vistos de cima).
 * Perto do centro a altura quase não aparece, e o quique é a freada sem
 * mudar de rumo; bem embaixo da rede, a freada é a bola na fita. É o quique a
 * poucos metros da rede, embaixo dela, que essa câmera vê pior — as de lado e
 * de fundo cobrem.
 *
 * ## Incerteza
 *
 * Toda medida sai com a sua INCERTEZA, em metros, EM CADA EIXO das linhas
 * (`x`: laterais e central; `y`: fundo, cozinha e rede): o tamanho do pixel
 * naquele ponto do chão, naquela direção; o quanto a bola anda no erro do
 * instante do quique; o erro da calibração; e o da correção de altura, que
 * segue o rumo até a câmera. A melhor vista de uma linha é a que corre AO
 * LONGO dela — o juiz de linha senta no prolongamento —: a câmera da rede tem
 * a palavra nas linhas da cozinha, a de fundo na central e nas laterais. Perto
 * de um canto decide a linha de menor margem medida em incertezas. Margem
 * menor que a incerteza é REVISAR, nunca um palpite — e revisar sem decisão vale DENTRO (8.D: a dúvida é de quem
 * recebe a marcação). Pé só conta APOIADO (parado por três quadros) e
 * visível; e a falta de pé no voleio só sai quando o motor tem certeza de que
 * FOI voleio (rastro contínuo, sem quique possível desde a batida anterior) —
 * senão é REVISAR: quem está na cozinha depois do quique joga normalmente.
 *
 * ## O impulso (11.A.2)
 *
 * O voleio só termina quando a pessoa recupera o equilíbrio ou para de ir em
 * direção à cozinha — não há relógio na regra. O motor observa até ela parar
 * de avançar para a cozinha por `balanceS` (parada ou andando de lado) ou
 * recuar (`retreatM`), no mínimo `momentumS` e no máximo `momentumMaxS`, e
 * segue observando mesmo com a bola já morta (9.B.1). O pé que só chega à
 * cozinha depois de o outro lado bater de novo é REVISAR: pode ser o embalo,
 * pode ser a pessoa indo jogar a bola que vai quicar ali (o que vale).
 *
 * ## O que ele não julga
 *
 * Só os PÉS são seguidos: raquete, mão, roupa ou o parceiro tocando a cozinha
 * no voleio (11.A.1) e o objeto que cai nela (10.J) ficam com quem organiza.
 * A bola que bate no corpo perto do punho parece batida de raquete (10.C.3), e
 * o saque que toca quem recebe antes de quicar (7.E.5) não é reconhecido. Bola
 * NA linha com precisão de milímetro pede várias câmeras rápidas sincronizadas
 * — com um celular por posição o motor diz REVISAR, e quem organiza decide.
 */

import { applyHomography, invertHomography, estimateCamera, liftToGround } from './homography.js';
import {
  COURT, BALL_RADIUS, kitchenDepth, kitchenMargin, courtSide, landingMargin, serveFootMargin, netHides, otherSide,
} from './court.js';

export const LINE_CALL = Object.freeze({ IN: 'in', OUT: 'out', REVIEW: 'review' });
export const VOLLEY_CALL = Object.freeze({ FAULT: 'fault', CLEAN: 'clean', REVIEW: 'review' });

/** Os tipos de marcação. O id é gravado (`line_calls.kind`): nunca renomeie. */
export const CALL_KIND = Object.freeze({
  BOUNCE: 'bounce', VOLLEY: 'volley', SERVE_FOOT: 'serve_foot', TWO_BOUNCE: 'two_bounce',
});

/** Por que a marcação saiu assim. Gravado (`line_calls.reason`): nunca renomeie. */
export const CALL_REASON = Object.freeze({
  LONG: 'long', WIDE: 'wide', SHORT: 'short', WRONG_BOX: 'wrong_box', NET: 'net',
  CONTACT: 'contact', MOMENTUM: 'momentum', REENTRY: 'reentry', UNSEEN: 'unseen',
  BASELINE: 'baseline', SIDELINE: 'sideline', CENTERLINE: 'centerline', AIRBORNE: 'airborne',
  RETURN: 'return', THIRD: 'third',
});

/** Ajustes do motor — botões de calibração do mundo real, não constantes. */
export const ENGINE_DEFAULTS = Object.freeze({
  /** erro típico do detector de bola, em pixels */
  ballPx: 3,
  /** erro típico do ponto do pé no detector de pose, em pixels */
  footPx: 6,
  /** distância entre o ponto do pé no modelo e a borda do tênis, em metros */
  footModelM: 0.04,
  /** pé com incerteza maior que isto (m) na linha da cozinha não é julgado por esta câmera: está longe demais */
  footMaxU: 0.25,
  /** erro da calibração (toques nos cantos), em metros */
  calibrationM: 0.015,
  /** mudança brusca: variação mínima da velocidade na imagem, em px/s */
  kinkPxS: 250,
  /**
   * a perspectiva e a gravidade mudam a velocidade da bola na imagem aos poucos e
   * sempre PARA BAIXO: variação para baixo menor que esta fração da velocidade, por
   * segundo, não é quina (perto da câmera, a bola que se afasta freia muito na imagem)
   */
  smoothRatePerS: 9,
  /** batida: a bola a até este raio (px) de um punho (teto; perto da pessoa vale o alcance da raquete) */
  wristPx: 90,
  /** alcance da raquete a partir do punho, em metros */
  paddleReachM: 0.6,
  /** sem punho à vista: o corpo de quem joga, de `bodyLowM` a `bodyTopM` acima do pé (m) */
  bodyLowM: 0.25,
  bodyTopM: 2.4,
  /** o impulso depois do voleio dura NO MÍNIMO isto (s) */
  momentumS: 0.5,
  /** ...e no máximo isto, se a pessoa não parar de avançar (s) */
  momentumMaxS: 2,
  /** o impulso acabou: este tempo (s) sem avançar para a cozinha (parada, ou andando de lado) */
  balanceS: 0.3,
  /** avançar para a cozinha é chegar mais perto dela que isto (m); menos é o tremor do detector */
  progressM: 0.05,
  /** recuou isto para longe da cozinha depois do voleio: o impulso para lá acabou (m) */
  retreatM: 0.3,
  /** pé "apoiado": moveu menos que `groundPx` (px) nos últimos `groundFrames` quadros */
  groundPx: 4,
  groundFrames: 3,
  /** ponto do pé com visibilidade abaixo disto (0–1, do detector) não conta */
  minVis: 0.5,
  /** sem bola por mais que isto, a jogada acabou (s) */
  rallyGapS: 3,
  /** a bola que APARECE depois de sumir por isto pode ser o saque (s) */
  startGapS: 0.25,
  /** buraco no rastro maior que isto tira a certeza de "não quicou" (s) */
  continuityS: 0.12,
  /** descida que vira subida mais devagar que a quina: possível quique suave (px/s) */
  softBouncePxS: 80,
  /** quanto tempo esperar o lance seguinte para saber se foi quique ou batida (s) */
  resolveS: 1.5,
  /** voleio: punho a pelo menos isto do chão para não ser meia-volta (m) */
  wristHighM: 0.7,
  /** `image` (de lado ou de trás) ou `overhead` (de cima) */
  mode: 'image',
  /** modo `overhead`: mudança brusca mínima da velocidade no chão, em m/s */
  kinkMS: 1.5,
  /** modo `overhead`: quanto a bola perde, no mínimo, de velocidade no quique */
  bounceSlowdown: 0.15,
  /** modo `overhead`: a "freada" a menos que isto da rede (m) é a bola na fita, não quique */
  netCordM: 0.25,
  /** modo `overhead`: até esta distância do ponto embaixo da câmera (m) a altura quase não aparece no rastro */
  overheadNearM: 1,
  /** modo `overhead`: bola quase parada (m/s) que dispara (m/s) é batida */
  launchSlowMS: 1.5,
  launchFastMS: 5,
  /** modo `overhead`: altura presumida da câmera, no centro da quadra (m) */
  overheadHeightM: 7,
  /** o 1º quique depois do saque vale contra a área de saque em diagonal */
  serveRule: true,
  /** julgar o pé de quem saca */
  serveFootRule: true,
  /**
   * pé no saque: esta câmera só julga se a incerteza na linha que decide for
   * menor que isto (m). O pé de quem saca fica quase sempre a poucos
   * centímetros do fundo, e a câmera que não enxerga essa folga (a da rede,
   * vendo o fundo de longe e de frente) só mandaria "revisar" a cada saque.
   */
  serveFootMaxU: 0.15,
  /** julgar a regra dos dois quiques */
  twoBounceRule: true,
  /** saque: pés a até isto dentro da quadra (m) e até `serveDeepM` atrás do fundo */
  serveZoneM: 0.6,
  serveDeepM: 3,
  /**
   * antes do saque a bola fica perto de quem saca: vinda de mais longe que isto
   * é devolução (m); e o saque só vale quando a bola já foi para mais longe que
   * isto (antes disso pode ser quem saca quicando a bola)
   */
  serveNearM: 3,
  /** de onde a bola veio antes da batida: olha até isto para trás, desde a última vez parada (s) */
  restWindowS: 2,
  /** "parada": andou menos que `restM` (m) em `restS` (s) */
  restS: 0.2,
  restM: 0.3,
  /** depois de um ponto, nada é saque antes disto (s): é a bola devolvida a quem vai sacar */
  serveAfterS: 1.5,
  /** quique a até isto de quem bateu: quicada de propósito, ou a bola bateu no corpo (m) */
  dropZoneM: 1.5,
  /**
   * a bola que cai do lado de quem bateu até `netBallS` depois da batida (ou até
   * `netLateS`, a até `netZoneM` da rede) não passou da rede; depois disso, alguém
   * do outro lado devolveu e esta câmera não viu (s, s, m)
   */
  netBallS: 1,
  netLateS: 1.4,
  netZoneM: 2.5,
  /** raio da marca que a bola deixa no chão ao quicar (bola dura, achata pouco), em metros */
  contactPatchM: 0.01,
  /** o tamanho da imagem analisada ({w, h}): com ele o motor corrige a altura */
  imageSize: null,
  /** altura do centro da bola no quique e dos pontos do pé (m) */
  ballHeightM: BALL_RADIUS,
  footHeightM: 0.03,
  /** erro relativo da correção de altura (a posição da câmera é estimada) */
  poseErrRel: 0.25,
  /** parte desse erro que vale em qualquer direção (o rumo até a câmera também é estimado) */
  poseDirShare: 0.3,
  /** com a imagem mas sem conseguir achar a câmera: incerteza extra (m) */
  noPoseM: 0.05,
  /** a bola até isto acima da fita da rede, na imagem, pode ter batido nela (m) */
  ballNetMarginM: 0.15,
  /** câmera de lado: a linha da quadra precisa correr ao menos isto de lado na imagem (0–1) */
  alongSepMin: 0.5,
  alongMinPxS: 60,
  /** rastro de pessoa: salto máximo entre quadros (px) e quanto vive sem ser vista (s) */
  trackJumpPx: 160,
  trackTtlS: 0.6,
  /** voleio: a pessoa precisa ser vista em ao menos esta fração do impulso */
  minCoverage: 0.6,
});

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const centroid = (pts) => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});
const quad = (...xs) => Math.sqrt(xs.reduce((s, v) => s + v * v, 0));
const vel = (a, b) => ({ x: (b.x - a.x) / (b.t - a.t), y: (b.y - a.y) / (b.t - a.t) });
const dot = (a, b) => a.x * b.x + a.y * b.y;

/** Decide dentro/fora/revisar por margem e incerteza (metros). */
export function decide(marginM, uncertaintyM) {
  if (marginM >= uncertaintyM) return LINE_CALL.IN;
  if (marginM <= -uncertaintyM) return LINE_CALL.OUT;
  return LINE_CALL.REVIEW;
}

/** O mesmo, para o que é falta: margem positiva = dentro da regra (sem falta). */
const decideFault = (marginM, u) => {
  if (marginM >= u) return VOLLEY_CALL.CLEAN;
  if (marginM <= -u) return VOLLEY_CALL.FAULT;
  return VOLLEY_CALL.REVIEW;
};

/**
 * @param {{ H: number[], options?: Partial<typeof ENGINE_DEFAULTS> }} cfg
 *   `H` leva a IMAGEM ao CHÃO (metros, coordenadas comuns de `court.js`).
 */
export function createLineCallEngine({ H, options = {} }) {
  const o = { ...ENGINE_DEFAULTS, ...options };
  const overhead = o.mode === 'overhead';
  const G = invertHomography(H);
  // De cima a perspectiva some e a posição não sai da calibração: vale a do arranjo (no centro).
  const cam = overhead
    ? { x: COURT.WIDTH / 2, y: COURT.NET_Y, z: o.overheadHeightM }
    : o.imageSize ? estimateCamera(H, o.imageSize) : null;
  const camKnown = overhead || Boolean(o.imageSize);
  const errRel = overhead ? 0.5 : o.poseErrRel;

  /**
   * Da imagem ao chão, corrigindo a altura. Devolve também o deslocamento da
   * correção (`d`, m) — o erro dela segue esse rumo — e, sem a câmera, o erro
   * sem direção de não poder corrigir (`iso`).
   */
  function lift(g, heightM) {
    if (!cam) return { p: g, d: { x: 0, y: 0 }, iso: camKnown ? o.noPoseM : 0 };
    const p = liftToGround(g, cam, heightM);
    return { p, d: { x: p.x - g.x, y: p.y - g.y }, iso: 0 };
  }
  const toGround = (img, heightM) => lift(applyHomography(H, img), heightM);

  /**
   * A incerteza no chão (m) em cada EIXO das linhas: `x` (laterais, central) e
   * `y` (fundo, cozinha, rede). A melhor vista de uma linha é a que corre ao
   * longo dela — o juiz de linha senta no prolongamento: ali um pixel de erro
   * vira pouco chão para os lados da linha e muito chão em profundidade, que
   * não muda a marcação. Por isso cada eixo tem a sua conta, e a câmera
   * alinhada com a linha fica com a incerteza menor justamente nela.
   * `px`: erro do detector (px); `iso`: os erros sem direção (m); `d`: o
   * deslocamento da correção de altura; `move`: quanto a bola anda (m, x/y)
   * no erro do instante estimado.
   */
  function axisU(img, px, iso, d, move = null) {
    const a = applyHomography(H, img);
    const bu = applyHomography(H, { x: img.x + 1, y: img.y });
    const bv = applyHomography(H, { x: img.x, y: img.y + 1 });
    const dn = Math.hypot(d.x, d.y);
    const one = (k) => quad(
      px * Math.hypot(bu[k] - a[k], bv[k] - a[k]),
      ...iso,
      errRel * Math.hypot(d[k], o.poseDirShare * dn),
      move ? move[k] : 0,
    );
    return { x: one('x'), y: one('y') };
  }

  /** A cozinha por este pé: a profundidade (positiva dentro) e a incerteza da linha que decide. */
  const kz = (f) => kitchenMargin(f.p, f.uxy);
  const hidden = (p, margin) => netHides(overhead ? null : cam, p, margin);
  /** Metros por pixel na horizontal da imagem (a escala de quem está de pé ali). */
  const mppX = (img) => {
    const a = applyHomography(H, img);
    const b = applyHomography(H, { x: img.x + 1, y: img.y });
    return Math.hypot(b.x - a.x, b.y - a.y) || 0.01;
  };

  // ── Pessoas: rastros de pose ────────────────────────────────────────────
  let tracks = [];
  let trackSeq = 0;

  /** `prevs`: o mesmo ponto do pé nos quadros anteriores (o mais recente primeiro). */
  function footPoint(f, i, prevs) {
    const seen = (f.v ?? 1) >= o.minVis;
    // Apoiado é PARADO por `groundFrames` quadros: o pé no ar perto do alto do pulo,
    // ou indo para longe da câmera, anda pouco de um quadro para o outro.
    const grounded = seen && prevs.length >= o.groundFrames - 1
      && prevs.every((q) => q?.seen && dist(f, q.img) <= o.groundPx);
    const { p, d, iso } = toGround(f, o.footHeightM);
    const uxy = axisU(f, o.footPx, [o.footModelM, o.calibrationM, iso], d);
    // Longe demais para esta câmera julgar a linha da cozinha (o fundo de lá,
    // visto daqui): é da outra câmera.
    return { img: { x: f.x, y: f.y }, foot: i % 2, seen, grounded, p, uxy, hidden: hidden(p) || uxy.y > o.footMaxU };
  }

  /** O estado de cozinha da pessoa: dentro, talvez, e se cada pé já voltou para fora (11.A.3). */
  function updateNvz(tr, feet) {
    const use = feet.filter((f) => f.seen && !f.hidden);
    const down = use.filter((f) => f.grounded).map(kz);
    const landed = (i) => { const pts = use.filter((f) => f.foot === i); return pts.length > 0 && pts.every((f) => f.grounded); };
    if (down.some((k) => k.depthM >= k.uncertaintyM)) tr.nvz = { inside: true, maybe: false, re: [false, false] };
    else if (down.some((k) => k.depthM > -k.uncertaintyM) && !tr.nvz.inside) tr.nvz = { inside: false, maybe: true, re: [false, false] };
    else if (tr.nvz.inside && [0, 1].every((i) => tr.nvz.re[i] || landed(i))) {
      // Os dois pés de volta no chão e nenhum ponto CERTAMENTE na cozinha: a
      // ponta do pé perto da linha, dentro da incerteza, pode já estar fora.
      // Vira "talvez" — reentrada para REVISAR, nunca falta certa (11.A.3). Pé
      // ainda no ar (o pulo para fora) segue "dentro": não firmou fora.
      tr.nvz = { inside: false, maybe: true, re: tr.nvz.re };
    }
    if (tr.nvz.inside || tr.nvz.maybe) {
      const re = [...tr.nvz.re];
      [0, 1].forEach((i) => {
        const pts = use.filter((f) => f.foot === i);
        if (pts.length && pts.every((f) => { const k = kz(f); return f.grounded && k.depthM <= -k.uncertaintyM; })) re[i] = true;
      });
      tr.nvz = re[0] && re[1] ? { inside: false, maybe: false, re: [false, false] } : { ...tr.nvz, re };
    }
  }

  function observe(tr, t, pl, anchor) {
    // os quadros anteriores, seguidos (sem buraco maior que 0,1 s entre eles)
    const prevs = [];
    for (let j = tr.hist.length - 1, at = t; j >= 0 && prevs.length < o.groundFrames - 1; j -= 1) {
      if (at - tr.hist[j].t > 0.1) break;
      prevs.push(tr.hist[j]);
      at = tr.hist[j].t;
    }
    const feet = (pl.feet || []).map((f, i) => footPoint(f, i, prevs.map((e) => e.feet[i])));
    const before = { inside: tr.nvz.inside, maybe: tr.nvz.maybe };
    updateNvz(tr, feet);
    const seenFeet = feet.filter((f) => f.seen);
    if (seenFeet.length) tr.side = courtSide(centroid(seenFeet.map((f) => f.p)));
    // Sem pé à vista (escondido pela rede, quase sempre do outro lado): o punho
    // projetado no chão cai ainda mais longe da câmera, do mesmo lado da rede.
    else if (!tr.side && pl.wrists?.length) tr.side = courtSide(applyHomography(H, centroid(pl.wrists)));
    tr.hist.push({ t, feet, wrists: pl.wrists || [], before });
    if (tr.hist.length > 20) tr.hist.shift();
    tr.anchor = anchor;
    tr.lastT = t;
  }

  function updateTracks(t, players) {
    const poses = (players || []).map((pl) => {
      const f = (pl.feet || []).filter((p) => (p.v ?? 1) >= o.minVis);
      const w = pl.wrists || [];
      const anchor = f.length ? centroid(f) : w.length ? centroid(w) : null;
      return { pl, anchor };
    }).filter((x) => x.anchor);
    const pairs = [];
    tracks.forEach((tr) => poses.forEach((ps, j) => {
      const d = dist(tr.anchor, ps.anchor);
      if (d <= o.trackJumpPx) pairs.push({ tr, j, d });
    }));
    pairs.sort((a, b) => a.d - b.d);
    const usedT = new Set();
    const usedP = new Set();
    pairs.forEach(({ tr, j }) => {
      if (usedT.has(tr) || usedP.has(j)) return;
      usedT.add(tr); usedP.add(j);
      observe(tr, t, poses[j].pl, poses[j].anchor);
    });
    poses.forEach((ps, j) => {
      if (usedP.has(j)) return;
      trackSeq += 1;
      const tr = { id: trackSeq, hist: [], nvz: { inside: false, maybe: false, re: [false, false] }, side: null };
      tracks.push(tr);
      observe(tr, t, ps.pl, ps.anchor);
    });
    tracks = tracks.filter((tr) => t - tr.lastT <= o.trackTtlS);
  }

  /** O quadro de pose de um rastro mais perto do instante `t`. */
  function entryAt(tr, t) {
    let best = null;
    tr.hist.forEach((e) => { if (!best || Math.abs(e.t - t) < Math.abs(best.t - t)) best = e; });
    return best && Math.abs(best.t - t) <= 0.12 ? best : null;
  }

  const seenFeetImg = (e) => e.feet.filter((f) => f.seen).map((f) => f.img);

  /** Quem está com o punho perto da bola no instante da quina. */
  function wristNear(k) {
    let best = null;
    tracks.forEach((tr) => {
      const e = entryAt(tr, k.t);
      if (!e) return;
      const feetImg = seenFeetImg(e);
      const reach = feetImg.length ? o.paddleReachM / mppX(centroid(feetImg)) : o.wristPx;
      const radius = Math.min(o.wristPx, Math.max(25, reach));
      e.wrists.forEach((w) => {
        const d = dist(w, k);
        if (d <= radius && (!best || d < best.d)) best = { tr, e, w, d };
      });
    });
    return best;
  }

  /**
   * Sem punho à vista: a bola à altura do CORPO de quem é a vez de bater (a
   * raquete que o detector não achou, ou a bola que bateu na pessoa). Só para
   * a câmera de fundo — na de lado a volta da bola já diz o que foi.
   */
  function bodyNear(k, side) {
    let best = null;
    tracks.forEach((tr) => {
      if (side && tr.side !== side) return;
      const e = entryAt(tr, k.t);
      if (!e) return;
      const feetImg = seenFeetImg(e);
      if (!feetImg.length) return;
      const c = centroid(feetImg);
      const m = mppX(c);
      const across = Math.abs(k.x - c.x) * m;
      const up = (c.y - k.y) * m;
      if (across <= o.paddleReachM + 0.25 && up >= o.bodyLowM && up <= o.bodyTopM && (!best || across < best.d)) {
        best = { tr, e, w: null, d: across, body: true };
      }
    });
    return best;
  }

  /** Altura do punho acima do pé mais baixo na imagem, em metros (aproximada). */
  function wristHeightM(hit) {
    if (!hit.w) return null;
    const feetSeen = hit.e.feet.filter((f) => f.seen);
    if (!feetSeen.length) return null;
    const ground = feetSeen.reduce((m, f) => (f.img.y > m.y ? f.img : m), feetSeen[0].img);
    return (ground.y - hit.w.y) * mppX(ground);
  }

  // ── A bola ─────────────────────────────────────────────────────────────
  let track = [];
  let recent = []; // a bola nos últimos instantes (para saber de onde ela veio)
  let lastKinkT = -Infinity;
  let kcand = null; // a quina mais forte, esperando o quadro seguinte
  let lastBallT = -Infinity;
  let gapMax = 0; // maior buraco no rastro desde a última batida
  let softB = null; // último possível quique suave: { t, side } (o lado em que teria sido)
  let start = null; // a bola que acabou de aparecer: talvez o saque
  let restT = -Infinity; // a última vez que a bola esteve parada (na mão) ou fora de vista

  // ── O ponto ────────────────────────────────────────────────────────────
  let rally = null; // { phase: 'serve'|'play', lastHit, bounces, established, chainOk, shot, serve }
  let over = false;
  let pointEndT = -Infinity;
  let nowT = 0;
  let pending = null; // quina ambígua esperando o lance seguinte
  let watches = []; // voleios em observação (impulso)
  let events = [];

  const emit = (e) => { events.push(e); };
  const endPoint = () => { rally = null; over = true; pointEndT = nowT; };
  /** De que lado da rede é a vez de bater (o outro de quem bateu por último). */
  const expectedSide = () => (rally?.lastHit?.side ? otherSide(rally.lastHit.side) : null);

  /** A bola veio de LONGE de quem bateu desde que estava parada (devolução, não saque). */
  function cameFromAfar(h) {
    const pts = recent.filter((p) => p.t >= Math.max(h.t - o.restWindowS, restT) && p.t <= h.t - 0.08);
    if (!pts.length) return false;
    if (overhead) return pts.some((p) => dist(applyHomography(H, p), h.ground) > o.serveNearM);
    const feetImg = h.entry ? seenFeetImg(h.entry) : [];
    const m = mppX(feetImg.length ? centroid(feetImg) : h.img);
    return pts.some((p) => dist(p, h.img) * m > o.serveNearM);
  }

  /**
   * A pessoa que sacaria: pés atrás (ou quase) de uma linha de fundo, com a
   * bola perto dela desde que estava parada na mão (ou fora de vista) — quicar
   * a bola antes de sacar não muda nada. Logo depois de um ponto nada é saque:
   * é a bola sendo devolvida a quem vai sacar.
   */
  function serveCandidate(h) {
    if (!o.serveRule) return null;
    if (over && h.t - pointEndT < o.serveAfterS) return null;
    let c = null;
    if (h.entry) {
      const pts = h.entry.feet.filter((f) => f.seen).map((f) => f.p);
      if (pts.length) c = centroid(pts);
    } else if (overhead && h.ground) {
      c = h.ground;
    }
    if (!c) return null;
    const { WIDTH: W, LENGTH: L } = COURT;
    if (c.x < -o.serveZoneM || c.x > W + o.serveZoneM) return null;
    let side = null;
    if (c.y <= o.serveZoneM && c.y >= -o.serveDeepM) side = 'A';
    else if (c.y >= L - o.serveZoneM && c.y <= L + o.serveDeepM) side = 'B';
    if (!side || cameFromAfar(h)) return null;
    return { side, at: c };
  }

  /** O pé de quem saca, no instante da batida (7.A). */
  function serveFootVerdict(h, side, at) {
    const fallbackHalf = at ? (at.x < COURT.WIDTH / 2 ? 'low' : 'high') : null;
    if (!o.serveFootRule || !h.entry) return { half: fallbackHalf, event: null };
    const use = h.entry.feet.filter((f) => f.seen && !f.hidden);
    if (!use.length) return { half: fallbackHalf, event: null };
    const down = use.filter((f) => f.grounded);
    const base = { type: CALL_KIND.SERVE_FOOT, t: h.t, imagePoint: h.img, point: at, serve: true };
    if (!down.length) {
      // Os dois pés no ar é falta (7.A.1.a), mas "apoiado" aqui é "parado" — e
      // o pé que gira no chão também se mexe: revisar.
      return { half: fallbackHalf, event: { ...base, call: VOLLEY_CALL.REVIEW, reason: CALL_REASON.AIRBORNE } };
    }
    const m = serveFootMargin(down.map((f) => ({ x: f.p.x, y: f.p.y, u: f.uxy })), side);
    if (m.uncertaintyM > o.serveFootMaxU) return { half: m.half, event: null };
    return {
      half: m.half,
      event: { ...base, call: decideFault(m.marginM, m.uncertaintyM), reason: m.reason, marginM: m.marginM, depthM: -m.marginM, uncertaintyM: m.uncertaintyM },
    };
  }

  /** O saque foi de verdade (a bola seguiu): sai a marcação do pé; falta encerra o ponto. */
  function confirmServe() {
    const s = rally?.serve;
    if (!s || s.confirmed) return;
    s.confirmed = true;
    if (s.footEvent) {
      emit(s.footEvent);
      if (s.footEvent.call === VOLLEY_CALL.FAULT) endPoint();
    }
  }

  /** Começa a observar o pé de quem voleou. */
  function startWatch(h, certain) {
    if (!h.track) return;
    const e = h.entry;
    const w = {
      t0: h.t, hit: h, track: h.track, certain, img: h.img, point: null, closest: null,
      fault: null, near: null, seenS: 0, lastSeenT: null, progressRef: null, progressT: null, judged: false, provisional: h.provisional,
    };
    if (e) {
      const use = e.feet.filter((f) => f.seen && !f.hidden);
      w.point = use.length ? centroid(use.map((f) => f.p)) : null;
      w.judged = use.length > 0;
      // No instante da batida: pé apoiado na cozinha?
      use.filter((f) => f.grounded).forEach((f) => {
        const { depthM: d, uncertaintyM: u } = kz(f);
        if (d >= u && (!w.fault || d > w.fault.depth)) w.fault = { depth: d, u, reason: CALL_REASON.CONTACT };
        else if (d > -u && (!w.near || d > w.near.depth)) w.near = { depth: d, u, reason: CALL_REASON.CONTACT };
      });
      // Esteve na cozinha e ainda não voltou com os dois pés para fora (11.A.3).
      if (!w.fault && e.before.inside) w.fault = { depth: null, u: null, reason: CALL_REASON.REENTRY };
      else if (!w.fault && e.before.maybe && !w.near) w.near = { depth: null, u: null, reason: CALL_REASON.REENTRY };
    }
    watches.push(w);
  }

  function watchEvent(w, call, extra = {}) {
    return {
      type: CALL_KIND.VOLLEY, t: w.t0, imagePoint: w.img, point: w.point, call, ...extra,
    };
  }

  /** Fecha um voleio: falta, revisar ou sem falta. */
  function finishWatch(w, forcedMaybe = false) {
    if (!w.judged) return null; // esta câmera não viu o pé (a rede esconde, ou fora da imagem)
    const certain = w.certain && !forcedMaybe;
    if (w.fault) {
      return watchEvent(w, certain ? VOLLEY_CALL.FAULT : VOLLEY_CALL.REVIEW, {
        reason: w.fault.reason, depthM: w.fault.depth, uncertaintyM: w.fault.u,
      });
    }
    if (w.near) return watchEvent(w, VOLLEY_CALL.REVIEW, { reason: w.near.reason || CALL_REASON.MOMENTUM, depthM: w.near.depth, uncertaintyM: w.near.u });
    return null;
  }

  function followWatches(t) {
    const keep = [];
    watches.forEach((w) => {
      const tr = w.track;
      const e = tr.lastT === t ? tr.hist[tr.hist.length - 1] : null;
      if (e && t > w.t0) {
        const use = e.feet.filter((f) => f.seen && !f.hidden);
        if (use.length) {
          w.judged = true;
          if (w.lastSeenT != null) w.seenS += Math.min(t - w.lastSeenT, 0.1);
          w.lastSeenT = t;
          use.filter((f) => f.grounded).forEach((f) => {
            const { depthM: d, uncertaintyM: u } = kz(f);
            if (d >= u && (!w.fault || (w.fault.depth != null && d > w.fault.depth))) {
              if (!w.fault) {
                w.fault = { depth: d, u, reason: CALL_REASON.MOMENTUM };
                // O outro lado já bateu de novo: ainda é o embalo do voleio, ou a
                // pessoa foi buscar a bola (entrar na cozinha para a bola que quica
                // vale)? Revisar. Com a bola morta, sem batida nova, segue falta (9.B.1).
                if (rally && rally.lastHit !== w.hit) w.certain = false;
              }
            } else if (d > -u && (!w.near || (w.near.depth != null && d > w.near.depth + (w.near.reason === CALL_REASON.CONTACT ? u / 2 : 0)))) {
              // o pé parado na linha oscila no detector: só é "embalo" se foi mais fundo de verdade
              w.near = { depth: d, u, reason: CALL_REASON.MOMENTUM };
            }
          });
          const out = -kitchenDepth(centroid(use.map((f) => f.p)));
          // Ainda avançando para a cozinha (mais que o tremor do detector)? O
          // impulso segue. Parado ou andando de lado não é impulso para lá — e
          // "parado" pelo pé apoiado engana: o pé que anda ao longo da quadra
          // quase não se mexe na imagem da câmera do fundo.
          if (w.progressRef == null || out <= w.progressRef - o.progressM) { w.progressRef = out; w.progressT = t; }
          w.closest = w.closest == null ? out : Math.min(w.closest, out);
          // recuou: o impulso para a cozinha acabou, e voltar depois é outro movimento
          w.retreated = w.retreated || out - w.closest >= o.retreatM;
        }
      }
      // Falta certa sai na hora (se o voleio não está em dúvida).
      if (w.fault && w.certain && !w.provisional) {
        emit(finishWatch(w));
        endPoint();
        return;
      }
      const elapsed = t - w.t0;
      // Sem avançar por `balanceS` — medido até o último quadro em que o pé foi
      // visto: o pé escondido não fecha o voleio sozinho.
      const settled = (w.progressT != null && w.lastSeenT - w.progressT >= o.balanceS) || w.retreated;
      if ((elapsed >= o.momentumS && settled) || elapsed >= o.momentumMaxS) {
        if (w.provisional) { w.done = true; keep.push(w); return; }
        const ev = finishWatch(w);
        if (ev) emit(ev);
        else if (w.judged) {
          const coverage = w.seenS / Math.max(elapsed, 1e-6);
          emit(coverage >= o.minCoverage
            ? watchEvent(w, VOLLEY_CALL.CLEAN)
            : watchEvent(w, VOLLEY_CALL.REVIEW, { reason: CALL_REASON.UNSEEN }));
        }
        if (ev?.call === VOLLEY_CALL.FAULT) endPoint();
        return;
      }
      keep.push(w);
    });
    watches = keep;
  }

  /** O voleio provisório (quina ambígua) foi resolvido. */
  function settleWatch(w, wasHit) {
    watches = watches.filter((x) => x !== w);
    if (!wasHit) return;
    w.provisional = false;
    if (w.done) {
      const ev = finishWatch(w);
      if (ev) { emit(ev); if (ev.call === VOLLEY_CALL.FAULT) endPoint(); } else if (w.judged) emit(watchEvent(w, VOLLEY_CALL.CLEAN));
      return;
    }
    watches.push(w);
  }

  // ── Batida ─────────────────────────────────────────────────────────────
  function startServe(h, sc) {
    const v = serveFootVerdict(h, sc.side, sc.at);
    const feetImg = h.entry ? seenFeetImg(h.entry) : [];
    over = false;
    rally = {
      phase: 'serve', lastHit: h, bounces: 0, bounceSide: null, established: true, chainOk: true, allSeen: true, shot: 1, eventT: h.t,
      serve: {
        side: sc.side, at: sc.at, half: v.half, footEvent: v.event, confirmed: false, t: h.t,
        img: h.img, ground: h.ground || null, scale: mppX(feetImg.length ? centroid(feetImg) : h.img),
      },
    };
  }

  /** A bola já foi para longe de quem sacou: o saque aconteceu (não era a bola sendo quicada). */
  function serveTravelled(b) {
    const s = rally.serve;
    if (overhead) return Boolean(s.ground) && dist(applyHomography(H, b), s.ground) >= o.serveNearM;
    return dist(b, s.img) * s.scale >= o.serveNearM;
  }

  function applyHit(h) {
    const side = h.track?.side || h.groundSide || h.side || null;
    h.side = side;
    // Fora de jogo (antes do saque, ou ponto encerrado): só um saque começa. A
    // câmera que não vê o saque começa a acompanhar um tempo depois do ponto.
    if (!rally) {
      const sc = h.serveFrom ? { side: h.serveFrom, at: null } : serveCandidate(h);
      if (sc) startServe(h, sc);
      else if (!over || h.t - pointEndT >= o.serveAfterS) {
        rally = {
          phase: 'play', lastHit: h, bounces: 0, bounceSide: null, established: false, chainOk: true, allSeen: false,
          shot: null, serve: null, eventT: h.t,
        };
      }
      sinceEvent(h.t);
      return;
    }
    const seenPrev = rally.lastHit;
    if (seenPrev?.side && side && side === seenPrev.side) {
      // Batidas se alternam de lado. Do mesmo lado de novo, sem quique, não é batida.
      if (rally.bounces === 0) {
        if (rally.phase === 'serve' && serveCandidate(h)) {
          // Quem ia sacar quicou a bola na raquete e agora saca de verdade.
          rally = null;
          applyHit(h);
          return;
        }
        if (h.bounceData && !h.bounceData.hidden) applyBounce(h.bounceData, { soft: h.bodyOnly });
        else rally.chainOk = false;
        return;
      }
      // Quicou do outro lado e este lado bate de novo: alguém de lá devolveu sem esta câmera ver.
      if (rally.bounceSide && rally.bounceSide !== side) missedHit(rally.bounceSide);
    }
    const isVolley = rally.bounces === 0;
    // O quique suave que o motor talvez não viu só importa se foi do lado de quem bate.
    const soft = softB && softB.t > rally.eventT + 0.05 && softB.t < h.t - 0.05 && (!side || !softB.side || softB.side === side);
    const certain = isVolley && rally.chainOk && h.certain && gapMax <= o.continuityS && !soft;
    if (rally.phase === 'serve') {
      // A devolução do saque: o saque foi de verdade.
      confirmServe();
      if (!rally) { sinceEvent(h.t); return; }
      rally.phase = 'play';
    }
    if (rally.shot != null) rally.shot += 1;
    if (!rally.established && seenPrev?.side && side && side !== seenPrev.side) rally.established = true;
    // Devolver o saque ou a 3ª bola sem quicar (10.A) só com todas as batidas à vista.
    if (o.twoBounceRule && isVolley && certain && rally.allSeen && (rally.shot === 2 || rally.shot === 3)) {
      emit({
        type: CALL_KIND.TWO_BOUNCE, t: h.t, imagePoint: h.img, point: h.track ? centroidOf(h) : null,
        call: VOLLEY_CALL.FAULT, reason: rally.shot === 2 ? CALL_REASON.RETURN : CALL_REASON.THIRD, shot: rally.shot,
      });
      endPoint();
      sinceEvent(h.t);
      return;
    }
    if (isVolley && rally.established) startWatch(h, certain);
    rally.lastHit = h;
    rally.bounces = 0;
    sinceEvent(h.t);
  }

  const centroidOf = (h) => {
    const pts = (h.entry?.feet || []).filter((f) => f.seen).map((f) => f.p);
    return pts.length ? centroid(pts) : null;
  };

  /**
   * Um lance explicado (batida ou quique): o que vem depois conta a partir dele —
   * o maior buraco no rastro e se houve alguma mudança de direção sem explicação.
   */
  function sinceEvent(t) {
    gapMax = 0;
    if (rally) { rally.chainOk = true; rally.eventT = t; }
  }

  // ── Quique ─────────────────────────────────────────────────────────────
  function bounceEvent(b, target, serveHalf, extra = {}, serve = false) {
    const m = landingMargin(b.p, { target, serveHalf, serve, patchM: o.contactPatchM, u: b.uxy });
    return {
      type: CALL_KIND.BOUNCE, t: b.t, call: decide(m.marginM, m.uncertaintyM), reason: m.reason,
      marginM: m.marginM, uncertaintyM: m.uncertaintyM, point: b.p, imagePoint: b.img, serve, ...extra,
    };
  }

  /**
   * @param {object} b o quique
   * @param {{ soft?: boolean }} [opts] `soft`: a quina pode ter sido a bola no
   *   corpo de alguém — "fora" vira "revisar"
   */
  /**
   * A bola caiu do lado de quem bateu: não passou da rede (ou saiu mal batida)
   * se foi logo — ou um pouco depois, perto da rede. Mais tarde que isso, alguém
   * do outro lado devolveu e esta câmera não viu (a batida longe, ou escondida).
   */
  function ownSideIsNet(b, hitT) {
    if (hitT == null) return false;
    const dt = b.t - hitT;
    return dt <= o.netBallS || (dt <= o.netLateS && Math.abs(b.p.y - COURT.NET_Y) <= o.netZoneM);
  }

  /** Alguém do lado `side` bateu sem esta câmera ver: o ponto segue, sem a certeza da sequência. */
  function missedHit(side) {
    rally.phase = 'play';
    rally.lastHit = { side, t: null, inferred: true };
    if (rally.shot != null) rally.shot += 1;
    rally.allSeen = false;
    rally.bounces = 0;
  }

  /**
   * @param {object} b o quique
   * @param {{ soft?: boolean }} [opts] `soft`: a quina pode ter sido a bola no
   *   corpo de alguém — "fora" vira "revisar"
   */
  function applyBounce(b, { soft = false } = {}) {
    if (!rally) return; // fora de jogo: antes do saque não há marcação (7.D.4)
    const careful = (ev) => (soft && ev.call === LINE_CALL.OUT ? { ...ev, call: LINE_CALL.REVIEW } : ev);
    const bSide = courtSide(b.p);
    if (rally.phase === 'serve') {
      const s = rally.serve;
      const boxHalf = s.half ? (s.half === 'low' ? 'high' : 'low') : null;
      if (bSide === s.side) {
        // Logo, perto de quem sacou: ele quicou a bola (ensaio, saque de quique) — não era o saque.
        if (s.at && b.t - s.t <= o.netBallS && dist(b.p, s.at) < o.dropZoneM) { rally = null; return; }
        confirmServe();
        if (!rally) return;
        if (ownSideIsNet(b, s.t)) {
          // A margem é a da REDE (a conta de quique de jogo, com a linha da rede);
          // `serve: true` só marca o lance. Fora mesmo perto da fita, sem
          // "revisar": o saque que mal passa a rede cai na cozinha de lá, que no
          // saque também é fora (curta, 7.E).
          const ev = bounceEvent(b, otherSide(s.side), null, { shot: 1, serve: true });
          emit(careful({ ...ev, call: LINE_CALL.OUT, reason: CALL_REASON.NET }));
          endPoint();
          return;
        }
        // Tarde demais para ser o saque na rede: o saque passou e voltou devolvido.
        missedHit(otherSide(s.side));
      } else {
        confirmServe();
        if (!rally) return;
        const ev = careful(bounceEvent(b, bSide, boxHalf, { shot: 1 }, true));
        emit(ev);
        if (ev.call === LINE_CALL.OUT) { endPoint(); return; }
        rally.phase = 'play';
        rally.bounces = 1;
        rally.bounceSide = bSide;
        sinceEvent(b.t);
        return;
      }
    }
    if (!rally.established) {
      rally.bounces += 1;
      rally.bounceSide = bSide;
      sinceEvent(b.t);
      return;
    }
    if (rally.bounces >= 1) {
      // 2º quique do mesmo lado: o ponto acabou, sem marcação (10.B.1). Do outro
      // lado: alguém de lá devolveu sem esta câmera ver — é o 1º quique dessa batida.
      if (bSide === rally.bounceSide) { endPoint(); return; }
      missedHit(rally.bounceSide);
    }
    let hitter = rally.lastHit;
    let target = hitter?.side ? otherSide(hitter.side) : null;
    if (target && bSide !== target) {
      const quick = hitter.t != null && b.t - hitter.t <= o.netBallS;
      // Logo, ao pé de quem bateu: a "batida" pode ter sido a bola no corpo (a
      // falta é de quem foi atingido, 10.C.3) — encerra sem marcação.
      const at = centroidOf(hitter) || hitter.ground || null;
      if (quick && at && dist(b.p, at) < o.dropZoneM) { endPoint(); return; }
      if (ownSideIsNet(b, hitter.t)) {
        // Com a sequência à vista, o alvo é o lado de lá e a margem é a da REDE:
        // fora só quando é certo. Colada na fita, dentro da incerteza, é revisar —
        // a bola de jogo que mal passa a rede cai DENTRO, na cozinha de lá (só no
        // saque ela é curta, 7.E), e revisar sem decisão segue em jogo (8.D).
        // Sem a sequência, não dá para dizer quem bateu: vale a quadra toda.
        const ev = careful(bounceEvent(b, rally.chainOk ? target : null, null, { shot: rally.shot }));
        emit(ev);
        rally.bounces = 1;
        rally.bounceSide = bSide;
        sinceEvent(b.t);
        if (ev.call === LINE_CALL.OUT) endPoint();
        return;
      }
      missedHit(target);
      hitter = rally.lastHit;
      target = otherSide(hitter.side);
    }
    const ev = careful(bounceEvent(b, target, null, { shot: rally.shot }));
    emit(ev);
    rally.bounces = 1;
    rally.bounceSide = bSide;
    sinceEvent(b.t);
    if (ev.call === LINE_CALL.OUT) endPoint();
  }

  // ── Quina ambígua: esperar o lance seguinte ────────────────────────────
  function startPending(kk) {
    pending = kk;
    kk.provisional = true;
    // O pé de quem talvez voleou: observar desde já (o instante da batida passa).
    if (rally && rally.bounces === 0 && rally.established && kk.track) {
      const before = watches.length;
      startWatch({ ...kk, provisional: true }, false);
      kk.watch = watches.length > before ? watches[watches.length - 1] : null;
    }
  }

  /** `sure`: a mesma pessoa bateu logo depois — foi quique, não bola no corpo. */
  function settlePending(asHit, sure = false) {
    const p = pending;
    pending = null;
    if (asHit) {
      if (p.watch) watches = watches.filter((x) => x !== p.watch);
      const hit = { ...p, provisional: false, certain: p.highWrist && !p.bodyOnly };
      const hadRally = rally;
      applyHit(hit);
      // O voleio que já vinha sendo observado continua (com o que já viu).
      if (p.watch && hadRally && rally && rally.lastHit === hit) {
        const fresh = watches[watches.length - 1];
        if (fresh && fresh.track === p.watch.track && fresh.t0 === p.t) {
          Object.assign(fresh, {
            fault: fresh.fault || p.watch.fault, near: fresh.near || p.watch.near, seenS: p.watch.seenS,
            lastSeenT: p.watch.lastSeenT, progressRef: p.watch.progressRef, progressT: p.watch.progressT, judged: fresh.judged || p.watch.judged,
            closest: p.watch.closest, retreated: p.watch.retreated,
          });
          if (p.watch.done) {
            watches.pop();
            const ev = finishWatch(fresh);
            if (ev) { emit(ev); if (ev.call === VOLLEY_CALL.FAULT) endPoint(); } else if (fresh.judged) emit(watchEvent(fresh, VOLLEY_CALL.CLEAN));
          }
        }
      }
      return;
    }
    if (p.watch) settleWatch(p.watch, false);
    if (p.bounceData && !p.bounceData.hidden) applyBounce(p.bounceData, { soft: p.bodyOnly && !sure });
  }

  /**
   * Depois da quina ambígua a bola foi vista do outro lado da rede: foi batida
   * (quique nunca devolve a bola por cima da rede). A projeção no chão de uma
   * bola no ar cai mais longe da câmera — erra para "passou", e por isso só a
   * última posição vista conta: o quique alto deste lado já teria descido.
   */
  function wentOver(p) {
    const side = p.track?.side;
    if (!side) return false;
    const after = recent.filter((q) => q.t > p.t + 0.1);
    if (!after.length) return false;
    return courtSide(applyHomography(H, after[after.length - 1])) !== side;
  }

  function resolvePending(next) {
    if (!pending) return;
    const p = pending;
    let asHit = true;
    let sure = false;
    if (next && next.t - p.t <= o.resolveS) {
      // Só o PUNHO conta como prova de que a mesma pessoa (ou a dupla dela) bateu de
      // novo: da câmera de fundo, a bola que quica longe aparece "à altura do corpo"
      // de quem está mais perto, na frente dela.
      // No saque, a dupla de quem saca nunca bate depois dele: lá vale só a mesma pessoa.
      const team = rally?.phase !== 'serve' && next.track?.side && next.track.side === p.track?.side;
      const sameHitter = (next.kind === 'hit' || next.kind === 'ambiguous') && !next.bodyOnly
        && ((next.track && p.track && next.track.id === p.track.id) || team);
      const bounceSameSide = next.kind === 'bounce' && next.bounceData && p.track?.side && courtSide(next.bounceData.p) === p.track.side;
      if (sameHitter || bounceSameSide) asHit = false;
      sure = sameHitter;
    } else {
      // Nada mais que esta câmera visse: batida se a bola foi para o outro lado
      // (o lance de lá ficou longe ou atrás da rede); senão quicou e saiu de cena.
      asHit = wentOver(p);
    }
    settlePending(asHit, sure);
  }

  /** O que fazer com uma quina já classificada. */
  function onKink(kk) {
    if (pending) resolvePending(kk);
    if (kk.kind === 'ambiguous') { startPending(kk); return; }
    if (kk.kind === 'hit') applyHit(kk);
    else if (kk.kind === 'bounce') applyBounce(kk.bounceData);
    else if (rally) rally.chainOk = false;
  }

  /** O quique visto em `k`, a bola chegando a `vImg` (px/s): o erro do instante é um quarto de quadro. */
  function bounceDataAt(k, vImg, dt) {
    const g = applyHomography(H, k);
    const { p, d, iso } = lift(g, o.ballHeightM);
    const g1 = applyHomography(H, { x: k.x + (vImg.x * dt) / 4, y: k.y + (vImg.y * dt) / 4 });
    const move = { x: Math.abs(g1.x - g.x), y: Math.abs(g1.y - g.y) };
    const uxy = axisU(k, o.ballPx, [o.calibrationM, iso], d, move);
    return { t: k.t, p, uxy, img: { x: k.x, y: k.y }, hidden: hidden(p, o.ballNetMarginM) };
  }

  /** A direção da linha da quadra (comprimento) na imagem, naquele ponto. */
  function alongDir(k) {
    if (!G) return { s: 0, dir: { x: 0, y: 1 } };
    const g = applyHomography(H, k);
    const a = applyHomography(G, g);
    const b = applyHomography(G, { x: g.x, y: g.y + 0.1 });
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const n = Math.hypot(dx, dy) || 1;
    return { s: Math.abs(dx / n), dir: { x: dx / n, y: dy / n } };
  }

  /** Reta de mínimos quadrados no tempo: a posição no instante médio e a velocidade. */
  function fitLine(pts) {
    const n = pts.length;
    const tm = pts.reduce((s, p) => s + p.t, 0) / n;
    const xm = pts.reduce((s, p) => s + p.x, 0) / n;
    const ym = pts.reduce((s, p) => s + p.y, 0) / n;
    let stt = 0;
    let stx = 0;
    let sty = 0;
    pts.forEach((p) => {
      const dt = p.t - tm;
      stt += dt * dt; stx += dt * (p.x - xm); sty += dt * (p.y - ym);
    });
    return { t: tm, x: xm, y: ym, v: stt > 0 ? { x: stx / stt, y: sty / stt } : { x: 0, y: 0 } };
  }
  const lineAt = (f, t) => ({ x: f.x + f.v.x * (t - f.t), y: f.y + f.v.y * (t - f.t) });

  /** Um lado da quina: três pontos se cabem numa reta (menos ruído), senão os dois mais perto dela. */
  function sideFit(pts, nearEnd, tol) {
    if (pts.length >= 3) {
      const f = fitLine(pts);
      if (pts.every((p) => dist(lineAt(f, p.t), p) <= tol)) return f;
      return fitLine(nearEnd === 'end' ? pts.slice(-2) : pts.slice(0, 2));
    }
    return fitLine(pts);
  }

  /** Onde as duas retas (antes e depois da quina) passam mais perto uma da outra, entre `lo` e `hi`. */
  function meet(f0, f1, lo, hi) {
    const B = { x: f0.v.x - f1.v.x, y: f0.v.y - f1.v.y };
    const A = {
      x: f0.x - f0.v.x * f0.t - (f1.x - f1.v.x * f1.t),
      y: f0.y - f0.v.y * f0.t - (f1.y - f1.v.y * f1.t),
    };
    const bb = B.x * B.x + B.y * B.y;
    let t = bb > 1e-9 ? -(A.x * B.x + A.y * B.y) / bb : (lo + hi) / 2;
    t = Math.min(Math.max(t, lo), hi);
    const p = lineAt(f0, t);
    const q = lineAt(f1, t);
    return { t, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  }

  const groundOf = (p) => ({ ...applyHomography(H, p), t: p.t, img: p });

  /**
   * A quina é a janela de quatro pontos com a MAIOR mudança de velocidade: a
   * primeira que passa do limiar costuma ter a quina entre o 3º e o 4º ponto,
   * e medir ali erraria o lugar em até um quadro inteiro (25 cm numa bola a
   * 15 m/s). Por isso a candidata espera o quadro seguinte e fica com a maior.
   */
  function scanKink() {
    // De cima o quique muda pouco a velocidade (centímetros por pixel): a
    // velocidade sai de dois quadros, com metade do ruído.
    const span = overhead ? 2 : 1;
    if (track.length < 2 * span + 2) return;
    const raw = track.slice(-(2 * span + 2));
    const pts = overhead ? raw.map(groundOf) : raw;
    const vin = vel(pts[0], pts[span]);
    const vout = vel(pts[span + 1], pts[2 * span + 1]);
    const b = raw[span];
    const c = raw[span + 1];
    const dv = Math.hypot(vout.x - vin.x, vout.y - vin.y);
    if (kcand) {
      if (b.t === kcand.tc && dv > kcand.dv) { kcand = { dv, tb: b.t, tc: c.t }; return; }
      commitKink();
    }
    if (dv >= (overhead ? o.kinkMS : o.kinkPxS) && b.t > lastKinkT) kcand = { dv, tb: b.t, tc: c.t };
  }

  /** Mede a quina candidata com até três pontos de cada lado e decide o que ela foi. */
  function commitKink() {
    const k = kcand;
    kcand = null;
    if (!k) return;
    const prevT = lastKinkT;
    lastKinkT = k.tc;
    const pre = track.filter((p) => p.t <= k.tb && p.t >= prevT).slice(-3);
    const post = track.filter((p) => p.t >= k.tc).slice(0, 3);
    if (pre.length < 2 || post.length < 2) {
      // logo depois de outra quina: vale a janela de quatro, como ela é
      const all = track.filter((p) => p.t >= k.tb - 0.2);
      const i = all.findIndex((p) => p.t === k.tb);
      if (i < 1 || i + 2 >= all.length) return;
      pre.splice(0, pre.length, all[i - 1], all[i]);
      post.splice(0, post.length, all[i + 1], all[i + 2]);
    }
    if (overhead) kinkOverhead(k, pre, post);
    else if (kinkImage(k, pre, post) === false) lastKinkT = prevT; // não era quina
  }

  /** Câmera de lado ou de trás: quique, batida ou dúvida. */
  function kinkImage(kc, pre, post) {
    const f0 = sideFit(pre, 'end', 2.5 * o.ballPx);
    const f1 = sideFit(post, 'start', 2.5 * o.ballPx);
    const vin = f0.v;
    const vout = f1.v;
    const dvx = vout.x - vin.x;
    const dvy = vout.y - vin.y;
    const dvm = Math.hypot(dvx, dvy);
    const speed = Math.hypot(vin.x, vin.y);
    // Para baixo e pouco perto da velocidade: a perspectiva e a gravidade, não uma quina.
    if (dvy >= 0.7 * dvm && dvm <= o.smoothRatePerS * (f1.t - f0.t) * Math.max(speed, Math.hypot(vout.x, vout.y))) return false;
    const k = meet(f0, f1, kc.tb, kc.tc);
    const sep = alongDir(k);
    const side = sep.s >= o.alongSepMin;
    let near = wristNear(k);
    if (!near && !side) near = bodyNear(k, expectedSide());
    // Quique: a MUDANÇA de velocidade aponta para cima na imagem. O sinal de antes e
    // de depois não diz nada: vista do fundo, a bola que vem para a câmera segue
    // descendo na imagem depois de quicar (só mais devagar), e a que vai para longe
    // já subia antes.
    const bounceSig = dvy <= -0.7 * dvm;
    const bounceData = bounceSig ? bounceDataAt(k, vin, kc.tc - kc.tb) : null;
    let kind;
    if (side) {
      const pin = dot(vin, sep.dir);
      const pout = dot(vout, sep.dir);
      const rev = pin * pout < 0 && Math.abs(pin) >= o.alongMinPxS && Math.abs(pout) >= o.alongMinPxS;
      // de quase parada (ao longo da quadra) a rápida, ao lado de um punho: o saque, ou a bola levantada e batida
      const launch = Boolean(near) && Math.abs(pout) >= 3 * o.alongMinPxS
        && Math.abs(pin) < Math.max(o.alongMinPxS, Math.abs(pout) / 3);
      kind = rev || launch ? 'hit' : bounceSig ? 'bounce' : 'other';
    } else {
      kind = near ? (bounceSig ? 'ambiguous' : 'hit') : bounceSig ? 'bounce' : 'other';
    }
    if (kind === 'bounce' && bounceData.hidden) kind = 'other';
    // Se fosse quique, seria num chão que a rede esconde desta câmera: foi a batida.
    if (kind === 'ambiguous' && bounceData.hidden) kind = 'hit';
    const wh = near ? wristHeightM(near) : null;
    const bodyOnly = Boolean(near?.body);
    const kk = {
      kind, t: k.t, img: { x: k.x, y: k.y }, track: near?.tr || null, entry: near?.e || null, bounceData, bodyOnly,
      // Batida CERTA só sem a marca do quique, ou com o punho alto. Também na
      // câmera de lado: a bola que quica e é batida logo em seguida (meia-volta)
      // vira UMA quina que volta — e a cozinha só vale no voleio (11.A).
      certain: kind === 'hit' && !bodyOnly && (!bounceSig || (wh != null && wh >= o.wristHighM)),
      highWrist: wh != null && wh >= o.wristHighM,
      groundSide: kind === 'hit' && !near ? courtSide(toGround(k, 1).p) : null,
    };
    onKink(kk);
  }

  /**
   * Câmera de cima: ela não vê a altura, e a altura MEXE no rastro — a bola que
   * sobe parece se afastar do centro da imagem (de baixo da câmera), a que desce
   * parece se aproximar. Por isso, longe do centro:
   * · o quique (desce e volta a subir) faz a bola "pular" para FORA do centro, ou
   *   só frear um pouco — nunca parar;
   * · a batida inverte o rumo, ou — quando a bola sobe muito logo depois — parece
   *   PARAR: o "voltar" e o "subir" se anulam vistos de cima.
   * Perto do centro (embaixo da câmera) a altura quase não aparece, e o quique é
   * só a freada sem mudar de rumo. Bem embaixo da rede, a "freada" é a bola na fita.
   */
  function kinkOverhead(kc, pre, post) {
    const f0 = sideFit(pre.map(groundOf), 'end', 0.15);
    const f1 = sideFit(post.map(groundOf), 'start', 0.15);
    const vin = f0.v;
    const vout = f1.v;
    const sin = Math.hypot(vin.x, vin.y);
    const sout = Math.hypot(vout.x, vout.y);
    const cos = (vin.x * vout.x + vin.y * vout.y) / ((sin * sout) || 1);
    // No chão as duas retas são quase a mesma: onde se encontram é onde a bola freou.
    const m = meet(f0, f1, kc.tb, kc.tc);
    const bImg = pre[pre.length - 1];
    const cImg = post[0];
    const img = { t: m.t, x: (bImg.x + cImg.x) / 2, y: (bImg.y + cImg.y) / 2 };
    const r = { x: m.x - cam.x, y: m.y - cam.y };
    const dv = { x: vout.x - vin.x, y: vout.y - vin.y };
    const rn = Math.hypot(r.x, r.y);
    const far = rn >= o.overheadNearM;
    const outward = far && dot(dv, r) >= 0.6 * rn * Math.hypot(dv.x, dv.y);
    const stopped = far && !outward && sout < 0.5 * sin;
    if (cos < 0 || stopped || (sin < o.launchSlowMS && sout > o.launchFastMS)) {
      const at = { x: m.x, y: m.y };
      onKink({ kind: 'hit', t: m.t, img, track: null, entry: null, ground: at, groundSide: courtSide(at), certain: false });
      return;
    }
    if (cos < 0.7 || Math.abs(m.y - COURT.NET_Y) < o.netCordM) return;
    // Longe do centro, só o "pulo para fora" é quique: a gravidade puxa o rastro
    // sempre para DENTRO, e freada sem o pulo é ruído (ou a bola caindo).
    if (far ? !outward : sout > sin * (1 - o.bounceSlowdown)) return;
    const { p, d, iso } = lift({ x: m.x, y: m.y }, o.ballHeightM);
    const s = (kc.tc - kc.tb) / 4;
    const uxy = axisU(bImg, o.ballPx, [o.calibrationM, iso], d, { x: Math.abs(vin.x) * s, y: Math.abs(vin.y) * s });
    onKink({ kind: 'bounce', t: m.t, img, bounceData: { t: m.t, p, uxy, img, hidden: false } });
  }

  /**
   * A bola APARECEU (estava parada na mão, ou fora de cena) e já está em
   * movimento: o saque cuja batida a câmera não pegou.
   */
  function serveFromStart(s) {
    if (rally || !o.serveRule) return;
    const k = { t: s.t, x: s.x, y: s.y };
    if (overhead) {
      const at = applyHomography(H, k);
      const h = { kind: 'hit', t: k.t, img: { x: k.x, y: k.y }, track: null, entry: null, ground: at, groundSide: courtSide(at), certain: false };
      if (serveCandidate(h)) onKink(h);
      return;
    }
    const near = wristNear(k);
    if (near) {
      const h = { kind: 'hit', t: k.t, img: { x: k.x, y: k.y }, track: near.tr, entry: near.e, bounceData: null, certain: false, highWrist: false };
      if (serveCandidate(h)) onKink(h);
      return;
    }
    // Câmera de lado sem ver quem saca: a 1ª bola depois da quadra parada, indo
    // de um fundo para o outro, é o saque daquele lado.
    if (!s.quiet) return;
    const sep = alongDir(k);
    if (sep.s < o.alongSepMin || track.length < 3) return;
    const [p0, , p2] = track.slice(-3);
    const along = dot(vel(p0, p2), sep.dir);
    if (Math.abs(along) < 3 * o.alongMinPxS) return;
    const from = along > 0 ? 'A' : 'B'; // indo para +y no chão: saiu do lado A
    onKink({
      kind: 'hit', t: k.t, img: { x: k.x, y: k.y }, track: null, entry: null, bounceData: null,
      certain: false, highWrist: false, side: from, serveFrom: from,
    });
  }

  /**
   * Uma virada para cima mais suave que uma quina: talvez um quique que o motor
   * não viu. A gravidade e a perspectiva só empurram a bola para BAIXO na imagem;
   * para cima, só o chão ou a raquete.
   */
  function softBounce() {
    if (track.length < 5) return;
    const [a, , c, , e] = track.slice(-5);
    const v1 = (c.y - a.y) / (c.t - a.t);
    const v2 = (e.y - c.y) / (e.t - c.t);
    if (v2 - v1 < -2 * o.softBouncePxS) softB = { t: c.t, side: courtSide(toGround(c, o.ballHeightM).p) };
  }

  /** A bola parada (na mão de quem vai sacar) nos últimos `restS`. */
  function atRest(t) {
    const pts = recent.filter((p) => p.t >= t - o.restS);
    if (pts.length < 3 || pts[0].t > t - o.restS * 0.8) return false;
    if (overhead) {
      const g0 = applyHomography(H, pts[0]);
      return pts.every((p) => dist(applyHomography(H, p), g0) <= o.restM);
    }
    const m = mppX(pts[0]);
    return pts.every((p) => dist(p, pts[0]) * m <= o.restM);
  }

  return {
    /**
     * @param {{ t: number, ball: {x:number,y:number}|null,
     *   players?: Array<{ feet: Array<{x,y,v?}>, wrists: Array<{x,y}> }> }} frame
     *   `t` em segundos; coordenadas em pixels da imagem. `feet` na ordem do
     *   detector: calcanhar esquerdo, calcanhar direito, ponta esquerda, ponta direita.
     * @returns {Array<object>} marcações novas
     */
    push(frame) {
      events = [];
      nowT = frame.t;
      updateTracks(frame.t, frame.players);
      if (frame.ball) {
        const gap = frame.t - lastBallT;
        if (gap >= o.startGapS) restT = frame.t; // estava fora de vista: na mão, no bolso
        if (gap > o.rallyGapS) {
          commitKink();
          if (pending) resolvePending(null);
          track = [];
          rally = null;
          over = false;
        }
        if (lastBallT > -Infinity) gapMax = Math.max(gapMax, gap);
        if (!track.length) start = gap > o.startGapS ? { t: frame.t, x: frame.ball.x, y: frame.ball.y, quiet: gap > o.rallyGapS, n: 0 } : null;
        lastBallT = frame.t;
        track.push({ t: frame.t, x: frame.ball.x, y: frame.ball.y });
        if (track.length > 10) track.shift();
        recent.push({ t: frame.t, x: frame.ball.x, y: frame.ball.y });
        recent = recent.filter((p) => frame.t - p.t <= o.restWindowS + 0.2);
        if (atRest(frame.t)) restT = frame.t;
        if (start) {
          start.n += 1;
          if (start.n === 3) { const s = start; start = null; serveFromStart(s); }
        }
        if (!overhead) softBounce();
        scanKink();
      } else if (track.length && frame.t - track[track.length - 1].t > 0.1) {
        commitKink();
        track = []; // buraco no rastro: não liga pontos de antes e depois dele
        start = null;
      }
      if (pending && frame.t - pending.t > o.resolveS) resolvePending(null);
      if (rally?.phase === 'serve' && !rally.serve.confirmed && frame.ball && serveTravelled(frame.ball)) confirmServe();
      followWatches(frame.t);
      return events;
    },

    /** Em que parte do ponto o motor está (para a tela da câmera). */
    state() {
      return {
        phase: rally ? rally.phase : over ? 'over' : 'idle',
        shot: rally?.shot ?? null,
        server: rally?.serve?.side ?? null,
        watching: watches.length,
      };
    },
  };
}
