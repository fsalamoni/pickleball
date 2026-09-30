/**
 * "Participar" DENTRO do dia de jogo — para onde o "Jogar" do início leva.
 *
 * Pedido: *"clicando no dia de jogo, deve levar para dentro dele (não para a
 * arena), local em que o usuário pode se inserir como participante (se
 * público)"*. Antes, quem abria um dia público que não era dele não tinha
 * botão nenhum ali.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = {};
const entrar = vi.fn(async () => {});
const sair = vi.fn(async () => {});
const marcarArena = vi.fn(async () => {});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'eu' } }) }));
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useGameDayParticipants: () => estado.inscritos,
  useJoinPublicGameDay: () => ({ mutateAsync: entrar, isPending: false }),
  useLeaveGameDay: () => ({ mutateAsync: sair, isPending: false }),
}));
vi.mock('@/modules/games/hooks/useArenaGameDays', () => ({
  useLeaveArenaGameDay: () => ({ mutateAsync: sair, isPending: false }),
  useSignUpToArenaGameDay: () => ({ mutateAsync: marcarArena, isPending: false }),
}));
// Os clubes da pessoa: é por ser do clube que ela entra sozinha no dia dele.
vi.mock('@/modules/clubs/hooks/useClubs', () => ({
  useMyClubs: () => ({ data: estado.clubes, isLoading: false }),
}));

const { default: GameDayJoinPanel } = await import('./GameDayJoinPanel.jsx');
const { joinPanelApplies } = await import('@/modules/games/domain/gameDayJoin');

const AGORA = new Date(2026, 8, 30, 10, 0).getTime();
const ok = (data) => ({ data, isLoading: false, isError: false, refetch: vi.fn() });
const diaAtleta = (over = {}) => ({
  id: 'gd1', title: 'Racha', visibility: 'public', status: 'active', created_by: 'ana',
  member_uids: ['ana'], date: '2026-10-03', time: '09:00', ...over,
});
const diaArena = (over = {}) => ({
  id: 'gdA', title: 'Play', visibility: 'public', status: 'active', created_by: 'gestor', arena_id: 'A1',
  member_uids: ['gestor'], date: '2026-10-02', capacity: 4, format: 'play',
  arena_slots: [{ court_id: 'q1', court_name: 'Quadra 1', start_time: '18:00', end_time: '21:00' }], ...over,
});

let container;
let root;
beforeEach(() => {
  estado.inscritos = ok([]);
  estado.clubes = [{ id: 'c1', name: 'Clube Ace' }];
  entrar.mockClear(); sair.mockClear(); marcarArena.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = async (props) => {
  await act(async () => { root.render(<MemoryRouter><GameDayJoinPanel agora={AGORA} {...props} /></MemoryRouter>); });
};
const botao = (t) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(t));
const clicar = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }); };

describe('quem vê o painel', () => {
  it('só num dia público que não é meu nem da minha gestão', () => {
    expect(joinPanelApplies(diaAtleta(), { uid: 'eu' })).toBe(true);
    expect(joinPanelApplies(diaAtleta({ visibility: 'private' }), { uid: 'eu' })).toBe(false);
    expect(joinPanelApplies(diaAtleta({ created_by: 'eu' }), { uid: 'eu' })).toBe(false);
    expect(joinPanelApplies(diaArena(), { uid: 'eu', podeConfigurar: true })).toBe(false);
    // Dia de clube: só para quem é do clube (souDoClube), nunca por ser público.
    expect(joinPanelApplies(diaAtleta({ club_id: 'c1' }), { uid: 'eu' })).toBe(false);
    expect(joinPanelApplies(diaArena({ open_slot_id: 's1' }), { uid: 'eu' })).toBe(false);
    expect(joinPanelApplies(diaAtleta({ status: 'archived' }), { uid: 'eu' })).toBe(false);
    expect(joinPanelApplies(diaAtleta(), { uid: null })).toBe(false);
  });
});

describe('⭐ dia público do atleta', () => {
  it('entra com um toque', async () => {
    await render({ gameDay: diaAtleta() });
    expect(container.textContent).toContain('Participar');
    await clicar(botao('Participar do dia de jogo'));
    expect(entrar).toHaveBeenCalledWith(expect.objectContaining({ id: 'gd1' }));
  });

  it('quem já está vê que está, e pode sair', async () => {
    estado.inscritos = ok([{ id: 'p1', user_id: 'eu' }]);
    await render({ gameDay: diaAtleta() });
    expect(container.textContent).toContain('Você está inscrito');
    await clicar(botao('Sair do dia de jogo'));
    expect(sair).toHaveBeenCalledWith('gd1');
  });

  it('com a lista falhando, não oferece entrar (não se sabe se já está)', async () => {
    estado.inscritos = { data: undefined, isLoading: false, isError: true, refetch: vi.fn() };
    await render({ gameDay: diaAtleta() });
    expect(container.textContent).toContain('Não carregou quem vai');
    expect(botao('Participar do dia de jogo')).toBeUndefined();
  });

  it('o que já aconteceu não oferece entrada', async () => {
    await render({ gameDay: diaAtleta({ date: '2026-09-29' }) });
    expect(container.textContent).toContain('já aconteceu');
    expect(botao('Participar')).toBeUndefined();
  });
});

describe('⭐ dia de jogo da arena', () => {
  it('mostra as vagas e marca presença — dentro do dia, sem mandar para a arena', async () => {
    estado.inscritos = ok([{ user_id: 'x' }]);
    await render({ gameDay: diaArena() });
    expect(container.textContent).toContain('1 de 4 vagas preenchidas');
    expect(container.querySelector('a[href="/dia-de-jogo/gdA"]')).toBeNull();
    await clicar(botao('Marcar presença'));
    expect(marcarArena).toHaveBeenCalledWith(expect.objectContaining({ gameDay: expect.objectContaining({ id: 'gdA' }) }));
  });

  it('lotado: diz o motivo em vez de só desabilitar', async () => {
    estado.inscritos = ok(Array.from({ length: 4 }, (_, i) => ({ user_id: `u${i}` })));
    await render({ gameDay: diaArena() });
    expect(botao('Marcar presença').disabled).toBe(true);
    expect(container.textContent).toContain('As vagas deste dia de jogo acabaram');
  });
});

describe('⭐ dia de jogo do CLUBE (privado)', () => {
  const diaClube = (over = {}) => ({
    id: 'gdC', title: 'Terça do clube', visibility: 'private', status: 'active', club_id: 'c1',
    club_name: 'Clube Ace', created_by: 'org', member_uids: ['org'], date: '2026-10-06', time: '19:00', ...over,
  });

  it('o membro do clube entra com um toque — é o dia aberto pelo "Jogar" e pelo Procura-se jogo', async () => {
    await render({ gameDay: diaClube() });
    expect(container.textContent).toContain('dia de jogo do seu clube');
    await clicar(botao('Participar do dia de jogo'));
    expect(entrar).toHaveBeenCalledWith(expect.objectContaining({ id: 'gdC' }));
  });

  it('e sai com um toque', async () => {
    estado.inscritos = ok([{ id: 'p1', user_id: 'eu' }]);
    await render({ gameDay: diaClube() });
    await clicar(botao('Sair do dia de jogo'));
    expect(sair).toHaveBeenCalledWith('gdC');
  });

  it('quem organiza (agendou a data) também pode entrar para jogar', async () => {
    await render({ gameDay: diaClube({ created_by: 'eu' }), podeConfigurar: true });
    expect(botao('Participar do dia de jogo')).toBeTruthy();
  });

  it('quem não é do clube não vê o botão (a regra recusaria)', async () => {
    estado.clubes = [];
    await render({ gameDay: diaClube() });
    expect(container.textContent).toBe('');
  });

  it('a regra do painel: no clube vale ser do clube, não quem criou', () => {
    expect(joinPanelApplies(diaClube(), { uid: 'eu', souDoClube: true })).toBe(true);
    expect(joinPanelApplies(diaClube({ created_by: 'eu' }), { uid: 'eu', podeConfigurar: true, souDoClube: true })).toBe(true);
    expect(joinPanelApplies(diaClube(), { uid: 'eu', souDoClube: false })).toBe(false);
    expect(joinPanelApplies(diaClube({ status: 'archived' }), { uid: 'eu', souDoClube: true })).toBe(false);
  });
});
