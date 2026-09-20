/**
 * 🐞 FALHA NÃO É LISTA VAZIA.
 *
 * O padrão do projeto é `const { data = [] } = useX()`. Numa falha de rede,
 * `data` vem indefinido, cai no `[]` e a tela CONCLUI que não existe nada.
 * Nas telas de dia de jogo isso virava afirmação:
 *
 *   - "Nenhum dia de jogo ainda" — para quem tem dez;
 *   - "Dia de jogo não encontrado. Ele pode ter sido removido ou você não tem
 *     acesso." — na beira da quadra, minutos antes de começar.
 *
 * Quem lê isso não tenta de novo: acredita. E cria um duplicado.
 *
 * A mesma classe já tinha sido corrigida na ARENA (Onda AE) e nunca chegou ao
 * dia de jogo. Estes testes travam os dois lados: a falha tem texto próprio e
 * botão, e o estado vazio DE VERDADE continua igual.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const auth = { user: { uid: 'u1' }, userProfile: {}, isPlatformAdmin: false };
const estado = {
  lista: [], listaErro: false,
  dia: null, diaErro: false,
  recarregouLista: 0, recarregouDia: 0,
};

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => true }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useMyManagedArenas: () => ({ data: [] }),
  useArena: () => ({ data: null }),
  useArenaCourts: () => ({ data: [] }),
}));
vi.mock('@/modules/clubs/hooks/useClubs', () => ({ useMyMembership: () => ({ data: null }) }));
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useMyGameDays: () => ({
    data: estado.listaErro ? undefined : estado.lista,
    isLoading: false,
    isError: estado.listaErro,
    refetch: () => { estado.recarregouLista += 1; },
  }),
  useGameDay: () => ({
    data: estado.diaErro ? undefined : estado.dia,
    isLoading: false,
    isError: estado.diaErro,
    refetch: () => { estado.recarregouDia += 1; },
  }),
  useGameDayParticipants: () => ({ data: [] }),
  useDeleteGameDay: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetPlayParticipantPartner: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/v2/components/games/GameDayModule', () => ({
  default: () => <div>MIOLO</div>,
  GameDayModuleTools: () => <div>FERRAMENTAS</div>,
}));
vi.mock('@/v2/components/games/CreateGameDayDialog', () => ({ default: () => null }));

const { default: V2GameDays } = await import('./V2GameDays.jsx');

let container, root;

function render(rota) {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/dia-de-jogo" element={<V2GameDays />} />
          <Route path="/dia-de-jogo/:gameDayId" element={<V2GameDays />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return container.textContent;
}

function clicar(texto) {
  const alvo = [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
  expect(alvo, `botão "${texto}" não encontrado`).toBeTruthy();
  act(() => { alvo.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

beforeEach(() => {
  Object.assign(estado, {
    lista: [], listaErro: false, dia: null, diaErro: false,
    recarregouLista: 0, recarregouDia: 0,
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe('🐞 a LISTA de dias de jogo', () => {
  it('⭐ falha NÃO diz que a pessoa não tem dia de jogo', () => {
    estado.listaErro = true;
    const txt = render('/dia-de-jogo');
    expect(txt).not.toContain('Nenhum dia de jogo ainda');
    expect(txt).toContain('Não foi possível carregar');
  });

  it('⭐ a falha oferece o caminho de volta, e o botão realmente recarrega', () => {
    estado.listaErro = true;
    render('/dia-de-jogo');
    clicar('Tentar de novo');
    expect(estado.recarregouLista).toBe(1);
  });

  it('vazio DE VERDADE continua convidando a criar', () => {
    const txt = render('/dia-de-jogo');
    expect(txt).toContain('Nenhum dia de jogo ainda');
    expect(txt).not.toContain('Não foi possível carregar');
  });

  it('com dias de jogo, nem vazio nem falha aparecem', () => {
    estado.lista = [{ id: 'g1', title: 'Rachão', date: '2099-10-02', visibility: 'public' }];
    const txt = render('/dia-de-jogo');
    expect(txt).toContain('Rachão');
    expect(txt).not.toContain('Nenhum dia de jogo ainda');
    expect(txt).not.toContain('Não foi possível carregar');
  });
});

describe('🐞 UM dia de jogo', () => {
  const dia = { id: 'g1', title: 'Rachão de quinta', date: '2099-10-02', visibility: 'public', format: 'play', created_by: 'u1', member_uids: ['u1'] };

  it('⭐ falha NÃO afirma que foi removido nem que falta acesso', () => {
    estado.diaErro = true;
    const txt = render('/dia-de-jogo/g1');
    expect(txt).not.toContain('pode ter sido removido');
    expect(txt).not.toContain('não tem acesso');
    expect(txt).toContain('Não foi possível carregar');
  });

  it('⭐ o botão de tentar de novo recarrega o dia de jogo', () => {
    estado.diaErro = true;
    render('/dia-de-jogo/g1');
    clicar('Tentar de novo');
    expect(estado.recarregouDia).toBe(1);
  });

  it('ausência DE VERDADE continua dizendo que não foi encontrado', () => {
    estado.dia = null;
    const txt = render('/dia-de-jogo/g1');
    expect(txt).toContain('não encontrado');
    expect(txt).not.toContain('Não foi possível carregar');
  });

  it('o dia de jogo que carregou abre normalmente', () => {
    estado.dia = dia;
    const txt = render('/dia-de-jogo/g1');
    expect(txt).toContain('Rachão de quinta');
    expect(txt).toContain('MIOLO');
  });
});
