import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  AlertTriangle, Building2, Trash2, UserPlus, Users, CalendarClock, Puzzle, Crown,
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
const ArenaEngagementPanel = lazy(() => import('@/v2/components/gamification/issuer/ArenaEngagementPanel'));
const ArenaModulesPanel = lazy(() => import('@/v2/components/arenas/ArenaModulesPanel'));
// Módulos que viraram parte da Central: o corpo das telas deles entra como aba.
const ArenaOpenMatchAdminPanel = lazy(() => import('@/v2/components/arenas/openMatch/ArenaOpenMatchAdminPanel'));
const ArenaShopOrdersPanel = lazy(() => import('@/v2/components/arenas/shop/ArenaShopOrdersPanel'));
const ArenaMarketingPanel = lazy(() => import('@/v2/pages/V2ArenaMarketing').then((m) => ({ default: m.ArenaMarketingPanel })));
const ArenaMembersPanel = lazy(() => import('@/v2/pages/V2ArenaAdminMembers').then((m) => ({ default: m.ArenaMembersPanel })));
const ArenaOperationsPanel = lazy(() => import('@/v2/pages/V2ArenaOperations').then((m) => ({ default: m.ArenaOperationsPanel })));
const ArenaAdvancedPanel = lazy(() => import('@/v2/pages/V2ArenaAdvanced').then((m) => ({ default: m.ArenaAdvancedPanel })));
const ArenaAttendancePanel = lazy(() => import('@/v2/pages/V2ArenaAttendance').then((m) => ({ default: m.ArenaAttendancePanel })));

import { db } from '@/core/config/firebase';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { ImageUpload } from '@/components/ui/image-upload';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import ArenaModuleShortcuts from '@/v2/components/arenas/ArenaModuleShortcuts';
import ArenaPendencias from '@/v2/components/arenas/ArenaPendencias';
import ArenaTodayPanel from '@/v2/components/arenas/ArenaTodayPanel';
import ArenaFavoriteTabs from '@/v2/components/arenas/ArenaFavoriteTabs';
import { recordEvent } from '@/core/services/observabilityService';
import { ARENA_SECTION_GROUPS, buildArenaSections, resolveArenaTabAlias } from '@/v2/components/arenas/arenaManageSections';
import { V2SectionNav, V2SubTabs } from '@/v2/ui/V2SectionNav';
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
// Torneios (Onda CB): os torneios da casa são os da PLATAFORMA sediados aqui,
// e o ranking da casa (módulo `leagues`) soma jogos abertos e torneios.
const ArenaPlatformTournamentsTab = lazy(() => import('@/v2/components/arenas/tournaments/ArenaPlatformTournamentsTab'));
const HouseRankingPanel = lazy(() => import('@/v2/components/arenas/houseRanking/HouseRankingPanel'));
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
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Skeleton, V2StatCard, V2Surface, V2BackLink, V2Page, HERO_TITLE } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { t, tn } from '@/core/i18n';

/**
 * O que falta para a arena receber reserva.
 *
 * Só aparece quando há o que resolver — um painel verde de "está tudo certo"
 * ocuparia espaço permanente para dizer nada. Cada item leva ao lugar de
 * resolver, porque avisar sem oferecer o caminho é metade do favor.
 */
function ArenaProntidao({ arena, onIrParaQuadras }) {
  const { data: courts = [], isSuccess: quadrasOk } = useArenaCourts(arena.id);
  const { data: schedules = [], isSuccess: janelasOk } = useArenaCourtSchedules(arena.id);

  // Só se afirma "falta isto" com quadras E janelas na mão. Com a consulta
  // falhando, as listas vêm vazias e o painel mandaria cadastrar de novo
  // quadras e horários que já existem.
  if (!quadrasOk || !janelasOk) return null;

  const ativas = courts.filter((c) => c.is_active !== false);
  const semHorario = courtsWithoutSchedule(courts, schedules);

  const pendencias = [];
  if (ativas.length === 0) {
    pendencias.push({
      texto: courts.length === 0
        ? t('Nenhuma quadra cadastrada. Sem quadra, a arena não aparece para reserva.')
        : t('Todas as quadras estão inativas. Sem quadra ativa, ninguém consegue reservar.'),
      acao: t('Cadastrar quadra'),
    });
  } else if (semHorario.length > 0) {
    pendencias.push({
      texto: tn(semHorario.length, '{quadras} sem horário de funcionamento — ninguém consegue reservar essa quadra.', '{quadras} sem horário de funcionamento — ninguém consegue reservar essas quadras.', { quadras: semHorario.map((c) => c.name).join(', ') }),
      acao: t('Definir horários'),
    });
  }

  if (pendencias.length === 0) return null;

  return (
    <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-amber-900">
            {t('Falta isto para a arena receber reservas')}
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
  const { data: arena, isLoading, isError: arenaFalhou, refetch: recarregarArena } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const deleteArena = useDeleteArena();
  const location = useLocation();
  // A aba mora na URL (`?aba=`): recarregar, voltar e mandar um link levam à
  // mesma aba — e os links "abrir os módulos" / "abrir o mercado" das outras
  // telas, que caíam sempre em Reservas, passam a funcionar. `?secao=` é
  // aceito por compatibilidade (abre a primeira aba da seção).
  const [params, setParams] = useSearchParams();
  // Aba que mudou de nome segue abrindo (`?aba=torneios-plataforma` → `torneios`).
  const tab = resolveArenaTabAlias(params.get('aba') || '');
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
      arenaFalhou={arenaFalhou}
      recarregarArena={recarregarArena}
      deleteArena={deleteArena}
      location={location}
      tab={tab}
      secao={secao}
      setTab={setTab}
    />
  );
}

function V2ArenaManageContent({ arenaId, user, isPlatformAdmin, arena, managed, isLoading, arenaFalhou, recarregarArena, deleteArena, location, tab: tabPedida, secao, setTab }) {

  // Âncora para o stepper de onboarding: ao montar, lê o hash
  // (#fotos / #precos / #horarios), troca a aba e rola até a seção.
  // Cada panel abaixo tem um `id` correspondente; #horarios aponta para
  // a aba 'info' (onde fica o campo de horário de funcionamento).
  useEffect(() => {
    const hash = location.hash?.replace('#', '').toLowerCase();
    if (!hash) return;
    const target = hash === 'horarios' ? 'info' : hash;
    const valid = ['hoje', 'reservas', 'precos', 'fotos', 'info', 'admins', 'retornos'].includes(target);
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
  const opsKpisOn = true;
  const engajamentoOn = true;
  // Dia de jogo da arena: rota própria (como Módulos e Open Match), por isso
  // entra como atalho no topo e não como aba — aba que navega para fora quebra
  // a promessa das outras.
  const gameDayOn = true;
  // Módulos adicionais: a seção Configurações só existe com a chave-mestra
  // ligada. Desligada, não há o que configurar — e aba vazia é pior que aba
  // nenhuma.
  const arenaModulesOn = true;
  const { isOn: moduloLigado, isLoading: modulosCarregando } = useArenaModules(arenaId);
  const { data: torneiosDaPlataforma = [], isLoading: torneiosCarregando } = useArenaPlatformTournaments(arenaId, { includePending: true });
  const modulos = {
    jogoAberto: moduloLigado(ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH),
    membros: moduloLigado(ARENA_MODULE_ID.MEMBERS),
    pacotes: moduloLigado(ARENA_MODULE_ID.MEMBERS_PACKAGES),
    aulas: moduloLigado(ARENA_MODULE_ID.CLASSES),
    torneios: moduloLigado(ARENA_MODULE_ID.LEAGUES),
    loja: moduloLigado(ARENA_MODULE_ID.PDV),
    // Marketing: a seção existe com o módulo; cada ferramenta vira uma aba.
    marketing: moduloLigado(ARENA_MODULE_ID.MARKETING),
    cupons: moduloLigado(ARENA_MODULE_ID.MARKETING) && moduloLigado(ARENA_MODULE_ID.MARKETING_COUPONS),
    campanhas: moduloLigado(ARENA_MODULE_ID.MARKETING) && moduloLigado(ARENA_MODULE_ID.MARKETING_CAMPAIGNS),
    satisfacao: moduloLigado(ARENA_MODULE_ID.MARKETING) && moduloLigado(ARENA_MODULE_ID.MARKETING_NPS),
    indicacoes: moduloLigado(ARENA_MODULE_ID.MARKETING) && moduloLigado(ARENA_MODULE_ID.MARKETING_REFERRAL),
    operacao: moduloLigado(ARENA_MODULE_ID.OPERATIONS),
    checklists: moduloLigado(ARENA_MODULE_ID.OPERATIONS) && moduloLigado(ARENA_MODULE_ID.OPERATIONS_CHECKLIST),
    manutencao: moduloLigado(ARENA_MODULE_ID.OPERATIONS) && moduloLigado(ARENA_MODULE_ID.OPERATIONS_MAINTENANCE),
    plantao: moduloLigado(ARENA_MODULE_ID.OPERATIONS) && moduloLigado(ARENA_MODULE_ID.OPERATIONS_STAFF),
    equipamentos: moduloLigado(ARENA_MODULE_ID.IOT),
    presenca: moduloLigado(ARENA_MODULE_ID.IOT) && moduloLigado(ARENA_MODULE_ID.IOT_QR_KIOSK),
    marca: moduloLigado(ARENA_MODULE_ID.WHITE_LABEL),
    rede: moduloLigado(ARENA_MODULE_ID.MULTI_UNIT),
    inteligencia: moduloLigado(ARENA_MODULE_ID.AI),
    // Torneio da plataforma sediado aqui não depende de módulo: é da arena
    // desde sempre, só não tinha lugar na gestão.
    torneiosPlataforma: torneiosDaPlataforma.some((t) => !t.archived),
  };
  // Lembra a última sub-aba visitada em cada seção principal.
  const [sectionMemory, setSectionMemory] = useState({});

  if (isLoading) return <V2Page className="space-y-4"><V2Skeleton className="h-40 rounded-4xl" /><V2Skeleton className="h-64 rounded-4xl" /></V2Page>;
  if (!arena && arenaFalhou) {
    return (
      <V2Page>
        <V2ErrorState
          title={t('Não foi possível abrir a gestão da arena')}
          description={t('A conexão falhou no meio do caminho. A arena continua lá — tente de novo.')}
          onRetry={() => recarregarArena()}
        />
      </V2Page>
    );
  }
  if (!arena) {
    return (
      <V2Page>
        <V2Surface className="text-center">
          <Building2 className="mx-auto h-10 w-10 text-gray-300" />
          <h2 className="mt-3 font-display text-lg font-bold text-ink">{t('Arena não encontrada')}</h2>
          <Link to="/arenas" className="mt-2 inline-block text-sm font-bold text-ink underline">{t('Voltar ao diretório')}</Link>
        </V2Surface>
      </V2Page>
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
    coachResidentOn, linkedClubsOn, crmOn, opsKpisOn, arenaModulesOn, engajamentoOn, modulos,
  });
  // A aba pedida na URL só vale se existir. Aba de módulo desligado cai em
  // Reservas — mas, enquanto os módulos ainda CARREGAM, a aba pedida pode
  // ser de um módulo que vai aparecer; aí espera, em vez de mostrar Reservas
  // por meio segundo e trocar.
  const abasValidas = sections.flatMap((sec) => sec.tabs.map((t) => t.value));
  const abaDaSecao = sections.find((sec) => sec.id === secao)?.tabs[0]?.value;
  const tab = abasValidas.includes(tabPedida) ? tabPedida : (abaDaSecao || 'hoje');
  const esperandoModulo = Boolean(tabPedida) && !abasValidas.includes(tabPedida)
    && (modulosCarregando || torneiosCarregando);
  const activeSectionId = sections.find((s) => s.tabs.some((t) => t.value === tab))?.id
    || sections[0].id;
  const activeSection = sections.find((s) => s.id === activeSectionId) || sections[0];

  const selectTab = (sectionId, value) => {
    setTab(value);
    // Para saber quais abas ninguém abre (plano de UX §7).
    recordEvent('arena_tab_open', { aba: value });
    setSectionMemory((m) => ({ ...m, [sectionId]: value }));
  };
  const selectSection = (section) => {
    if (section.id === activeSectionId) return;
    selectTab(section.id, sectionMemory[section.id] || section.tabs[0].value);
  };

  return (
    <V2Page>
      <div className="mb-5 flex items-center justify-between gap-2">
        <V2BackLink to={`/arenas/${arena.id}`}>{arena.name}</V2BackLink>
        {isOwner && (
          <ConfirmDialog
            title={t('Excluir arena?')}
            description={t('A arena, suas reservas e avaliações serão removidas permanentemente.')}
            confirmLabel={t('Excluir')}
            onConfirm={async () => {
              try { await deleteArena.mutateAsync(arena.id); toast.success(t('Arena excluída.')); window.location.assign('/arenas'); }
              catch (err) { toast.error(err?.message || t('Não foi possível excluir.')); }
            }}
            trigger={<V2Button variant="danger" size="sm"><Trash2 className="h-4 w-4" /> {t('Excluir')}</V2Button>}
          />
        )}
      </div>

      <div className="relative overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic">
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-acid">{t('Central da arena')}</span>
        <h1 className={`mt-4 ${HERO_TITLE}`}>{arena.name}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-300">{t('Gerencie reservas, preços, fotos, admins e informações públicas no mesmo fluxo operacional.')}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {arenaModulesOn && (
            <V2Button variant="secondary" size="sm" onClick={() => selectTab('configuracoes', 'modulos')}>
              <Puzzle className="h-4 w-4" /> {t('Módulos adicionais')}
            </V2Button>
          )}
          {gameDayOn && (
            <V2Button asChild variant="secondary" size="sm">
              <Link to={`/arenas/${arena.id}/gerir/dia-de-jogo`}>
                <CalendarClock className="h-4 w-4" /> {t('Dia de jogo')}
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

      {/* O que está esperando a arena agir, de todos os módulos — cada item
          leva à aba que resolve. Vem depois da prontidão: aquela diz o que
          IMPEDE de funcionar; esta, o trabalho do dia. */}
      <ArenaPendencias
        arena={arena}
        onIrParaAba={(aba) => {
          const secaoDaAba = sections.find((sec) => sec.tabs.some((t) => t.value === aba));
          if (secaoDaAba) selectTab(secaoDaAba.id, aba);
        }}
      />

      <div className="mt-6 space-y-3">
        {/* Nível 1: as seções, em duas linhas com nome — "Atender" (o trabalho
            do dia) e "Gerir" (como a arena é). Nada rola para o lado: com os
            módulos ligados eram treze seções numa linha só, e o que não cabia
            não era visto. */}
        <V2SectionNav
          ariaLabel={t('Seções da Central da arena')}
          dica="arena-secoes"
          sections={sections}
          grupos={ARENA_SECTION_GROUPS}
          activeId={activeSectionId}
          onSelect={selectSection}
        />

        {/* As favoritas da pessoa nesta arena: um toque para a aba de sempre. */}
        <ArenaFavoriteTabs
          uid={user?.uid}
          arenaId={arena.id}
          sections={sections}
          activeTab={tab}
          onOpen={(aba) => {
            const secaoDaAba = sections.find((sec) => sec.tabs.some((t) => t.value === aba));
            if (secaoDaAba) selectTab(secaoDaAba.id, aba);
          }}
        />

        {/* Nível 2: sub-abas da seção ativa (só quando há mais de uma) */}
        {activeSection.tabs.length > 1 && (
          <V2SubTabs
            ariaLabel={`Abas de ${activeSection.label}`}
            tabs={activeSection.tabs}
            activeValue={tab}
            onSelect={(t) => selectTab(activeSection.id, t.value)}
          />
        )}
      </div>

      {/* O esqueleto de carregamento cobre SÓ a área das abas: o cabeçalho da
          arena e a própria barra de abas continuam na tela enquanto a aba
          nova baixa, então trocar de aba nunca pisca a página inteira. */}
      <div className="mt-6">
        <Suspense fallback={<V2Skeleton lines={6} />}>
        {esperandoModulo ? <V2Skeleton lines={6} /> : (
        <>
        {tab === 'hoje' && (
          <ArenaTodayPanel
            arena={arena}
            onIrParaAba={(aba) => {
              const secaoDaAba = sections.find((sec) => sec.tabs.some((t) => t.value === aba));
              if (secaoDaAba) selectTab(secaoDaAba.id, aba);
            }}
          >
            {modulos.operacao && <ArenaOperationsPanel arena={arena} view="operacao" />}
          </ArenaTodayPanel>
        )}
        {tab === 'jogo-aberto' && modulos.jogoAberto && <ArenaOpenMatchAdminPanel arena={arena} />}
        {tab === 'membros' && modulos.membros && <ArenaMembersPanel arena={arena} view="membros" />}
        {tab === 'planos' && modulos.pacotes && <ArenaMembersPanel arena={arena} view="planos" />}
        {tab === 'semana' && opsKpisOn && <V2ArenaWeekPanel arenaId={arena.id} />}
        {tab === 'metricas' && <V2ArenaMetrics arena={arena} />}
        {tab === 'engajamento' && engajamentoOn && <ArenaEngagementPanel arena={arena} />}
        {tab === 'reservas' && <BookingsTab arena={arena} />}
        {tab === 'calendario' && <V2ArenaCalendar arena={arena} />}
        {tab === 'calendario-admin' && <V2AdminBookingCalendar arenaId={arena.id} />}
        {tab === 'clientes' && crmOn && <ArenaCrmTab arenaId={arena.id} membrosOn={modulos.membros} onVerMembros={() => selectTab('membros', 'membros')} />}
        {tab === 'pedidos' && modulos.loja && (
          <ArenaShopOrdersPanel arena={arena} onIrAoMercado={() => selectTab('comercial', 'mercado')} />
        )}
        {['cupons', 'campanhas', 'satisfacao', 'indicacoes', 'marketing'].includes(tab) && modulos.marketing && (
          <ArenaMarketingPanel arena={arena} view={tab} />
        )}
        {['operacao', 'checklists', 'manutencao'].includes(tab) && modulos.operacao && (
          <ArenaOperationsPanel arena={arena} view={tab} />
        )}
        {tab === 'plantao' && modulos.plantao && <ArenaOperationsPanel arena={arena} view="plantao" />}
        {tab === 'presenca' && modulos.presenca && <ArenaAttendancePanel arena={arena} />}
        {tab === 'marca' && modulos.marca && <ArenaAdvancedPanel arena={arena} view="marca" />}
        {tab === 'rede' && modulos.rede && <ArenaAdvancedPanel arena={arena} view="rede" />}
        {tab === 'inteligencia' && modulos.inteligencia && <ArenaAdvancedPanel arena={arena} view="inteligencia" />}
        {tab === 'equipamentos' && modulos.equipamentos && <ArenaAdvancedPanel arena={arena} view="equipamentos" />}
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
        {tab === 'torneios' && (modulos.torneios || modulos.torneiosPlataforma) && <ArenaPlatformTournamentsTab arena={arena} />}
        {tab === 'ranking-da-casa' && modulos.torneios && <HouseRankingPanel arena={arena} audience="arena" />}
        {tab === 'clubes' && linkedClubsOn && <LinkedClubsSection ownerType="arena" ownerId={arena.id} canManage title={t('Clubes da arena')} />}
        {tab === 'retornos' && <V2ArenaReviews arena={arena} canModerate />}
        {tab === 'modulos' && arenaModulesOn && (
          <ArenaModulesPanel arenaId={arena.id} canManage={canManage} />
        )}
        </>
        )}
        </Suspense>
      </div>
    </V2Page>
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
  const { data: bookings = [], isLoading, isError: reservasFalharam, refetch: recarregarReservas } = useArenaBookings(arenaId);
  const { data: members = [], isError: membrosFalharam, refetch: recarregarMembros } = useArenaMembers(membrosOn ? arenaId : null);
  // Sem a lista de membros, todo cliente frequente pareceria "ainda não é
  // membro" — e o botão ofereceria tornar membro quem já é.
  const membrosNaMao = membrosOn && !membrosFalharam;
  const incluir = useAddArenaMember();
  const [soCandidatos, setSoCandidatos] = useState(false);
  const clients = React.useMemo(() => buildArenaClients(bookings), [bookings]);
  const summary = React.useMemo(() => arenaCrmSummary(clients), [clients]);
  const comMembro = React.useMemo(
    () => (membrosNaMao ? attachMembership(clients, members) : clients),
    [clients, members, membrosNaMao],
  );
  const resumoMembros = React.useMemo(() => membershipSummary(comMembro), [comMembro]);
  const listados = soCandidatos ? comMembro.filter((c) => c.memberCandidate) : comMembro;

  const tornarMembro = async (c) => {
    try {
      await incluir.mutateAsync({ arenaId, target: { user_id: c.athlete_id, user_name: c.name } });
      toast.success(t('{name} agora é membro.', { name: c.name }));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível incluir.'));
    }
  };

  if (isLoading) return <V2Skeleton lines={5} />;
  if (reservasFalharam) {
    return (
      <V2ErrorState
        title={t('Não foi possível carregar os clientes')}
        description={t('A lista de clientes sai das reservas, e elas não carregaram. Tente de novo.')}
        onRetry={() => recarregarReservas()}
      />
    );
  }
  if (clients.length === 0) {
    return (
      <V2Surface>
        <V2EmptyState icon={Users} title={t('Sem clientes ainda')} description={t('Quando houver reservas, seus clientes aparecem aqui com histórico e valores.')} />
      </V2Surface>
    );
  }

  return (
    <div className="space-y-4">
      {membrosOn && membrosFalharam && (
        <V2ErrorState
          inline
          title={t('Não foi possível conferir quem já é membro')}
          description={t('Os clientes aparecem sem o nível até carregar.')}
          onRetry={() => recarregarMembros()}
        />
      )}
      <div className={cn('grid grid-cols-2 gap-3', membrosNaMao ? 'sm:grid-cols-3 lg:grid-cols-6' : 'sm:grid-cols-4')}>
        <V2StatCard label={t('Clientes')} value={summary.clients} />
        <V2StatCard label={t('Reservas')} value={summary.bookings} />
        <V2StatCard label={t('Valor acordado')} value={formatPrice(summary.revenue)} />
        <V2StatCard label={t('No-shows')} value={summary.no_shows} />
        {membrosNaMao && <V2StatCard label={t('Membros')} value={resumoMembros.members} />}
        {membrosNaMao && <V2StatCard label={t('Frequentes sem ser membro')} value={resumoMembros.candidates} />}
      </div>

      {membrosNaMao && resumoMembros.candidates > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-acid/30 bg-acid/10 px-4 py-3">
          <p className="text-sm text-ink">
            <strong>{resumoMembros.candidates}</strong> {tn(resumoMembros.candidates, 'cliente reservou {min} vezes ou mais e ainda não é membro', 'clientes reservaram {min} vezes ou mais e ainda não são membros', { min: FREQUENT_CLIENT_MIN })}{t('. É quem mais aproveita desconto, pacote e carteira.')}
          </p>
          <V2Button size="sm" variant="secondary" onClick={() => setSoCandidatos((v) => !v)}>
            {soCandidatos ? t('Ver todos') : t('Ver só esses')}
          </V2Button>
        </div>
      )}

      <V2Surface className="overflow-hidden p-0 sm:p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-2xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">{t('Cliente')}</th>
                {membrosNaMao && <th className="px-4 py-3">{t('Membro')}</th>}
                <th className="px-4 py-3 text-center">{t('Reservas')}</th>
                <th className="px-4 py-3 text-center">{t('Confirmadas')}</th>
                <th className="px-4 py-3 text-center">{t('No-show')}</th>
                <th className="px-4 py-3 text-right">{t('Valor')}</th>
                <th className="px-4 py-3">{t('Última')}</th>
              </tr>
            </thead>
            <tbody>
              {listados.map((c) => {
                const tier = c.member ? computeTier(Number(c.member.points) || 0) : null;
                return (
                  <tr key={c.key} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-semibold text-ink">
                      {c.athlete_id ? <Link to={`/atletas/${c.athlete_id}`} className="hover:underline">{c.name}</Link> : c.name}
                      {!c.athlete_id && <span className="ml-1 text-xs text-gray-500">· {t('avulso')}</span>}
                    </td>
                    {membrosNaMao && (
                      <td className="px-4 py-3">
                        {tier ? (
                          <button type="button" onClick={onVerMembros} className="inline-flex" title={t('Ver na aba Membros')}>
                            <V2Badge tone={TIER_TONE[tier.id] || 'amber'}>{tier.name}</V2Badge>
                          </button>
                        ) : c.memberCandidate ? (
                          <V2Button size="sm" variant="secondary" disabled={incluir.isPending} onClick={() => tornarMembro(c)}>
                            <Crown className="h-3.5 w-3.5" /> {t('Tornar membro')}
                          </V2Button>
                        ) : c.athlete_id ? (
                          <span className="text-xs text-gray-500">—</span>
                        ) : (
                          <span className="text-xs text-gray-500" title={t('Sem conta na plataforma')}>{t('sem conta')}</span>
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
    try { await update.mutateAsync({ id: arena.id, updates: form }); toast.success(t('Informações atualizadas.')); }
    catch (err) { toast.error(err?.message || t('Não foi possível salvar.')); }
  }

  return (
    <V2Surface id="arena-manage-horarios" className="space-y-4 p-5 sm:p-6">
      <V2ProfileFields form={form} setField={setField} />
      <div className="flex justify-end pt-2">
        <V2Button onClick={save} disabled={update.isPending}>{update.isPending ? t('Salvando…') : t('Salvar informações')}</V2Button>
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
    try { await setPhotos.mutateAsync({ id: arena.id, photos: next }); toast.success(t('Foto adicionada.')); }
    catch (err) { toast.error(err?.message || t('Falha ao adicionar a foto.')); }
  }
  async function removePhoto(idx) {
    const next = photos.filter((_, i) => i !== idx);
    try { await setPhotos.mutateAsync({ id: arena.id, photos: next }); }
    catch (err) { toast.error(err?.message || t('Falha ao remover a foto.')); }
  }

  return (
    <V2Surface className="space-y-4 p-5 sm:p-6">
      <div>
        <p className="text-sm font-bold text-ink">{t('Fotos da arena')}</p>
        <p className="mt-1 text-xs text-gray-500">{t('A primeira foto é usada como capa. Até 20 fotos.')}</p>
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((p, i) => (
            <div key={p.path || i} className="group relative">
              <PhotoLightbox src={p.url} alt={t('Foto {valor} da arena', { valor: i + 1 })}
                trigger={<img src={p.url} alt="" loading="lazy" decoding="async" className="h-28 w-full cursor-zoom-in rounded-2xl object-cover" />} />
              {i === 0 && <span className="absolute left-1 top-1 rounded bg-acid px-1.5 py-0.5 text-2xs font-bold text-ink">{t('Capa')}</span>}
              <button type="button" onClick={() => removePhoto(i)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-600 opacity-0 transition-opacity group-hover:opacity-100" aria-label={t('Remover foto')}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length < 20 && <ImageUpload value="" onChange={addPhoto} folder="arenas" label={t('Adicionar foto')} hint={t('JPG/PNG da arena, quadras, estrutura.')} />}
    </V2Surface>
  );
}

function BookingsTab({ arena }) {
  const sharedBookingsOn = true;
  const { data: bookings = [], isLoading, isError, refetch } = useArenaBookings(arena.id);
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
  // Falha não é "nenhuma solicitação": a arena deixaria pedidos sem resposta
  // achando que não chegou nenhum.
  if (isError) {
    return (
      <V2ErrorState
        title={t('Não foi possível carregar as reservas')}
        description={t('Pode haver pedidos esperando resposta. Tente de novo.')}
        onRetry={() => refetch()}
      />
    );
  }
  if (bookings.length === 0) return <V2Surface className="text-center"><p className="py-6 text-sm text-gray-500">{t('Nenhuma solicitação de reserva ainda.')}</p></V2Surface>;

  return (
    <div className="space-y-4">
      <V2Surface className="space-y-2 p-4 sm:p-5">
        <h3 className="text-sm font-bold text-ink">{t('Ativas')}</h3>
        {grouped.active.length === 0 ? <p className="text-sm text-gray-500">{t('Nenhuma reserva ativa.')}</p>
          : grouped.active.map(renderBooking)}
      </V2Surface>
      {grouped.past.length > 0 && (
        <V2Surface className="space-y-2 p-4 sm:p-5">
          <h3 className="text-sm font-bold text-ink">{t('Histórico')}</h3>
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
      if (snap.empty) { toast.error(t('Usuário não encontrado. Peça para a pessoa entrar na plataforma ao menos uma vez.')); return; }
      const target = snap.docs[0].data();
      if (managers.some((m) => m.user_id === target.uid)) { toast.error(t('Esse usuário já administra esta arena.')); return; }
      await addManager.mutateAsync({ arena, target: { user_id: target.uid, user_name: target.platform_name || target.full_name || target.email, user_photo: target.photo_url || '' } });
      toast.success(t('Admin da arena adicionado.'));
      setEmail('');
    } catch (err) { toast.error(err?.message || t('Não foi possível adicionar o admin da arena.')); }
  }

  return (
    <V2Surface>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-acid"><Users className="h-5 w-5" /></div>
        <div>
          <div className="font-display text-base font-bold text-ink">{t('Admins da arena')}</div>
          <p className="mt-1 text-sm leading-6 text-gray-500">{t('O criador já nasce como owner. Qualquer admin pode compartilhar a administração com outros usuários.')}</p>
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {managers.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-paper px-4 py-3">
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink">{m.user_name || t('Usuário')}</div>
              <div className="mt-0.5 text-xs text-gray-500">{m.user_id}</div>
            </div>
            <div className="flex items-center gap-2">
              <V2Badge tone="neutral">{m.role === ARENA_MANAGER_ROLE.OWNER ? t('Owner') : t('Admin')}</V2Badge>
              {m.role !== ARENA_MANAGER_ROLE.OWNER && (
                <button onClick={() => removeManager.mutate({ arenaId: arena.id, userId: m.user_id })} disabled={removeManager.isPending} className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <V2Surface variant="plano" className="mt-5 p-4">
        <V2Field label={t('Adicionar admin (e-mail do usuário já cadastrado)')}>
          <div className="flex gap-2">
            <V2Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@dominio.com" type="email" />
            <V2Button onClick={handleAddManager} disabled={addManager.isPending} aria-label={t('Adicionar admin')}><UserPlus className="h-4 w-4" aria-hidden="true" /></V2Button>
          </div>
        </V2Field>
      </V2Surface>
    </V2Surface>
  );
}
