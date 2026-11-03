import { describe, it, expect } from 'vitest';
import { solveHomography, applyHomography, invertHomography, metersPerPixel } from './homography.js';
import { COURT, insideMargin, kitchenDepth, kitchenMargin, landingMargin, serveFootMargin, courtSide } from './court.js';
import {
  CAMERA_LAYOUTS, CAMERA_POSITIONS, calibrationPoints, layoutById, layoutsByCount, layoutJudges, DEFAULT_LAYOUT,
} from './cameraLayouts.js';
import { fuseLineCalls, isCamOnline, positionOccupancy, decisionsFor } from './fusion.js';

const CALIBRATION_CORNERS = calibrationPoints('fundo_a');
import { decide, LINE_CALL } from './lineCallEngine.js';
import { findBallCandidates, pickBall, rgbToHsv } from './ballDetection.js';
import {
  gameDayLineCourts, lineCourtCopyPlan, lineCourtNumber, gameDayLineHost, gameDayLinePage,
} from './gameDayLine.js';
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

  it('com a incerteza de cada eixo, decide a linha de menor margem em incertezas', () => {
    // perto do canto do fundo: 6 cm do fundo (eixo y, bem visto), 8 cm da lateral (eixo x, mal visto)
    const p = { x: 0.08 - 0.01, y: 0.06 - 0.01 };
    const semU = landingMargin(p, { patchM: 0.01 });
    expect(semU).toMatchObject({ reason: 'long', axis: 'y' });
    const comU = landingMargin(p, { patchM: 0.01, u: { x: 0.2, y: 0.02 } });
    expect(comU).toMatchObject({ reason: 'wide', axis: 'x', uncertaintyM: 0.2 });
    expect(decide(comU.marginM, comU.uncertaintyM)).toBe(LINE_CALL.REVIEW);
    // a cozinha: a linha dela é o eixo y; a lateral ao lado dela, o x
    expect(kitchenMargin({ x: 3, y: COURT.NET_Y - 1 }, { x: 0.1, y: 0.05 })).toMatchObject({ axis: 'y', uncertaintyM: 0.05 });
    expect(kitchenMargin({ x: 0.02, y: COURT.NET_Y - 1 }, { x: 0.1, y: 0.05 })).toMatchObject({ axis: 'x', uncertaintyM: 0.1 });
    // o pé no saque: cada ponto com a sua incerteza
    const pe = serveFootMargin([{ x: 1.5, y: -0.05, u: { x: 0.03, y: 0.08 } }], 'A');
    expect(pe).toMatchObject({ reason: 'baseline', axis: 'y', uncertaintyM: 0.08 });
  });

  it('decide só com margem maior que a incerteza', () => {
    expect(decide(0.08, 0.03)).toBe(LINE_CALL.IN);
    expect(decide(-0.08, 0.03)).toBe(LINE_CALL.OUT);
    expect(decide(0.01, 0.03)).toBe(LINE_CALL.REVIEW);
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

describe('quadra por quadra no dia de jogo', () => {
  it('as quadras do dia: play_courts, as dos jogos e as já configuradas, sem repetir', () => {
    expect(gameDayLineCourts({ play_courts: 2 })).toEqual([{ id: 'court-1', index: 1 }, { id: 'court-2', index: 2 }]);
    // Sem play_courts ⇒ ao menos uma quadra; jogo na quadra 4 e configuração na 6 entram.
    expect(gameDayLineCourts({}, { games: [{ court: 4 }, { court: 'x' }, { court: 0 }], docs: [{ id: 'court-6' }, { id: 'lixo' }] })
      .map((c) => c.index)).toEqual([1, 4, 6]);
    // Quadra configurada fora do número do dia continua na lista (ela pode ter câmera ligada).
    expect(gameDayLineCourts({ play_courts: 1 }, { docs: [{ id: 'court-3' }] }).map((c) => c.id)).toEqual(['court-1', 'court-3']);
    // Teto: 99 quadras, número negativo ou absurdo não vira quadra.
    expect(gameDayLineCourts({ play_courts: 500 })).toHaveLength(99);
    expect(gameDayLineCourts({ play_courts: -3 })).toHaveLength(1);
  });

  it('o número da quadra só sai de um id de quadra', () => {
    expect(lineCourtNumber('court-12')).toBe(12);
    expect(lineCourtNumber('court-0')).toBe(null);
    expect(lineCourtNumber('court-100')).toBe(null);
    expect(lineCourtNumber('quadra-1')).toBe(null);
    expect(lineCourtNumber(null)).toBe(null);
  });

  it('caminho das câmeras e a página de cada quadra', () => {
    expect(gameDayLineHost('G1', 'court-2')).toBe('game_days/G1/line_courts/court-2');
    expect(gameDayLinePage('G1')).toBe('/dia-de-jogo/G1/linhas');
    expect(gameDayLinePage('G1', 'court-2')).toBe('/dia-de-jogo/G1/linhas?quadra=court-2');
  });

  it('⭐ copiar: só os MEUS dias de hoje em diante, quadra a quadra pelo número', () => {
    const fonte = { id: 'src' };
    const conf = [
      { id: 'court-1', line_control: true, line_control_layout: 'quatro' },
      { id: 'court-2', line_control: false },
    ];
    const dias = [
      { id: 'src', created_by: 'u', play_courts: 2 },
      { id: 'a', created_by: 'u', date: '2026-11-03', play_courts: 3 },
      { id: 'b', created_by: 'u', date: '2026-10-01', play_courts: 2 },
      { id: 'c', created_by: 'x', date: '2026-12-01', play_courts: 2 },
      { id: 'd', created_by: 'u' },
      { id: 'e', created_by: 'u', status: 'archived', date: '2026-12-01' },
    ];
    const plano = lineCourtCopyPlan(fonte, conf, dias, 'u', '2026-11-03');
    expect(plano.map((p) => p.gameDayId)).toEqual(['a', 'd']);
    expect(plano[0].courts).toEqual([
      { id: 'court-1', patch: { line_control: true, line_control_layout: 'quatro' } },
      { id: 'court-2', patch: { line_control: false } },
      // A quadra 3 não existe aqui: lá ela fica desligada, como a cópia pede.
      { id: 'court-3', patch: { line_control: false } },
    ]);
    expect(plano[1].courts).toEqual([{ id: 'court-1', patch: { line_control: true, line_control_layout: 'quatro' } }]);
    // Ligada sem arranjo escolhido leva o padrão (senão a de lá mantém o dela).
    const soLigada = lineCourtCopyPlan(fonte, [{ id: 'court-1', line_control: true }], [dias[4]], 'u', '2026-11-03');
    expect(soLigada[0].courts).toEqual([{ id: 'court-1', patch: { line_control: true, line_control_layout: 'solo_fundo' } }]);
    expect(lineCourtCopyPlan(fonte, conf, dias, null, '2026-11-03')).toEqual([]);
    expect(lineCourtCopyPlan(null, conf, dias, 'u', '2026-11-03')).toEqual([]);
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

  it('pé no saque (7.A): vale a câmera do fundo de quem saca, e o motivo vem dela', () => {
    const s = (id, position, call, extra = {}) => ({
      id, position, kind: 'serve_foot', call, t_ms: 1000, uncertainty_m: 0.03, x: 1.5, y: -0.2, ...extra,
    });
    const [l] = fuseLineCalls([s('1', 'fundo_b', 'clean'), s('2', 'fundo_a', 'fault', { reason: 'baseline' })]);
    expect(l).toMatchObject({ call: 'fault', disagree: false, reason: 'baseline' });
    expect(l.best.position).toBe('fundo_a');
    // a lateral da rede vê a linha de fundo de longe: o fundo decide
    expect(fuseLineCalls([s('1', 'rede_1', 'fault'), s('2', 'fundo_a', 'clean')])[0].call).toBe('clean');
  });

  it('dois quiques (10.A): um quique visto do lado de quem bateu, logo antes, desmente', () => {
    const tb = { id: '9', position: 'fundo_a', kind: 'two_bounce', call: 'fault', reason: 'return', t_ms: 5000, x: 3, y: 12 };
    const b = (y, t) => ({ id: `b${t}`, position: 'rede_1', kind: 'bounce', call: 'in', t_ms: t, uncertainty_m: 0.05, x: 3, y });
    expect(fuseLineCalls([tb])[0]).toMatchObject({ call: 'fault', disagree: false });
    const desmentido = fuseLineCalls([b(11, 4600), tb]).find((l) => l.kind === 'two_bounce');
    expect(desmentido).toMatchObject({ call: 'review', disagree: true });
    // o quique do outro lado (o do saque, por exemplo) não desmente nada
    expect(fuseLineCalls([b(2, 4600), tb]).find((l) => l.kind === 'two_bounce').call).toBe('fault');
    // nem o quique de muito antes
    expect(fuseLineCalls([b(11, 1000), tb]).find((l) => l.kind === 'two_bounce').call).toBe('fault');
  });

  it('lance de pé tem janela curta: dois voleios do mesmo lado a 0,5 s são dois lances', () => {
    const v = (id, position, t) => ({ id, position, kind: 'volley', call: 'clean', t_ms: t, uncertainty_m: 0.05, x: 3, y: 4.5 });
    expect(fuseLineCalls([v('1', 'fundo_a', 1000), v('2', 'rede_1', 1500)])).toHaveLength(2);
    expect(fuseLineCalls([v('1', 'fundo_a', 1000), v('2', 'rede_1', 1150)])).toHaveLength(1);
  });

  it('o que quem organiza decide em cada tipo de lance', () => {
    expect(decisionsFor('bounce')).toEqual(['in', 'out']);
    expect(decisionsFor('serve_foot')).toEqual(['fault', 'clean']);
    expect(decisionsFor('two_bounce')).toEqual(['fault', 'clean']);
    expect(decisionsFor('outra_coisa')).toEqual([]);
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
