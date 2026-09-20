import { describe, it, expect, vi } from 'vitest';
import { combinarConsultas, podeAfirmarVazio } from './queryState.js';

const ok = { isLoading: false, isError: false };
const carregando = { isLoading: true, isError: false };
const falhou = { isLoading: false, isError: true };

describe('combinarConsultas', () => {
  it('tudo pronto: nem carregando nem falhou', () => {
    expect(combinarConsultas([ok, ok])).toMatchObject({ carregando: false, falhou: false });
  });

  it('UMA carregando já deixa a tela carregando', () => {
    expect(combinarConsultas([ok, carregando, ok]).carregando).toBe(true);
  });

  it('UMA falha já é falha — a que ficar de fora é justamente a que mente', () => {
    expect(combinarConsultas([ok, ok, falhou]).falhou).toBe(true);
  });

  it('recarregar chama o refetch de TODAS as que têm', () => {
    const a = { ...falhou, refetch: vi.fn() };
    const b = { ...ok, refetch: vi.fn() };
    const c = { ...ok };
    combinarConsultas([a, b, c, null, undefined]).recarregar();
    expect(a.refetch).toHaveBeenCalledOnce();
    expect(b.refetch).toHaveBeenCalledOnce();
  });

  it('lista vazia ou com buracos não quebra', () => {
    expect(combinarConsultas()).toMatchObject({ carregando: false, falhou: false });
    expect(() => combinarConsultas([null, undefined]).recarregar()).not.toThrow();
  });

  it('consulta DESABILITADA (isPending eterno) não trava a tela', () => {
    const desabilitada = { isPending: true, isLoading: false, isError: false };
    expect(combinarConsultas([ok, desabilitada]).carregando).toBe(false);
  });
});

describe('podeAfirmarVazio', () => {
  it('só afirma vazio quando terminou e não falhou', () => {
    expect(podeAfirmarVazio(ok)).toBe(true);
  });

  it('carregando NÃO afirma vazio — o mês sem reserva carregada parece livre', () => {
    expect(podeAfirmarVazio(carregando)).toBe(false);
  });

  it('falha NÃO afirma vazio — é o defeito inteiro', () => {
    expect(podeAfirmarVazio(falhou)).toBe(false);
  });

  it('sem consulta, não afirma nada', () => {
    expect(podeAfirmarVazio(undefined)).toBe(false);
  });
});
