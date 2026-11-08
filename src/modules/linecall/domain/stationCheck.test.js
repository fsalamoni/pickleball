import { describe, it, expect } from 'vitest';
import { stationCheck, STATION_NEXT } from './stationCheck.js';

const pronto = {
  hasStream: true,
  cameraChecks: [{ key: 'fps', level: 'ok' }, { key: 'resolution', level: 'ok' }],
  calibrated: true, checkLevel: 'great', cmPerPixel: 2, running: true, fps: 60, frameMs: 12,
  battery: { level: 80, charging: false }, usesPose: true, poseState: 'ready',
};
const codes = (r) => r.items.map((i) => `${i.code}:${i.level}`);

describe('stationCheck — o próximo passo de uma câmera', () => {
  it('sem câmera, o passo é abrir a câmera', () => {
    expect(stationCheck({})).toMatchObject({ next: STATION_NEXT.OPEN, ready: false });
  });

  it('segue a ordem da quadra: marcar, conferir, analisar', () => {
    expect(stationCheck({ ...pronto, calibrated: false, checkLevel: null, running: false }).next).toBe(STATION_NEXT.MARK);
    expect(stationCheck({ ...pronto, checkLevel: null, running: false }).next).toBe(STATION_NEXT.CHECK);
    expect(stationCheck({ ...pronto, running: false }).next).toBe(STATION_NEXT.START);
  });

  it('tudo certo e analisando = pronto, sem próximo passo', () => {
    const r = stationCheck(pronto);
    expect(r).toMatchObject({ next: null, ready: true });
    expect(codes(r)).toEqual(['camera:ok', 'calibration:ok', 'analysis:ok', 'central:ok']);
  });

  it('câmera abaixo do mínimo manda trocar antes de tudo', () => {
    const r = stationCheck({ ...pronto, cameraChecks: [{ key: 'fps', level: 'block' }], calibrated: false });
    expect(r.next).toBe(STATION_NEXT.CAMERA);
  });

  it('erro alto no 5º ponto ou câmera que mexeu pedem marcar de novo', () => {
    expect(stationCheck({ ...pronto, checkLevel: 'redo' }).next).toBe(STATION_NEXT.REMARK);
    const r = stationCheck({ ...pronto, moved: true });
    expect(r.next).toBe(STATION_NEXT.REMARK);
    expect(r.ready).toBe(false);
  });

  it('lento, longe, escuro, sem central e bateria baixa só avisam', () => {
    const r = stationCheck({
      ...pronto, fps: 18, cmPerPixel: 4.2, dark: true, shareError: true, battery: { level: 10, charging: false }, poseState: 'failed',
    });
    expect(r.next).toBe(null);
    expect(codes(r)).toEqual(expect.arrayContaining(['analysis:warn', 'far:warn', 'light:warn', 'central:warn', 'battery:warn', 'pose:warn']));
    expect(r.ready).toBe(true); // avisos não bloqueiam
  });

  it('quadro que leva mais de 33 ms para analisar conta como lento', () => {
    expect(codes(stationCheck({ ...pronto, frameMs: 48 }))).toContain('analysis:warn');
  });

  it('bateria baixa carregando não avisa; aparelho sem central não mostra o item', () => {
    const r = stationCheck({ ...pronto, battery: { level: 5, charging: true }, sharing: false });
    expect(codes(r).some((c) => c.startsWith('battery') || c.startsWith('central'))).toBe(false);
  });
});
