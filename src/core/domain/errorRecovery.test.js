import { describe, it, expect } from 'vitest';
import {
  isChunkLoadError, autoRetryDelayMs, planErrorRecovery, MAX_AUTO_RETRY,
} from './errorRecovery.js';

describe('isChunkLoadError — versão velha x defeito de código', () => {
  it('⭐ reconhece a falha de baixar pedaço de código nos quatro navegadores', () => {
    [
      new Error('Failed to fetch dynamically imported module: https://x/assets/a-123.js'),
      new Error('error loading dynamically imported module'),
      new Error('Importing a module script failed.'),
      new Error('Failed to load module script: MIME type'),
      new Error('Unable to preload CSS for /assets/x.css'),
    ].forEach((e) => expect(isChunkLoadError(e), e.message).toBe(true));
  });

  it('reconhece pelo NOME do erro também', () => {
    const e = new Error('qualquer coisa');
    e.name = 'ChunkLoadError';
    expect(isChunkLoadError(e)).toBe(true);
  });

  it('⭐ defeito de programação NÃO é confundido com versão velha', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false);
    expect(isChunkLoadError(new Error('x is not a function'))).toBe(false);
  });

  it('não quebra com entrada estranha', () => {
    [null, undefined, 0, '', {}].forEach((e) => expect(isChunkLoadError(e)).toBe(false));
  });
});

describe('autoRetryDelayMs — espera que cresce', () => {
  it('a primeira tentativa é rápida e as seguintes esperam mais', () => {
    expect(autoRetryDelayMs(0)).toBe(3_000);
    expect(autoRetryDelayMs(1)).toBe(6_000);
    expect(autoRetryDelayMs(2)).toBe(12_000);
  });

  it('⭐ tem teto — não vira espera de horas nem martela o aparelho', () => {
    expect(autoRetryDelayMs(10)).toBe(30_000);
    expect(autoRetryDelayMs(99)).toBe(30_000);
  });

  it('entrada inválida não gera espera negativa', () => {
    expect(autoRetryDelayMs(-5)).toBe(3_000);
    expect(autoRetryDelayMs(undefined)).toBe(3_000);
  });
});

describe('planErrorRecovery — o que a tela faz', () => {
  const chunk = new Error('Failed to fetch dynamically imported module: /assets/x.js');
  const bug = new TypeError("Cannot read properties of undefined (reading 'map')");

  it('⭐ versão velha manda RECARREGAR, não "tentar de novo"', () => {
    // Tentar de novo não adianta: o pedaço de código continua não existindo.
    const p = planErrorRecovery({ error: chunk });
    expect(p).toMatchObject({ kind: 'chunk', reload: true, autoRetry: false });
    expect(p.title).toMatch(/versão nova/i);
  });

  it('⭐ versão velha manda recarregar mesmo no telão — repetir não resolveria', () => {
    expect(planErrorRecovery({ error: chunk, unattended: true }).autoRetry).toBe(false);
  });

  it('⭐ com alguém olhando, NÃO tenta sozinho: a pessoa decide', () => {
    const p = planErrorRecovery({ error: bug, unattended: false });
    expect(p.autoRetry).toBe(false);
    expect(p.description).toMatch(/resto da plataforma continua funcionando/);
  });

  it('⭐ sozinho no telão, tenta de novo por conta própria', () => {
    const p = planErrorRecovery({ error: bug, unattended: true, attempt: 0 });
    expect(p.autoRetry).toBe(true);
    expect(p.delayMs).toBe(3_000);
    expect(p.description).toMatch(/sozinho/);
  });

  it('⭐ e DESISTE depois do limite — tentar para sempre é um laço que ninguém vê', () => {
    const p = planErrorRecovery({ error: bug, unattended: true, attempt: MAX_AUTO_RETRY });
    expect(p.autoRetry).toBe(false);
    expect(p.delayMs).toBe(0);
  });

  it('a espera cresce entre as tentativas do telão', () => {
    const d = [0, 1, 2].map((a) => planErrorRecovery({ error: bug, unattended: true, attempt: a }).delayMs);
    expect(d).toEqual([3_000, 6_000, 12_000]);
  });

  it('sem erro nenhum não quebra', () => {
    expect(() => planErrorRecovery()).not.toThrow();
    expect(planErrorRecovery().kind).toBe('code');
  });
});
