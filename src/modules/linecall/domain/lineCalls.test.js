import { describe, it, expect } from 'vitest';
import { solveHomography, applyHomography, invertHomography, metersPerPixel } from './homography.js';
import { COURT, insideMargin, kitchenDepth, courtSide } from './court.js';
import {
  CAMERA_LAYOUTS, CAMERA_POSITIONS, calibrationPoints, layoutById, layoutsByCount, layoutJudges, DEFAULT_LAYOUT,
} from './cameraLayouts.js';
import { fuseLineCalls, isCamOnline, positionOccupancy } from './fusion.js';

const CALIBRATION_CORNERS = calibrationPoints('fundo_a');
import { createLineCallEngine, decide, LINE_CALL, VOLLEY_CALL } from './lineCallEngine.js';
import { findBallCandidates, pickBall, rgbToHsv } from './ballDetection.js';
import { lineControlTargets } from './lineControlTargets.js';
import { assessCamera, worstCmPerPixel, worstLevel, CAMERA_LEVEL } from './cameraCheck.js';

// Imagem em "centímetros": 1 px = 1 cm do chão. Facilita conferir as contas.
const H_CM = [0.01, 0, 0, 0, 0.01, 0, 0, 0, 1];

describe('homografia', () => {
  it('leva os cantos tocados aos cantos da quadra, e volta', () => {
    const img = [{ x: 420, y: 180 }, { x: 860, y: 182 }, { x: 1180, y: 690 }, { x: 110, y: 700 }];
    const H = solveHomography(img, CALIBRATION_CORNERS);
    img.forEach((p, i) => {
      const q = applyHomography(H, p);
      expect(q.x).toBeCloseTo(CALIBRATION_CORNERS[i].x, 6);
      expect(q.y).toBeCloseTo(CALIBRATION_CORNERS[i].y, 6);
    });
    const back = applyHomography(invertHomography(H), { x: COURT.WIDTH / 2, y: COURT.LENGTH });
    expect(back.y).toBeGreaterThan(690);
    // longe da câmera um pixel cobre mais chão que perto
    expect(metersPerPixel(H, img[0])).toBeGreaterThan(metersPerPixel(H, img[3]));
  });

  it('pontos alinhados não dão homografia', () => {
    const line = [0, 1, 2, 3].map((i) => ({ x: i, y: i }));
    expect(solveHomography(line, CALIBRATION_CORNERS)).toBeNull();
  });
});

describe('quadra', () => {
  it('a linha é parte da área: na borda externa ainda é dentro', () => {
    expect(insideMargin({ x: 3, y: COURT.LENGTH })).toBeCloseTo(0);
    expect(insideMargin({ x: -0.1, y: 5 })).toBeCloseTo(-0.1);
    expect(kitchenDepth({ x: 3, y: COURT.NET_Y + COURT.KITCHEN })).toBeCloseTo(0);
    expect(kitchenDepth({ x: 3, y: COURT.NET_Y - 1 })).toBeCloseTo(COURT.KITCHEN - 1);
    // fora da quadra, ao lado da cozinha, não é cozinha
    expect(kitchenDepth({ x: -0.3, y: COURT.NET_Y })).toBeLessThan(0);
  });

  it('decide só com margem maior que a incerteza', () => {
    expect(decide(0.08, 0.03)).toBe(LINE_CALL.IN);
    expect(decide(-0.08, 0.03)).toBe(LINE_CALL.OUT);
    expect(decide(0.01, 0.03)).toBe(LINE_CALL.REVIEW);
  });
});

/** Quique: a bola desce na imagem até `peak` e volta a subir. */
function bounceAt(peak) {
  const e = createLineCallEngine({ H: H_CM });
  const ys = [peak - 30, peak - 20, peak - 10, peak, peak - 5, peak - 10];
  return ys.flatMap((y, i) => e.push({ t: i / 60, ball: { x: 300, y } }));
}

describe('motor: quique', () => {
  it('dentro, fora e revisar pela distância à linha de fundo', () => {
    const fundo = COURT.LENGTH * 100;
    const [dentro] = bounceAt(fundo - 11);
    expect(dentro).toMatchObject({ type: 'bounce', call: LINE_CALL.IN });
    expect(dentro.marginM).toBeCloseTo(0.11, 2);
    expect(bounceAt(fundo + 9)[0].call).toBe(LINE_CALL.OUT);
    expect(bounceAt(fundo - 2)[0].call).toBe(LINE_CALL.REVIEW);
  });

  it('uma quina perto do punho é batida, não quique', () => {
    const e = createLineCallEngine({ H: H_CM });
    const players = [{ feet: [], wrists: [{ x: 300, y: 500 }] }];
    const ev = [470, 480, 490, 500, 495, 490].flatMap((y, i) => e.push({ t: i / 60, ball: { x: 300, y }, players }));
    expect(ev).toEqual([]);
  });
});

/** Saque perto do punho (y=460), voleio perto do punho (y=360), pés parados em `feetY`. */
function volley(feetY) {
  const e = createLineCallEngine({ H: H_CM });
  const players = [{
    feet: [{ x: 300, y: feetY }, { x: 330, y: feetY }],
    wrists: [{ x: 300, y: 460 }, { x: 300, y: 360 }],
  }];
  const ys = [400, 420, 440, 460, 440, 420, 400, 380, 360, 380, 400];
  const ev = ys.flatMap((y, i) => e.push({ t: i / 60, ball: { x: 300, y }, players }));
  for (let i = ys.length; i < ys.length + 90; i += 1) ev.push(...e.push({ t: i / 60, ball: null, players }));
  return ev.filter((x) => x.type === 'volley');
}

describe('motor: pé na cozinha no voleio', () => {
  it('pé apoiado dentro da cozinha é falta', () => {
    const [v] = volley(800);
    expect(v.call).toBe(VOLLEY_CALL.FAULT);
    expect(v.depthM).toBeGreaterThan(0.5);
  });

  it('pé longe da cozinha é voleio limpo, depois do impulso', () => {
    expect(volley(1200).map((v) => v.call)).toEqual([VOLLEY_CALL.CLEAN]);
  });

  it('pé em cima da linha, dentro da incerteza, pede revisão', () => {
    const linha = (COURT.NET_Y + COURT.KITCHEN) * 100 + 2;
    expect(volley(linha).map((v) => v.call)).toEqual([VOLLEY_CALL.REVIEW]);
  });
});

describe('detecção da bola', () => {
  it('acha a mancha amarela que se mexeu', () => {
    const w = 10; const h = 10;
    const prev = new Uint8ClampedArray(w * h * 4).fill(40);
    const cur = new Uint8ClampedArray(prev);
    [[4, 4], [5, 4], [4, 5], [5, 5]].forEach(([x, y]) => cur.set([220, 240, 40, 255], (y * w + x) * 4));
    const c = findBallCandidates(cur, prev, w, h);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ x: 4.5, y: 4.5, area: 4 });
    // parada não conta
    expect(findBallCandidates(cur, cur, w, h)).toEqual([]);
    expect(pickBall(c, { x: 0, y: 0 })).toEqual(c[0]);
    expect(pickBall(c, { x: 400, y: 400 })).toBeNull();
    expect(rgbToHsv(220, 240, 40).h).toBeCloseTo(66, 0);
  });
});

describe('ligar em todos os meus jogos', () => {
  it('só os meus, de hoje em diante, que ainda não estão como pedido', () => {
    const dias = [
      { id: 'a', created_by: 'u', date: '2026-11-02' },
      { id: 'b', created_by: 'u', date: '2026-10-01' },
      { id: 'c', created_by: 'x', date: '2026-12-01' },
      { id: 'd', created_by: 'u', line_control: true },
      { id: 'e', created_by: 'u', status: 'archived' },
    ];
    expect(lineControlTargets(dias, 'u', true, '2026-11-02')).toEqual(['a']);
    expect(lineControlTargets(dias, 'u', false, '2026-11-02')).toEqual(['d']);
    expect(lineControlTargets(dias, null, true, '2026-11-02')).toEqual([]);
  });
});

describe('câmera', () => {
  it('30 quadros é o mínimo, 60 o bom', () => {
    expect(worstLevel(assessCamera({ width: 1920, height: 1080, frameRate: 60 }))).toBe(CAMERA_LEVEL.OK);
    expect(worstLevel(assessCamera({ width: 1280, height: 720, frameRate: 30 }))).toBe(CAMERA_LEVEL.WARN);
    expect(worstLevel(assessCamera({ width: 640, height: 480, frameRate: 30 }))).toBe(CAMERA_LEVEL.BLOCK);
    expect(worstCmPerPixel(H_CM, [{ x: 0, y: 0 }])).toBeCloseTo(1);
  });
});

/** Câmera de cima: a bola segue em +y a 10 m/s e passa a 7 m/s (quique) ou volta (batida). */
function overhead(startCm, after) {
  const e = createLineCallEngine({ H: H_CM, options: { mode: 'overhead' } });
  const ys = [0, 1, 2, 3].map((i) => startCm + (1000 / 60) * i);
  for (let i = 1; i <= 3; i += 1) ys.push(ys[3] + (after * 100 / 60) * i);
  return ys.flatMap((y, i) => e.push({ t: i / 60, ball: { x: 300, y } }));
}

describe('motor: câmera de cima', () => {
  it('o quique é a freada no chão, sem mudar de rumo', () => {
    const [dentro, ...resto] = overhead(100, 7);
    expect(resto).toEqual([]);
    expect(dentro).toMatchObject({ type: 'bounce', call: LINE_CALL.IN });
    expect(dentro.point.y).toBeCloseTo(1.417, 2);
    expect(overhead(1316, 7)[0].call).toBe(LINE_CALL.OUT);
  });

  it('a bola que volta é batida, não quique', () => {
    expect(overhead(400, -8)).toEqual([]);
  });

  it('seguir no mesmo ritmo não é nada', () => {
    expect(overhead(400, 10)).toEqual([]);
  });
});

describe('posições e arranjos', () => {
  it('todo arranjo usa posições que existem, sem repetir, e os ids não mudam', () => {
    CAMERA_LAYOUTS.forEach((l) => {
      expect(l.positions.every((p) => CAMERA_POSITIONS[p])).toBe(true);
      expect(new Set(l.positions).size).toBe(l.positions.length);
    });
    expect(layoutsByCount().map(([n]) => n)).toEqual([1, 2, 3, 4, 5]);
    expect(layoutById('nao-existe').id).toBe(DEFAULT_LAYOUT);
    expect(Object.keys(CAMERA_POSITIONS)).toEqual(
      ['fundo_a', 'fundo_b', 'topo', 'rede_1', 'rede_2', 'canto_a1', 'canto_a2', 'canto_b1', 'canto_b2'],
    );
  });

  it('a câmera de cima não julga o pé; a lateral calibra pelas cozinhas', () => {
    expect(layoutJudges('solo_topo')).toEqual({ bounce: true, feet: false });
    expect(layoutJudges('topo_rede').feet).toBe(true);
    expect(calibrationPoints('rede_1').map((p) => p.id)).toEqual(['KA1', 'KA2', 'KB2', 'KB1']);
    expect(calibrationPoints('topo').map((p) => p.id)).toEqual(['A1', 'A2', 'B2', 'B1']);
    expect(courtSide({ y: 1 })).toBe('A');
    expect(courtSide({ y: 12 })).toBe('B');
  });
});

describe('central: juntar as câmeras', () => {
  const q = (id, position, call, t, extra = {}) => ({
    id, position, kind: 'bounce', call, t_ms: t, uncertainty_m: 0.03, x: 3, y: 13.3, ...extra,
  });

  it('o mesmo quique visto por duas câmeras vira um lance', () => {
    const [l] = fuseLineCalls([q('1', 'fundo_a', 'out', 1000), q('2', 'fundo_b', 'out', 1200, { uncertainty_m: 0.01 })]);
    expect(l).toMatchObject({ call: 'out', disagree: false, positions: ['fundo_a', 'fundo_b'] });
    expect(l.best.position).toBe('fundo_b');
  });

  it('câmeras seguras que discordam ⇒ revisar; "revisar" de uma não desmente a outra', () => {
    expect(fuseLineCalls([q('1', 'fundo_a', 'in', 1000), q('2', 'fundo_b', 'out', 1100)])[0])
      .toMatchObject({ call: 'review', disagree: true });
    expect(fuseLineCalls([q('1', 'fundo_a', 'review', 1000), q('2', 'topo', 'in', 1100)])[0].call).toBe('in');
  });

  it('longe no tempo ou no chão são lances diferentes', () => {
    expect(fuseLineCalls([q('1', 'fundo_a', 'in', 1000), q('2', 'fundo_b', 'in', 3000)])).toHaveLength(2);
    expect(fuseLineCalls([q('1', 'fundo_a', 'in', 1000), q('2', 'fundo_b', 'in', 1100, { y: 1 })])).toHaveLength(2);
    // a mesma câmera não vota duas vezes no mesmo lance
    expect(fuseLineCalls([q('1', 'fundo_a', 'in', 1000), q('2', 'fundo_a', 'in', 1200)])).toHaveLength(2);
  });

  it('no pé vale a câmera que vê melhor: o "sem falta" do fundo não desmente a lateral', () => {
    const v = (id, position, call, t) => ({ id, position, kind: 'volley', call, t_ms: t, uncertainty_m: 0.05, x: 3, y: 8 });
    const [l] = fuseLineCalls([v('1', 'fundo_a', 'clean', 1000), v('2', 'rede_1', 'fault', 1050)]);
    expect(l).toMatchObject({ call: 'fault', disagree: false });
    expect(fuseLineCalls([v('1', 'rede_1', 'clean', 1000), v('2', 'rede_2', 'fault', 1050)])[0].call).toBe('review');
  });

  it('câmera no ar e quem ocupa cada posição', () => {
    const cams = [
      { position: 'fundo_a', seen_ms: 100000, name: 'velha' },
      { position: 'fundo_a', seen_ms: 130000, name: 'nova' },
      { position: 'rede_1', seen_ms: 10000, name: 'parada' },
    ];
    expect(isCamOnline(cams[2], 140000)).toBe(false);
    const occ = positionOccupancy(['fundo_a', 'rede_1'], cams, 140000);
    expect(occ.fundo_a.name).toBe('nova');
    expect(occ.rede_1).toBeNull();
  });
});
