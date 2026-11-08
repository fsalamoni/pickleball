import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { addClockSamples, clockOffsets, alignCalls, alignCams, serverMs, toViewerMs } from './clockSync.js';
import { fuseLineCalls, isCamOnline } from './fusion.js';

const T0 = 1_800_000_000_000;
const ts = (ms) => Timestamp.fromMillis(ms);
// Câmera A com o relógio 3 min ATRASADO; câmera B certa. Subida de 150 ms.
const camA = (seen) => ({ uid: 'a', position: 'fundo_a', seen_ms: seen, updated_at: ts(seen + 180000 + 150) });
const camB = (seen) => ({ uid: 'b', position: 'fundo_b', seen_ms: seen, updated_at: ts(seen + 150) });

describe('relógios dos aparelhos (clockSync)', () => {
  it('lê a hora do servidor de Timestamp e de { seconds }', () => {
    expect(serverMs(ts(T0))).toBe(T0);
    expect(serverMs({ seconds: 10, nanoseconds: 5e6 })).toBe(10005);
    expect(serverMs(null)).toBeNull();
  });

  it('sem amostras a diferença é zero — igual ao de antes', () => {
    const off = clockOffsets(null);
    expect(toViewerMs(1234, { uid: 'x', position: 'y' }, off)).toBe(1234);
  });

  it('fica com a MENOR diferença (o atraso da rede só soma) e ignora sinal repetido', () => {
    let s = addClockSamples(null, [camA(T0)], null);
    s = addClockSamples(s, [{ ...camA(T0 - 180000), updated_at: ts(T0 + 900) }], null); // subida lenta
    s = addClockSamples(s, [camA(T0)], null); // o mesmo sinal relido
    expect(s.cams.a_fundo_a).toHaveLength(2);
    expect(clockOffsets(s).cams.a_fundo_a).toBe(180150);
  });

  it('sinal ainda sem hora do servidor (escrita pendente) não vira amostra', () => {
    const s = addClockSamples(null, [{ uid: 'a', position: 'p', seen_ms: T0, updated_at: null }], T0);
    expect(s.cams).toEqual({});
    expect(s.view).toEqual([]);
  });

  it('o MESMO quique visto pelas duas câmeras vira um lance só (antes viravam dois)', () => {
    const q = (id, uid, position, tMs) => ({ id, uid, position, kind: 'bounce', call: 'out', t_ms: tMs, uncertainty_m: 0.03, x: 3, y: 13.5 });
    const calls = [q('1', 'a', 'fundo_a', T0 - 180000 + 50), q('2', 'b', 'fundo_b', T0)];
    expect(fuseLineCalls(calls)).toHaveLength(2);
    const off = clockOffsets(addClockSamples(null, [camA(T0 - 180000), camB(T0)], null));
    const lances = fuseLineCalls(alignCalls(calls, off));
    expect(lances).toHaveLength(1);
    expect(lances[0].calls.map((c) => c.t_ms_raw)).toContain(T0 - 180000 + 50);
  });

  it('a câmera de relógio atrasado não aparece "fora do ar" na tela de quem olha', () => {
    // Esta tela recebe o sinal 80 ms depois do servidor gravá-lo.
    const sinal = camA(T0 - 180000);
    const off = clockOffsets(addClockSamples(null, [sinal], serverMs(sinal.updated_at) + 80));
    expect(isCamOnline(sinal, T0 + 1000)).toBe(false);
    expect(isCamOnline(alignCams([sinal], off)[0], T0 + 1000)).toBe(true);
  });
});
