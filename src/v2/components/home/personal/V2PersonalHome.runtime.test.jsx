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
 *
 * E o INÍCIO SOB MEDIDA (flag `home_cards`, Onda CI):
 *  6. ⭐ o padrão é Dias de jogo, Horários da arena e Ranking — mesmo para
 *     quem gere arena e dá aula (o que a pessoa faz vira SUGESTÃO, não enche
 *     a tela);
 *  7. ⭐ a ordem é a da pessoa, e atalhos/destaques/evolução são cards como
 *     os outros;
 *  8. ⭐ card escondido não é montado — e por isso não consulta nada;
 *  9. desligar tudo é escolha: a tela diz "enxuto" e oferece os dois caminhos;
 * 10. Personalizar abre o seletor dos cards (e não mexe nos interesses);
 * 11. o que tem PRAZO (a chamada da fila) aparece com qualquer escolha.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
    consultasRanking: 0,
    updateUserProfile: vi.fn(() => Promise.resolve()),
    todasArenas: null,
    consultasTreino: 0,
    jogar: { itens: [], convites: [], carregando: false, isError: false, falhas: { dias: false, convites: false, vagas: false }, recarregar: { dias: vi.fn(), convites: vi.fn(), vagas: vi.fn() } },
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
  useArenas: () => estado.todasArenas || ok([]),
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
vi.mock('@/modules/games/hooks/useArenaGameDays', () => ({
  useArenaGameDays: () => ok([]),
  useSignUpToArenaGameDay: () => ({ mutateAsync: vi.fn(async () => {}), isPending: false }),
}));
vi.mock('@/modules/games/hooks/useOpenGames', () => ({ useOpenGames: () => ok([]) }));
vi.mock('@/modules/games/hooks/usePlayDiscovery', () => ({ usePlayDiscovery: () => estado.jogar }));
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
    estado.consultasRanking += 1;
    if (estado.quebrarRanking) throw new Error('defeito simulado');
    return estado.rating;
  },
  useMyDoublesRankings: () => ok([]),
}));
vi.mock('@/modules/rating/hooks/useDuprRating', () => ({ useDuprRatingForUid: () => ok(null) }));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({ useAthletes: () => ok([]) }));
vi.mock('@/v2/components/home/V2ActionHome', () => ({
  EvolutionStrip: ({ className }) => <section data-extra-inicio="evolucao" className={className} />,
}));
vi.mock('@/v2/components/arenas/openMatch/HomeWaitlistCalls', () => ({
  default: () => <div data-extra-inicio="fila" />,
}));
vi.mock('@/v2/components/arenas/marketing/HomePromoBanners', () => ({
  default: ({ className }) => <section data-extra-inicio="destaques" className={className} />,
}));

vi.mock('@/modules/training/hooks/useTrainingIdentity', () => ({ useTrainingIdentity: () => ({ uid: 'u1', activeCoachIds: [] }) }));
vi.mock('@/modules/training/hooks/useTodaySession', () => ({
  useTodaySession: () => {
    estado.consultasTreino += 1;
    const q = { isSuccess: true, isError: false, data: [], refetch: vi.fn() };
    return {
      sessao: { source: 'recomendacao', title: 'Treino sugerido', note: 'Sugestão a partir da sua rotina.', itemIds: [] },
      items: [], minutos: 45, routine: { days: [6] }, visiveis: { incompleto: false, refetch: vi.fn() },
      planos: q, inbox: q, meta: q, isLoading: false,
    };
  },
}));

const { default: V2PersonalHome } = await import('./V2PersonalHome.jsx');

let container;
let root;
beforeEach(() => {
  reset();
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => { root.render(<QueryClientProvider client={qc}><MemoryRouter><V2PersonalHome /></MemoryRouter></QueryClientProvider>); });
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

describe('🐞 o torneio que eu criei e em que me inscrevi', () => {
  it('⭐ aparece em "Seus torneios" como meu (organizo e jogo) — e não em "inscreva-se"', async () => {
    estado.perfil.interests = ['play_tournaments'];
    const meu = {
      id: 'meu', name: 'Aberto da Ana', my_role: 'owner', is_player: true, my_registration_status: 'confirmed',
      status: 'registrations_open', city: 'Porto Alegre', state: 'RS', registration_deadline: '2026-10-01', starts_at: '2026-10-03',
    };
    estado.meus = ok([meu]);
    estado.publicos = ok([meu, { id: 'outro', name: 'Torneio de Canoas', status: 'registrations_open', city: 'Canoas', state: 'RS', registration_deadline: '2026-10-02' }]);
    await render();
    const secao = container.querySelector('[data-secao-inicio="torneios"]');
    expect(secao.textContent).toContain('Seus torneios');
    expect(secao.textContent).toContain('Você organiza e joga');
    const linhasDoMeu = [...secao.querySelectorAll('a')].filter((a) => a.textContent.includes('Aberto da Ana'));
    expect(linhasDoMeu).toHaveLength(1);
    expect(linhasDoMeu[0].getAttribute('href')).toBe('/torneios/meu');
    expect(linhasDoMeu[0].textContent).not.toContain('inscreva-se');
    expect(secao.textContent).toContain('Torneio de Canoas');
  });

  it('organizo sem jogar: entra em "Seus torneios" levando à gestão', async () => {
    estado.perfil.interests = ['play_tournaments'];
    estado.meus = ok([{ id: 'org', name: 'Copa do Clube', my_role: 'admin', is_player: false, status: 'registrations_open', registration_deadline: '2026-10-01' }]);
    estado.publicos = ok([]);
    await render();
    const secao = container.querySelector('[data-secao-inicio="torneios"]');
    const link = [...secao.querySelectorAll('a')].find((a) => a.textContent.includes('Copa do Clube'));
    expect(link.getAttribute('href')).toBe('/torneios/org/gerenciar');
    expect(link.textContent).toContain('Você organiza');
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

// ---------------------------------------------------------------------------
// Início sob medida (flag `home_cards`)
// ---------------------------------------------------------------------------

const SOB_MEDIDA = { personalized_home: true, home_cards: true };
const escolher = (cards) => window.localStorage.setItem('v2:view:u1:inicio:cards', JSON.stringify({ v: 1, cards }));
/** A ordem na grade: seções e os cards que não são seção, como aparecem. */
const ordem = () => [...container.querySelectorAll('[data-secao-inicio], [data-extra-inicio], nav[aria-label="Atalhos para você"]')]
  .map((el) => el.getAttribute('data-secao-inicio') || el.getAttribute('data-extra-inicio') || 'atalhos')
  .filter((id) => id !== 'fila');
const chipsDoTopo = () => {
  const rotulo = [...container.querySelectorAll('span')].find((s) => s.textContent === 'Seu início mostra');
  return [...rotulo.parentElement.querySelectorAll(':scope > span')].slice(1).map((s) => s.textContent);
};
const botao = (texto, raiz = container) => [...raiz.querySelectorAll('button')].find((b) => b.textContent.includes(texto));

describe('⭐ início sob medida', () => {
  beforeEach(() => { estado.flags = { ...SOB_MEDIDA }; });

  it('⭐ o padrão é Dias de jogo, Horários da arena e Ranking — mesmo para quem gere arena e dá aula', async () => {
    estado.arenas = [{ id: 'a1', name: 'Arena Sul', my_role: 'owner' }];
    estado.coach = ok({ id: 'u1', display_name: 'Ana', active: true });
    estado.perfil.interests = ['organize_tournaments'];
    await render();
    expect(ordem()).toEqual(['jogar', 'reservar', 'ranking']);
    expect(chipsDoTopo()).toEqual(['Dias de jogo', 'Horários da arena', 'Ranking']);
    // O motivo ("Porque…") é da tela que decide sozinha; aqui quem decidiu foi a pessoa.
    expect(texto()).not.toContain('Porque você faz isso na plataforma');
    expect(atalhos()).toEqual([]);
    // Três cards: o terceiro ocupa a linha inteira em vez de ficar sozinho com um buraco ao lado.
    expect(container.querySelector('[data-secao-inicio="ranking"]').className).toContain('xl:col-span-2');
    expect(container.querySelector('[data-secao-inicio="jogar"]').className).not.toContain('xl:col-span-2');
  });

  it('"Seu último torneio" escolhido e ainda sem resultado: diz que não há, em vez de sumir', async () => {
    escolher(['resultado']);
    await render();
    expect(ordem()).toEqual(['resultado']);
    expect(texto()).toContain('Você ainda não tem resultado de torneio');
  });

  it('⭐ a ordem é a da pessoa, com atalhos e evolução como cards', async () => {
    estado.flags = { ...SOB_MEDIDA, action_home: true };
    escolher(['ranking', 'atalhos', 'agenda', 'evolucao']);
    await render();
    expect(ordem()).toEqual(['ranking', 'atalhos', 'agenda', 'evolucao']);
    // Os cards "largos" ocupam a linha inteira da grade.
    expect(container.querySelector('[data-extra-inicio="evolucao"]').className).toContain('xl:col-span-2');
    expect(container.querySelector('nav[aria-label="Atalhos para você"]').className).toContain('xl:col-span-2');
  });

  it('⭐ card escondido não é montado — e não consulta nada', async () => {
    escolher(['jogar', 'reservar']);
    await render();
    expect(ordem()).toEqual(['jogar', 'reservar']);
    expect(estado.consultasRanking).toBe(0);
  });

  it('card que depende de funcionalidade desligada fica guardado e não aparece', async () => {
    escolher(['destaques', 'evolucao', 'ranking']);
    await render();
    expect(ordem()).toEqual(['ranking']);
    act(() => root.unmount());
    root = createRoot(container);
    estado.flags = { ...SOB_MEDIDA, arena_modules: true, action_home: true };
    await render();
    expect(ordem()).toEqual(['destaques', 'evolucao', 'ranking']);
  });

  it('⭐ o card do treino só existe com o Centro de Treino ligado — desligado, nem consulta', async () => {
    escolher(['jogar', 'treino']);
    await render();
    expect(ordem()).toEqual(['jogar']);
    expect(estado.consultasTreino).toBe(0);
    act(() => root.unmount());
    root = createRoot(container);
    estado.flags = { ...SOB_MEDIDA, training_center: true };
    await render();
    // O card chega por import dinâmico.
    for (let i = 0; i < 20 && !container.querySelector('[data-secao-inicio="treino"]'); i += 1) {
      await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    }
    expect(ordem()).toEqual(['jogar', 'treino']);
    expect(texto()).toContain('Treino sugerido');
    expect(container.querySelector('[data-secao-inicio="treino"]').className).not.toContain('xl:col-span-2');
  });

  it('⭐ o que tem prazo aparece com qualquer escolha (mesmo sem card nenhum)', async () => {
    estado.flags = { ...SOB_MEDIDA, arena_modules: true };
    escolher([]);
    await render();
    expect(container.querySelector('[data-extra-inicio="fila"]')).toBeTruthy();
  });

  it('desligar tudo é escolha: "enxuto", e voltar ao padrão num toque', async () => {
    escolher([]);
    await render();
    expect(texto()).toContain('Seu início está enxuto');
    expect(chipsDoTopo()).toEqual(['Só o resumo do dia']);
    expect(ordem()).toEqual([]);
    await act(async () => { botao('Voltar ao padrão').click(); });
    expect(ordem()).toEqual(['jogar', 'reservar', 'ranking']);
    expect(window.localStorage.getItem('v2:view:u1:inicio:cards')).toBeNull();
  });

  it('⭐ Personalizar abre o seletor dos cards, muda a tela na hora e não mexe nos interesses', async () => {
    await render();
    await act(async () => { botao('Personalizar').click(); });
    // O seletor é baixado sob demanda (lazy): espera ele chegar.
    for (let i = 0; i < 100 && !document.querySelector('[data-card-inicio]'); i += 1) {
      await act(async () => { await new Promise((r) => { setTimeout(r, 20); }); });
    }
    expect(document.body.textContent).toContain('O que aparece no seu início');
    const linhaAgenda = document.querySelector('[data-card-inicio="agenda"]');
    await act(async () => { linhaAgenda.querySelector('[role="switch"]').click(); });
    expect(ordem()).toEqual(['jogar', 'reservar', 'ranking', 'agenda']);
    expect(estado.updateUserProfile).not.toHaveBeenCalled();
  });

  it('o topo mostra no máximo seis cards e diz quantos sobram', async () => {
    escolher(['agenda', 'jogar', 'reservar', 'ranking', 'torneios', 'aulas', 'clubes', 'comunidade']);
    await render();
    const chips = chipsDoTopo();
    expect(chips).toHaveLength(7);
    expect(chips[6]).toBe('+2 cards');
  });
});

describe('⭐ Jogar: os dias de jogo com vaga', () => {
  it('⭐ o dia de jogo da ARENA aparece, com as vagas, e leva para DENTRO do dia de jogo', async () => {
    estado.jogar = {
      ...estado.jogar,
      itens: [{
        key: 'dia:gd1', kind: 'dia', id: 'gd1', link: '/dia-de-jogo/gd1', inicio: AGORA + 3_600_000,
        title: 'Play de sábado', subtitle: 'Sáb, 26/09 · 18:00–21:00 · Arena Sol',
        place: { city: 'Canoas', state: 'RS' }, vagas: 5, badge: '5 vagas', daArena: true,
      }],
    };
    await render();
    const secao = container.querySelector('[data-secao-inicio="jogar"]');
    expect(secao.textContent).toContain('Play de sábado');
    expect(secao.textContent).toContain('5 vagas');
    expect(secao.querySelector('a[href="/dia-de-jogo/gd1"]')).not.toBeNull();
    expect(secao.querySelector('a[href^="/arenas/"]')).toBeNull();
  });

  it('com uma fonte fora do ar, NÃO afirma "nenhum jogo"', async () => {
    estado.jogar = { ...estado.jogar, isError: true, falhas: { dias: true, convites: false, vagas: false } };
    await render();
    const secao = container.querySelector('[data-secao-inicio="jogar"]');
    expect(secao.textContent).toContain('Não carregou os dias de jogo');
    expect(secao.textContent).not.toContain('Nenhum jogo com vaga');
  });

  it('⭐ cada jogo tem o botão de entrar ali mesmo — e o que não cabe no meu nível fica de fora', async () => {
    estado.jogar = {
      ...estado.jogar,
      itens: [
        {
          key: 'dia:gd1', kind: 'dia', origem: 'atleta', id: 'gd1', link: '/dia-de-jogo/gd1', inicio: AGORA + 3_600_000,
          title: 'Racha de sábado', subtitle: '', place: { city: 'Porto Alegre', state: 'RS' }, vagas: null, badge: null,
          daArena: false, estou: false, cabe: true, fonte: { id: 'gd1' },
        },
        {
          key: 'vaga:s1', kind: 'jogo_aberto', origem: 'jogo_aberto', id: 's1', link: '/dia-de-jogo/gs1', inicio: AGORA + 7_200_000,
          title: 'Jogo aberto · Arena Sol', subtitle: '', place: { city: 'Porto Alegre', state: 'RS' }, vagas: 2, badge: '2 vagas',
          daArena: true, estou: false, cabe: false, motivo: 'Esta vaga é a partir do nível 4.5', fonte: { id: 's1' },
        },
      ],
    };
    await render();
    const secao = container.querySelector('[data-secao-inicio="jogar"]');
    const botao = [...secao.querySelectorAll('button')].find((b) => b.textContent.includes('Participar'));
    expect(botao).toBeTruthy();
    expect(botao.getAttribute('aria-label')).toBe('Participar de Racha de sábado');
    // O botão NÃO fica dentro do link (dois alvos, nenhum dentro do outro).
    expect(botao.closest('a')).toBeNull();
    expect(secao.textContent).not.toContain('Jogo aberto · Arena Sol');
  });

  it('o que já tenho marcado aparece com "Você vai" e o botão de sair', async () => {
    estado.jogar = {
      ...estado.jogar,
      itens: [{
        key: 'clube:gc', kind: 'dia', origem: 'clube', id: 'gc', link: '/dia-de-jogo/gc', inicio: AGORA + 3_600_000,
        title: 'Terça do clube', subtitle: '', place: { city: 'Porto Alegre', state: 'RS' }, vagas: null, badge: 'Você vai',
        daArena: false, estou: true, cabe: true, fonte: { id: 'gc', club_id: 'c1' },
      }],
    };
    await render();
    const secao = container.querySelector('[data-secao-inicio="jogar"]');
    expect(secao.textContent).toContain('Você vai');
    expect([...secao.querySelectorAll('button')].some((b) => b.textContent.includes('Sair'))).toBe(true);
  });

  it('mostra no máximo 5 e leva ao resto', async () => {
    estado.jogar = {
      ...estado.jogar,
      itens: Array.from({ length: 7 }, (_, i) => ({
        key: `dia:g${i}`, kind: 'dia', id: `g${i}`, link: `/dia-de-jogo/g${i}`, inicio: AGORA + i,
        title: `Dia ${i}`, subtitle: '', place: { city: 'Porto Alegre', state: 'RS' }, vagas: null, badge: null, daArena: false,
      })),
    };
    await render();
    const secao = container.querySelector('[data-secao-inicio="jogar"]');
    expect(secao.querySelectorAll('a[href^="/dia-de-jogo/g"]')).toHaveLength(5);
    expect(secao.textContent).toContain('Ver todos os 7 jogos');
  });
});

describe('Horários da arena, para quem ainda não tem arena de sempre', () => {
  it('mostra as arenas da cidade e do estado do perfil, a da cidade primeiro', async () => {
    estado.todasArenas = ok([
      { id: 'sp', name: 'Arena Paulista', city: 'São Paulo', state: 'SP' },
      { id: 'pel', name: 'Arena Pelotas', city: 'Pelotas', state: 'RS' },
      { id: 'poa', name: 'Arena Moinhos', city: 'Porto Alegre', state: 'RS' },
    ]);
    await render();
    const secao = container.querySelector('[data-secao-inicio="reservar"]');
    expect(secao.textContent).toContain('Arenas perto de você');
    const links = [...secao.querySelectorAll('a[href^="/arenas/"]')].map((a) => a.getAttribute('href'));
    expect(links.slice(0, 2)).toEqual(['/arenas/poa#arena-reservar', '/arenas/pel#arena-reservar']);
    expect(links).not.toContain('/arenas/sp#arena-reservar');
  });

  it('com a lista falhando, só o convite — sem afirmar que não há arena perto', async () => {
    estado.todasArenas = { data: undefined, isLoading: false, isError: true, refetch: vi.fn() };
    await render();
    const secao = container.querySelector('[data-secao-inicio="reservar"]');
    expect(secao.textContent).toContain('Encontrar uma arena');
    expect(secao.textContent).not.toContain('Arenas perto de você');
  });
});
