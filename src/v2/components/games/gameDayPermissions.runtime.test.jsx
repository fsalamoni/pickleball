/**
 * Os comandos só aparecem para quem tem atribuição.
 *
 * O domínio (`gameDayRoles.test.js`) prova QUEM pode o quê; as regras do
 * Firestore (`tests/rules/gameDayRoles.rules.emulator.mjs`) provam que o
 * servidor recusa quem não pode. Este arquivo prova o terceiro pedaço: que a
 * INTERFACE não oferece o botão a quem não tem direito — porque um botão que
 * aparece e depois falha é pior do que não aparecer.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const auth = { user: { uid: 'dono' }, userProfile: {} };
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));

const dados = { participants: [], games: [] };
const semMutacao = { mutate: vi.fn(), mutateAsync: vi.fn(async () => ({})), isPending: false };

vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useGameDayParticipants: () => ({ data: dados.participants, isLoading: false }),
  useGameDayGames: () => ({ data: dados.games, isLoading: false }),
  useAddGameDayParticipant: () => semMutacao,
  useRemoveGameDayParticipant: () => semMutacao,
  useAddGameDayGame: () => semMutacao,
  useUpdateGameDayGame: () => semMutacao,
  useDeleteGameDayGame: () => semMutacao,
  useAppendGameDayGames: () => semMutacao,
  useClearGameDayGames: () => semMutacao,
  useGameDayRankingMeta: () => ({ data: null }),
  usePublishGameDayRanking: () => semMutacao,
  useUnpublishGameDayRanking: () => semMutacao,
  useAddGameDayAdmin: () => semMutacao,
  useRemoveGameDayAdmin: () => semMutacao,
  useSetGameDayManageMode: () => semMutacao,
}));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({ useAthletes: () => ({ data: [] }) }));
vi.mock('@/modules/rating/services/unifiedLevelService', () => ({
  fetchUnifiedLevelsByParticipant: async () => ({}),
}));

const { default: AthleteGameDayOrganizer } = await import('./AthleteGameDayOrganizer.jsx');

const DONO = 'dono';
const ADMIN = 'admin';
const JOGA = 'joga';

const dia = (extra = {}) => ({
  id: 'gd1', title: 'Sábado', format: 'americano', created_by: DONO,
  member_uids: [DONO, ADMIN, JOGA], ...extra,
});

let container, root;

beforeEach(() => {
  window.localStorage.clear();
  auth.user = { uid: DONO };
  dados.participants = [
    { id: 'p1', user_id: DONO, name: 'Dono', source: 'owner' },
    { id: 'p2', user_id: ADMIN, name: 'Admin', source: 'invited' },
    { id: 'p3', user_id: JOGA, name: 'Joga', source: 'joined' },
    { id: 'p4', user_id: null, name: 'Convidado', source: 'guest' },
  ];
  dados.games = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(gameDay) {
  act(() => { root.render(<AthleteGameDayOrganizer gameDay={gameDay} />); });
}

const texto = () => container.textContent;
const temBotao = (rotulo) => [...container.querySelectorAll('button')]
  .some((b) => b.textContent.includes(rotulo));

describe('dia de jogo RESTRITO (o padrão)', () => {
  it('o criador vê todos os comandos', () => {
    auth.user = { uid: DONO };
    render(dia());
    expect(temBotao('Inserir atletas')).toBe(true);
    expect(temBotao('Sortear jogos')).toBe(true);
    expect(temBotao('Inserir partida')).toBe(true);
    expect(texto()).toContain('Resultados no ranking');
  });

  it('o criador vê o painel de Organização', () => {
    auth.user = { uid: DONO };
    render(dia());
    expect(texto()).toContain('Organização');
  });

  it('participante comum NÃO vê nenhum comando', () => {
    auth.user = { uid: JOGA };
    render(dia());
    expect(temBotao('Inserir atletas')).toBe(false);
    expect(temBotao('Sortear jogos')).toBe(false);
    expect(temBotao('Inserir partida')).toBe(false);
  });

  it('participante comum NÃO vê o painel de Organização nem o de ranking', () => {
    auth.user = { uid: JOGA };
    render(dia());
    expect(texto()).not.toContain('Organização');
    expect(texto()).not.toContain('Resultados no ranking');
  });

  it('participante comum continua VENDO participantes e jogos', () => {
    auth.user = { uid: JOGA };
    render(dia());
    expect(texto()).toContain('Participantes');
    expect(texto()).toContain('Jogos');
    expect(texto()).toContain('Ranking do dia');
  });
});

describe('organizador nomeado', () => {
  const comAdmin = () => dia({ admin_uids: [ADMIN] });

  it('vê os comandos das partidas e dos participantes', () => {
    auth.user = { uid: ADMIN };
    render(comAdmin());
    expect(temBotao('Inserir atletas')).toBe(true);
    expect(temBotao('Sortear jogos')).toBe(true);
  });

  it('NÃO vê o painel de Organização (nomear é só do criador)', () => {
    auth.user = { uid: ADMIN };
    render(comAdmin());
    expect(texto()).not.toContain('Organização');
  });

  it('NÃO vê a publicação no ranking (o espelho é amarrado ao criador)', () => {
    auth.user = { uid: ADMIN };
    render(comAdmin());
    expect(texto()).not.toContain('Resultados no ranking');
  });

  it('quem não foi nomeado segue sem comandos', () => {
    auth.user = { uid: JOGA };
    render(comAdmin());
    expect(temBotao('Sortear jogos')).toBe(false);
  });
});

describe('dia de jogo ABERTO aos participantes', () => {
  const aberto = () => dia({ manage_mode: 'participants' });

  it('participante inscrito passa a ver os comandos', () => {
    auth.user = { uid: JOGA };
    render(aberto());
    expect(temBotao('Inserir atletas')).toBe(true);
    expect(temBotao('Sortear jogos')).toBe(true);
  });

  it('abrir o dia NÃO dá acesso ao painel de Organização', () => {
    auth.user = { uid: JOGA };
    render(aberto());
    expect(texto()).not.toContain('Organização');
  });

  it('abrir o dia NÃO dá acesso à publicação no ranking', () => {
    auth.user = { uid: JOGA };
    render(aberto());
    expect(texto()).not.toContain('Resultados no ranking');
  });

  it('quem NÃO está inscrito continua sem comandos, mesmo com o dia aberto', () => {
    auth.user = { uid: 'estranho' };
    render(aberto());
    expect(temBotao('Sortear jogos')).toBe(false);
    expect(temBotao('Inserir atletas')).toBe(false);
  });
});
