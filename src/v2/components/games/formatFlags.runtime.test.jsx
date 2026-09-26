/**
 * Mexicano e Rei da Quadra atrás das PRÓPRIAS flags (Onda CE), na tela.
 *
 * O que protege:
 *  1. ⭐ sem as flags, criar um dia de jogo oferece Americano e Play — e nada
 *     de Mexicano nem Rei da Quadra;
 *  2. ⭐ cada flag liga SÓ o seu formato;
 *  3. ⭐ o seletor de formato do SORTEIO some quando só sobra o Americano (não
 *     há o que escolher) — e volta com uma flag ligada;
 *  4. ⭐ um dia gravado num formato desligado continua sorteando nele.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FEATURE_FLAG } from '@/core/featureFlags';

const flags = vi.hoisted(() => ({ valores: {} }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({
  useFeatureFlag: (chave) => flags.valores[chave] === true,
}));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, userProfile: { city: 'Porto Alegre', state: 'RS' } }),
}));
const semMutacao = vi.hoisted(() => ({ mutate: () => {}, mutateAsync: async () => ({}), isPending: false }));
const dados = vi.hoisted(() => ({ participants: [], games: [] }));
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useCreateGameDay: () => semMutacao,
  useSetPlayParticipantPartner: () => semMutacao,
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
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({ useMyManagedArenas: () => ({ data: [] }) }));
vi.mock('@/modules/clubs/hooks/useClubs', () => ({ useMyMembership: () => ({ data: null }) }));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({ useAthletes: () => ({ data: [] }) }));
vi.mock('@/modules/rating/services/unifiedLevelService', () => ({
  fetchUnifiedLevelsByParticipant: async () => ({}),
}));
vi.mock('@/v2/components/tutorial/V2TutorialLauncher', () => ({ default: () => null }));

const { default: CreateGameDayDialog } = await import('./CreateGameDayDialog.jsx');
const { default: AthleteGameDayOrganizer } = await import('./AthleteGameDayOrganizer.jsx');

let container, root;
beforeEach(() => {
  flags.valores = {};
  window.localStorage.clear();
  // Quatro atletas (o mínimo para sortear); `u1` é quem criou o dia.
  dados.participants = ['Ana', 'Bia', 'Caio', 'Duda'].map((name, i) => ({ id: `p${i + 1}`, user_id: `u${i + 1}`, name }));
  dados.games = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

async function abrir() {
  await act(async () => { root.render(<CreateGameDayDialog open onOpenChange={() => {}} />); });
}
const opcoes = () => {
  const select = [...document.body.querySelectorAll('select')]
    .find((s) => [...s.options].some((o) => o.value === 'americano'));
  return select ? [...select.options].map((o) => o.value) : [];
};

describe('⭐ criar um dia de jogo: o que se pode escolher', () => {
  it('sem as flags: Americano e Play — nada de Mexicano nem Rei da Quadra', async () => {
    await abrir();
    expect(opcoes()).toEqual(['americano', 'play']);
  });

  it('⭐ só o Mexicano ligado: ele aparece, o Rei da Quadra não', async () => {
    flags.valores = { [FEATURE_FLAG.GAMEDAY_MEXICANO]: true };
    await abrir();
    expect(opcoes()).toEqual(['americano', 'mexicano', 'play']);
  });

  it('⭐ só o Rei da Quadra ligado: ele aparece, o Mexicano não', async () => {
    flags.valores = { [FEATURE_FLAG.GAMEDAY_KING_OF_COURT]: true };
    await abrir();
    expect(opcoes()).toEqual(['americano', 'king_of_court', 'play']);
  });

  it('as três flags ligadas: os cinco formatos, na ordem de sempre', async () => {
    flags.valores = {
      [FEATURE_FLAG.GAMEDAY_MEXICANO]: true,
      [FEATURE_FLAG.GAMEDAY_KING_OF_COURT]: true,
      [FEATURE_FLAG.GAMEDAY_AMERICANO_LIVE]: true,
    };
    await abrir();
    expect(opcoes()).toEqual(['americano', 'mexicano', 'king_of_court', 'play', 'americano_live']);
  });
});

describe('⭐ o seletor de formato do SORTEIO', () => {
  const sortear = async (gameDay) => {
    await act(async () => { root.render(<AthleteGameDayOrganizer gameDay={gameDay} />); });
    const botao = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Sortear jogos'));
    expect(botao, 'botão "Sortear jogos"').toBeTruthy();
    await act(async () => { botao.click(); });
    const select = document.body.querySelector('#gd-format');
    return select ? [...select.options].map((o) => o.value) : null;
  };
  const dia = (format) => ({ id: 'gd1', title: 'Sábado', format, created_by: 'u1', member_uids: ['u1'] });

  it('⭐ sem as flags, só sobra o Americano — e o seletor nem aparece', async () => {
    expect(await sortear(dia('americano'))).toBeNull();
  });

  it('com o Mexicano ligado, o seletor volta com as duas opções de grade', async () => {
    flags.valores = { [FEATURE_FLAG.GAMEDAY_MEXICANO]: true };
    expect(await sortear(dia('americano'))).toEqual(['americano', 'mexicano']);
  });

  it('⭐ um dia JÁ Rei da Quadra segue sorteando Rei da Quadra com a flag desligada', async () => {
    expect(await sortear(dia('king_of_court'))).toEqual(['americano', 'king_of_court']);
  });
});
