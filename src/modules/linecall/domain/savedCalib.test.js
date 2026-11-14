import { describe, it, expect } from 'vitest';
import { savedCalibFor, seenFromSaved, curForDb, cameraTodo } from './remoteCalib.js';

const quatro = [{ x: 10, y: 10 }, { x: 100, y: 10 }, { x: 100, y: 60 }, { x: 10, y: 60 }];

describe('a calibração guardada na quadra', () => {
  it('volta a mais recente, nos pixels do vídeo de agora', () => {
    const velho = { vw: 1280, cur: { corners: quatro, hue: 60, ms: 1000 } };
    const novo = { vw: 1280, cur: { corners: quatro.map((p) => ({ x: p.x + 1, y: p.y })), hue: 70, zone: 'kitchens', ms: 2000 } };
    const c = savedCalibFor([velho, novo], 1920);
    expect(c.corners[0]).toEqual({ x: 16.5, y: 15 });
    expect(c.zone).toBe('kitchens');
    expect(c.hue).toBe(70);
  });

  it('nada guardado (ou incompleto) não vira calibração', () => {
    expect(savedCalibFor([], 1280)).toBeNull();
    expect(savedCalibFor([{ cur: { corners: quatro.slice(0, 3) } }, null], 1280)).toBeNull();
  });

  it('guarda só a calibração completa, com a hora', () => {
    expect(curForDb({ corners: quatro.slice(0, 2), hue: 60 })).toBeNull();
    expect(curForDb({ corners: quatro, hue: 60, zone: 'full' }, 5)).toMatchObject({ ms: 5, zone: 'full' });
  });

  it('ao reabrir, o começar antigo e a calibração da central já aplicada não voltam', () => {
    const d = { calib: { corners: quatro }, calib_ms: 10, applied_ms: 10, run: true, run_ms: 11, snap_req_ms: 3, snap_ms: 4 };
    const todo = cameraTodo(d, seenFromSaved(d));
    expect(todo).toEqual({ applyCalib: false, run: null, sendSnap: false });
    // A calibração que a central mandou e a câmera NÃO aplicou ainda vale.
    expect(cameraTodo({ ...d, applied_ms: 5 }, seenFromSaved({ ...d, applied_ms: 5 })).applyCalib).toBe(true);
  });
});
