import { describe, it, expect, vi } from 'vitest';
import { JANELA_DESFAZER_MS, agendarDesfazivel } from './desfazer.js';

describe('agendarDesfazivel', () => {
  it('⭐ só executa depois da janela; desfazer antes cancela e nada roda', () => {
    vi.useFakeTimers();
    const executar = vi.fn();
    const a = agendarDesfazivel({ executar });
    vi.advanceTimersByTime(JANELA_DESFAZER_MS - 1);
    expect(executar).not.toHaveBeenCalled();
    expect(a.cancelar()).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(executar).not.toHaveBeenCalled();
    expect(a.pendente()).toBe(false);
    vi.useRealTimers();
  });
  it('passada a janela executa uma vez; cancelar depois não desfaz; "agora" antecipa', () => {
    vi.useFakeTimers();
    const executar = vi.fn(() => 'ok');
    const a = agendarDesfazivel({ executar });
    vi.advanceTimersByTime(JANELA_DESFAZER_MS);
    expect(executar).toHaveBeenCalledTimes(1);
    expect(a.cancelar()).toBe(false);
    expect(a.agora()).toBeUndefined();
    expect(executar).toHaveBeenCalledTimes(1);

    const b = agendarDesfazivel({ executar: vi.fn(() => 'já') });
    expect(b.agora()).toBe('já');
    expect(b.pendente()).toBe(false);
    vi.useRealTimers();
  });
});
