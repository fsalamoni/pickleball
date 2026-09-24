/**
 * Teste de RUNTIME do painel "Ranking e rating" do admin.
 *
 * Ele passou a dizer QUANDO o servidor recalculou pela última vez. Em
 * 2026-09-22 a última passada era de 18/09 e nada na plataforma mostrava isso.
 * O que só a tela prova: a data aparece em pt-BR, um erro recente aparece, e
 * uma leitura que FALHA não vira afirmação ("nunca recalculou").
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { data: null, isLoading: false, isError: false };

vi.mock('@/modules/rating/hooks/useRating', () => ({
  useRankingWorkerStatus: () => estado,
}));

const { default: RankingAutomatico } = await import('./RankingAutomatico.jsx');

const ts = (iso) => ({ toMillis: () => Date.parse(iso) });

let container;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  Object.assign(estado, { data: null, isLoading: false, isError: false });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = () => act(() => { root.render(<RankingAutomatico />); });

describe('RankingAutomatico — o estado do servidor', () => {
  it('⭐ mostra a última atualização do servidor, em pt-BR, com o motivo', () => {
    estado.data = { last_run_at: ts('2026-09-18T00:26:38Z'), last_request_reason: 'club-event-game' };
    render();
    expect(container.textContent).toContain('Última atualização do servidor');
    expect(container.textContent).toContain('17/09/2026, 21:26');
    expect(container.textContent).toContain('dia de jogo publicado');
  });

  it('⭐ erro depois da última passada aparece', () => {
    estado.data = {
      last_run_at: ts('2026-09-18T00:00:00Z'),
      last_error: 'DEADLINE_EXCEEDED',
      last_error_at: ts('2026-09-19T12:00:00Z'),
    };
    render();
    expect(container.textContent).toContain('falhou (DEADLINE_EXCEEDED)');
  });

  it('⭐ leitura que falha NÃO afirma que o servidor nunca recalculou', () => {
    estado.isError = true;
    render();
    expect(container.textContent).toContain('Não foi possível ler agora');
    expect(container.textContent).not.toContain('ainda não registrou');
  });

  it('sem registro nenhum, diz isso', () => {
    estado.data = null;
    render();
    expect(container.textContent).toContain('O servidor ainda não registrou nenhum recálculo.');
  });

  it('explica a rede de segurança de 30 minutos', () => {
    render();
    expect(container.textContent).toContain('a cada 30 minutos');
  });

  it('carregando: não mostra linha de estado nenhuma', () => {
    estado.isLoading = true;
    render();
    expect(container.textContent).not.toContain('Última atualização');
    expect(container.textContent).not.toContain('ainda não registrou');
  });
});
