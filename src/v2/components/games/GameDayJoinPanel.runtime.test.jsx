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
}));
vi.mock('@/modules/games/hooks/useArenaGameDays', () => ({
  useLeaveArenaGameDay: () => ({ mutateAsync: sair, isPending: false }),
  useSignUpToArenaGameDay: () => ({ mutateAsync: marcarArena, isPending: false }),
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
    expect(sair).toHaveBeenCalledWith({ gameDayId: 'gd1', uid: 'eu' });
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
