/**
 * A tela inicial personalizada (Onda CG).
 *
 * O que protege:
 *  1. ⭐ cada pessoa vê a SUA tela: quem gere arena vê a arena e o atalho
 *     direto para a Central (com os pedidos); quem organiza vê "criar
 *     torneio" e o torneio esquecido sem encerrar; quem compete vê os torneios
 *     abertos perto dela e o último resultado;
 *  2. ⭐ nada vencido: torneio encerrado ou com prazo vencido não aparece;
 *  3. ⭐ falha não é vazio: consulta que falhou diz que falhou (com "Tentar de
 *     novo") e NUNCA "não há";
 *  4. ⭐ uma seção quebrada não derruba a tela;
 *  5. Personalizar salva os interesses pelo mesmo caminho do perfil.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Sábado, 26/09/2026, 15:00.
const AGORA = new Date(2026, 8, 26, 15, 0).getTime();
const ok = (data) => ({ data, isLoading: false, isError: false, refetch: vi.fn() });
const falha = () => ({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });

const estado = {};
function reset() {
  Object.assign(estado, {
    perfil: { platform_name: 'Ana Souza', city: 'Porto Alegre', state: 'RS', interests: [] },
    flags: {},
    arenas: [],
    pendentes: {},
    arenasQ: null,
    coach: ok(null),
    meus: ok([]),
    publicos: ok([]),
    historico: ok([]),
    clubes: ok([]),
    agenda: { itens: [], carregando: false, completa: true, falhas: [], recarregar: vi.fn(), sinais: {} },
    rating: ok(null),
    quebrarRanking: false,
    updateUserProfile: vi.fn(() => Promise.resolve()),
  });
}
reset();

vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'u1', displayName: 'Ana' },
    userProfile: estado.perfil,
    isPlatformAdmin: false,
    updateUserProfile: estado.updateUserProfile,
  }),
}));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: (k) => Boolean(estado.flags[k]) }));
vi.mock('@/core/lib/useRelogio', () => ({ useRelogio: () => ({ ms: AGORA, hora: '15:00' }) }));
vi.mock('@/core/services/observabilityService', () => ({ recordClientError: vi.fn() }));
vi.mock('@/modules/arenas/hooks/useMyArenaSummary', () => ({
  useMyArenaSummary: () => ({
    arenas: estado.arenas,
    pendingByArena: estado.pendentes,
    totalPendingBookings: Object.values(estado.pendentes).reduce((a, b) => a + b, 0),
    isLoading: false,
  }),
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useMyManagedArenas: () => estado.arenasQ || ok(estado.arenas),
  useMyFavoriteArenas: () => ok([]),
  useArena: () => ok(null),
  useArenaCourts: () => ok([]),
  useArenaCourtSchedules: () => ok([]),
  useArenaUnavailabilities: () => ok([]),
}));
vi.mock('@/modules/arenas/hooks/useBookings', () => ({
  useMyBookings: () => ok([]),
  useArenaBookings: () => ok([]),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useGlobalOpenSlots: () => ok([]),
  useArenaOpenSlots: () => ok([]),
  useArenaClasses: () => ok([]),
  useArenaInternalTournaments: () => ok([]),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useModuleOnInArenas: () => ({ isOnIn: () => true, isLoading: false }),
}));
vi.mock('@/modules/games/hooks/useArenaGameDays', () => ({ useArenaGameDays: () => ok([]) }));
vi.mock('@/modules/games/hooks/useOpenGames', () => ({ useOpenGames: () => ok([]) }));
vi.mock('@/modules/coaches/hooks/useCoaches', () => ({
  useCoach: () => estado.coach,
  useCoaches: () => ok([]),
}));
vi.mock('@/modules/coaches/hooks/useLessons', () => ({
  useCoachLessons: () => ok([
    { id: 'l1', status: 'requested', student_name: 'Rui', slots: [{ date: '2026-09-28', start: '08:00', end: '09:00' }] },
  ]),
}));
vi.mock('@/modules/coaches/hooks/useStudents', () => ({
  useCoachStudents: () => ok([{ id: 's1', status: 'active' }, { id: 's2', status: 'paused' }]),
}));
vi.mock('@/modules/coaches/hooks/useClinics', () => ({ useCoachClinics: () => ok([]) }));
vi.mock('@/modules/tournament/hooks/useTournament', () => ({
  useMyTournaments: () => estado.meus,
  usePublicTournaments: () => estado.publicos,
  useMyTournamentHistory: () => estado.historico,
}));
vi.mock('@/modules/clubs/hooks/useClubs', () => ({
  useMyClubs: () => estado.clubes,
  useAvailableEvents: () => ok([]),
}));
vi.mock('@/modules/home/hooks/useHomeAgenda', () => ({ useHomeAgenda: () => estado.agenda }));
vi.mock('@/modules/rating/hooks/useRating', () => ({
  useMyPlayerRating: () => {
    if (estado.quebrarRanking) throw new Error('defeito simulado');
    return estado.rating;
  },
  useMyDoublesRankings: () => ok([]),
}));
vi.mock('@/modules/rating/hooks/useDuprRating', () => ({ useDuprRatingForUid: () => ok(null) }));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({ useAthletes: () => ok([]) }));
vi.mock('@/v2/components/home/V2ActionHome', () => ({ EvolutionStrip: () => null }));
vi.mock('@/v2/components/arenas/openMatch/HomeWaitlistCalls', () => ({ default: () => null }));
vi.mock('@/v2/components/arenas/marketing/HomePromoBanners', () => ({ default: () => null }));

const { default: V2PersonalHome } = await import('./V2PersonalHome.jsx');

let container;
let root;
beforeEach(() => {
  reset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = async () => {
  await act(async () => { root.render(<MemoryRouter><V2PersonalHome /></MemoryRouter>); });
};
const secoes = () => [...container.querySelectorAll('[data-secao-inicio]')].map((s) => s.getAttribute('data-secao-inicio'));
const atalhos = () => [...container.querySelectorAll('nav[aria-label="Atalhos para você"] a')].map((a) => a.getAttribute('href'));
const texto = () => container.textContent;

describe('⭐ cada pessoa vê a SUA tela inicial', () => {
  it('quem gere arena e dá aula: arena e professor primeiro, com as portas diretas', async () => {
    estado.arenas = [{ id: 'a1', name: 'Arena Sul', city: 'Porto Alegre', state: 'RS', my_role: 'owner' }];
    estado.pendentes = { a1: 2 };
    estado.coach = ok({ id: 'u1', display_name: 'Ana', active: true });
    await render();
    expect(secoes().slice(0, 3)).toEqual(['agenda', 'arena', 'professor']);
    expect(atalhos().slice(0, 2)).toEqual(['/arenas/a1/gerir', '/aulas']);
    expect(texto()).toContain('2 pedidos esperando');
    expect(texto()).toContain('1 pedido de aula esperando a sua resposta');
    expect(texto()).toContain('Porque você faz isso na plataforma');
  });

  it('quem organiza: "criar torneio" primeiro e o torneio esquecido pede encerramento; o encerrado some', async () => {
    estado.perfil.interests = ['organize_tournaments'];
    estado.meus = ok([
      { id: 't1', name: 'Open da Primavera', my_role: 'owner', status: 'in_progress', ends_at: '2026-09-10' },
      { id: 't2', name: 'Copa Encerrada', my_role: 'owner', status: 'finished' },
      { id: 't3', name: 'Rascunho de Outubro', my_role: 'admin', status: 'draft' },
    ]);
    await render();
    expect(atalhos()[0]).toBe('/torneios/criar');
    expect(secoes()).toContain('organizar');
    expect(texto()).toContain('Open da Primavera');
    expect(texto()).toContain('A data passou — encerre o torneio');
    expect(texto()).toContain('Rascunho de Outubro');
    expect(texto()).not.toContain('Copa Encerrada');
  });

  it('quem compete: torneios abertos perto primeiro, sem encerrado nem prazo vencido, e o último resultado', async () => {
    estado.perfil.interests = ['play_tournaments'];
    estado.publicos = ok([
      { id: 'p1', name: 'Torneio de Curitiba', status: 'registrations_open', city: 'Curitiba', state: 'PR', registration_deadline: '2026-10-01' },
      { id: 'p2', name: 'Torneio de POA', status: 'registrations_open', city: 'Porto Alegre', state: 'RS', registration_deadline: '2026-10-05' },
      { id: 'p3', name: 'Torneio Vencido', status: 'registrations_open', registration_deadline: '2026-09-01' },
      { id: 'p4', name: 'Torneio Encerrado', status: 'finished' },
    ]);
    estado.historico = ok([{
      tournamentId: 'h1',
      tournament: { id: 'h1', name: 'Open de Inverno', status: 'finished', starts_at: '2026-08-10' },
      entries: [{ modality: { name: 'Duplas Mistas' }, partnerName: 'Rui', ranking: { started: true, position: 2, total: 12, wins: 4, losses: 1, played: 5 } }],
    }]);
    await render();
    const t = texto();
    expect(t.indexOf('Torneio de POA')).toBeLessThan(t.indexOf('Torneio de Curitiba'));
    expect(t).toContain('Na sua cidade');
    expect(t).not.toContain('Torneio Vencido');
    expect(t).not.toContain('Torneio Encerrado');
    expect(t).toContain('Open de Inverno');
    expect(t).toContain('2º de 12 na classificação');
  });
});

describe('⭐ falha não é vazio', () => {
  it('torneios que não carregaram: diz que falhou, nunca "nenhum torneio"', async () => {
    estado.perfil.interests = ['play_tournaments'];
    estado.publicos = falha();
    await render();
    expect(texto()).toContain('Não carregou os torneios abertos');
    expect(texto()).not.toContain('Nenhum torneio com inscrição aberta');
    expect(container.querySelector('[role="alert"] button')).toBeTruthy();
  });

  it('arenas que não carregaram: nunca oferece "cadastrar minha arena" (seria duplicar)', async () => {
    estado.perfil.interests = ['arena_manage'];
    estado.arenasQ = falha();
    await render();
    expect(texto()).toContain('Não carregou as suas arenas');
    expect(texto()).not.toContain('Cadastrar minha arena');
    expect(atalhos()).not.toContain('/arenas/criar');
  });

  it('agenda incompleta: diz o que não carregou e não afirma "agenda livre"', async () => {
    estado.agenda = { ...estado.agenda, completa: false, falhas: ['reservas'] };
    await render();
    expect(texto()).toContain('Não carregou: reservas');
    expect(texto()).not.toContain('agenda está livre');
  });

  it('agenda completa e vazia: diz que está livre e oferece o próximo passo', async () => {
    await render();
    expect(texto()).toContain('sua agenda está livre');
  });
});

describe('agenda', () => {
  it('agrupa por dia, com "Hoje" e o que pede ação destacado', async () => {
    estado.agenda = {
      ...estado.agenda,
      itens: [
        { key: 'r1', kind: 'reserva', dia: '2026-09-26', hora: '19:00', title: 'Arena Sul', subtitle: '19:00–20:00', status: 'Confirmada', acao: false, link: '/minhas-reservas' },
        { key: 'a1', kind: 'aula_professor', dia: '2026-09-27', hora: '08:00', title: 'Aula com Rui', status: 'Pedido esperando você', acao: true, link: '/aulas' },
      ],
    };
    await render();
    const t = texto();
    expect(t).toContain('Hoje');
    expect(t).toContain('19:00 · Arena Sul');
    expect(t).toContain('Amanhã');
    expect(t).toContain('Pedido esperando você');
    expect(t).toContain('Hoje você tem um compromisso — o primeiro às 19:00.');
  });
});

describe('⭐ uma seção quebrada não derruba a tela', () => {
  it('o ranking com defeito vira um aviso; o resto segue de pé', async () => {
    estado.perfil.interests = ['ranking', 'play_tournaments'];
    estado.quebrarRanking = true;
    const erroOriginal = console.error;
    console.error = () => {};
    try {
      await render();
    } finally {
      console.error = erroOriginal;
    }
    expect(texto()).toContain('Esta parte da tela inicial não abriu');
    expect(secoes()).toContain('agenda');
    expect(secoes()).toContain('torneios');
  });
});

describe('Personalizar', () => {
  it('salva os interesses pelo mesmo caminho do perfil', async () => {
    estado.perfil.interests = ['ranking'];
    await render();
    const botao = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Personalizar'));
    await act(async () => { botao.click(); });
    const opcao = [...document.querySelectorAll('button[aria-pressed]')].find((b) => b.textContent.includes('Organizar torneios'));
    await act(async () => { opcao.click(); });
    const salvar = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Salvar');
    await act(async () => { salvar.click(); });
    expect(estado.updateUserProfile).toHaveBeenCalledWith({ interests: ['ranking', 'organize_tournaments'] });
  });
});
