/**
 * O LEGADO DO CLUBE CONTINUA DE PÉ.
 *
 * A Onda AS fez o dia de jogo do clube nascer como `game_days` — o mesmo
 * módulo do atleta e da arena. O pedido era explícito: **não mexer no que já
 * está publicado**. A garantia é uma pergunta só, `isModularEventDate(date)`,
 * e é ela que este arquivo prende:
 *
 *  · data SEM `game_day_id` (tudo o que existe hoje) → organizador LEGADO,
 *    lendo e escrevendo exatamente onde sempre leu e escreveu;
 *  · data COM `game_day_id` (as novas) → o MÓDULO.
 *
 * Um teste de comportamento comum não pega isto: cada tela, isolada, funciona.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const auth = { user: { uid: 'u1' }, userProfile: {} };
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({ useMyManagedArenas: () => ({ data: [] }) }));
const papel = { role: 'admin' };
// A data LEGADA também consulta o clube e as listas do evento, para decidir se
// a conversão para o módulo é segura (só quando a data está VAZIA).
const legado = { participants: [], games: [], falhou: false };
vi.mock('@/modules/clubs/hooks/useClubs', () => ({
  useMyMembership: () => ({ data: papel }),
  useClub: () => ({ data: { id: 'clube1', name: 'Clube' } }),
  useEventParticipants: () => ({ data: legado.participants, isError: legado.falhou }),
  useEventGames: () => ({ data: legado.games, isError: legado.falhou }),
}));
const converteu = { chamadas: [] };
vi.mock('@/modules/games/hooks/useClubGameDay', () => ({
  useUpgradeEventDate: () => ({
    mutateAsync: vi.fn(async (args) => { converteu.chamadas.push(args); return { gameDayId: 'novo' }; }),
    isPending: false,
  }),
}));

// As duas casas, trocadas por sentinelas: o que importa aqui é QUAL delas a
// data escolhe, não o que cada uma desenha por dentro.
vi.mock('@/modules/clubs/components/GameDayOrganizer', () => ({
  default: () => <div>ORGANIZADOR LEGADO DO CLUBE</div>,
}));
vi.mock('@/v2/components/games/GameDayModule', () => ({
  default: () => <div>MODULO UNICO</div>,
  GameDayModuleTools: () => <div>FERRAMENTAS DO DIA</div>,
}));

vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => false }));

const estado = { gameDay: null, participants: [], games: [] };
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useGameDay: () => ({ data: estado.gameDay, isLoading: false }),
  useGameDayParticipants: () => ({ data: estado.participants, isLoading: false }),
  useGameDayGames: () => ({ data: estado.games, isLoading: false }),
  useAddGameDayParticipant: () => ({ mutateAsync: vi.fn(async () => ({})), isPending: false }),
  useRemoveGameDayParticipant: () => ({ mutateAsync: vi.fn(async () => ({})), isPending: false }),
  useUpdateGameDay: () => ({ mutateAsync: vi.fn(async () => ({})), isPending: false }),
}));

const { default: ClubGameDayTab } = await import('./ClubGameDayTab.jsx');

const evento = { id: 'ev1', title: 'Rachão de quinta', club_id: 'clube1' };

let container;
let root;

function render(ui) {
  act(() => { root.render(<MemoryRouter>{ui}</MemoryRouter>); });
  return container.textContent;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  estado.gameDay = null;
  estado.participants = [];
  estado.games = [];
  papel.role = 'admin';
  legado.participants = [];
  legado.games = [];
  legado.falhou = false;
  converteu.chamadas = [];
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('⭐ a data do evento escolhe a casa', () => {
  it('⭐ data LEGADA (sem game_day_id) abre o organizador de sempre', () => {
    const texto = render(
      <ClubGameDayTab event={evento} clubId="clube1" date={{ id: 'd1', date_time: '2026-09-25T19:00' }} />,
    );
    expect(texto).toContain('ORGANIZADOR LEGADO DO CLUBE');
    expect(texto).not.toContain('MODULO UNICO');
  });

  it('game_day_id vazio ou nulo também é legado', () => {
    [null, '', undefined].forEach((v) => {
      const texto = render(
        <ClubGameDayTab event={evento} clubId="clube1" date={{ id: 'd1', game_day_id: v }} />,
      );
      expect(texto).toContain('ORGANIZADOR LEGADO DO CLUBE');
    });
  });

  it('⭐ data NOVA (com game_day_id) abre o módulo único', () => {
    estado.gameDay = { id: 'gd1', title: 'Rachão', format: 'americano', club_id: 'clube1', created_by: 'u1' };
    const texto = render(
      <ClubGameDayTab event={evento} clubId="clube1" date={{ id: 'd2', game_day_id: 'gd1' }} />,
    );
    expect(texto).toContain('MODULO UNICO');
    expect(texto).toContain('FERRAMENTAS DO DIA');
    expect(texto).not.toContain('ORGANIZADOR LEGADO DO CLUBE');
  });

  it('dia de jogo arquivado não deixa a aba em branco — explica', () => {
    estado.gameDay = null;
    const texto = render(
      <ClubGameDayTab event={evento} clubId="clube1" date={{ id: 'd2', game_day_id: 'gd_sumiu' }} />,
    );
    expect(texto).toContain('não foi encontrado');
  });
});

/*
 * ⭐ Formato, quadras e "quem organiza" NÃO se testam mais aqui.
 *
 * Eles deixaram de ser um cartão escrito à mão nesta aba e viraram as
 * CONFIGURAÇÕES DO DIA DE JOGO, dentro do `GameDayModule` — que é o que faz
 * elas chegarem iguais ao atleta, à arena e ao clube. Os mesmos invariantes
 * (trava com partidas, regra da flag, quem pode configurar) estão em
 * `src/v2/components/games/gameDaySettings.runtime.test.jsx`, agora valendo
 * para as três origens em vez de só para o clube.
 */

describe('⭐ a data legada ganha uma PORTA — estreita de propósito', () => {
  const dataLegada = { id: 'd1', date_time: '2026-09-25T19:00' };
  const abrir = () => render(
    <ClubGameDayTab event={evento} clubId="clube1" date={dataLegada} />,
  );

  it('⭐ data VAZIA pode ser convertida: não há documento para esconder', () => {
    const texto = abrir();
    expect(texto).toContain('Ativar o módulo completo');
    expect(texto).toContain('ainda está vazia');
    // E o organizador de sempre continua na tela — nada foi substituído.
    expect(texto).toContain('ORGANIZADOR LEGADO DO CLUBE');
  });

  it('⭐ com PARTIDA na data, não converte — e diz por quê', () => {
    legado.games = [{ id: 'g1', date_id: 'd1' }];
    const texto = abrir();
    expect(texto).not.toContain('Ativar o módulo completo');
    expect(texto).toContain('partidas');
    expect(texto).toContain('ORGANIZADOR LEGADO DO CLUBE');
  });

  it('⭐ com ATLETA inserido na data, também não', () => {
    legado.participants = [{ id: 'p1', date_id: 'd1' }];
    const texto = abrir();
    expect(texto).not.toContain('Ativar o módulo completo');
    expect(texto).toContain('atletas');
  });

  it('⭐ dado de OUTRA data do mesmo evento não bloqueia esta', () => {
    legado.participants = [{ id: 'p1', date_id: 'outra' }];
    legado.games = [{ id: 'g1', date_id: 'outra' }];
    expect(abrir()).toContain('Ativar o módulo completo');
  });

  it('⭐ consulta FALHANDO não oferece converter — vazio desconhecido não é vazio', () => {
    legado.falhou = true;
    const texto = abrir();
    expect(texto).not.toContain('Ativar o módulo completo');
    expect(texto).toContain('Não deu para conferir');
  });

  it('a data do MÓDULO não mostra a porta (já está do outro lado)', () => {
    estado.gameDay = { id: 'gd1', title: 'Rachão', format: 'americano', club_id: 'clube1', created_by: 'u1' };
    const texto = render(
      <ClubGameDayTab event={evento} clubId="clube1" date={{ id: 'd2', game_day_id: 'gd1' }} />,
    );
    expect(texto).not.toContain('Ativar o módulo completo');
    expect(texto).not.toContain('organizador antigo');
  });
});

describe('⭐ o membro entra e sai sozinho (era o que o legado já permitia)', () => {
  beforeEach(() => {
    estado.gameDay = { id: 'gd1', title: 'Rachão', format: 'americano', club_id: 'clube1', created_by: 'outra' };
  });

  it('⭐ quem não está no dia vê "Marcar presença"', () => {
    const texto = render(<ClubGameDayTab event={evento} clubId="clube1" date={{ id: 'd2', game_day_id: 'gd1' }} />);
    expect(texto).toContain('Marcar presença');
    expect(texto).toContain('ainda não está');
  });

  it('⭐ quem já está vê a saída, não o convite para entrar de novo', () => {
    estado.participants = [{ id: 'p1', user_id: 'u1', name: 'Eu' }];
    const texto = render(<ClubGameDayTab event={evento} clubId="clube1" date={{ id: 'd2', game_day_id: 'gd1' }} />);
    expect(texto).toContain('Sair do dia de jogo');
    expect(texto).not.toContain('Marcar presença');
  });
});

describe('⭐ o que o LOCAL acrescenta: os confirmados da data', () => {
  const rsvps = [
    { user_id: 'a1', user_name: 'Ana', status: 'going' },
    { user_id: 'a2', user_name: 'Bruno', status: 'going' },
    { user_id: 'a3', user_name: 'Carla', status: 'maybe' },
    { user_id: 'a4', user_name: 'Davi', status: 'not_going' },
  ];

  beforeEach(() => {
    estado.gameDay = { id: 'gd1', title: 'Rachão', format: 'americano', club_id: 'clube1', created_by: 'u1' };
  });

  it('⭐ oferece inserir só quem confirmou "vou"', () => {
    const texto = render(
      <ClubGameDayTab event={evento} clubId="clube1" date={{ id: 'd2', game_day_id: 'gd1' }} rsvps={rsvps} />,
    );
    expect(texto).toContain('Ana');
    expect(texto).toContain('Bruno');
    // "talvez" e "não vou" não são presença confirmada.
    expect(texto).not.toContain('Carla');
    expect(texto).not.toContain('Davi');
  });

  it('⭐ quem JÁ está no dia de jogo não é oferecido de novo', () => {
    estado.participants = [{ id: 'p1', user_id: 'a1', name: 'Ana' }];
    const texto = render(
      <ClubGameDayTab event={evento} clubId="clube1" date={{ id: 'd2', game_day_id: 'gd1' }} rsvps={rsvps} />,
    );
    expect(texto).not.toContain('Ana');
    expect(texto).toContain('Bruno');
  });

  it('sem ninguém pendente, o atalho some em vez de ocupar a tela', () => {
    estado.participants = [{ id: 'p1', user_id: 'a1' }, { id: 'p2', user_id: 'a2' }];
    const texto = render(
      <ClubGameDayTab event={evento} clubId="clube1" date={{ id: 'd2', game_day_id: 'gd1' }} rsvps={rsvps} />,
    );
    expect(texto).not.toContain('Confirmaram presença');
  });

  it('sem RSVP nenhum, nada é prometido', () => {
    const texto = render(
      <ClubGameDayTab event={evento} clubId="clube1" date={{ id: 'd2', game_day_id: 'gd1' }} rsvps={[]} />,
    );
    expect(texto).not.toContain('Confirmaram presença');
    expect(texto).toContain('MODULO UNICO');
  });
});
