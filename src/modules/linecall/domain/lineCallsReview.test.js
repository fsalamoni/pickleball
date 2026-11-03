import { describe, it, expect } from 'vitest';
import { COURT, nearestBoundary, serviceBoxMargin } from './court.js';
import { fuseLineCalls } from './fusion.js';
import { createFrameRing, clipWindow, frameIndexAt } from './replay.js';
import { lanceSummary, lancesCsv } from './report.js';
import { checkPointFor, calibrationCheck, CHECK_LEVEL } from './calibrationCheck.js';
import { calibrationPoints } from './cameraLayouts.js';
import { solveHomography } from './homography.js';

const { WIDTH: W, LENGTH: L, NET_Y: N, KITCHEN: K } = COURT;

describe('marca do quique: a linha mais perto', () => {
  it('acha a linha e a margem com sinal', () => {
    expect(nearestBoundary({ x: 3, y: L - 0.04 })).toMatchObject({ line: 'fundo_b' });
    expect(nearestBoundary({ x: 3, y: L - 0.04 }).marginM).toBeCloseTo(0.04, 6);
    expect(nearestBoundary({ x: -0.05, y: 5 })).toMatchObject({ line: 'lateral_1' });
    expect(nearestBoundary({ x: -0.05, y: 5 }).marginM).toBeCloseTo(-0.05, 6);
  });
});

describe('saque: a área em diagonal', () => {
  const srv = { side: 'A', x: 1 }; // sacando do lado A, metade do lado 1
  it('dentro da área diagonal é dentro; na cozinha, na metade errada ou além do fundo é fora', () => {
    expect(serviceBoxMargin({ x: 4.5, y: 11 }, srv)).toBeGreaterThan(0);
    expect(serviceBoxMargin({ x: 4.5, y: N + K - 0.01 }, srv)).toBeLessThan(0); // linha da cozinha
    expect(serviceBoxMargin({ x: 1.5, y: 11 }, srv)).toBeLessThan(0); // metade errada
    expect(serviceBoxMargin({ x: 4.5, y: L + 0.05 }, srv)).toBeLessThan(0);
    // a linha central é da área
    expect(serviceBoxMargin({ x: W / 2, y: 11 }, srv)).toBeGreaterThan(0);
  });
  it('do lado B, o alvo é o lado A', () => {
    expect(serviceBoxMargin({ x: 1, y: 2 }, { side: 'B', x: 5 })).toBeGreaterThan(0);
    expect(serviceBoxMargin({ x: 1, y: N - 1 }, { side: 'B', x: 5 })).toBeLessThan(0);
  });
});

describe('central: a decisão de quem organiza', () => {
  const q = (id, extra = {}) => ({ id, position: 'fundo_a', kind: 'bounce', call: 'review', t_ms: 1000, uncertainty_m: 0.03, x: 3, y: 13.3, ...extra });
  it('a decisão vence a máquina, e a mais recente vale', () => {
    const [l] = fuseLineCalls([q('1', { decision: 'out', decided_ms: 5, decided_by: 'u1' })]);
    expect(l).toMatchObject({ call: 'out', machineCall: 'review', decided: true, decidedBy: 'u1', decisionDocId: '1' });
    const [l2] = fuseLineCalls([
      q('1', { decision: 'out', decided_ms: 5 }),
      q('2', { position: 'fundo_b', t_ms: 1100, decision: 'in', decided_ms: 9 }),
    ]);
    expect(l2.call).toBe('in');
  });
  it('decisão que não cabe no tipo do lance é ignorada', () => {
    expect(fuseLineCalls([q('1', { decision: 'fault' })])[0]).toMatchObject({ call: 'review', decided: false });
  });
});

describe('replay: a fita', () => {
  it('guarda só os últimos segundos e devolve o que saiu', () => {
    const ring = createFrameRing({ seconds: 1, max: 100 });
    const out = [];
    for (let i = 0; i <= 30; i += 1) out.push(...ring.push({ t: i / 10 }));
    expect(ring.size).toBe(11);
    expect(out).toHaveLength(20);
    const { from, to } = clipWindow(2.5, { before: 0.3, after: 0.2 });
    expect(ring.between(from, to).map((f) => f.t)).toEqual([2.2, 2.3, 2.4, 2.5, 2.6, 2.7]);
    expect(frameIndexAt(ring.between(from, to), 2.48)).toBe(3);
  });
  it('respeita o teto de quadros', () => {
    const ring = createFrameRing({ seconds: 10, max: 5 });
    for (let i = 0; i < 9; i += 1) ring.push({ t: i / 100 });
    expect(ring.size).toBe(5);
  });
});

describe('resumo e planilha', () => {
  const lances = [
    { t_ms: 2000, call: 'out', best: { margin_m: -0.08, uncertainty_m: 0.02 }, positions: ['fundo_a'], decided: true },
    { t_ms: 1000, call: 'in', best: { margin_m: 0.3, uncertainty_m: 0.02 }, positions: ['fundo_a', 'topo'], serve: true },
  ];
  it('conta por veredito', () => {
    expect(lanceSummary(lances)).toMatchObject({ in: 1, out: 1, total: 2, decided: 1, serves: 1 });
  });
  it('separa as faltas por regra: pé na cozinha, pé no saque e dois quiques', () => {
    const faltas = [
      { kind: 'serve_foot', call: 'fault' }, { kind: 'serve_foot', call: 'fault' },
      { kind: 'two_bounce', call: 'fault' }, { kind: 'volley', call: 'clean' },
    ];
    expect(lanceSummary(faltas)).toMatchObject({ fault: 3, faults: { volley: 0, serve_foot: 2, two_bounce: 1 } });
  });
  it('monta o CSV em ordem de tempo, com ; e aspas quando precisa', () => {
    const csv = lancesCsv(lances, {
      header: ['Hora', 'Lance', 'Decidido', 'Discordância', 'Margem', 'Incerteza', 'Câmeras'],
      time: (ms) => String(ms),
      label: (l) => (l.call === 'in' ? 'Dentro; saque' : 'Fora'),
      positions: (ids) => ids.join(' + '),
    }).split('\n');
    expect(csv[1]).toBe('1000;"Dentro; saque";;;30;2;fundo_a + topo');
    expect(csv[2]).toBe('2000;Fora;x;;-8;2;fundo_a');
  });
});

describe('conferência da calibração com um 5º ponto', () => {
  it('cada conjunto de cantos tem um ponto de conferência que não é canto', () => {
    expect(checkPointFor('fundo_a')).toMatchObject({ x: W / 2, y: N - K });
    expect(checkPointFor('fundo_b')).toMatchObject({ x: W / 2, y: N + K });
    expect(checkPointFor('rede_1')).toMatchObject({ x: W / 2, y: 0 });
  });
  it('mede o erro em cm e classifica', () => {
    const img = calibrationPoints('fundo_a').map((p) => ({ x: p.x * 100, y: p.y * 100 }));
    const H = solveHomography(img, calibrationPoints('fundo_a'));
    const cp = checkPointFor('fundo_a');
    expect(calibrationCheck(H, { x: cp.x * 100 + 2, y: cp.y * 100 }, cp)).toMatchObject({ level: CHECK_LEVEL.GREAT });
    expect(calibrationCheck(H, { x: cp.x * 100 + 10, y: cp.y * 100 }, cp).level).toBe(CHECK_LEVEL.REDO);
  });
});
