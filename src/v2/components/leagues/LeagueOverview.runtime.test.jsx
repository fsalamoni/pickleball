/**
 * A visão geral da liga no desenho do torneio (docs/57 §15): o cartão do
 * critério segue a ordem de desempate CONFIGURADA na liga, as divisões são
 * cards como as modalidades (inscrever abre o diálogo; quem está na divisão
 * vê "Você está inscrito" e "Sair da liga") e o antigo `/gerir` leva à
 * página de gestão sem perder a seção.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';

vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u-1' }, profile: {} }) }));
vi.mock('@/modules/leagues/hooks/useLeagues', () => ({ useLeagueAction: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
vi.mock('@/v2/components/people/PersonPicker', () => ({ default: () => <div data-testid="seletor" /> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const dadosDaLiga = vi.fn();
vi.mock('@/v2/components/leagues/useLeagueData', () => ({ useLeagueData: (...a) => dadosDaLiga(...a) }));
vi.mock('@/v2/components/leagues/LeaguesGate', () => ({ default: ({ children }) => children }));

const { default: LeagueOverview } = await import('./LeagueOverview.jsx');
const { default: V2League } = await import('@/v2/pages/V2League.jsx');

const ok = (data) => ({ data, isSuccess: true, isLoading: false, isError: false, refetch: vi.fn() });
const liga = (extra = {}) => ({
  id: 'l1', name: 'Liga de Verão', format: 'divisional_pairs', status: 'open', visibility: 'public',
  season: { cadence: 'weekly', start_date: '2026-11-01' },
  standings: { mode: 'points', win: 3, loss: 1, wo_loss: 0, tiebreak_order: ['balance', 'wins'] },
  ...extra,
});
const divisoes = ok([{ id: 'd1', name: 'Série A', max_entries: 8 }, { id: 'd2', name: 'Série B' }]);

let root;
let el;
async function render(node, entrada = '/') {
  el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => { root.render(<MemoryRouter initialEntries={[entrada]}>{node}</MemoryRouter>); });
  return el;
}
afterEach(() => { act(() => root.unmount()); el.remove(); document.body.innerHTML = ''; });
const botao = (texto) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(texto));

describe('visão geral da liga', () => {
  it('o cartão do critério lista a ordem de desempate configurada na liga', async () => {
    const c = await render(<LeagueOverview league={liga()} divisions={divisoes} entries={ok([])} matches={ok([])} onGo={() => {}} />);
    const texto = c.textContent;
    expect(texto).toContain('Critério de classificação');
    expect(texto).toContain('Pontos na tabela');
    expect(texto.indexOf('Saldo de pontos')).toBeGreaterThan(-1);
    expect(texto.indexOf('Saldo de pontos')).toBeLessThan(texto.indexOf('Mais vitórias'));
  });

  it('cada divisão vira um card; "Inscrever-se" abre o diálogo da divisão', async () => {
    const c = await render(<LeagueOverview league={liga()} divisions={divisoes} entries={ok([])} matches={ok([])} onGo={() => {}} />);
    expect(c.textContent).toContain('Série A');
    expect(c.textContent).toContain('0 de 8 duplas');
    await act(async () => { botao('Inscrever-se').click(); });
    expect(document.body.textContent).toContain('Entrar na liga');
    expect(document.querySelector('#liga-insc-div').value).toBe('d1');
  });

  it('quem está na divisão vê "Você está inscrito" e "Sair da liga"', async () => {
    const minha = { id: 'e1', division_id: 'd2', status: 'active', player_uids: ['u-1', 'u-2'], players: [{ name: 'Ana' }, { name: 'Bia' }] };
    const c = await render(<LeagueOverview league={liga()} divisions={divisoes} entries={ok([minha])} matches={ok([])} onGo={() => {}} />);
    expect(c.textContent).toContain('Você está inscrito');
    expect(botao('Sair da liga')).toBeTruthy();
    expect(c.textContent).toContain('Ana · Bia');
  });

  it('com a organização inscrevendo, o card diz isso em vez do botão', async () => {
    const c = await render(<LeagueOverview league={liga({ self_registration: false })} divisions={divisoes} entries={ok([])} matches={ok([])} onGo={() => {}} />);
    expect(botao('Inscrever-se')).toBeUndefined();
    expect(c.textContent).toContain('Quem inscreve é a organização');
  });
});

function Onde() {
  const { pathname, search } = useLocation();
  return <p>{`gestão em ${pathname}${search}`}</p>;
}

describe('página da liga', () => {
  it('o antigo /gerir leva à gestão, com a seção', async () => {
    dadosDaLiga.mockReturnValue({ liga: ok(liga()), divisoes, inscricoes: ok([]), jogos: ok([]), gere: true, acessoCarregando: false });
    const c = await render(
      <Routes>
        <Route path="/ligas/:leagueId/gerenciar" element={<Onde />} />
        <Route path="/ligas/:leagueId/:tab" element={<V2League />} />
      </Routes>,
      '/ligas/l1/gerir?secao=rodadas',
    );
    expect(c.textContent).toBe('gestão em /ligas/l1/gerenciar?secao=rodadas');
  });
});
