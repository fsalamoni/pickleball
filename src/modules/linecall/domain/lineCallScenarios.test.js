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
import { CAMS, ballPath, bounce, makeCamera, player, frames, run } from './testkit/courtSim.js';

const { WIDTH: W, LENGTH: L, NET_Y: N, KITCHEN: K } = COURT;

function play({ cam, ball, players, tail = 3.5, options = {}, seed = 3, lift = true, fps = 60 }) {
  const e = createLineCallEngine({ H: cam.H, options: { ...(lift ? { imageSize: cam.size } : {}), ...options } });
  const fr = frames({ cam, ball: ballPath(ball), players, from: ball[0].t - 0.3, to: ball[ball.length - 1].t + tail, seed, fps });
  return run(e, fr);
}
/** Como `play`, com a bola em pedaços: entre um pedaço e o outro ela some (na mão, no bolso). */
function playParts({ cam, parts, players, tail = 3.5, options = {}, seed = 3, lift = true, fps = 60 }) {
  const e = createLineCallEngine({ H: cam.H, options: { ...(lift ? { imageSize: cam.size } : {}), ...options } });
  const paths = parts.map(ballPath);
  const ball = (t) => paths.reduce((b, path) => b || path(t), null);
  const last = parts[parts.length - 1];
  const fr = frames({ cam, ball, players, from: parts[0][0].t - 0.3, to: last[last.length - 1].t + tail, seed, fps });
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
function volleyA(cam, o, fps = 60) {
  const p = four(o);
  const ball = [...opening(p), paddle(p.pA, 3.2, 0.9), bounce(3.8, 2.0, 11.0), away(4.1, 1.9, 12.5, 0.8)];
  return play({ cam, ball, players: all(p), fps });
}
/** As duas taxas de quadros que a tela aceita (30 é o mínimo, 60 o bom). */
const FPS = [30, 60];
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
    const ev = play({ cam: CAMS.fundoB(), ball, players: all(p) });
    expect(brief(ev)).toEqual(['serve_foot clean', 'bounce out net 1']);
    // 🐞 a margem era a da linha da cozinha de lá (3 m): é a distância até a REDE
    expect(Math.abs(ev[1].marginM + 0.9)).toBeLessThan(0.15);
    expect(ev[1].serve).toBe(true);
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

  // pA voleia na linha (a ponta do pé 13 cm atrás) e anda de lado; pB devolve
  // curto, a bola quica na cozinha de A e pA entra para jogar DEPOIS do quique.
  function shuffleThenDink(cam, fps, shuffleTo, pauseS, dx = -0.8) {
    const stepFrom = shuffleTo + pauseS;
    const pA = player({ x: 4.5, y: N - K - 0.27, moves: [{ from: 3.25, to: shuffleTo, dx }, { from: stepFrom, to: stepFrom + 0.25, dy: 0.9 }] });
    const p = { ...four(), pA };
    const ball = [...opening(p), paddle(pA, 3.2, 0.9), paddle(p.pB, 3.75, 0.7), bounce(4.5, 3.75, 5.7), paddle(pA, 4.7, 0.25), bounce(5.6, 2.0, 9.0), away(5.9, 2.0, 10.0, 0.6)];
    return brief(play({ cam: CAMS[cam](), ball, players: all(p), fps }));
  }

  it('andar de lado depois do voleio encerra o impulso: entrar na cozinha para jogar a bola que quicou não é falta (11.A.2)', () => {
    // 🐞 o impulso só acabava com a pessoa PARADA 0,3 s (ou recuando): quem seguia
    // andando de lado levava o voleio aberto até a devolução de lá, e a entrada
    // legal na cozinha virava falta certa de impulso — e o ponto acabava.
    FPS.forEach((fps) => ['fundoA', 'rede1'].forEach((c) => {
      const still = shuffleThenDink(c, fps, 3.25, 0.95, 0);
      expect(still.join()).not.toContain('volley fault');
      [[4.2, 0], [3.9, 0], [3.9, 0.15], [3.6, 0.3]].forEach(([to, pause]) => {
        expect(shuffleThenDink(c, fps, to, pause), `${c} ${fps} q/s, de lado até ${to} s`).toEqual(still);
      });
    }));
  });

  it('o embalo que só chega à cozinha depois da devolução de lá: revisar — ainda é o embalo, ou foi buscar a bola? (11.A.2)', () => {
    FPS.forEach((fps) => ['fundoA', 'rede1'].forEach((c) => {
      const pA = player({ x: 4.5, y: 4.0, moves: [{ from: 3.25, to: 4.25, dy: 0.8 }] });
      const p = { ...four(), pA };
      const ball = [...opening(p), paddle(pA, 3.2, 0.9), paddle(p.pB, 3.75, 0.7), bounce(4.6, 2.0, 2.5), paddle(p.rA, 4.9, 0.5), bounce(5.9, 2.0, 11.0), away(6.2, 2.0, 12.4, 0.6)];
      const ev = brief(play({ cam: CAMS[c](), ball, players: all(p), fps }));
      expect(ev, `${c} ${fps} q/s`).toContain('volley review momentum');
      expect(ev.join()).not.toContain('volley fault');
    }));
  });

  it('o embalo que leva à cozinha com a bola já morta (o 2º quique de lá): falta assim mesmo (11.A.2, 9.B.1)', () => {
    FPS.forEach((fps) => ['fundoA', 'rede1'].forEach((c) => {
      const pA = player({ x: 4.5, y: 4.0, moves: [{ from: 3.25, to: 4.2, dy: 0.8 }] });
      const p = { ...four(), pA };
      const ball = [...opening(p), paddle(pA, 3.2, 0.9), bounce(3.8, 2.0, 10.0), bounce(4.3, 1.9, 11.6), away(4.6, 1.85, 12.5, 0.3)];
      expect(brief(play({ cam: CAMS[c](), ball, players: all(p), fps })), `${c} ${fps} q/s`).toContain('volley fault momentum');
    }));
  });

  it('saiu da cozinha pulando e voleou antes de firmar os dois pés fora: falta (11.A.3)', () => {
    const reentry = { pA: { y: 5.2, moves: [{ from: 2.95, to: 3.3, dy: -1.3 }], lift: [{ from: 2.95, to: 3.35, foot: 0, z: 0.3 }, { from: 2.95, to: 3.35, foot: 1, z: 0.3 }] } };
    expect(brief(volleyA(CAMS.fundoA(), reentry))).toEqual(['bounce in 1', 'bounce in 2', 'volley fault reentry']);
  });

  it('saiu da cozinha e parou com a ponta do pé logo atrás da linha: o mesmo que quem nunca entrou — revisar, nunca falta certa (11.A.3)', () => {
    // 🐞 o estado "na cozinha" não baixava para "talvez": a medida dentro da
    // incerteza virava falta de reentrada certa, e o ponto acabava ali.
    FPS.forEach((fps) => [0.02, 0.06, 0.12].forEach((behind) => {
      const y = N - K - behind - 0.14; // a ponta do pé `behind` atrás da linha
      ['fundoA', 'rede1'].forEach((c) => {
        const back = volleyA(CAMS[c](), { pA: { y: 5.0, moves: [{ from: 2.55, to: 2.85, dy: y - 5.0 }] } }, fps);
        const never = volleyA(CAMS[c](), { pA: { y } }, fps);
        expect(brief(back), `${c} ${fps} q/s, ${behind * 100} cm`).toEqual(brief(never));
        expect(brief(back).join()).not.toContain('volley fault');
      });
    }));
    // pulando para fora, os dois pés ainda no ar na batida: segue falta
    const jump = { pA: { y: 5.2, moves: [{ from: 2.95, to: 3.3, dy: -1.3 }], lift: [{ from: 2.95, to: 3.35, foot: 0, z: 0.3 }, { from: 2.95, to: 3.35, foot: 1, z: 0.3 }] } };
    FPS.forEach((fps) => expect(brief(volleyA(CAMS.fundoA(), jump, fps))).toEqual(['bounce in 1', 'bounce in 2', 'volley fault reentry']));
  });

  it('pé em cima da linha da cozinha: revisar, e a câmera da rede vê com o dobro da precisão', () => {
    const o = { pA: { y: N - K + 0.02 - 0.14 } }; // a ponta do pé 2 cm na linha
    const a = volleyA(CAMS.fundoA(), o);
    const r = volleyA(CAMS.rede1(), o);
    expect(brief(a)).toEqual(['bounce in 1', 'bounce in 2', 'volley review contact', 'bounce in 4']);
    expect(brief(r)).toEqual(['bounce in 1', 'bounce in 2', 'volley review contact', 'bounce in 4']);
    expect(r[2].uncertaintyM * 1.8).toBeLessThan(a[2].uncertaintyM);
  });

  it('na cozinha, a bola quicou e foi batida logo em seguida (meia-volta): não é voleio — nunca falta certa, nem na câmera de lado', () => {
    // 🐞 na câmera da rede toda virada de rumo era batida CERTA, mesmo com a
    // marca do quique e o punho baixo: quique e batida juntos numa quina viravam
    // "voleio" na cozinha — e jogar a bola que quicou na cozinha é permitido (11.A).
    FPS.forEach((fps) => [0.01, 0.02].forEach((gap) => {
      const p = four();
      p.pA = player({ x: 4.5, y: 5.0, wrist: (t) => [4.85, 5.2, t > 3.4 && t < 4.0 ? 0.3 : 0.95] });
      const tb = 3.7;
      const ball = [
        ...serveFromB(p, [1.5, 2.5]), paddle(p.rA, 1.15), bounce(2.25, 4.3, 12.0), { t: 2.5, p: [4.95, L - 0.01, 1.0] },
        bounce(tb, 4.85, 5.5), { t: tb + gap, p: [4.85, 5.5 - 5.3 * gap, 0.037 + 5 * gap - 4.9 * gap * gap] },
        bounce(tb + gap + 1.18, 2.0, 11.0), away(tb + gap + 1.48, 1.9, 12.5, 0.8),
      ];
      ['rede1', 'fundoA'].forEach((c) => {
        const ev = brief(play({ cam: CAMS[c](), ball, players: all(p), fps }));
        expect(ev.join(), `${c} ${fps} q/s, ${gap * 1000} ms`).not.toContain('volley fault');
      });
    }));
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

describe('rede na troca: a bola caiu do lado de quem bateu', () => {
  const netBall = (dy, cam, fps) => {
    const p = four();
    const ball = [...opening(p), bounce(3.8, 3.5, 5.6), paddle(p.pA, 4.1, 0.4), bounce(4.7, 3.0, N + dy), away(4.95, 3.0, N + dy - 0.15, 0.3)];
    return brief(play({ cam: CAMS[cam](), ball, players: all(p), fps })).slice(3);
  };

  it('colada na rede, dentro da incerteza: revisar — logo depois da rede a bola de jogo cai DENTRO (8.D)', () => {
    // 🐞 era "fora" forçado: perto da rede o lado do quique é incerto, e na troca
    // a cozinha do outro lado vale (só no saque ela é curta).
    FPS.forEach((fps) => {
      [-0.03, -0.06].forEach((dy) => expect(netBall(dy, 'fundoA', fps), `${fps} q/s, ${dy}`).toEqual(['bounce review net 4']));
      expect(netBall(-0.01, 'rede1', fps)).toEqual(['bounce review net 4']);
    });
  });

  it('longe da fita: fora (rede)', () => {
    FPS.forEach((fps) => ['fundoA', 'rede1'].forEach((c) => expect(netBall(-0.4, c, fps)).toEqual(['bounce out net 4'])));
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

describe('entre um ponto e outro: a bola devolvida a quem vai sacar não é saque julgado (7.D.4)', () => {
  // O saque longo de B acaba o ponto aos 0,85 s. Segundos depois, quem recebeu
  // — atrás do fundo, com a bola vinda da mão — manda a bola de volta para B
  // sacar de novo: parece saque. 🐞 Era julgada como um: "Saque: fora" (área
  // errada, longo, curto) e "Falta no saque" (pé dentro da quadra), ditos em voz
  // alta, gravados e mostrados no telão sem ponto nenhum sendo jogado. O que
  // separa um do outro é a gente em volta: no saque, a dupla de quem saca fica
  // no fundo e quem recebe espera parado no fundo de lá, em diagonal; quem
  // devolve a bola costuma ter o parceiro na cozinha (o time que recebe).
  const firstServe = (q) => {
    const c = paddle(q.sB, 0);
    const b = bounce(0.85, 1.5, -0.4);
    return [dropBefore(c), c, b, rebound(c, b, 0.3)];
  };
  const shot = (pl, T, land, flight = 1.4) => {
    const c = paddle(pl, T);
    const b = bounce(T + flight, land[0], land[1]);
    return [dropBefore(c), c, b, rebound(c, b, 0.3)];
  };
  /** As marcações certas de falta ou fora depois do 1º ponto. */
  const certain = (ev) => ev.filter((e) => e.t > 1.5 && (e.call === LINE_CALL.OUT || e.call === VOLLEY_CALL.FAULT));

  [2, 3, 5].forEach((T) => {
    // na área errada, além do fundo e na cozinha de lá
    [[1.5, L - 2.0], [4.5, L + 0.8], [4.5, N + 1.2]].forEach((land) => {
      it(`${T} s depois, a bola que cai em (${land.join(', ')}): nunca falta nem fora certos`, () => {
        ['fundoA', 'fundoB'].forEach((cam) => {
          const q = four();
          const ev = playParts({ cam: CAMS[cam](), parts: [firstServe(q), shot(q.rA, T, land)], players: all(q) });
          expect(certain(ev), `${cam}: ${brief(ev).join(', ')}`).toEqual([]);
        });
      });
    });
  });

  it('quem devolve a bola com o pé dentro da quadra não comete "falta no saque"', () => {
    FPS.forEach((fps) => ['fundoA', 'fundoB'].forEach((cam) => {
      const q = four({ rA: { x: 1.3, y: 0.3 } });
      const ev = playParts({ cam: CAMS[cam](), parts: [firstServe(q), shot(q.rA, 3, [4.5, L - 2.0])], players: all(q), fps });
      expect(certain(ev), `${cam} ${fps} q/s: ${brief(ev).join(', ')}`).toEqual([]);
    }));
  });

  it('a bola passada para a dupla do mesmo lado não é "saque na rede"', () => {
    const q = four();
    const ev = playParts({ cam: CAMS.fundoA(), parts: [firstServe(q), shot(q.rA, 3, [4.2, N - K - 1.0], 0.9)], players: all(q) });
    expect(certain(ev), brief(ev).join(', ')).toEqual([]);
  });

  it('quem vai sacar amortece a bola no ar com a raquete: não é devolução de voleio', () => {
    const q = four();
    const c = paddle(q.rA, 3);
    const touch = paddle(q.sB, 4.4, 1.0);
    const popUp = { t: 4.8, p: [touch.p[0], touch.p[1] + 0.1, 1.1] };
    const ev = playParts({ cam: CAMS.fundoA(), parts: [firstServe(q), [dropBefore(c), c, touch, popUp]], players: all(q) });
    expect(certain(ev), brief(ev).join(', ')).toEqual([]);
  });

  it('o saque de verdade depois do ponto, com a formação de saque à vista, segue julgado na hora', () => {
    // B saca de novo com a dupla no fundo; quem recebe espera parado no fundo de lá, em diagonal.
    const q = four({ pB: { x: 1.5, y: L + 0.3 } });
    const ev = playParts({ cam: CAMS.fundoA(), parts: [firstServe(q), shot(q.sB, 8, [1.5, -0.4], 0.85)], players: all(q) });
    expect(brief(ev)).toEqual(['bounce out long 1', 'bounce out long 1']);
    // ...e o pé de quem saca, visto de perto pela câmera do fundo dele
    const r = four({ pB: { x: 1.5, y: L + 0.3 }, sB: { moves: [{ from: 4, to: 6, dy: -0.6 }] } });
    const fb = playParts({ cam: CAMS.fundoB(), parts: [firstServe(r), shot(r.sB, 8, [1.5, 2.5], 0.9)], players: all(r) });
    expect(brief(fb)).toContain('serve_foot fault baseline');
  });

  it('a bola pega no ar por quem vai sacar e sacada logo em seguida: o saque é este', () => {
    // A bola devolvida some na mão de B; 1,6 s depois B saca na área errada.
    const q = four({ pB: { x: 1.5, y: L + 0.3 } });
    const c = paddle(q.rA, 3);
    const w = q.sB.wrist(4.4);
    const caught = { t: 4.4, p: [w[0], w[1] - 0.2, 1.0] };
    const parts = [firstServe(q), [dropBefore(c), c, caught], shot(q.sB, 6, [4.5, 2.5], 0.85)];
    expect(brief(playParts({ cam: CAMS.fundoA(), parts, players: all(q) }))).toEqual(['bounce out long 1', 'bounce out wrong_box 1']);
  });

  it('a bola passada pela dupla de quem saca, do mesmo lado, e o saque logo depois: o saque é julgado', () => {
    // Depois do ponto a bola chega à dupla de B, junto da cozinha, que a passa
    // com a raquete para quem saca e volta para o fundo. 🐞 Essa batida abria
    // uma jogada "sem saque" do lado de B, e o saque de verdade, do mesmo lado,
    // era tomado por um toque repetido: o saque na área errada passava calado.
    const q = four({ pB: { moves: [{ from: 3.3, to: 4.6, dy: L + 0.3 - (N + K + 0.26) }] } });
    const pass = paddle(q.pB, 3);
    const w = q.sB.wrist(4.2);
    const handed = [dropBefore(pass), pass, { t: 4.2, p: [w[0], w[1] + 0.2, 1.0] }];
    FPS.forEach((fps) => ['fundoA', 'fundoB'].forEach((cam) => {
      const ev = playParts({ cam: CAMS[cam](), parts: [firstServe(q), handed, shot(q.sB, 6.2, [4.5, 1.5], 0.85)], players: all(q), fps });
      expect(brief(ev).filter((x) => !x.startsWith('serve_foot clean')), `${cam} ${fps} q/s`).toEqual(['bounce out long 1', 'bounce out wrong_box 1']);
    }));
  });

  it('a câmera de cima não vê quem recebe: depois do ponto, o saque é revisar, nunca fora certo', () => {
    const ov = (parts) => playParts({ cam: CAMS.topo(), parts, players: [], options: { mode: 'overhead' }, lift: false });
    const serve = (T, land, from = [4.95, 13.4]) => {
      const c = { t: T, p: [from[0], from[1], 0.6] };
      const b = bounce(T + 0.85, land[0], land[1]);
      return [{ t: T - 0.35, p: [from[0], from[1], 1.1] }, c, b, rebound(c, b, 0.3)];
    };
    const first = serve(0, [1.5, -0.35]);
    // a bola devolvida de trás do fundo de A, que cai na área errada de B...
    expect(brief(ov([first, serve(3, [1.5, L - 2.0], [1.3, -0.4])]))).toEqual(['bounce out long 1', 'bounce review wrong_box 1']);
    // ...e o saque de verdade, longo: sem ver as pessoas, a câmera não sabe qual é qual
    expect(brief(ov([first, serve(8, [1.5, -0.35])]))).toEqual(['bounce out long 1', 'bounce review long 1']);
  });

  it('a câmera da rede não vê quem recebe, só o parceiro dele na cozinha: o saque depois do ponto é revisar, não calado', () => {
    // 🐞 O parceiro de quem recebe junto da cozinha (o lugar normal dele) contava
    // como prova de bola devolvida, e todo saque depois do 1º ponto saía calado.
    [[1.5, 5.2, 'short'], [4.5, 2.5, 'wrong_box']].forEach(([x, y, reason]) => FPS.forEach((fps) => {
      const q = four({ pB: { x: 1.5, y: L + 0.3 } });
      const ev = playParts({ cam: CAMS.rede1(), parts: [firstServe(q), shot(q.sB, 8, [x, y], 0.85)], players: all(q), fps });
      const second = ev.filter((e) => e.type === 'bounce' && e.t > 8);
      expect(second.map((e) => e.reason), `${reason} ${fps} q/s: ${brief(ev).join(', ')}`).toEqual([reason]);
      expect([LINE_CALL.OUT, LINE_CALL.REVIEW]).toContain(second[0].call);
    }));
  });

  it('o pé do parceiro de quem saca perdido pelo detector, lá no fundo: o saque segue julgado', () => {
    // 🐞 Sem os pés à vista, o punho do lado de quem saca valia como "perto da
    // rede" em qualquer lugar — a pessoa no fundo calava o saque.
    const q = four({ pB: { x: 2.0, y: L + 0.5 } });
    const lost = { ...q.pB, feet: (t) => q.pB.feet(t).map(([x, y]) => [x, y, -50]) };
    FPS.forEach((fps) => {
      const ev = playParts({ cam: CAMS.fundoA(), parts: [firstServe(q), shot(q.sB, 8, [4.5, 2.5], 0.85)], players: [q.sB, lost, q.rA, q.pA], fps });
      expect(brief(ev), `${fps} q/s`).toEqual(['bounce out long 1', 'bounce out wrong_box 1']);
    });
  });

  it('a câmera do canto de B, que não vê o fim do ponto: o toque de quem devolve a bola, lá no fundo, não é "fora" certo', () => {
    // 🐞 A bola some na mão de quem recebeu e volta com o toque de raquete dele,
    // ~3 m atrás do fundo de A: a quina do toque era tomada pelo 1º quique.
    const cam = makeCamera({ C: [W + 2, L + 3, 3.5], L: [2, L - 8, 0], f: 900 });
    const q = four({ sB: { x: 4.6, y: L - 2 }, pA: { x: 2, y: 1.5 } });
    [2, 3].forEach((T) => {
      const ev = playParts({ cam, parts: [firstServe(q), shot(q.rA, T, [1.5, L - 2])], players: all(q) });
      expect(certain(ev), `${T} s: ${brief(ev).join(', ')}`).toEqual([]);
    });
  });
});

describe('a bola perdida perto de quem bateu não é quique escondido pela rede', () => {
  it('o lob longo, com a bola sumida um instante ainda do lado de cá: "fora" certo', () => {
    // 🐞 Qualquer buraco no rastro antes do quique virava "revisar" no fundo de
    // lá — também o de quando a bola mal tinha saído da raquete, longe da rede.
    const p = four();
    const ball = [...opening(p), paddle(p.pA, 3.2, 0.9), bounce(4.6, 3.9, L + 0.6), away(4.9, 3.8, L + 1.6, 0.8)];
    const path = ballPath(ball);
    FPS.forEach((fps) => {
      const cam = CAMS.fundoA();
      const e = createLineCallEngine({ H: cam.H, options: { imageSize: cam.size } });
      const fr = frames({ cam, ball: (t) => (t >= 3.27 && t < 3.44 ? null : path(t)), players: all(p), from: -0.65, to: 8, fps });
      const ev = run(e, fr).filter((x) => x.type === 'bounce' && x.t > 4);
      expect(brief(ev), `${fps} q/s`).toEqual(['bounce out long 4']);
    });
  });

  it('a bola que passa um instante atrás do corpo de alguém, em voo, e cai longa lá no fundo: "fora" certo', () => {
    // Sumir mais que `startGapS` só faz bola nova quando ela não volta no rumo.
    const p = four();
    const ball = [...opening(p), bounce(3.8, 3.5, 5.6), paddle(p.pA, 4.1, 0.4), bounce(5.1, 2.0, L + 0.6), away(5.4, 1.9, L + 1.6, 0.8)];
    const path = ballPath(ball);
    [[4.2, 4.48], [4.3, 4.65], [4.4, 4.8], [4.6, 4.88]].forEach(([a, b]) => FPS.forEach((fps) => {
      const cam = CAMS.fundoA();
      const e = createLineCallEngine({ H: cam.H, options: { imageSize: cam.size } });
      const fr = frames({ cam, ball: (t) => (t >= a && t < b ? null : path(t)), players: all(p), from: -0.65, to: 8, fps });
      const ev = run(e, fr).filter((x) => x.type === 'bounce' && x.t > 5);
      expect(brief(ev), `${a}–${b} ${fps} q/s`).toEqual(['bounce out long 4']);
    }));
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

/** O 2º quique de verdade depois de `b`, vindo de `prev`: segue o rumo 20% mais devagar e sobe com 75% da velocidade. */
function nextBounce(prev, b) {
  const T = b.t - prev.t;
  const vx = (b.p[0] - prev.p[0]) / T;
  const vy = (b.p[1] - prev.p[1]) / T;
  const vzDown = (b.p[2] - prev.p[2] + 0.5 * 9.81 * T * T) / T - 9.81 * T;
  const dt = (2 * -0.75 * vzDown) / 9.81;
  return bounce(b.t + dt, b.p[0] + 0.8 * vx * dt, b.p[1] + 0.8 * vy * dt);
}

describe('o 1º quique onde a rede esconde o chão (10.C.1): o 2º não é julgado como o 1º', () => {
  // Do fundo A, o chão logo depois da rede (a cozinha de lá e um pedaço da área)
  // fica atrás da rede. A bola que cai DENTRO ali some — e o quique seguinte,
  // longe, atrás da linha de fundo ou fora da lateral, era julgado como o 1º:
  // "fora" certo numa bola boa. 🐞 Três caminhos davam nisso: a bola sumida ali
  // sem quina nenhuma, a quina vista como "não era quique" e a quina tomada pela
  // batida de quem está ali (e o 2º quique virava a bola dele na rede).
  // Cada caso: quadros/s, semente do ruído, onde o 1º quique cai, a altura do
  // voleio de A e quando a bola quica.
  const cases = [
    [30, 7, 4.2, 2.5, 0.9, 3.7], [30, 7, 5.2, 2.8, 0.9, 3.7], [60, 7, 5.2, 2.8, 1.1, 3.8],
    [60, 11, 3.0, 2.4, 0.9, 3.7], [30, 3, 1.4, 3.0, 1.1, 3.8], [60, 5, 2.0, 3.2, 0.9, 3.7],
  ];
  cases.forEach(([fps, seed, x, dy, z, t]) => {
    it(`${fps} q/s, semente ${seed}: a bola de A cai dentro ${dy} m depois da rede e ninguém joga — nunca "fora" certo`, () => {
      const p = four();
      const volley = paddle(p.pA, 3.2, z);
      const b1 = bounce(t, x, N + dy);
      const b2 = nextBounce(volley, b1);
      const ev = play({ cam: CAMS.fundoA(), ball: [...opening(p), volley, b1, b2, rebound(b1, b2, 0.3)], players: all(p), fps, seed });
      expect(ev.filter((e) => e.type === 'bounce' && e.call === LINE_CALL.OUT), brief(ev).join(', ')).toEqual([]);
    });
  });

  it('o fora longo que a câmera viu inteiro segue fora certo', () => {
    const p = four();
    const volley = paddle(p.pA, 3.2, 0.9);
    const b1 = bounce(4.0, 3.9, L + 0.6);
    const ev = play({ cam: CAMS.fundoA(), ball: [...opening(p), volley, b1, rebound(volley, b1, 0.3)], players: all(p) });
    expect(brief(ev).slice(-1)).toEqual(['bounce out long 4']);
  });

  // O mesmo no saque, da câmera atrás de quem saca: a bola cai DENTRO da área,
  // logo depois da cozinha, onde a rede esconde o chão; o 2º quique, atrás do
  // fundo, era o "Saque: fora". O último caso é o saque que só se confirma no
  // lance seguinte (a quina dele fica em dúvida até lá).
  [[30, 3, 4.0, 2.8, 1.0], [60, 5, 4.0, 2.8, 0.85], [60, 3, 3.6, 2.6, 0.7]].forEach(([fps, seed, x, dy, t]) => {
    it(`${fps} q/s, semente ${seed}: o saque de A cai dentro ${dy} m depois da rede — nunca "Saque: fora" certo`, () => {
      const sA = player({ x: 1.6, y: -0.3 });
      const c = paddle(sA, 0);
      const b1 = bounce(t, x, N + dy);
      const b2 = nextBounce(c, b1);
      const ev = play({ cam: CAMS.fundoA(), ball: [dropBefore(c), c, b1, b2, rebound(b1, b2, 0.3)], players: [sA, player({ x: 4.6, y: L + 0.3 })], fps, seed });
      expect(ev.filter((e) => e.type === 'bounce' && e.call === LINE_CALL.OUT), brief(ev).join(', ')).toEqual([]);
    });
  });
});
