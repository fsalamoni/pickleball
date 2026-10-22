/**
 * "Meus pontos no ranking": ano a ano, com a posição gravada no ranking do
 * ano, o que não conta, o cancelado com o motivo e a soma de todos os anos;
 * leitura que falhou é dita, nunca vira "você não pontuou".
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { pontos: null, rankings: { porAno: {}, isLoading: false, isError: false, retry: vi.fn() } };
vi.mock('@/modules/federations/hooks/useFederations', () => ({
  useMyFederationPoints: () => estado.pontos,
  useFederationRankings: () => estado.rankings,
}));

const { default: FedMyPoints } = await import('./FedMyPoints');

const ANO = new Date().getFullYear();
const fed = { id: 'fpp', name: 'FPP', modules: { ranking: true }, ranking_config: { best_n: 1 } };
const e = (id, extra = {}) => ({ id, federation_id: 'fpp', result_id: id, uid: 'ana', season: ANO, status: 'awarded', points: 100, position: 1, date: `${ANO}-03-10`, tournament_name: `Torneio ${id}`, category: 'male_open_doubles', ...extra });

let container, root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async () => { await act(async () => { root.render(<FedMyPoints federation={fed} uid="ana" />); }); };

describe('FedMyPoints', () => {
  it('mostra cada ano, a posição do ranking gravado, o que não conta, o cancelado e a soma', async () => {
    estado.pontos = { isSuccess: true, isLoading: false, isError: false, data: [
      e('a'), e('b', { points: 70, position: 2, date: `${ANO}-04-01` }), e('c', { status: 'cancelled', cancel_reason: 'result_rejected', points: 50 }),
      e('d', { season: ANO - 3, date: `${ANO - 3}-05-01`, points: 40 }), e('outra', { federation_id: 'fxx', points: 999 }),
    ] };
    estado.rankings = { porAno: { [ANO - 3]: { config: { best_n: 6 }, general: [{ uid: 'zed', position: 1 }, { uid: 'ana', position: 2 }] } }, isLoading: false, isError: false, retry: vi.fn() };
    await montar();
    const txt = container.textContent;
    expect(txt).toContain('Meus pontos no ranking');
    expect(txt).toContain('Soma de todos os anos: 140 pontos');
    expect(txt).toContain(`aberto até 31/01/${ANO + 1}`);
    expect(txt).toContain('encerrado');
    expect(txt).toContain('2º de 2 na geral');
    expect(txt).toContain('não conta');
    expect(txt).toContain('Resultado recusado pela federação');
    expect(txt).not.toContain('999');
  });
  it('falhou: diz que não carregou, não afirma que a pessoa não pontuou', async () => {
    estado.pontos = { isSuccess: false, isLoading: false, isError: true, data: undefined, refetch: vi.fn() };
    estado.rankings = { porAno: {}, isLoading: false, isError: false, retry: vi.fn() };
    await montar();
    expect(container.textContent).toContain('Não carregou os seus pontos');
    expect(container.textContent).not.toContain('ainda não pontuou');
  });
  it('módulo de ranking desligado: não mostra nada', async () => {
    estado.pontos = { isSuccess: true, data: [] };
    await act(async () => { root.render(<FedMyPoints federation={{ ...fed, modules: { ranking: false } }} uid="ana" />); });
    expect(container.textContent).toBe('');
  });
});
