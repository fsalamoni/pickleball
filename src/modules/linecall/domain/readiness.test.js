import { describe, it, expect } from 'vitest';
import { readinessCheck } from './readiness';

const ok = { calibrated: true, analyzing: true, fps: 60, battery: 90, charging: false, check_cm: 2 };

describe('readinessCheck', () => {
  it('tudo no ar e saudável = pronto', () => {
    expect(readinessCheck(['fundo_a', 'fundo_b'], { fundo_a: ok, fundo_b: ok })).toMatchObject({ ready: true, blocking: 0, warnings: 0 });
  });

  it('posição vazia e sem calibrar bloqueiam; lenta, bateria e erro só avisam', () => {
    const r = readinessCheck(['fundo_a', 'fundo_b', 'rede_1', 'topo'], {
      fundo_a: null,
      fundo_b: { ...ok, calibrated: false },
      rede_1: { ...ok, fps: 15, battery: 10, check_cm: 9 },
      topo: { ...ok, analyzing: false },
    });
    expect(r.ready).toBe(false);
    expect(r.blocking).toBe(3);
    expect(r.issues.filter((i) => i.position === 'rede_1').map((i) => i.code)).toEqual(['slow', 'battery', 'calibration']);
  });

  it('a câmera que saiu do lugar trava; a escura só avisa', () => {
    const r = readinessCheck(['fundo_a', 'fundo_b'], { fundo_a: { ...ok, alert: 'moved' }, fundo_b: { ...ok, alert: 'dark' } });
    expect(r.issues).toEqual([
      { position: 'fundo_a', code: 'moved', level: 'block' },
      { position: 'fundo_b', code: 'dark', level: 'warn' },
    ]);
    expect(readinessCheck(['fundo_a'], { fundo_a: { ...ok, alert: 'qualquer' } }).ready).toBe(true);
  });

  it('bateria baixa carregando não avisa', () => {
    expect(readinessCheck(['fundo_a'], { fundo_a: { ...ok, battery: 5, charging: true } }).ready).toBe(true);
  });
});
