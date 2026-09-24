import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  AlertTriangle, ArrowLeft, Building2, Trash2, UserPlus, Users, CalendarClock, Puzzle, Crown,
} from 'lucide-react';
/**
 * As abas chegam SOB DEMANDA.
 *
 * A Central da arena tem quinze abas, e importá-las todas de uma vez fazia
 * desta a maior tela do aplicativo (170 kB). Quem abre a Central quase sempre
 * vai a UMA aba — normalmente "Reservas", que abre por padrão — e pagava o
 * download do calendário administrativo, do mercado, das métricas e do resto
 * antes de ver qualquer coisa. Agora cada aba baixa quando é aberta, com um
 * esqueleto no lugar (o `<Suspense>` fica em volta da área das abas, nunca da
 * página inteira: trocar de aba não pode apagar o cabeçalho).
 */
const V2CourtsTab = lazy(() => import('@/v2/components/arenas/V2CourtsTab'));
const V2ArenaCalendar = lazy(() => import('@/v2/components/arenas/V2ArenaCalendar'));
const V2ArenaMetrics = lazy(() => import('@/v2/components/arenas/V2ArenaMetrics'));
const V2AdminBookingCalendar = lazy(() => import('@/v2/components/arenas/V2AdminBookingCalendar'));
const V2ArenaPaymentTab = lazy(() => import('@/v2/components/arenas/V2ArenaPaymentTab'));
const V2ArenaRulesTab = lazy(() => import('@/v2/components/arenas/V2ArenaRulesTab'));
const V2ArenaMercadoTab = lazy(() => import('@/v2/components/arenas/V2ArenaMercadoTab'));
const V2ArenaWeekPanel = lazy(() => import('@/v2/components/arenas/V2ArenaWeekPanel'));
const ArenaModulesPanel = lazy(() => import('@/v2/components/arenas/ArenaModulesPanel'));
// Módulos que viraram parte da Central: o corpo das telas deles entra como aba.
const ArenaOpenMatchAdminPanel = lazy(() => import('@/v2/components/arenas/openMatch/ArenaOpenMatchAdminPanel'));
const ArenaMembersPanel = lazy(() => import('@/v2/pages/V2ArenaAdminMembers').then((m) => ({ default: m.ArenaMembersPanel })));
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { db } from '@/core/config/firebase';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { ImageUpload } from '@/components/ui/image-upload';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import ArenaModuleShortcuts from '@/v2/components/arenas/ArenaModuleShortcuts';
import { buildArenaSections } from '@/v2/components/arenas/arenaManageSections';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { useArenaTournaments as useArenaPlatformTournaments } from '@/modules/tournament/hooks/useTournament';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import ConfirmDialog from '@/components/ConfirmDialog';
import { V2ProfileFields, V2PricingEditor } from '@/v2/components/arenas/V2ArenaEditors';
const V2ArenaReviews = lazy(() => import('@/v2/components/arenas/V2ArenaReviews'));
const ArenaCoachesManager = lazy(() => import('@/v2/pages/V2ArenaCoaches').then((m) => ({ default: m.ArenaCoachesManager })));
// Aulas (módulo `classes`): a agenda e a lista ÚNICA de professores.
const ArenaClassesPanel = lazy(() => import('@/v2/components/arenas/classes/ArenaClassesPanel'));
const ArenaCoachRoster = lazy(() => import('@/v2/components/arenas/classes/ArenaCoachRoster'));
// Torneios: os da casa (módulo `leagues`) e os da plataforma sediados aqui.
const ArenaLeaguesPanel = lazy(() => import('@/v2/components/arenas/tournaments/ArenaLeaguesPanel'));
const ArenaPlatformTournamentsTab = lazy(() => import('@/v2/components/arenas/tournaments/ArenaPlatformTournamentsTab'));
import BookingParticipantsPanel from '@/modules/arenas/components/BookingParticipantsPanel';
const LinkedClubsSection = lazy(() => import('@/modules/clubs/components/LinkedClubsSection'));
import V2BookingRow from '@/v2/components/arenas/V2BookingRow';
import { sortBookings } from '@/modules/arenas/domain/booking';
import { ARENA_MANAGER_ROLE, BOOKING_STATUS } from '@/modules/arenas/domain/constants';
import {
  useArena, useMyManagedArenas, useUpdateArena, useSetArenaPhotos, useDeleteArena,
  useArenaManagers, useAddManager, useRemoveManager,
  useArenaCourts, useArenaCourtSchedules,
} from '@/modules/arenas/hooks/useArenas';
import { courtsWithoutSchedule } from '@/modules/arenas/domain/court_schedule';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import {
  buildArenaClients, arenaCrmSummary, attachMembership, membershipSummary, FREQUENT_CLIENT_MIN,
} from '@/modules/arenas/domain/arena_crm';
import { computeTier } from '@/modules/arenas/domain/members';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { useArenaMembers, useAddArenaMember } from '@/modules/arenas/hooks/useArenaV3';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton, V2StatCard, V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

/**
 * O que falta para a arena receber reserva.
 *
 * Só aparece quando há o que resolver — um painel verde de "está tudo certo"
 * ocuparia espaço permanente para dizer nada. Cada item leva ao lugar de
 * resolver, porque avisar sem oferecer o caminho é metade do favor.
 */
function ArenaProntidao({ arena, onIrParaQuadras }) {
  const { data: courts = [] } = useArenaCourts(arena.id);
  const { data: schedules = [] } = useArenaCourtSchedules(arena.id);

  const ativas = courts.filter((c) => c.is_active !== false);
  const semHorario = courtsWithoutSchedule(courts, schedules);

  const pendencias = [];
  if (ativas.length === 0) {
    pendencias.push({
      texto: courts.length === 0
        ? 'Nenhuma quadra cadastrada. Sem quadra, a arena não aparece para reserva.'
        : 'Todas as quadras estão inativas. Sem quadra ativa, ninguém consegue reservar.',
      acao: 'Cadastrar quadra',
    });
  } else if (semHorario.length > 0) {
    pendencias.push({
      texto: `${semHorario.map((c) => c.name).join(', ')} sem horário de funcionamento — ninguém consegue reservar ${semHorario.length === 1 ? 'essa quadra' : 'essas quadras'}.`,
      acao: 'Definir horários',
    });
  }

  if (pendencias.length === 0) return null;

  return (
    <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-amber-900">
            Falta isto para a arena receber reservas
          </h2>
          <ul className="mt-1.5 space-y-2">
            {pendencias.map((p) => (
              <li key={p.acao} className="text-sm leading-6 text-amber-800">
                {p.texto}
                {' '}
                <button
                  type="button"
                  onClick={onIrParaQuadras}
                  className="font-bold underline underline-offset-2 hover:text-amber-900"
                >
                  {p.acao}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function V2ArenaManage() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const deleteArena = useDeleteArena();
  const location = useLocation();
  // A aba mora na URL (`?aba=`): recarregar, voltar e mandar um link levam à
  // mesma aba — e os links "abrir os módulos" / "abrir o mercado" das outras
  // telas, que caíam sempre em Reservas, passam a funcionar. `?secao=` é
  // aceito por compatibilidade (abre a primeira aba da seção).
  const [params, setParams] = useSearchParams();
  const tab = params.get('aba') || '';
  const secao = params.get('secao') || '';
  const setTab = useCallback((value) => {
    setParams((atual) => {
      const novo = new URLSearchParams(atual);
      novo.set('aba', value);
      novo.delete('secao');
      return novo;
    }, { replace: true });
  }, [setParams]);

  return (
    <V2ArenaManageContent
      arenaId={arenaId}
      user={user}
      isPlatformAdmin={isPlatformAdmin}
      arena={arena}
      managed={managed}
      isLoading={isLoading}
      deleteArena={deleteArena}
      location={location}
      tab={tab}
      secao={secao}
      setTab={setTab}
    />
  );
}

function V2ArenaManageContent({ arenaId, user, isPlatformAdmin, arena, managed, isLoading, deleteArena, location, tab: tabPedida, secao, setTab }) {

  // Âncora para o stepper de onboarding: ao montar, lê o hash
  // (#fotos / #precos / #horarios), troca a aba e rola até a seção.
  // Cada panel abaixo tem um `id` correspondente; #horarios aponta para
  // a aba 'info' (onde fica o campo de horário de funcionamento).
  useEffect(() => {
    const hash = location.hash?.replace('#', '').toLowerCase();
    if (!hash) return;
    const target = hash === 'horarios' ? 'info' : hash;
    const valid = ['reservas', 'precos', 'fotos', 'info', 'admins', 'retornos'].includes(target);
    if (!valid) return;
    setTab(target);
    // Espera o próximo frame pra garantir que o panel está montado
    requestAnimationFrame(() => {
      const el = document.getElementById(`arena-manage-${hash}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [location.hash, setTab]);

  const coachResidentOn = true;
  const linkedClubsOn = true;
  const crmOn = true;
  const opsKpisOn = useFeatureFlag(FEATURE_FLAG.ARENA_OPS_KPIS);
  // Dia de jogo da arena: rota própria (como Módulos e Open Match), por isso
  // entra como atalho no topo e não como aba — aba que navega para fora quebra
  // a promessa das outras.
  const gameDayOn = useFeatureFlag(FEATURE_FLAG.ARENA_GAME_DAY);
  // Módulos adicionais: a seção Configurações só existe com a chave-mestra
  // ligada. Desligada, não há o que configurar — e aba vazia é pior que aba
  // nenhuma.
  const arenaModulesOn = useFeatureFlag(FEATURE_FLAG.ARENA_MODULES);
  const { isOn: moduloLigado, isLoading: modulosCarregando } = useArenaModules(arenaId);
  const { data: torneiosDaPlataforma = [], isLoading: torneiosCarregando } = useArenaPlatformTournaments(arenaId);
  const modulos = {
    jogoAberto: moduloLigado(ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH),
    membros: moduloLigado(ARENA_MODULE_ID.MEMBERS),
    pacotes: moduloLigado(ARENA_MODULE_ID.MEMBERS_PACKAGES),
    aulas: moduloLigado(ARENA_MODULE_ID.CLASSES),
    torneios: moduloLigado(ARENA_MODULE_ID.LEAGUES),
    // Torneio da plataforma sediado aqui não depende de módulo: é da arena
    // desde sempre, só não tinha lugar na gestão.
    torneiosPlataforma: torneiosDaPlataforma.some((t) => !t.archived),
  };
  // Lembra a última sub-aba visitada em cada seção principal.
  const [sectionMemory, setSectionMemory] = useState({});

  if (isLoading) return <div className="mx-auto max-w-[1000px] space-y-4"><V2Skeleton className="h-40 rounded-4xl" /><V2Skeleton className="h-64 rounded-4xl" /></div>;
  if (!arena) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface className="text-center">
          <Building2 className="mx-auto h-10 w-10 text-gray-300" />
          <h2 className="mt-3 font-display text-lg font-bold text-ink">Arena não encontrada</h2>
          <Link to="/arenas" className="mt-2 inline-block text-sm font-bold text-ink underline">Voltar ao diretório</Link>
        </V2Surface>
      </div>
    );
  }

  const canManage = arena.owner_id === user?.uid || managed.some((m) => m.id === arena.id) || isPlatformAdmin;
  if (!canManage) return <Navigate to={`/arenas/${arena.id}`} replace />;
  const isOwner = arena.owner_id === user?.uid || isPlatformAdmin;

  // Navegação em dois níveis: poucas SEÇÕES principais (por tema), cada uma
  // com suas sub-abas. Ordem = ciclo de vida da arena, do início ao fim:
  // identidade → estrutura/preços → reservas (operação) → dinheiro →
  // resultados → equipe.
  const sections = buildArenaSections({
    coachResidentOn, linkedClubsOn, crmOn, opsKpisOn, arenaModulesOn, modulos,
  });
  // A aba pedida na URL só vale se existir. Aba de módulo desligado cai em
  // Reservas — mas, enquanto os módulos ainda CARREGAM, a aba pedida pode
  // ser de um módulo que vai aparecer; aí espera, em vez de mostrar Reservas
  // por meio segundo e trocar.
  const abasValidas = sections.flatMap((sec) => sec.tabs.map((t) => t.value));
  const abaDaSecao = sections.find((sec) => sec.id === secao)?.tabs[0]?.value;
  const tab = abasValidas.includes(tabPedida) ? tabPedida : (abaDaSecao || 'reservas');
  const esperandoModulo = Boolean(tabPedida) && !abasValidas.includes(tabPedida)
    && (modulosCarregando || torneiosCarregando);
  const activeSectionId = sections.find((s) => s.tabs.some((t) => t.value === tab))?.id
    || sections[0].id;
  const activeSection = sections.find((s) => s.id === activeSectionId) || sections[0];

  const selectTab = (sectionId, value) => {
    setTab(value);
    setSectionMemory((m) => ({ ...m, [sectionId]: value }));
  };
  const selectSection = (section) => {
    if (section.id === activeSectionId) return;
    selectTab(section.id, sectionMemory[section.id] || section.tabs[0].value);
  };

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-5 flex items-center justify-between gap-2">
        <Link to={`/arenas/${arena.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> {arena.name}
        </Link>
        {isOwner && (
          <ConfirmDialog
            title="Excluir arena?"
            description="A arena, suas reservas e avaliações serão removidas permanentemente."
            confirmLabel="Excluir"
            onConfirm={async () => {
              try { await deleteArena.mutateAsync(arena.id); toast.success('Arena excluída.'); window.location.assign('/arenas'); }
              catch (err) { toast.error(err?.message || 'Não foi possível excluir.'); }
            }}
            trigger={<V2Button variant="danger" size="sm"><Trash2 className="h-4 w-4" /> Excluir</V2Button>}
          />
        )}
      </div>

      <div className="relative overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic">
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-acid">Central da arena</span>
        <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">{arena.name}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-300">Gerencie reservas, preços, fotos, admins e informações públicas no mesmo fluxo operacional.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {arenaModulesOn && (
            <V2Button variant="secondary" size="sm" onClick={() => selectTab('configuracoes', 'modulos')}>
              <Puzzle className="h-4 w-4" /> Módulos adicionais
            </V2Button>
          )}
          {gameDayOn && (
            <V2Button asChild variant="secondary" size="sm">
              <Link to={`/arenas/${arena.id}/gerir/dia-de-jogo`}>
                <CalendarClock className="h-4 w-4" /> Dia de jogo
              </Link>
            </V2Button>
          )}
          {/* As telas dos módulos que ESTA arena ligou. Vêm do catálogo, não de
              uma lista escrita à mão: o console de marketing existia, tinha
              rota, e nada na plataforma levava até ele. */}
          <ArenaModuleShortcuts arenaId={arena.id} audience="manage" />
        </div>
      </div>

      {/* Prontidão da arena: o que impede a arena de RECEBER RESERVA hoje.
          Fica no topo, antes das abas, porque o dono não vai procurar por um
          problema que ele não sabe que tem — ele só descobriria quando alguém
          reclamasse de não conseguir reservar. */}
      <ArenaProntidao arena={arena} onIrParaQuadras={() => selectTab('estrutura', 'quadras')} />

      <div className="mt-6 space-y-3">
        {/* Nível 1: seções principais (temas) */}
        <div className="overflow-x-auto">
          <div className="inline-flex gap-1.5 rounded-full border border-gray-100 bg-paper-pure p-1.5 shadow-sm">
            {sections.map((section) => {
              const Icon = section.icon;
              const active = section.id === activeSectionId;
              return (
                <button key={section.id} onClick={() => selectSection(section)}
                  aria-current={active ? 'page' : undefined}
                  className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors', active ? 'bg-ink text-white shadow-md' : 'text-gray-500 hover:text-ink')}>
                  {Icon && <Icon className={cn('h-4 w-4', active ? 'text-acid' : 'text-gray-400')} />}
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nível 2: sub-abas da seção ativa (só quando há mais de uma) */}
        {activeSection.tabs.length > 1 && (
          <div className="overflow-x-auto">
            <div className="inline-flex flex-wrap gap-1.5 px-1">
              {activeSection.tabs.map((t) => {
                const Icon = t.icon;
                const active = tab === t.value;
                return (
                  <button key={t.value} onClick={() => selectTab(activeSection.id, t.value)}
                    aria-current={active ? 'page' : undefined}
                    className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors', active ? 'border-ink bg-ink/5 text-ink' : 'border-gray-200 text-gray-500 hover:border-ink/40 hover:text-ink')}>
                    {Icon && <Icon className={cn('h-3.5 w-3.5', active ? 'text-ink' : 'text-gray-400')} />}
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* O esqueleto de carregamento cobre SÓ a área das abas: o cabeçalho da
          arena e a própria barra de abas continuam na tela enquanto a aba
          nova baixa, então trocar de aba nunca pisca a página inteira. */}
      <div className="mt-6">
        <Suspense fallback={<V2Skeleton lines={6} />}>
        {esperandoModulo ? <V2Skeleton lines={6} /> : (
        <>
        {tab === 'jogo-aberto' && modulos.jogoAberto && <ArenaOpenMatchAdminPanel arena={arena} />}
        {tab === 'membros' && modulos.membros && <ArenaMembersPanel arena={arena} view="membros" />}
        {tab === 'planos' && modulos.pacotes && <ArenaMembersPanel arena={arena} view="planos" />}
        {tab === 'semana' && opsKpisOn && <V2ArenaWeekPanel arenaId={arena.id} />}
        {tab === 'metricas' && <V2ArenaMetrics arena={arena} />}
        {tab === 'reservas' && <BookingsTab arena={arena} />}
        {tab === 'calendario' && <V2ArenaCalendar arena={arena} />}
        {tab === 'calendario-admin' && <V2AdminBookingCalendar arenaId={arena.id} />}
        {tab === 'clientes' && crmOn && <ArenaCrmTab arenaId={arena.id} membrosOn={modulos.membros} onVerMembros={() => selectTab('membros', 'membros')} />}
        {tab === 'pagamento' && <V2ArenaPaymentTab />}
        {tab === 'regras' && <V2ArenaRulesTab />}
        {tab === 'mercado' && <V2ArenaMercadoTab />}
        {tab === 'quadras' && <V2CourtsTab arena={arena} />}
        {tab === 'precos' && <V2Surface id="arena-manage-precos"><V2PricingEditor arena={arena} /></V2Surface>}
        {tab === 'fotos' && <div id="arena-manage-fotos"><PhotosTab arena={arena} /></div>}
        {tab === 'info' && <InfoTab arena={arena} />}
        {tab === 'admins' && <ManagersTab arena={arena} />}
        {tab === 'aulas' && modulos.aulas && <ArenaClassesPanel arena={arena} podeGerir />}
        {/* Com Aulas ligado, a lista de professores é a ÚNICA (parceiros +
            quem dá aula); desligado, é a de parceiros, como sempre foi. */}
        {tab === 'professores' && modulos.aulas && <ArenaCoachRoster arena={arena} />}
        {tab === 'professores' && !modulos.aulas && coachResidentOn && <ArenaCoachesManager arena={arena} />}
        {tab === 'torneios' && modulos.torneios && <ArenaLeaguesPanel arena={arena} podeGerir />}
        {tab === 'torneios-plataforma' && modulos.torneiosPlataforma && <ArenaPlatformTournamentsTab arena={arena} />}
        {tab === 'clubes' && linkedClubsOn && <LinkedClubsSection ownerType="arena" ownerId={arena.id} canManage title="Clubes da arena" />}
        {tab === 'retornos' && <V2ArenaReviews arena={arena} canModerate />}
        {tab === 'modulos' && arenaModulesOn && (
          <ArenaModulesPanel arenaId={arena.id} canManage={canManage} />
        )}
        </>
        )}
        </Suspense>
      </div>
    </div>
  );
}

const TIER_TONE = { bronze: 'amber', silver: 'neutral', gold: 'acid', platinum: 'ink' };

/**
 * Clientes — quem reserva aqui, derivado das reservas.
 *
 * Com o módulo Membros ligado, a mesma lista diz quem JÁ é membro (e em que
 * nível) e quem é FREQUENTE e ainda não é — com o botão ali mesmo. Antes eram
 * dois mundos: a arena via o cliente fiel aqui e tinha de ir a outra tela,
 * procurar pelo nome, para torná-lo membro.
 */
function ArenaCrmTab({ arenaId, membrosOn = false, onVerMembros }) {
  const { data: bookings = [], isLoading } = useArenaBookings(arenaId);
  const { data: members = [] } = useArenaMembers(membrosOn ? arenaId : null);
  const incluir = useAddArenaMember();
  const [soCandidatos, setSoCandidatos] = useState(false);
  const clients = React.useMemo(() => buildArenaClients(bookings), [bookings]);
  const summary = React.useMemo(() => arenaCrmSummary(clients), [clients]);
  const comMembro = React.useMemo(
    () => (membrosOn ? attachMembership(clients, members) : clients),
    [clients, members, membrosOn],
  );
  const resumoMembros = React.useMemo(() => membershipSummary(comMembro), [comMembro]);
  const listados = soCandidatos ? comMembro.filter((c) => c.memberCandidate) : comMembro;

  const tornarMembro = async (c) => {
    try {
      await incluir.mutateAsync({ arenaId, target: { user_id: c.athlete_id, user_name: c.name } });
      toast.success(`${c.name} agora é membro.`);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível incluir.');
    }
  };

  if (isLoading) return <V2Skeleton lines={5} />;
  if (clients.length === 0) {
    return (
      <V2Surface>
        <V2EmptyState icon={Users} title="Sem clientes ainda" description="Quando houver reservas, seus clientes aparecem aqui com histórico e valores." />
      </V2Surface>
    );
  }

  return (
    <div className="space-y-4">
      <div className={cn('grid grid-cols-2 gap-3', membrosOn ? 'sm:grid-cols-3 lg:grid-cols-6' : 'sm:grid-cols-4')}>
        <V2StatCard label="Clientes" value={summary.clients} />
        <V2StatCard label="Reservas" value={summary.bookings} />
        <V2StatCard label="Valor acordado" value={formatPrice(summary.revenue)} />
        <V2StatCard label="No-shows" value={summary.no_shows} />
        {membrosOn && <V2StatCard label="Membros" value={resumoMembros.members} />}
        {membrosOn && <V2StatCard label="Frequentes sem ser membro" value={resumoMembros.candidates} />}
      </div>

      {membrosOn && resumoMembros.candidates > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-acid/30 bg-acid/10 px-4 py-3">
          <p className="text-sm text-ink">
            <strong>{resumoMembros.candidates}</strong> {resumoMembros.candidates === 1 ? 'cliente reservou' : 'clientes reservaram'} {FREQUENT_CLIENT_MIN} vezes
            ou mais e ainda não {resumoMembros.candidates === 1 ? 'é membro' : 'são membros'}. É quem mais aproveita desconto, pacote e carteira.
          </p>
          <V2Button size="sm" variant="secondary" onClick={() => setSoCandidatos((v) => !v)}>
            {soCandidatos ? 'Ver todos' : 'Ver só esses'}
          </V2Button>
        </div>
      )}

      <V2Surface className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                {membrosOn && <th className="px-4 py-3">Membro</th>}
                <th className="px-4 py-3 text-center">Reservas</th>
                <th className="px-4 py-3 text-center">Confirmadas</th>
                <th className="px-4 py-3 text-center">No-show</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Última</th>
              </tr>
            </thead>
            <tbody>
              {listados.map((c) => {
                const tier = c.member ? computeTier(Number(c.member.points) || 0) : null;
                return (
                  <tr key={c.key} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-semibold text-ink">
                      {c.athlete_id ? <Link to={`/atletas/${c.athlete_id}`} className="hover:underline">{c.name}</Link> : c.name}
                      {!c.athlete_id && <span className="ml-1 text-xs text-gray-400">· avulso</span>}
                    </td>
                    {membrosOn && (
                      <td className="px-4 py-3">
                        {tier ? (
                          <button type="button" onClick={onVerMembros} className="inline-flex" title="Ver na aba Membros">
                            <V2Badge tone={TIER_TONE[tier.id] || 'amber'}>{tier.name}</V2Badge>
                          </button>
                        ) : c.memberCandidate ? (
                          <V2Button size="sm" variant="secondary" disabled={incluir.isPending} onClick={() => tornarMembro(c)}>
                            <Crown className="h-3.5 w-3.5" /> Tornar membro
                          </V2Button>
                        ) : c.athlete_id ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          <span className="text-xs text-gray-400" title="Sem conta na plataforma">sem conta</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-center tabular-nums">{c.bookings}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-green-700">{c.confirmed}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{c.no_shows > 0 ? <V2Badge tone="amber">{c.no_shows}</V2Badge> : '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.total_value > 0 ? formatPrice(c.total_value) : '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{c.last_date ? formatDateShortBR(c.last_date) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </V2Surface>
    </div>
  );
}

function InfoTab({ arena }) {
  const update = useUpdateArena();
  const [form, setForm] = useState({
    name: arena.name || '', description: arena.description || '', address: arena.address || '',
    neighborhood: arena.neighborhood || '', city: arena.city || '', state: arena.state || '',
    contact_phone: arena.contact_phone || '', contact_whatsapp: arena.contact_whatsapp || '',
    contact_email: arena.contact_email || '', instagram: arena.instagram || '', website: arena.website || '',
    court_count: arena.court_count ?? '', hours: arena.hours || '',
    house_rules_md: arena.house_rules_md || '',
  });
  const setField = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  async function save() {
    try { await update.mutateAsync({ id: arena.id, updates: form }); toast.success('Informações atualizadas.'); }
    catch (err) { toast.error(err?.message || 'Não foi possível salvar.'); }
  }

  return (
    <V2Surface id="arena-manage-horarios" className="space-y-4 p-5 sm:p-6">
      <V2ProfileFields form={form} setField={setField} />
      <div className="flex justify-end pt-2">
        <V2Button onClick={save} disabled={update.isPending}>{update.isPending ? 'Salvando…' : 'Salvar informações'}</V2Button>
      </div>
    </V2Surface>
  );
}

function PhotosTab({ arena }) {
  const setPhotos = useSetArenaPhotos();
  const photos = arena.photos || [];

  async function addPhoto(url, meta) {
    if (!url) return;
    const next = [...photos, { url, path: meta?.path || '', name: meta?.name || 'foto' }];
    try { await setPhotos.mutateAsync({ id: arena.id, photos: next }); toast.success('Foto adicionada.'); }
    catch (err) { toast.error(err?.message || 'Falha ao adicionar a foto.'); }
  }
  async function removePhoto(idx) {
    const next = photos.filter((_, i) => i !== idx);
    try { await setPhotos.mutateAsync({ id: arena.id, photos: next }); }
    catch (err) { toast.error(err?.message || 'Falha ao remover a foto.'); }
  }

  return (
    <V2Surface className="space-y-4 p-5 sm:p-6">
      <div>
        <p className="text-sm font-bold text-ink">Fotos da arena</p>
        <p className="mt-1 text-xs text-gray-500">A primeira foto é usada como capa. Até 20 fotos.</p>
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((p, i) => (
            <div key={p.path || i} className="group relative">
              <PhotoLightbox src={p.url} alt={`Foto ${i + 1} da arena`}
                trigger={<img src={p.url} alt="" className="h-28 w-full cursor-zoom-in rounded-2xl object-cover" />} />
              {i === 0 && <span className="absolute left-1 top-1 rounded bg-acid px-1.5 py-0.5 text-[10px] font-bold text-ink">Capa</span>}
              <button type="button" onClick={() => removePhoto(i)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-600 opacity-0 transition-opacity group-hover:opacity-100" aria-label="Remover foto">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length < 20 && <ImageUpload value="" onChange={addPhoto} folder="arenas" label="Adicionar foto" hint="JPG/PNG da arena, quadras, estrutura." />}
    </V2Surface>
  );
}

function BookingsTab({ arena }) {
  const sharedBookingsOn = true;
  const { data: bookings = [], isLoading } = useArenaBookings(arena.id);
  const grouped = useMemo(() => {
    const active = sortBookings(bookings.filter((b) => [BOOKING_STATUS.REQUESTED, BOOKING_STATUS.NEGOTIATING, BOOKING_STATUS.CONFIRMED].includes(b.status)));
    const past = sortBookings(bookings.filter((b) => [BOOKING_STATUS.DECLINED, BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED].includes(b.status)));
    return { active, past };
  }, [bookings]);

  const sharedOn = sharedBookingsOn;
  const renderBooking = (b) => (
    <div key={b.id}>
      <V2BookingRow booking={b} perspective="arena" arena={arena} />
      {sharedOn && b.shared && <BookingParticipantsPanel booking={b} />}
    </div>
  );

  if (isLoading) return <V2Skeleton className="h-40 rounded-4xl" />;
  if (bookings.length === 0) return <V2Surface className="text-center"><p className="py-6 text-sm text-gray-500">Nenhuma solicitação de reserva ainda.</p></V2Surface>;

  return (
    <div className="space-y-4">
      <V2Surface className="space-y-2 p-4 sm:p-5">
        <h3 className="text-sm font-bold text-ink">Ativas</h3>
        {grouped.active.length === 0 ? <p className="text-sm text-gray-500">Nenhuma reserva ativa.</p>
          : grouped.active.map(renderBooking)}
      </V2Surface>
      {grouped.past.length > 0 && (
        <V2Surface className="space-y-2 p-4 sm:p-5">
          <h3 className="text-sm font-bold text-ink">Histórico</h3>
          {grouped.past.map(renderBooking)}
        </V2Surface>
      )}
    </div>
  );
}

function ManagersTab({ arena }) {
  const { data: managers = [] } = useArenaManagers(arena.id);
  const addManager = useAddManager();
  const removeManager = useRemoveManager();
  const [email, setEmail] = useState('');

  async function handleAddManager() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('email', '==', trimmed)));
      if (snap.empty) { toast.error('Usuário não encontrado. Peça para a pessoa entrar na plataforma ao menos uma vez.'); return; }
      const target = snap.docs[0].data();
      if (managers.some((m) => m.user_id === target.uid)) { toast.error('Esse usuário já administra esta arena.'); return; }
      await addManager.mutateAsync({ arena, target: { user_id: target.uid, user_name: target.platform_name || target.full_name || target.email, user_photo: target.photo_url || '' } });
      toast.success('Admin da arena adicionado.');
      setEmail('');
    } catch (err) { toast.error(err?.message || 'Não foi possível adicionar o admin da arena.'); }
  }

  return (
    <V2Surface>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-acid"><Users className="h-5 w-5" /></div>
        <div>
          <div className="font-display text-base font-bold text-ink">Admins da arena</div>
          <p className="mt-1 text-sm leading-6 text-gray-500">O criador já nasce como owner. Qualquer admin pode compartilhar a administração com outros usuários.</p>
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {managers.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-paper px-4 py-3">
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink">{m.user_name || 'Usuário'}</div>
              <div className="mt-0.5 text-xs text-gray-400">{m.user_id}</div>
            </div>
            <div className="flex items-center gap-2">
              <V2Badge tone="neutral">{m.role === ARENA_MANAGER_ROLE.OWNER ? 'Owner' : 'Admin'}</V2Badge>
              {m.role !== ARENA_MANAGER_ROLE.OWNER && (
                <button onClick={() => removeManager.mutate({ arenaId: arena.id, userId: m.user_id })} disabled={removeManager.isPending} className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-5 rounded-3xl border border-gray-100 bg-paper p-4">
        <V2Field label="Adicionar admin (e-mail do usuário já cadastrado)">
          <div className="flex gap-2">
            <V2Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@dominio.com" type="email" />
            <V2Button onClick={handleAddManager} disabled={addManager.isPending}><UserPlus className="h-4 w-4" /></V2Button>
          </div>
        </V2Field>
      </div>
    </V2Surface>
  );
}
