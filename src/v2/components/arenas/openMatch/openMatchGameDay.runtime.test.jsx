/**
 * O jogo aberto que é um dia de jogo (Onda CA) — as telas.
 *
 * O que protege:
 *  1. ⭐ publicar pergunta "como se joga" (formato, quem conduz) e as quadras,
 *     e diz o efeito ANTES de salvar;
 *  2. sem quadra não publica (e não chama o serviço);
 *  3. editar abre preenchido com o dia de jogo (nome, formato);
 *  4. ⭐ Central: o cartão do jogo aberto ligado leva ao dia de jogo; o antigo,
 *     com quadra e por acontecer, oferece "Criar o dia de jogo"; quadras que
 *     não carregaram viram erro, nunca "a arena não tem quadras";
 *  5. ⭐ página do dia de jogo: o painel do jogo aberto conta os convidados da
 *     arena (lotado oferece a fila) e entra pelo mesmo botão da arena;
 *  6. a linha do jogo aberto na página da arena leva ao dia de jogo;
 *  7. guardas de fonte: a página do dia de jogo monta o painel sob demanda, e a
 *     seção "Dias de jogo" da arena não repete o jogo aberto.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = {
  slot: null, slotErro: false, participantes: [], fila: [], gameDay: null, quadrasErro: false, ligados: new Set(),
};
const criar = vi.fn(() => Promise.resolve({ slotId: 's9', gameDayId: 'gd9' }));
const editar = vi.fn(() => Promise.resolve());
const ligar = vi.fn(() => Promise.resolve());
const entrar = vi.fn(() => Promise.resolve());
const erro = vi.fn();
const mut = (fn = vi.fn(() => Promise.resolve())) => ({ mutateAsync: fn, isPending: false });

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: (...a) => erro(...a) } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'eu' }, isAuthenticated: true }) }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => false }));
vi.mock('@/modules/rating/hooks/useMyUnifiedLevel', () => ({ useMyUnifiedLevel: () => ({ level: 3.5 }) }));
vi.mock('@/modules/arenas/hooks/useBookings', () => ({ useArenaBookings: () => ({ data: [] }) }));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({ useAthletes: () => ({ data: [] }) }));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArenaCourts: () => (estado.quadrasErro
    ? { data: undefined, isError: true, isLoading: false, refetch: vi.fn() }
    : { data: [{ id: 'q1', name: 'Quadra 1' }, { id: 'q2', name: 'Quadra 2' }], isError: false, isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => estado.ligados.has(id), isLoading: false }),
}));
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useGameDay: () => ({ data: estado.gameDay, isLoading: false, isError: false }),
  useGameDayParticipants: () => ({ data: estado.participantes }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useCreateOpenMatch: () => mut(criar),
  useUpdateOpenMatch: () => mut(editar),
  useLinkOpenSlotToGameDay: () => mut(ligar),
  useOpenSlot: () => ({ data: estado.slotErro ? undefined : estado.slot, isLoading: false, isError: estado.slotErro, refetch: vi.fn() }),
  useUserWaitlist: () => ({ data: estado.fila }),
  useArenaOpenSlots: () => ({ data: estado.slot ? [estado.slot] : [], isLoading: false, isError: false, refetch: vi.fn() }),
  useArenaWaitlist: () => ({ data: [] }),
  useJoinOpenSlot: () => mut(entrar),
  useLeaveOpenSlot: () => mut(),
  useJoinWaitlist: () => mut(),
  useLeaveWaitlist: () => mut(),
  useAcceptWaitlist: () => mut(),
  useDeclineWaitlist: () => mut(),
  useCancelOpenSlot: () => mut(),
  useDeleteOpenSlot: () => mut(),
}));

const { default: OpenMatchForm } = await import('./OpenMatchForm.jsx');
const { default: OpenMatchGameDayPanel } = await import('./OpenMatchGameDayPanel.jsx');
const { default: ArenaOpenMatchAdminPanel } = await import('./ArenaOpenMatchAdminPanel.jsx');
const { OpenSlotRow } = await import('./OpenSlotCard.jsx');

const COURTS = [{ id: 'q1', name: 'Quadra 1' }, { id: 'q2', name: 'Quadra 2' }];
const vaga = (over = {}) => ({
  id: 's1', arena_id: 'a1', arena_name: 'Arena', date: '2099-05-10', start: '19:00', end: '21:00',
  court: 'Quadra 1', court_id: 'q1', total_spots: 4, participants: [], status: 'open', format: 'duplas', ...over,
});

let container;
let root;
beforeEach(() => {
  Object.assign(estado, {
    slot: null, slotErro: false, participantes: [], fila: [], gameDay: null, quadrasErro: false, ligados: new Set(),
  });
  [criar, editar, ligar, entrar, erro].forEach((f) => f.mockClear());
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = async (el) => { await act(async () => { root.render(<MemoryRouter>{el}</MemoryRouter>); }); };
const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(texto));
const clicar = async (el) => { await act(async () => { el.click(); }); };
function digitar(sel, valor) {
  const el = container.querySelector(sel);
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
  setter.call(el, valor);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
const enviar = async () => { await act(async () => { container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); };

describe('⭐ publicar: como se joga, onde e o efeito antes de salvar', () => {
  it('escolhe quadras e formato, mostra o efeito e publica o dia de jogo junto', async () => {
    await render(<OpenMatchForm arenaId="a1" courts={COURTS} onClose={vi.fn()} />);
    expect(container.textContent).toContain('Como se joga');
    expect(container.textContent).toContain('Quem conduz as partidas');
    await act(async () => { digitar('#om-data', '2099-05-10'); });
    await clicar(botao('Quadra 1'));
    await clicar(botao('Quadra 2'));
    await clicar(botao('Play'));
    expect(container.textContent).toMatch(/Vira um dia de jogo em Play, em 2 quadras, para até 8 atletas/);
    expect(container.textContent).toContain('No Play não há placar');
    await clicar(botao('A equipe e os inscritos'));
    await enviar();
    expect(criar).toHaveBeenCalledTimes(1);
    const { arenaId, input, ctx } = criar.mock.calls[0][0];
    expect(arenaId).toBe('a1');
    expect(input).toMatchObject({
      date: '2099-05-10', court_ids: ['q1', 'q2'], game_format: 'play', manage_mode: 'participants', total_spots: 8,
    });
    expect(ctx.bookings).toEqual([]);
  });

  it('sem quadra não publica — e diz por quê', async () => {
    await render(<OpenMatchForm arenaId="a1" courts={COURTS} onClose={vi.fn()} />);
    await act(async () => { digitar('#om-data', '2099-05-10'); });
    await enviar();
    expect(criar).not.toHaveBeenCalled();
    expect(erro).toHaveBeenCalledWith('Escolha pelo menos uma quadra.');
  });

  it('editar abre preenchido com o dia de jogo', async () => {
    await render(
      <OpenMatchForm arenaId="a1" courts={COURTS} mode="edit"
        slot={vaga({ game_day_id: 'gd1', court_ids: ['q2'] })}
        gameDay={{ id: 'gd1', title: 'Terça do Americano', format: 'mexicano', manage_mode: 'owner_only' }}
        onClose={vi.fn()} />,
    );
    expect(container.querySelector('#om-titulo').value).toBe('Terça do Americano');
    expect(botao('Mexicano').getAttribute('aria-pressed')).toBe('true');
    expect(botao('Quadra 2').getAttribute('aria-pressed')).toBe('true');
    await enviar();
    expect(editar).toHaveBeenCalledWith(expect.objectContaining({ slotId: 's1' }));
  });
});

describe('⭐ Central: o cartão leva ao dia de jogo', () => {
  it('ligado: "Organizar o jogo" abre o dia de jogo; mostra o formato', async () => {
    estado.slot = vaga({ game_day_id: 'gd1', game_format: 'americano' });
    await render(<ArenaOpenMatchAdminPanel arena={{ id: 'a1' }} />);
    const link = [...container.querySelectorAll('a')].find((a) => a.textContent.includes('Organizar o jogo'));
    expect(link.getAttribute('href')).toBe('/dia-de-jogo/gd1');
    expect(container.textContent).toContain('Dia de jogo · Americano');
    expect(botao('Editar')).toBeTruthy();
  });

  it('⭐ quadras sem carregar: diz que falhou — nunca "a arena não tem quadras"', async () => {
    estado.quadrasErro = true;
    await render(<ArenaOpenMatchAdminPanel arena={{ id: 'a1' }} />);
    expect(container.textContent).toContain('Não foi possível carregar as quadras');
    expect(container.textContent).not.toContain('ainda não tem quadras');
    expect(botao('Publicar jogo')).toBeFalsy();
  });

  it('antigo, com quadra e por acontecer: oferece "Criar o dia de jogo"', async () => {
    estado.slot = vaga();
    await render(<ArenaOpenMatchAdminPanel arena={{ id: 'a1' }} />);
    expect(botao('Criar o dia de jogo')).toBeTruthy();
    expect([...container.querySelectorAll('a')].some((a) => a.textContent.includes('Organizar o jogo'))).toBe(false);
  });
});

describe('⭐ página do dia de jogo: o painel do jogo aberto', () => {
  const dia = { id: 'gd1', open_slot_id: 's1', arena_id: 'a1' };

  it('o convidado da arena ocupa lugar: lotado oferece a fila', async () => {
    estado.slot = vaga({ game_day_id: 'gd1', total_spots: 2, participants: ['x'] });
    estado.participantes = [{ user_id: 'x' }, { user_id: null, name: 'Convidado' }];
    await render(<OpenMatchGameDayPanel gameDay={dia} />);
    expect(container.textContent).toContain('Lotado');
    expect(botao('Entrar na fila de espera')).toBeTruthy();
    expect(botao('Quero jogar')).toBeFalsy();
  });

  it('com vaga, entra pelo mesmo botão da página da arena', async () => {
    estado.slot = vaga({ game_day_id: 'gd1', total_spots: 4, participants: ['x'], min_level: 3, max_level: 4 });
    estado.participantes = [{ user_id: 'x' }];
    await render(<OpenMatchGameDayPanel gameDay={dia} />);
    expect(container.textContent).toContain('3 vagas de 4');
    expect(container.textContent).toContain('Nível 3.0 a 4.0 · o seu é 3.5');
    await clicar(botao('Quero jogar'));
    expect(entrar).toHaveBeenCalledWith('s1');
  });

  it('já inscrito pela arena (só no dia de jogo) vê "Sair deste jogo"', async () => {
    estado.slot = vaga({ game_day_id: 'gd1', participants: [] });
    estado.participantes = [{ user_id: 'eu' }];
    await render(<OpenMatchGameDayPanel gameDay={dia} />);
    expect(botao('Sair deste jogo')).toBeTruthy();
  });

  it('cancelado: diz, e aponta outros jogos', async () => {
    estado.slot = vaga({ game_day_id: 'gd1', status: 'cancelled' });
    await render(<OpenMatchGameDayPanel gameDay={dia} />);
    expect(container.textContent).toContain('foi cancelado pela arena');
    expect(botao('Quero jogar')).toBeFalsy();
  });

  it('falha de leitura vira aviso, não some', async () => {
    estado.slotErro = true;
    await render(<OpenMatchGameDayPanel gameDay={dia} />);
    expect(container.textContent).toContain('Não foi possível carregar o jogo aberto');
  });

  it('⭐ com o ranking da casa ligado, diz que o jogo conta — e leva ao ranking', async () => {
    estado.ligados = new Set(['leagues']);
    estado.slot = vaga({ game_day_id: 'gd1' });
    await render(<OpenMatchGameDayPanel gameDay={{ ...dia, format: 'americano' }} />);
    expect(container.textContent).toContain('Este jogo conta no ranking da casa');
    const link = [...container.querySelectorAll('a')].find((a) => a.textContent.includes('Ver o ranking'));
    expect(link.getAttribute('href')).toBe('/arenas/a1/torneios');
  });

  it('Play não pontua — e a tela diz por quê', async () => {
    estado.ligados = new Set(['leagues']);
    estado.slot = vaga({ game_day_id: 'gd1' });
    await render(<OpenMatchGameDayPanel gameDay={{ ...dia, format: 'play' }} />);
    expect(container.textContent).toContain('Play não tem placar');
  });

  it('sem o módulo do ranking, não fala de ranking', async () => {
    estado.slot = vaga({ game_day_id: 'gd1' });
    await render(<OpenMatchGameDayPanel gameDay={{ ...dia, format: 'americano' }} />);
    expect(container.textContent).not.toContain('ranking da casa');
  });
});

describe('a linha do jogo aberto na página da arena', () => {
  it('ligado: formato e o caminho para o dia de jogo', async () => {
    await render(<ul><OpenSlotRow slot={vaga({ game_day_id: 'gd1', game_format: 'americano_live' })} /></ul>);
    expect(container.textContent).toContain('Americano aprimorado');
    const link = [...container.querySelectorAll('a')].find((a) => a.textContent.includes('regras e quem vai'));
    expect(link.getAttribute('href')).toBe('/dia-de-jogo/gd1');
  });

  it('sem conta, não manda para uma porta fechada', async () => {
    await render(<ul><OpenSlotRow slot={vaga({ game_day_id: 'gd1' })} semConta /></ul>);
    expect(container.textContent).not.toContain('regras e quem vai');
  });
});

describe('guardas de fonte', () => {
  it('a página do dia de jogo monta o painel do jogo aberto, sob demanda', () => {
    const src = readFileSync('src/v2/pages/V2GameDays.jsx', 'utf8');
    expect(src).toMatch(/const OpenMatchGameDayPanel = lazy\(\(\) => import\('@\/v2\/components\/arenas\/openMatch\/OpenMatchGameDayPanel'\)\)/);
    expect(src).toMatch(/isOpenMatchGameDay\(gameDay\) && \(\s*<Suspense/);
  });

  it('a seção "Dias de jogo" da arena não repete o jogo aberto', () => {
    const src = readFileSync('src/v2/components/arenas/ArenaGameDaysSection.jsx', 'utf8');
    expect(src).toMatch(/\.filter\(\(g\) => !isOpenMatchGameDay\(g\)\)/);
  });
});
