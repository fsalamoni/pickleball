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
vi.mock('@/modules/clubs/hooks/useClubs', () => ({ useMyMembership: () => ({ data: papel }) }));

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

describe('⭐ trocar o formato: só enquanto não houver partidas', () => {
  beforeEach(() => {
    estado.gameDay = {
      id: 'gd1', title: 'Rachão', format: 'americano', club_id: 'clube1', created_by: 'u1', play_courts: 1,
    };
  });

  const seletor = () => container.querySelector('#fmt-gd1');

  it('⭐ sem partidas, o formato é editável', () => {
    render(<ClubGameDayTab event={evento} clubId="clube1" date={{ id: 'd2', game_day_id: 'gd1' }} />);
    expect(seletor()).toBeTruthy();
    expect(seletor().disabled).toBe(false);
  });

  it('⭐ com partidas, trava e EXPLICA em vez de só desabilitar', () => {
    estado.games = [{ id: 'g1', round: 1 }];
    const texto = render(<ClubGameDayTab event={evento} clubId="clube1" date={{ id: 'd2', game_day_id: 'gd1' }} />);
    expect(seletor().disabled).toBe(true);
    expect(texto).toContain('já tem partidas');
  });

  it('⭐ o Americano aprimorado só aparece com a flag ligada', () => {
    // `useFeatureFlag` está mockado como false neste arquivo.
    const valores = Array.from(seletorOpcoes());
    expect(valores).not.toContain('americano_live');
    expect(valores).toContain('americano');
    expect(valores).toContain('play');
  });

  function seletorOpcoes() {
    render(<ClubGameDayTab event={evento} clubId="clube1" date={{ id: 'd2', game_day_id: 'gd1' }} />);
    return Array.from(seletor().querySelectorAll('option')).map((o) => o.value);
  }

  it('o formato GRAVADO aparece mesmo com a flag desligada (senão o seletor mentiria)', () => {
    estado.gameDay = { ...estado.gameDay, format: 'americano_live' };
    render(<ClubGameDayTab event={evento} clubId="clube1" date={{ id: 'd2', game_day_id: 'gd1' }} />);
    const valores = Array.from(seletor().querySelectorAll('option')).map((o) => o.value);
    expect(valores).toContain('americano_live');
  });

  it('⭐ membro COMUM do clube não troca o formato (nem sendo organizador do dia)', () => {
    papel.role = 'member';
    estado.gameDay = { ...estado.gameDay, created_by: 'outra-pessoa', manage_mode: 'participants' };
    estado.participants = [{ id: 'p1', user_id: 'u1' }];
    render(<ClubGameDayTab event={evento} clubId="clube1" date={{ id: 'd2', game_day_id: 'gd1' }} />);
    expect(seletor()).toBeNull();
  });

  it('⭐ ADMINISTRADOR do clube troca o formato mesmo sem ter agendado a data', () => {
    estado.gameDay = { ...estado.gameDay, created_by: 'outra-pessoa' };
    render(<ClubGameDayTab event={evento} clubId="clube1" date={{ id: 'd2', game_day_id: 'gd1' }} />);
    expect(seletor()).toBeTruthy();
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
