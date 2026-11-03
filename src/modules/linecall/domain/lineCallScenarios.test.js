/**
 * O motor de linhas jogada a jogada, numa quadra simulada em 3D (`testkit/courtSim.js`):
 * câmeras de verdade, bola com gravidade, a rede que esconde o chão, pés e
 * punhos com ruído. Cada teste é um lance da regra (USA Pickleball 2026) e
 * confere a SEQUÊNCIA inteira do que a câmera marcou — o lance certo e nenhum
 * a mais: marcação falsa no meio do ponto é o pior defeito de um juiz.
 */
import { describe, it, expect } from 'vitest';
import { createLineCallEngine, LINE_CALL, VOLLEY_CALL } from './lineCallEngine.js';
import { COURT } from './court.js';
import { CAMS, ballPath, bounce, player, frames, run } from './testkit/courtSim.js';

const { WIDTH: W, LENGTH: L, NET_Y: N, KITCHEN: K } = COURT;

function play({ cam, ball, players, tail = 3.5, options = {}, seed = 3, lift = true }) {
  const e = createLineCallEngine({ H: cam.H, options: { ...(lift ? { imageSize: cam.size } : {}), ...options } });
  const fr = frames({ cam, ball: ballPath(ball), players, from: ball[0].t - 0.3, to: ball[ball.length - 1].t + tail, seed });
  return run(e, fr);
}
/** Cada marcação numa linha: tipo, decisão, o motivo (quando não é "dentro" nem "sem falta") e a jogada. */
const brief = (ev) => ev.map((e) => {
  const ok = e.call === LINE_CALL.IN || e.call === VOLLEY_CALL.CLEAN;
  return [e.type, e.call, ok ? null : e.reason, e.shot].filter((x) => x != null).join(' ');
});
/** O ponto marcado a menos de 15 cm do de verdade. */
function at(e, x, y) {
  expect(Math.abs(e.point.x - x)).toBeLessThan(0.15);
  expect(Math.abs(e.point.y - y)).toBeLessThan(0.15);
}
/** A raquete, um pouco à frente do punho, na altura `z`. */
const paddle = (pl, t, z = 0.6) => {
  const w = pl.wrist(t);
  return { t, p: [w[0], w[1] + pl.facing * 0.2, z] };
};
/** A bola solta da mão antes do saque. */
const dropBefore = (c, dt = 0.35) => ({ t: c.t - dt, p: [c.p[0], c.p[1], c.p[2] + 0.5] });
/** O quique de verdade: segue o rumo, 20% mais devagar no chão, e sobe com 75% da velocidade com que desceu. */
function rebound(prev, b, dt) {
  const T = b.t - prev.t;
  const vx = (b.p[0] - prev.p[0]) / T;
  const vy = (b.p[1] - prev.p[1]) / T;
  const vz = -0.75 * ((b.p[2] - prev.p[2] + 0.5 * 9.81 * T * T) / T - 9.81 * T);
  return { t: b.t + dt, p: [b.p[0] + 0.8 * vx * dt, b.p[1] + 0.8 * vy * dt, b.p[2] + vz * dt - 0.5 * 9.81 * dt * dt] };
}
/** Depois do último lance a bola segue e some. */
const away = (t, x, y, z = 0.9) => ({ t, p: [x, y, z] });

// Duplas: B saca do fundo de lá (metade alta), A recebe na diagonal (metade baixa).
const four = (o = {}) => ({
  sB: player({ x: 4.6, y: L + 0.34, ...o.sB }),
  pB: player({ x: 1.5, y: N + K + 0.26, ...o.pB }),
  rA: player({ x: 1.3, y: -0.4, ...o.rA }),
  pA: player({ x: 4.5, y: N - K - 0.27, ...o.pA }),
});
const all = (p) => [p.sB, p.pB, p.rA, p.pA];

/** Saque de B: solta, bate e quica em `land`. */
function serveFromB(p, land, flight = 0.9) {
  const c = paddle(p.sB, 0);
  return [dropBefore(c), c, bounce(flight, land[0], land[1])];
}
/** Saque, devolução no fundo de B e a 3ª bola de B. */
function opening(p) {
  return [...serveFromB(p, [1.5, 2.5]), paddle(p.rA, 1.15), bounce(2.25, 4.3, 12.0), paddle(p.sB, 2.5)];
}
/** Um saque de B que quica em `land` e segue. */
function serveB(cam, land, flight = 0.9) {
  const p = four();
  return play({ cam, ball: [...serveFromB(p, land, flight), away(flight + 0.4, land[0], land[1] - 3, 0.9)], players: all(p) });
}
/** O voleio de A na cozinha (com `o` mudando os jogadores), e a bola quicando no fundo de B. */
function volleyA(cam, o) {
  const p = four(o);
  const ball = [...opening(p), paddle(p.pA, 3.2, 0.9), bounce(3.8, 2.0, 11.0), away(4.1, 1.9, 12.5, 0.8)];
  return play({ cam, ball, players: all(p) });
}
/** O saque de A com o pé em `spot`. */
function serveA(spot) {
  const sA = player(spot);
  const c = paddle(sA, 0);
  const ball = [dropBefore(c), c, bounce(1.0, 4.5, 11.0), away(1.3, 4.6, 12.5, 0.8)];
  return play({ cam: CAMS.fundoA(), ball, players: [sA, player({ x: 4.6, y: L + 0.3 })] });
}

describe('um ponto inteiro', () => {
  const p = four();
  const ball = [
    ...opening(p),
    bounce(3.8, 3.5, 5.6),
    paddle(p.pA, 4.1, 0.4),
    bounce(5.0, 1.8, 8.0),
    paddle(p.pB, 5.3, 0.4),
    bounce(6.2, 2.0, -0.6),
    away(6.5, 2.1, -1.8, 0.6),
  ];

  it('do fundo A: cada quique de lá de dentro e o último, longo, fora', () => {
    const ev = play({ cam: CAMS.fundoA(), ball, players: all(p) });
    // o 4º quica na cozinha de lá, que a rede esconde desta câmera: não é dela
    expect(brief(ev)).toEqual(['bounce in 1', 'bounce in 2', 'bounce in 3', 'bounce out long 5']);
    at(ev[3], 2.0, -0.6);
  });

  it('do fundo B: o pé de quem saca, os quiques do lado de lá e o fora longo', () => {
    const ev = play({ cam: CAMS.fundoB(), ball, players: all(p) });
    expect(brief(ev)).toEqual(['serve_foot clean', 'bounce in 2', 'bounce in 4', 'bounce out long 5']);
    at(ev[2], 1.8, 8.0);
    at(ev[3], 2.0, -0.6);
  });

  it('fora pela lateral, na 3ª bola', () => {
    const q = four();
    const ev = play({ cam: CAMS.fundoA(), ball: [...opening(q), bounce(3.8, -0.25, 4.0), away(4.1, -0.9, 2.5, 0.5)], players: all(q) });
    expect(brief(ev)).toEqual(['bounce in 1', 'bounce in 2', 'bounce out wide 3']);
    at(ev[2], -0.25, 4.0);
  });
});

describe('saque (7.E, 8.B, 8.C): a área em diagonal, além da cozinha', () => {
  it('na área é dentro; na cozinha, na metade errada ou além do fundo é fora', () => {
    expect(brief(serveB(CAMS.fundoA(), [1.5, 2.5]))).toEqual(['bounce in 1']);
    expect(brief(serveB(CAMS.fundoA(), [1.5, 5.2], 1.1))).toEqual(['bounce out short 1']);
    expect(brief(serveB(CAMS.fundoA(), [4.5, 2.5]))).toEqual(['bounce out wrong_box 1']);
    expect(brief(serveB(CAMS.fundoA(), [1.5, -0.35], 0.85))).toEqual(['bounce out long 1']);
  });

  it('na linha central é dentro: a central é da área (3.A.4.f), e a câmera de fundo corre ao longo dela', () => {
    const ev = serveB(CAMS.fundoA(), [W / 2, 2.5]);
    expect(ev.map((e) => e.call)).not.toContain(LINE_CALL.OUT);
  });

  it('não passou da rede: fora, e o pé de quem sacou estava limpo', () => {
    const p = four();
    const c = paddle(p.sB, 0);
    const ball = [dropBefore(c), c, { t: 0.6, p: [2.6, N + 0.15, 0.5] }, bounce(0.95, 2.5, N + 0.9), away(1.4, 2.4, N + 1.6, 0.2)];
    expect(brief(play({ cam: CAMS.fundoB(), ball, players: all(p) }))).toEqual(['serve_foot clean', 'bounce out net 1']);
  });

  it('pegou na fita e caiu na área: dentro (o saque que toca a rede não se repete)', () => {
    const p = four();
    const c = paddle(p.sB, 0);
    const ball = [dropBefore(c), c, { t: 0.55, p: [2.4, N + 0.02, 0.93] }, bounce(1.0, 2.0, 3.5), away(1.3, 2.0, 2.2, 0.8)];
    const ev = play({ cam: CAMS.fundoA(), ball, players: all(p) });
    expect(brief(ev)).toEqual(['bounce in 1']);
    at(ev[0], 2.0, 3.5);
  });
});

describe('a linha da cozinha no saque (3.A.4.c, 8.B): quem vê melhor decide', () => {
  // a bola com o centro 2 cm depois da linha (a marca dela pega na linha): curto, mas por pouco
  const touch = [1.5, N - K + 0.02];
  // a bola em cheio na linha (centro 6 cm depois da borda de trás)
  const deep = [1.5, N - K + 0.06];

  it('tocou a linha: nunca "dentro"; a câmera da rede, alinhada com a linha, é quatro vezes mais precisa', () => {
    const [rede] = serveB(CAMS.rede1(), touch, 1.1);
    const [fundo] = serveB(CAMS.fundoA(), touch, 1.1);
    [rede, fundo].forEach((e) => expect(e).toMatchObject({ serve: true, reason: 'short', call: LINE_CALL.REVIEW }));
    expect(rede.uncertaintyM).toBeLessThan(0.05);
    expect(rede.uncertaintyM * 3).toBeLessThan(fundo.uncertaintyM);
  });

  it('em cheio na linha: a da rede crava o curto; a do fundo, que vê a linha de frente, pede revisão', () => {
    expect(brief(serveB(CAMS.rede1(), deep, 1.1))).toEqual(['bounce out short 1']);
    expect(brief(serveB(CAMS.fundoA(), deep, 1.1))).toEqual(['bounce review short 1']);
  });
});

describe('voleio e a cozinha (11.A)', () => {
  it('pé apoiado na cozinha ao volear: falta, e o ponto acaba ali', () => {
    const ev = volleyA(CAMS.fundoA(), { pA: { y: 5.0 } });
    expect(brief(ev)).toEqual(['bounce in 1', 'bounce in 2', 'volley fault contact']);
  });

  it('pé fora da cozinha, parado: sem falta, e o ponto segue', () => {
    expect(brief(volleyA(CAMS.fundoA(), { pA: { y: 3.9 } }))).toEqual(['bounce in 1', 'bounce in 2', 'volley clean', 'bounce in 4']);
  });

  it('o embalo do voleio levou o pé para a cozinha: falta (11.A.2)', () => {
    const ev = volleyA(CAMS.fundoA(), { pA: { y: 4.0, moves: [{ from: 3.25, to: 3.55, dy: 0.8 }] } });
    expect(brief(ev)).toEqual(['bounce in 1', 'bounce in 2', 'volley fault momentum']);
  });

  it('entrar na cozinha DEPOIS de equilibrar, ou depois de recuar, é outro movimento: sem falta', () => {
    const balanced = { pA: { y: 4.0, moves: [{ from: 4.0, to: 4.3, dy: 0.8 }] } };
    const retreat = { pA: { y: 4.0, moves: [{ from: 3.22, to: 3.5, dy: -0.4 }, { from: 3.9, to: 4.2, dy: 1.2 }] } };
    [balanced, retreat].forEach((o) => {
      expect(brief(volleyA(CAMS.fundoA(), o))).toEqual(['bounce in 1', 'bounce in 2', 'volley clean', 'bounce in 4']);
    });
  });

  it('saiu da cozinha pulando e voleou antes de firmar os dois pés fora: falta (11.A.3)', () => {
    const reentry = { pA: { y: 5.2, moves: [{ from: 2.95, to: 3.3, dy: -1.3 }], lift: [{ from: 2.95, to: 3.35, foot: 0, z: 0.3 }, { from: 2.95, to: 3.35, foot: 1, z: 0.3 }] } };
    expect(brief(volleyA(CAMS.fundoA(), reentry))).toEqual(['bounce in 1', 'bounce in 2', 'volley fault reentry']);
  });

  it('pé em cima da linha da cozinha: revisar, e a câmera da rede vê com o dobro da precisão', () => {
    const o = { pA: { y: N - K + 0.02 - 0.14 } }; // a ponta do pé 2 cm na linha
    const a = volleyA(CAMS.fundoA(), o);
    const r = volleyA(CAMS.rede1(), o);
    expect(brief(a)).toEqual(['bounce in 1', 'bounce in 2', 'volley review contact', 'bounce in 4']);
    expect(brief(r)).toEqual(['bounce in 1', 'bounce in 2', 'volley review contact', 'bounce in 4']);
    expect(r[2].uncertaintyM * 1.8).toBeLessThan(a[2].uncertaintyM);
  });

  describe('a cozinha do outro lado', () => {
    const p = four({ pB: { y: N + 1.3 } });
    const ball = [...opening(p), bounce(3.8, 3.5, 5.6), paddle(p.pA, 4.1, 0.4), paddle(p.pB, 4.7, 0.9), bounce(5.4, 3.0, 2.0), away(5.7, 3.1, 0.5, 0.7)];

    it('quem vê (o fundo de lá e a rede) marca a falta; o fundo de cá, com a rede no meio, fica calado', () => {
      const fb = play({ cam: CAMS.fundoB(), ball, players: all(p) });
      expect(brief(fb)).toEqual(['serve_foot clean', 'bounce in 2', 'volley fault contact']);
      at(fb[2], 1.5, 8.0);
      expect(brief(play({ cam: CAMS.rede1(), ball, players: all(p) }))).toEqual(['bounce in 1', 'bounce in 2', 'bounce in 3', 'volley fault contact']);
      const fa = play({ cam: CAMS.fundoA(), ball, players: all(p) });
      expect(fa.filter((e) => e.type === 'volley')).toEqual([]);
    });
  });
});

describe('dois quiques (10.A)', () => {
  it('a devolução de voleio é falta', () => {
    const p = four({ rA: { y: 1.8 } });
    const c = paddle(p.sB, 0);
    const ball = [dropBefore(c), c, paddle(p.rA, 0.75, 0.9), bounce(1.8, 4.3, 12.0), away(2.1, 4.4, 13.5, 0.7)];
    expect(brief(play({ cam: CAMS.fundoA(), ball, players: all(p) }))).toEqual(['two_bounce fault return 2']);
  });

  it('a 3ª bola de voleio é falta', () => {
    const q = four();
    const ball = [...serveFromB(q, [1.5, 2.5]), paddle(q.rA, 1.15), paddle(q.sB, 2.2, 0.9), bounce(3.0, 2.0, 1.5), away(3.3, 1.9, 0.2, 0.7)];
    expect(brief(play({ cam: CAMS.fundoA(), ball, players: all(q) }))).toEqual(['bounce in 1', 'two_bounce fault third 3']);
  });
});

describe('pé no saque (7.A)', () => {
  it('atrás do fundo, entre os prolongamentos: limpo', () => {
    expect(brief(serveA({ x: 1.5, y: -0.3 }))).toEqual(['serve_foot clean', 'bounce in 1']);
  });

  it('na linha de fundo, dentro da quadra, além da lateral ou da central: falta, e o saque nem é julgado', () => {
    expect(brief(serveA({ x: 1.5, y: 0.05 }))).toEqual(['serve_foot fault baseline']);
    expect(brief(serveA({ x: 1.5, y: 0.3 }))).toEqual(['serve_foot fault baseline']);
    expect(brief(serveA({ x: -0.35, y: -0.3 }))).toEqual(['serve_foot fault sideline']);
    expect(brief(serveA({ x: 3.05, y: -0.3 }))).toEqual(['serve_foot fault centerline']);
  });
});

describe('antes e depois do ponto', () => {
  it('quicar a bola antes de sacar não é lance (7.D.4: só o saque começa o ponto)', () => {
    const p = four();
    const w = p.sB.wrist(0);
    const hand = [w[0], w[1] - 0.2];
    const ball = [
      { t: -2.0, p: [hand[0], hand[1], 1.0] }, bounce(-1.55, hand[0], hand[1] + 0.05),
      { t: -1.1, p: [hand[0], hand[1], 1.0] }, bounce(-0.65, hand[0], hand[1] + 0.05),
      { t: -0.35, p: [hand[0], hand[1], 1.1] }, paddle(p.sB, 0),
      bounce(0.9, 1.5, 2.5), paddle(p.rA, 1.15), bounce(2.25, 4.3, 12.6), away(2.6, 4.4, 14.6, 0.5),
    ];
    expect(brief(play({ cam: CAMS.fundoB(), ball, players: all(p) }))).toEqual(['serve_foot clean', 'bounce in 2']);
  });

  it('a bola devolvida depois do fora não é outro lance', () => {
    const q = four();
    const ball = [...serveFromB(q, [1.5, -0.4], 0.85), paddle(q.rA, 1.4, 0.5), bounce(2.4, 4.6, 12.0), away(2.7, 4.6, 13.2, 0.6)];
    expect(brief(play({ cam: CAMS.fundoA(), ball, players: all(q) }))).toEqual(['bounce out long 1']);
  });
});

describe('paralaxe: a bola tem altura, e só o toque no chão conta (8.E)', () => {
  const p = four();
  const ball = [...serveFromB(p, [1.5, 2.5]), paddle(p.rA, 1.15), bounce(2.25, 3.0, L - 0.11), away(2.6, 3.0, L + 1.5, 0.5)];

  it('com a correção de altura o quique cai onde caiu; sem ela, 16 cm adiante — e a incerteza cobre', () => {
    const lifted = play({ cam: CAMS.fundoA(), ball, players: all(p) })[1];
    const raw = play({ cam: CAMS.fundoA(), ball, players: all(p), lift: false })[1];
    expect(Math.abs(lifted.point.y - (L - 0.11))).toBeLessThan(0.03);
    expect(raw.point.y - lifted.point.y).toBeGreaterThan(0.1);
    // de longe (o fundo de lá a 18 m), dentro por 12 cm é "revisar", nunca "fora"
    [lifted, raw].forEach((e) => expect(e).toMatchObject({ call: LINE_CALL.REVIEW, reason: 'long' }));
    // a câmera de lá vê de perto e crava
    expect(brief(play({ cam: CAMS.fundoB(), ball, players: all(p) }))).toEqual(['serve_foot clean', 'bounce in 2']);
  });
});

describe('a câmera de cima', () => {
  const ov = (ball) => play({ cam: CAMS.topo(), ball, players: [], options: { mode: 'overhead' }, lift: false });
  const s0 = { t: 0, p: [4.95, 13.4, 0.6] };
  const toss = { t: -0.35, p: [4.95, 13.4, 1.1] };

  it('um ponto inteiro: os quiques pelo "pulo para fora" do rastro, e o fora longo', () => {
    const b1 = bounce(0.9, 1.5, 2.5);
    const h2 = rebound(s0, b1, 0.25);
    const b2 = bounce(2.25, 4.3, 12.0);
    const h3 = rebound(h2, b2, 0.25);
    const b3 = bounce(3.8, 3.5, 5.6);
    const h4 = rebound(h3, b3, 0.3);
    const b4 = bounce(5.0, 1.8, 8.0);
    const h5 = rebound(h4, b4, 0.3);
    const b5 = bounce(6.2, 2.0, -0.6);
    const ev = ov([toss, s0, b1, h2, b2, h3, b3, h4, b4, h5, b5, rebound(h5, b5, 0.3)]);
    expect(brief(ev)).toEqual(['bounce in 1', 'bounce in 2', 'bounce in 3', 'bounce in 4', 'bounce out long 5']);
    [b1, b2, b3, b4, b5].forEach((b, i) => at(ev[i], b.p[0], b.p[1]));
  });

  it('saque longo e saque curto', () => {
    const long = bounce(0.85, 1.5, -0.35);
    expect(brief(ov([toss, s0, long, rebound(s0, long, 0.3)]))).toEqual(['bounce out long 1']);
    const short = bounce(1.1, 1.5, 5.2);
    expect(brief(ov([toss, s0, short, rebound(s0, short, 0.3)]))).toEqual(['bounce out short 1']);
  });
});
