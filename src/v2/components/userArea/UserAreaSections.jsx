/**
 * As seções da Minha área. Cada uma é montada SÓ quando está aberta — então
 * só ela consulta. Nenhuma afirma "não há" sem a leitura ter respondido
 * (`isSuccess`); falha vira `V2ErrorState` com "Tentar de novo".
 *
 * As peças de outras telas entram como são (planos e compras nas arenas,
 * aulas, códigos de indicação, progresso): a Minha área JUNTA, não copia.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeftRight, Award, BadgeCheck, BarChart3, FileSignature, Flag, Plane, Bell, BookOpen, Building2, CalendarDays, ClipboardCheck, ClipboardList, Dumbbell, FileText, Gift, GraduationCap,
  HandCoins, Heart, HelpCircle, Inbox, MailPlus, LayoutDashboard, LayoutGrid, MapPin, MessageCircleQuestion, PanelLeft, Plus, Receipt,
  Search, Settings, ShieldCheck, Landmark, IdCard, Medal, ShoppingBag, ShoppingCart, Store, Swords, Trophy, User, Users,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';

import { useNavRotulos } from '@/core/lib/useNavRotulos';

import { useMyPlayerRating } from '@/modules/rating/hooks/useRating';
import { useDuprMirror, useDuprMode } from '@/modules/rating/hooks/useDuprMode';
import { useMyTournaments } from '@/modules/tournament/hooks/useTournament';
import { useMyJoinRequests } from '@/modules/clubs/hooks/useClubs';
import { CLUB_ROLE_LABELS, JOIN_REQUEST_STATUS } from '@/modules/clubs/domain/constants';
import { partitionLessons, lessonsAwaitingReply } from '@/modules/coaches/domain/lesson';
import { hojeLocal, TOURNAMENT_PHASE, TOURNAMENT_PHASE_LABEL } from '@/modules/home/domain/freshness';
import { meuPapelTexto, myTournamentsForHome, periodoTexto } from '@/modules/home/domain/homeTournaments';
import { useHomeCardsOn } from '@/modules/home/hooks/useHomeCards';
import { helpLinkFor } from '@/modules/help/domain/helpLink';
import { useMyTrainingPlans } from '@/modules/training/hooks/useTrainingPlans';
import { useMyTrainingSessions } from '@/modules/training/hooks/useTrainingSessions';
import { useTrainingInbox } from '@/modules/training/hooks/useTrainingShares';
import { PLAN_STATUS, plannedByDate } from '@/modules/training/domain/plan';
import { weekSummary } from '@/modules/training/domain/session';
import { todayLocal, weekKeyOf } from '@/modules/training/domain/dates';
import { unreadCount } from '@/modules/training/domain/share';
import { USER_AREA_SECTION as S, marketPendingCounts } from '@/modules/athletes/domain/userArea';
import { useMarketCart, useSellerListings } from '@/modules/marketplace/hooks/useMarket';
import { ORDER_FINAL_STATUSES } from '@/modules/marketplace/domain/constants';
import { isoDate, membershipState } from '@/modules/federations/domain/membership';
import { finalInviteOpen } from '@/modules/federations/domain/competitions';
import { MyDirectedTournaments, MyFinalInvites } from '@/v2/components/federations/competitions/MyCompetitions';
import { MyCallupInvites, MyGrantApplications } from '@/v2/components/federations/selection/MySelection';
import { CHARGE_STATUS, COURSE_KIND_LABELS, MEMBER_STATUS, TRANSFER_KIND_LABELS, TRANSFER_OPEN, TRANSFER_STATUS_LABELS, isInvitePending } from '@/modules/federations/domain/constants';
import { credentialState } from '@/modules/federations/domain/courses';
import { staffRoleName } from '@/modules/federations/domain/staff';
import { verifyPath } from '@/modules/federations/domain/card';
import { membershipAction, setCredentialPublic } from '@/modules/federations/services/federationService';
import { FedCancelMembership, FedMySanctions } from '@/v2/components/federations/FedMemberExtras';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FedLogo, MemberStatusBadge, fedManagePath, fedPath, quando } from '@/v2/components/federations/federationUi';
import MemberCardDialog from '@/v2/components/federations/MemberCard';
import MembershipDeclarationDialog from '@/v2/components/federations/MembershipDeclaration';
import PixChargeBlock from '@/v2/components/federations/PixChargeBlock';
import { useFederation, useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { V2Badge, V2Button, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { HomeAction, HomeEmpty, HomeRow } from '@/v2/components/home/personal/HomeSection';
import WeekStrip from '@/v2/components/training/WeekStrip';
import ProfileProgressionSection from '@/v2/components/profile/ProfileProgressionSection';
import MyReferralCodes from '@/v2/components/arenas/marketing/MyReferralCodes';
import MyArenaPlans from '@/v2/components/arenas/members/MyArenaPlans';
import MyShopPurchases from '@/v2/components/arenas/shop/MyShopPurchases';
import HomeWaitlistCalls from '@/v2/components/arenas/openMatch/HomeWaitlistCalls';
import TrophyShelf from '@/v2/components/trophies/TrophyShelf';
import { MyArenaEnrollments, MyTaughtArenaClasses } from '@/v2/components/arenas/classes/MyArenaClasses';
import { MiniStat } from './ProfileShowcase';
import MyRefereeAssignments from '@/v2/components/federations/referees/MyRefereeAssignments';
import { MyCoachingFed } from '@/v2/components/federations/coaching/MyCoaching';
import { useInsuranceTermGate } from '@/v2/components/federations/insurance/InsuranceTerm';
import { t, tn } from '@/core/i18n';

/* ------------------------------- peças ------------------------------- */

function Bloco({ id, icon: Icon, title, action, children, className }) {
  const tituloId = `minha-area-${id}-titulo`;
  return (
    <section aria-labelledby={tituloId} className={cn('rounded-4xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm sm:p-6', className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid" aria-hidden="true">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <h2 id={tituloId} className="font-display text-lg font-bold leading-tight text-ink sm:text-xl">{title}</h2>
        </div>
        {action && (
          <Link to={action.to} className="shrink-0 rounded-full px-2 py-1 text-sm font-semibold text-gray-500 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30">
            {action.label}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

/** Grade de atalhos: cada um diz para que serve, não só o nome. */
function Atalhos({ itens }) {
  const lista = itens.filter(Boolean);
  if (!lista.length) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {lista.map((a) => (
        <li key={a.to}>
          <HomeRow to={a.to} icon={a.icon} title={a.label} subtitle={a.descricao} badge={a.badge} badgeTone={a.badgeTone} />
        </li>
      ))}
    </ul>
  );
}


/* ------------------------------ seções ------------------------------- */

function ResumoSecao({ ctx }) {
  const { isPlatformAdmin } = useAuth();
  const arenaModulesOn = true;
  const trainingOn = true;
  const { flags } = useFeatureFlags();
  const mercadoOn = Boolean(flags?.[FEATURE_FLAG.MARKETPLACE]);
  const arenas = ctx.arenasQ.isSuccess ? ctx.arenasQ.data : [];
  return (
    <div className="space-y-6">
      {/* A chamada da fila tem prazo: aparece onde a pessoa estiver. */}
      {arenaModulesOn && <HomeWaitlistCalls />}
      {trainingOn && <TreinoDaSemana uid={ctx.uid} compacto />}
      <Bloco id="atalhos" icon={LayoutGrid} title={t('Atalhos')}>
        <Atalhos
          itens={[
            { to: '/meu-desempenho', label: t('Meu desempenho'), descricao: t('Todos os seus jogos e o seu rating'), icon: BarChart3 },
            { to: '/minhas-reservas', label: t('Minhas reservas'), descricao: t('Quadras, jogos abertos e compras'), icon: CalendarDays },
            { to: '/dia-de-jogo', label: t('Dia de jogo'), descricao: t('Os seus dias e os com vaga'), icon: Swords },
            { to: '/perfil/torneios', label: t('Torneios que organizo'), descricao: t('Os que você criou ou ajuda a organizar'), icon: Trophy },
            ctx.isCoach && { to: '/aulas', label: t('Painel do professor'), descricao: t('Agenda, alunos e pacotes'), icon: GraduationCap },
            ...arenas.slice(0, 3).map((a) => ({ to: `/arenas/${a.id}/gerir`, label: a.name || t('Minha arena'), descricao: t('Central da arena'), icon: Building2 })),
            mercadoOn && { to: '/mercado', label: t('Mercado'), descricao: t('Comprar e vender equipamento'), icon: ShoppingBag },
            isPlatformAdmin && { to: '/admin/painel', label: t('Painel admin'), descricao: t('A plataforma inteira'), icon: LayoutDashboard },
          ]}
        />
      </Bloco>
    </div>
  );
}

/** O rating oficial do DUPR de quem está logado (no lugar dos números do rating próprio). */
function DuprNumeros({ uid }) {
  const dupr = useDuprMirror(uid);
  const d = dupr.data;
  const fmt = (n) => (n != null && Number.isFinite(Number(n)) ? Number(n).toFixed(3) : '—');
  return (
    <Bloco id="numeros" icon={Award} title={t('Seu rating DUPR')} action={d?.verified ? { to: '/ranking', label: t('Ver no ranking') } : undefined}>
      {dupr.isPending ? (
        <V2Skeleton className="h-28 rounded-3xl" />
      ) : dupr.isError ? (
        <V2ErrorState inline title={t('Não carregou o seu rating')} description={t('Os seus jogos continuam lá — tente de novo.')} onRetry={() => dupr.refetch()} />
      ) : d?.verified ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MiniStat label={t('Duplas')} value={fmt(d.doubles)} />
          <MiniStat label={t('Simples')} value={fmt(d.singles)} />
          <MiniStat label={t('ID DUPR')} value={d.dupr_id || '—'} />
        </div>
      ) : (
        <HomeEmpty icon={BarChart3} actions={<HomeAction to="/perfil/editar">{t('Conectar conta DUPR')}</HomeAction>}>
          {t('O rating da plataforma agora é o do DUPR. Conecte a sua conta DUPR no editor de perfil para ele aparecer aqui e no ranking.')}
        </HomeEmpty>
      )}
    </Bloco>
  );
}

/** Perfil E conta: os números, o editor, a progressão e as configurações — uma seção só. */
function PerfilSecao() {
  const { user } = useAuth();
  const gamificationOn = true;
  const inicioOn = useHomeCardsOn();
  // Com o DUPR oficial valendo, os números são os do DUPR (rating próprio suspenso).
  const { ownRatingOff } = useDuprMode();
  const rating = useMyPlayerRating({ enabled: !ownRatingOff });
  const me = rating.data;
  return (
    <div className="space-y-6">
      {ownRatingOff ? <DuprNumeros uid={user?.uid} /> : (
      <Bloco id="numeros" icon={Award} title={t('Seus números no ranking')} action={me ? { to: '/ranking', label: t('Ver no ranking') } : undefined}>
        {rating.isPending ? (
          <V2Skeleton className="h-28 rounded-3xl" />
        ) : rating.isError ? (
          <V2ErrorState inline title={t('Não carregou o seu rating')} description={t('Os seus jogos continuam lá — tente de novo.')} onRetry={() => rating.refetch()} />
        ) : me ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label={t('Posição')} value={me.position ? `${me.position}º` : '—'} />
            <MiniStat label={t('Rating')} value={me.rating ?? '—'} />
            <MiniStat label={t('Vitórias')} value={me.wins ?? '—'} />
            <MiniStat label={t('Jogos')} value={me.games ?? '—'} />
          </div>
        ) : (
          <HomeEmpty icon={BarChart3} actions={<HomeAction to="/meu-desempenho">{t('Meu desempenho')}</HomeAction>}>
            {t('Você ainda não aparece no ranking nacional. Ele conta os jogos publicados — em Meu desempenho está o porquê de cada jogo.')}
          </HomeEmpty>
        )}
        <p className="mt-4 text-sm text-gray-500">
          {t('Todos os seus jogos — e, se algum não contar no ranking, o porquê — estão em')}{' '}
          <Link to="/meu-desempenho" className="font-bold text-ink underline">{t('Meu desempenho')}</Link>.
        </p>
      </Bloco>
      )}

      <div className="rounded-4xl border border-dashed border-gray-200 bg-paper p-6 text-sm text-gray-500">
        {t('Edite seus dados, nivelamento e privacidade no editor de perfil.')}{' '}
        <Link to="/perfil/editar" className="font-bold text-ink underline">{t('Abrir editor de perfil')}</Link>
      </div>

      {gamificationOn && user && <ProfileProgressionSection uid={user.uid} />}

      <Bloco id="conta" icon={Settings} title={t('Conta')}>
        <Atalhos
          itens={[
            { to: '/configuracoes', label: t('Configurações'), descricao: t('Aparência, dicas e preferências'), icon: Settings },
            { to: '/configuracoes#notificacoes', label: t('Avisos'), descricao: t('O que chega para você'), icon: Bell },
            { to: '/notificacoes', label: t('Notificações'), descricao: t('Todos os avisos, inclusive os antigos'), icon: Inbox },
            { to: '/configuracoes#minha-regiao', label: t('Minha região'), descricao: t('Cidade e raio das buscas'), icon: MapPin },
            inicioOn && { to: '/configuracoes#pagina-inicial', label: t('Página inicial'), descricao: t('Os cards do seu início'), icon: LayoutGrid },
            { to: '/configuracoes#menu-lateral', label: t('Menu'), descricao: t('O que aparece na barra lateral, e a ordem'), icon: PanelLeft },
            { to: '/legal', label: t('Privacidade e documentos'), descricao: t('Termos, LGPD e os seus dados'), icon: ShieldCheck },
            { to: helpLinkFor('/perfil'), label: t('Ajuda'), descricao: t('O manual da plataforma'), icon: HelpCircle },
          ]}
        />
      </Bloco>
      <MyReferralCodes />
    </div>
  );
}

/** A semana de treino (planejado × feito) e o que chegou do professor. */
function TreinoDaSemana({ uid, compacto = false }) {
  const planos = useMyTrainingPlans(uid);
  const sessoes = useMyTrainingSessions(uid);
  const inbox = useTrainingInbox(uid);
  const hoje = todayLocal();
  const ativo = planos.isSuccess ? (planos.data || []).find((p) => p.status === PLAN_STATUS.ATIVO) : undefined;
  // Só desenha a semana com as DUAS leituras: sem os planos, um dia
  // planejado pareceria livre.
  const resumo = planos.isSuccess && sessoes.isSuccess
    ? weekSummary({ weekKey: weekKeyOf(hoje), sessions: sessoes.data || [], plannedByDate: plannedByDate(ativo), today: hoje })
    : null;
  const novos = inbox.isSuccess ? unreadCount(inbox.data || []) : undefined;
  const falhou = planos.isError || sessoes.isError;

  return (
    <Bloco id={compacto ? 'treino-resumo' : 'treino'} icon={Dumbbell} title={t('Treino desta semana')} action={{ to: '/treino', label: t('Abrir o treino') }}>
      {falhou ? (
        <V2ErrorState
          inline
          title={t('Não carregou a sua semana de treino')}
          description={t('Os seus planos e registros continuam lá.')}
          onRetry={() => { planos.refetch(); sessoes.refetch(); }}
        />
      ) : !resumo ? (
        <V2Skeleton className="h-16 rounded-3xl" />
      ) : (
        <>
          <WeekStrip summary={resumo} />
          <p className="mt-3 text-sm text-gray-500">
            {resumo.sessionsCount > 0
              ? tn(resumo.sessionsCount, '{n} treino registrado nesta semana{min}.', '{n} treinos registrados nesta semana{min}.', { min: resumo.minutes ? `, ${resumo.minutes} min` : '' })
              : t('Nenhum treino registrado nesta semana ainda.')}
            {' '}{ativo ? t('Plano ativo: {nome}.', { nome: ativo.title || t('sem nome') }) : t('Sem plano ativo.')}
          </p>
        </>
      )}
      {!compacto && (
        <div className="mt-5">
          <Atalhos
            itens={[
              { to: '/treino?aba=hoje', label: t('Hoje'), descricao: t('O treino de hoje e o registro'), icon: Dumbbell },
              { to: '/treino?aba=planos', label: t('Planos'), descricao: t('A sua semana planejada'), icon: CalendarDays },
              { to: '/treino?aba=diario', label: t('Diário'), descricao: t('O que você treinou'), icon: ClipboardList },
              { to: '/treino?aba=biblioteca', label: t('Biblioteca'), descricao: t('Exercícios e treinos prontos'), icon: BookOpen },
              {
                to: '/treino?aba=recebidos', label: t('Recebidos'), descricao: t('O que o professor e os amigos mandaram'), icon: Inbox,
                badge: novos ? tn(novos, '{n} novo', '{n} novos') : undefined, badgeTone: 'acid',
              },
              { to: '/treino?aba=duvidas', label: t('Dúvidas'), descricao: t('Conversas com o professor'), icon: MessageCircleQuestion },
            ]}
          />
          {inbox.isError && (
            <V2ErrorState inline className="mt-3" title={t('Não carregou o que você recebeu')} onRetry={() => inbox.refetch()} />
          )}
        </div>
      )}
    </Bloco>
  );
}

function TreinoSecao({ ctx }) {
  return <TreinoDaSemana uid={ctx.uid} />;
}

/** Meus jogos: o que vem (reservas, aulas, dias de jogo) e o que foi (desempenho, ranking) — um link por destino. */
function JogosSecao() {
  const rotulos = useNavRotulos();
  return (
    <div className="space-y-6">
      <MyArenaEnrollments />
      <MyArenaPlans />
      <MyShopPurchases />
      <Bloco id="jogos" icon={Swords} title={t('Meus jogos')}>
        <Atalhos
          itens={[
            { to: '/meus-jogos', label: t('Meus jogos'), descricao: t('As partidas que você tem marcadas'), icon: Swords },
            { to: '/dia-de-jogo', label: t('Dia de jogo'), descricao: t('Os seus dias e os com vaga'), icon: CalendarDays },
            { to: '/procura-jogo', label: rotulos.vagas, descricao: t('Jogos abertos e convites'), icon: Search },
            { to: '/minhas-reservas', label: t('Minhas reservas'), descricao: t('Quadras, jogos abertos e compras nas arenas'), icon: Users },
            { to: '/minhas-aulas', label: t('Minhas aulas'), descricao: t('Aulas com professores e nas arenas'), icon: GraduationCap },
            { to: '/meu-desempenho', label: t('Meu desempenho'), descricao: t('Jogos, evolução e o que conta no ranking'), icon: BarChart3 },
            { to: '/ranking', label: t('Ranking'), descricao: t('Nacional, duplas e 2.0–8.0'), icon: Trophy },
            { to: '/conquistas', label: t('Conquistas'), descricao: t('Medalhas e progresso'), icon: Award },
          ]}
        />
      </Bloco>
    </div>
  );
}

const TOM_DA_FASE = {
  [TOURNAMENT_PHASE.LIVE]: 'acid',
  [TOURNAMENT_PHASE.STALE]: 'amber',
  [TOURNAMENT_PHASE.OPEN]: 'green',
  [TOURNAMENT_PHASE.UPCOMING]: 'blue',
  [TOURNAMENT_PHASE.DRAFT]: 'neutral',
};

function TorneiosSecao() {
  const userHubOn = true;
  const meusQ = useMyTournaments();
  const hoje = hojeLocal();
  const meus = useMemo(() => (meusQ.isSuccess ? myTournamentsForHome(meusQ.data || [], hoje) : []), [meusQ.isSuccess, meusQ.data, hoje]);
  return (
    <Bloco id="torneios" icon={Trophy} title={t('Seus torneios')} action={{ to: '/perfil/torneios', label: userHubOn ? t('Torneios que organizo') : t('Meus torneios') }}>
      {meusQ.isPending ? (
        <V2Skeleton lines={3} />
      ) : meusQ.isError ? (
        <V2ErrorState inline title={t('Não carregou os seus torneios')} description={t('Os seus torneios continuam lá.')} onRetry={() => meusQ.refetch()} />
      ) : meus.length === 0 ? (
        <HomeEmpty
          icon={Trophy}
          actions={(
            <>
              <HomeAction to="/torneios">{t('Ver torneios')}</HomeAction>
              <HomeAction to="/torneios/criar" primary>{t('Criar torneio')}</HomeAction>
            </>
          )}
        >
          {t('Nenhum torneio seu em andamento agora — nem para jogar, nem para organizar.')}
        </HomeEmpty>
      ) : (
        <ul className="space-y-1">
          {meus.map((item) => {
            const { tournament: tor, phase, organizo, inscrito } = item;
            return (
              <li key={tor.id}>
                <HomeRow
                  to={organizo && !inscrito ? `/torneios/${tor.id}/gerenciar` : `/torneios/${tor.id}`}
                  icon={organizo ? ClipboardList : Trophy}
                  title={tor.name}
                  subtitle={[meuPapelTexto(item), periodoTexto(tor, hoje)].filter(Boolean).join(' · ')}
                  badge={t(TOURNAMENT_PHASE_LABEL[phase])}
                  badgeTone={TOM_DA_FASE[phase] || 'blue'}
                  highlight={organizo && phase === TOURNAMENT_PHASE.STALE}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Bloco>
  );
}

function ClubesSecao({ ctx }) {
  const { clubsQ, clubInvitesQ, eventInvitesQ } = ctx;
  const pedidosQ = useMyJoinRequests();
  const nomeDoClube = useMemo(() => new Map((clubsQ.data || []).map((c) => [c.id, c.name])), [clubsQ.data]);
  const convites = clubInvitesQ.data || [];
  const eventos = (eventInvitesQ.data || []).filter((i) => i?.status === 'invited');
  const pedidos = (pedidosQ.data || []).filter((p) => p?.status === JOIN_REQUEST_STATUS.PENDING);

  return (
    <div className="space-y-6">
      {(convites.length > 0 || eventos.length > 0) && (
        <Bloco id="convites" icon={Bell} title={t('Convites para responder')}>
          <ul className="space-y-1">
            {convites.map((c) => (
              <li key={c.id}>
                <HomeRow to={`/clubes/${c.club_id}`} icon={Users} title={c.club_name || 'Clube'} subtitle={t('Convite para entrar no clube')} badge={t('Responder')} badgeTone="acid" />
              </li>
            ))}
            {eventos.map((e) => (
              <li key={e.id}>
                <HomeRow
                  to={`/clubes/${e.club_id}/eventos/${e.event_id}`}
                  icon={CalendarDays}
                  title={t('Convite para um evento')}
                  subtitle={nomeDoClube.get(e.club_id) || t('Evento de clube')}
                  badge={t('Responder')}
                  badgeTone="acid"
                />
              </li>
            ))}
          </ul>
        </Bloco>
      )}
      {(clubInvitesQ.isError || eventInvitesQ.isError) && (
        <V2ErrorState
          inline
          title={t('Não carregaram os seus convites')}
          description={t('Pode haver convite esperando — tente de novo.')}
          onRetry={() => { clubInvitesQ.refetch(); eventInvitesQ.refetch(); }}
        />
      )}

      <Bloco id="clubes" icon={Users} title={t('Seus clubes')} action={{ to: '/clubes', label: t('Ver clubes') }}>
        {clubsQ.isPending ? (
          <V2Skeleton lines={3} />
        ) : clubsQ.isError ? (
          <V2ErrorState inline title={t('Não carregaram os seus clubes')} description={t('Você continua membro deles.')} onRetry={() => clubsQ.refetch()} />
        ) : (clubsQ.data || []).length === 0 ? (
          <HomeEmpty icon={Users} actions={<HomeAction to="/clubes">{t('Encontrar clubes')}</HomeAction>}>
            {t('Você ainda não é membro de nenhum clube.')}
          </HomeEmpty>
        ) : (
          <ul className="space-y-1">
            {clubsQ.data.map((c) => (
              <li key={c.id}>
                <HomeRow to={`/clubes/${c.id}`} icon={Users} title={c.name || 'Clube'} subtitle={CLUB_ROLE_LABELS[c.my_role] || 'Membro'} />
              </li>
            ))}
          </ul>
        )}
        {pedidosQ.isError && (
          <V2ErrorState inline title={t('Não carregaram os seus pedidos para entrar')} onRetry={() => pedidosQ.refetch()} />
        )}
        {pedidos.length > 0 && (
          <p className="mt-3 text-sm text-gray-500">
            {tn(pedidos.length, '{n} pedido para entrar esperando o clube responder: {clubes}.', '{n} pedidos para entrar esperando o clube responder: {clubes}.', {
              clubes: pedidos.map((p) => p.club_name).filter(Boolean).join(', '),
            })}
          </p>
        )}
      </Bloco>
    </div>
  );
}

function ProfessorSecao({ ctx }) {
  const arenaModulesOn = true;
  const trainingOn = true;
  const { lessonsQ, coachQ, uid } = ctx;
  if (coachQ.isError) {
    return <V2ErrorState title={t('Não carregou o seu perfil de professor')} description={t('Ele continua lá — tente de novo.')} onRetry={() => coachQ.refetch()} />;
  }
  const proximas = lessonsQ.isSuccess ? partitionLessons(lessonsQ.data || []).upcoming : null;
  const aResponder = proximas ? lessonsAwaitingReply(proximas).length : undefined;
  return (
    <div className="space-y-6">
      <Bloco id="professor" icon={GraduationCap} title={t('Professor')} action={{ to: '/aulas', label: t('Painel do professor') }}>
        {lessonsQ.isError && (
          <V2ErrorState inline className="mb-3" title={t('Não carregou a sua agenda de aulas')} onRetry={() => lessonsQ.refetch()} />
        )}
        <Atalhos
          itens={[
            {
              to: '/aulas?aba=agenda', label: t('Agenda'), icon: CalendarDays,
              descricao: proximas ? tn(proximas.length, '{n} próxima aula', '{n} próximas aulas') : t('As suas aulas'),
              badge: aResponder ? t('{n} a responder', { n: aResponder }) : undefined, badgeTone: 'acid',
            },
            { to: '/aulas?aba=alunos', label: t('Alunos'), descricao: t('Quem treina com você'), icon: Users },
            trainingOn && { to: '/treino?aba=alunos', label: t('Treino dos alunos'), descricao: t('O que eles registraram e perguntaram'), icon: Dumbbell },
            uid && { to: `/coaches/${uid}`, label: t('Perfil público'), descricao: t('Como os alunos veem você'), icon: User },
          ]}
        />
      </Bloco>
      {arenaModulesOn && <MyTaughtArenaClasses />}
    </div>
  );
}

function ArenasSecao({ ctx }) {
  const { arenasQ, arenaSummary } = ctx;
  return (
    <Bloco id="arenas" icon={Building2} title={t('Suas arenas')} action={{ to: '/arenas/criar', label: t('Cadastrar arena') }}>
      {arenasQ.isPending ? (
        <V2Skeleton lines={3} />
      ) : arenasQ.isError ? (
        <V2ErrorState inline title={t('Não carregaram as suas arenas')} description={t('Você continua gerindo cada uma delas.')} onRetry={() => arenasQ.refetch()} />
      ) : (
        <>
          <ul className="space-y-1">
            {(arenasQ.data || []).map((a) => {
              // Só mostra a contagem conhecida: falha não vira "0 pedidos".
              const n = arenaSummary.pendingByArena?.[a.id];
              return (
                <li key={a.id}>
                  <HomeRow
                    to={`/arenas/${a.id}/gerir`}
                    icon={Building2}
                    title={a.name || t('Arena')}
                    subtitle={[a.city, a.state].filter(Boolean).join(', ') || t('Central da arena')}
                    badge={n ? tn(n, '{n} pedido', '{n} pedidos') : undefined}
                    badgeTone="acid"
                  />
                </li>
              );
            })}
          </ul>
          {arenaSummary.pendingError && (
            <V2ErrorState inline className="mt-3" title={t('Não deu para contar os pedidos de reserva de todas as arenas')} onRetry={() => arenaSummary.refetch?.()} />
          )}
        </>
      )}
    </Bloco>
  );
}

function AdminSecao() {
  const trainingOn = true;
  return (
    <Bloco id="admin" icon={LayoutDashboard} title={t('Administração')}>
      <Atalhos
        itens={[
          { to: '/admin/painel', label: t('Painel admin'), descricao: t('Funcionalidades, cadastros e métricas'), icon: LayoutDashboard },
          trainingOn && { to: '/admin/painel?tab=treino-revisao', label: t('Revisão de treinos'), descricao: t('O que espera aprovação'), icon: FileText },
          trainingOn && { to: '/admin/painel?tab=treino-conteudo', label: t('Conteúdo de treino'), descricao: t('Itens da biblioteca'), icon: BookOpen },
        ]}
      />
    </Bloco>
  );
}

/**
 * Mercado (flag `marketplace`): o que compro e o que vendo. As contas de
 * "esperando você" são as MESMAS da faixa (`marketPendingCounts`), sobre as
 * leituras que a Minha área já fez; só carrinho e anúncios consultam aqui.
 */
function MercadoSecao({ ctx }) {
  const { uid, mercado: m } = ctx;
  const carrinho = useMarketCart(uid);
  const vende = m.sellerQ.isSuccess && Boolean(m.sellerQ.data);
  const anuncios = useSellerListings(vende ? m.sellerKey : null);
  const ok = (q) => (q.isSuccess ? q.data : undefined);
  const contas = marketPendingCounts({
    sellerOrders: ok(m.sellerOrdersQ), sellerOffers: ok(m.sellerOffersQ), sellerQuestions: ok(m.sellerQuestionsQ), myOrders: ok(m.myOrdersQ),
  });
  const emAndamento = m.myOrdersQ.isSuccess ? (m.myOrdersQ.data || []).filter((o) => !ORDER_FINAL_STATUSES.includes(o.status)).length : undefined;
  const esperaCompra = (contas.pagar ?? 0) + (contas.receber ?? 0);
  const noAr = anuncios.isSuccess ? (anuncios.data || []).filter((l) => l.status === 'active').length : undefined;
  const selo = (n) => (n ? t('{n} esperando você', { n }) : undefined);
  const falhaVendas = [m.sellerOrdersQ, m.sellerOffersQ, m.sellerQuestionsQ, anuncios].filter((q) => q.isError);

  return (
    <div className="space-y-6">
      <Bloco id="mercado-comprando" icon={ShoppingBag} title={t('Comprando')} action={{ to: '/mercado', label: t('Abrir o Mercado') }}>
        <Atalhos
          itens={[
            {
              to: '/mercado/pedidos', label: t('Minhas compras'), icon: Receipt,
              descricao: emAndamento === undefined ? t('Pedidos e ofertas') : tn(emAndamento, '{n} compra em andamento', '{n} compras em andamento'),
              badge: selo(esperaCompra), badgeTone: 'acid',
            },
            {
              to: '/mercado/carrinho', label: t('Carrinho'), icon: ShoppingCart,
              descricao: carrinho.isSuccess ? tn(carrinho.count, '{n} item no carrinho', '{n} itens no carrinho') : t('O que você vai comprar'),
            },
            { to: '/mercado/favoritos', label: t('Favoritos'), descricao: t('Os anúncios que você guardou'), icon: Heart },
            { to: '/mercado/buscas', label: t('Buscas salvas'), descricao: t('Aviso quando chega anúncio novo'), icon: Bell },
            { to: '/mercado/vales', label: t('Vales-presente'), descricao: t('Os vales que você comprou ou ganhou'), icon: Gift },
          ]}
        />
        {(m.myOrdersQ.isError || carrinho.isError) && (
          <V2ErrorState
            inline
            className="mt-3"
            title={t('Não carregaram as suas compras')}
            description={t('Os seus pedidos continuam lá.')}
            onRetry={() => { if (m.myOrdersQ.isError) m.myOrdersQ.refetch(); if (carrinho.isError) carrinho.refetch(); }}
          />
        )}
      </Bloco>

      <Bloco id="mercado-vendendo" icon={Store} title={t('Vendendo')} action={{ to: '/mercado/vender', label: t('Painel de vendas') }}>
        {m.sellerQ.isError ? (
          <V2ErrorState inline title={t('Não carregou a sua ficha de vendedor')} description={t('Os seus anúncios continuam lá.')} onRetry={() => m.sellerQ.refetch()} />
        ) : !m.sellerQ.isSuccess ? (
          <V2Skeleton lines={3} />
        ) : !vende ? (
          <HomeEmpty icon={Store} actions={<HomeAction to="/mercado/vender" primary>{t('Começar a vender')}</HomeAction>}>
            {t('Você ainda não vende no Mercado em seu nome. Vendas pela arena, como professor ou pela loja ficam no painel de vendas.')}
          </HomeEmpty>
        ) : (
          <>
            <Atalhos
              itens={[
                {
                  to: '/mercado/vender', label: t('Painel de vendas'), icon: LayoutDashboard,
                  descricao: noAr === undefined ? t('Anúncios, vendas e o seu Pix') : tn(noAr, '{n} anúncio no ar', '{n} anúncios no ar'),
                },
                { to: `/mercado/vender/anuncio/novo?como=${encodeURIComponent(m.sellerKey)}`, label: t('Novo anúncio'), descricao: t('Fotos, preço e entrega'), icon: Plus },
                { to: '/mercado/vender?aba=vendas', label: t('Vendas'), descricao: t('Aceitar, conferir o Pix e entregar'), icon: Receipt, badge: selo(contas.vendas), badgeTone: 'acid' },
                { to: '/mercado/vender?aba=ofertas', label: t('Ofertas'), descricao: t('Propostas de preço dos compradores'), icon: HandCoins, badge: selo(contas.ofertas), badgeTone: 'acid' },
                { to: '/mercado/vender?aba=perguntas', label: t('Perguntas'), descricao: t('Dúvidas sobre os seus anúncios'), icon: MessageCircleQuestion, badge: selo(contas.perguntas), badgeTone: 'acid' },
              ]}
            />
            {falhaVendas.length > 0 && (
              <V2ErrorState inline className="mt-3" title={t('Não deu para contar tudo o que espera por você nas vendas')} onRetry={() => falhaVendas.forEach((q) => q.refetch())} />
            )}
          </>
        )}
      </Bloco>
    </div>
  );
}

/** A estante de troféus: pódios de torneio e de dia de jogo, com o cartão. */
function TrofeusSecao() {
  const { user } = useAuth();
  return (
    <Bloco id="trofeus" icon={Medal} title={t('Seus troféus')}>
      <TrophyShelf uid={user?.uid} nome={user?.displayName || ''} mine />
    </Bloco>
  );
}


/**
 * Federações (flag `federations`): as filiações da pessoa (estado, validade,
 * carteirinha), as cobranças em aberto (Pix) e os papéis na equipe. As
 * leituras são as da Minha área (`ctx.federacoes`); só a carteirinha abre a
 * federação (para a cor e o logo do cartão).
 */
function FiliacaoRow({ m }) {
  const [cartao, setCartao] = useState(false);
  const [declaracao, setDeclaracao] = useState(false);
  // O dependente não tem página própria: a renovação dele sai daqui, pelo id da filiação (o servidor confere o responsável).
  const renovar = useFederationMutation((v) => membershipAction({ federationId: m.federation_id, action: 'renew', memberId: m.id, ...(v ? { insuranceTermVersion: v } : {}) }));
  const st = membershipState(m);
  // A federação vem também para renovar o dependente: o termo do seguro pode precisar de aceite antes.
  const fq = useFederation(cartao || declaracao || (st.canRenew && !m.user_id) ? m.federation_id : null);
  const termo = useInsuranceTermGate(fq.data, m, { confirmLabel: t('Aceitar e renovar'), loading: renovar.isPending });
  const f = { id: m.federation_id, name: m.federation_name || t('Federação'), acronym: m.federation_acronym || '' };
  const temCartao = [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.EXPIRED].includes(st.status) && m.card_code;
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 p-3">
      <FedLogo federation={f} size="sm" />
      <div className="min-w-0 flex-1">
        <Link to={fedPath(f)} className="font-bold text-ink hover:underline">{f.name}</Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <MemberStatusBadge status={st.status} label={st.label} />
          {m.plan_name && <span>{m.plan_name}</span>}
          {m.member_number && <span>· {m.member_number}</span>}
          {st.validUntil && <span>· {t('até {data}', { data: quando(st.validUntil) })}</span>}
        </div>
      </div>
      {temCartao && <V2Button type="button" size="sm" variant="secondary" onClick={() => setCartao(true)} data-dica="minha-area-carteirinha"><IdCard className="h-4 w-4" aria-hidden="true" />{t('Carteirinha')}</V2Button>}
      {st.status === MEMBER_STATUS.ACTIVE && m.card_code && <V2Button type="button" size="sm" variant="ghost" onClick={() => setDeclaracao(true)} data-dica="minha-area-declaracao"><FileText className="h-4 w-4" aria-hidden="true" />{t('Declaração')}</V2Button>}
      {st.canRenew && m.user_id && <V2Button asChild size="sm" variant="ghost"><Link to={`${fedPath(f)}?aba=minha`}>{t('Renovar')}</Link></V2Button>}
      {st.canRenew && !m.user_id && <V2Button type="button" size="sm" variant="ghost" disabled={renovar.isPending} onClick={() => termo.run((v) => renovar.mutate(v, { onSuccess: (r) => toast.success(r?.chargeId ? t('Cobrança de renovação criada. O Pix está em "Pagamentos da federação", nesta página.') : t('Filiação renovada.')), onError: (e) => toast.error(e.message) }))}>{t('Renovar')}</V2Button>}
      {termo.dialog}
      {!m.user_id && <FedCancelMembership member={m} />}
      {cartao && <MemberCardDialog open onOpenChange={setCartao} member={m} federation={fq.data || f} />}
      {declaracao && <MembershipDeclarationDialog open onOpenChange={setDeclaracao} member={m} federationQ={fq} selfService />}
    </li>
  );
}

/** Uma credencial da pessoa: aparecer (ou não) no diretório público e o link de verificação. */
function CredencialRow({ c }) {
  const st = credentialState(c);
  const m = useFederationMutation((input) => setCredentialPublic(c.id, input));
  const alternar = () => m.mutate({ public: !c.public, public_photo: c.public_photo !== false }, { onSuccess: () => toast.success(c.public ? t('Você saiu do diretório público.') : t('Você aparece no diretório público da federação.')), onError: (e) => toast.error(e.message) });
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 p-3">
      <ShieldCheck className={`h-5 w-5 shrink-0 ${st.valid ? 'text-green-700' : 'text-gray-500'}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-ink">{t(COURSE_KIND_LABELS[c.kind] || COURSE_KIND_LABELS.clinic)}{c.level ? ` · ${c.level}` : ''} <span className="text-xs font-normal text-gray-500">· {c.federation_acronym || c.federation_name}</span></p>
        <p className="text-xs text-gray-500">{c.course_name}{c.valid_until ? ` · ${t('até {data}', { data: quando(c.valid_until) })}` : ''} · <V2Badge tone={st.valid ? 'green' : 'neutral'}>{st.label}</V2Badge></p>
      </div>
      {st.valid && c.code && <V2Button asChild size="sm" variant="secondary"><Link to={verifyPath(c.code)}>{t('Verificar')}</Link></V2Button>}
      {st.valid && <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={alternar} data-dica="minha-area-credencial-publica">{c.public ? t('Sair do diretório') : t('Aparecer no diretório')}</V2Button>}
    </li>
  );
}

function FederacoesSecao({ ctx }) {
  const { membersQ, chargesQ, rolesQ, invitesQ, dependentsQ, credentialsQ, transfersQ, rostersQ, assignmentsQ, finalsQ, directedQ, callupsQ, grantAppsQ, coachLicQ } = ctx.federacoes;
  const falhas = [membersQ, chargesQ, rolesQ, invitesQ, dependentsQ, credentialsQ, transfersQ, rostersQ, assignmentsQ, finalsQ, directedQ, callupsQ, grantAppsQ, coachLicQ].filter((q) => q?.isError);
  // Convocações: as abertas e as aceitas de eventos que ainda vêm; inscrições em editais: as do último ano.
  const convocacoes = (callupsQ?.data || []).filter((i) => finalInviteOpen(i) || (i.status === 'accepted' && (!i.starts_at || i.starts_at >= isoDate())));
  const editais = (grantAppsQ?.data || []).filter((a) => (a.created_at_ms || 0) > Date.now() - 365 * 86400000);
  // Convite da final: os abertos e os confirmados de torneios que ainda vêm (o resto é histórico).
  const finais = (finalsQ?.data || []).filter((i) => finalInviteOpen(i) || (i.status === 'accepted' && (!i.starts_at || i.starts_at >= isoDate())));
  const dirigidos = directedQ?.data || [];
  const arbitra = (rostersQ?.data || []).length > 0 || (assignmentsQ?.data || []).length > 0;
  const convites = (invitesQ?.data || []).filter((inv) => isInvitePending(inv));
  const filiacoes = (membersQ.data || []).filter((m) => !['cancelled', 'rejected'].includes(m.status));
  const abertas = (chargesQ.data || []).filter((c) => [CHARGE_STATUS.OPEN, CHARGE_STATUS.DECLARED].includes(c.status));
  const papeis = rolesQ.data || [];
  const dependentes = dependentsQ?.data || [];
  const credenciais = credentialsQ?.data || [];
  const transferencias = (transfersQ?.data || []).filter((x) => TRANSFER_OPEN.includes(x.status));
  // Licença e proteção de menores: as federações em que a pessoa é filiada, licenciada ou árbitra (o servidor diz o que está ligado).
  const licencas = coachLicQ?.data || [];
  const fedsTrabalho = [...new Map([...filiacoes.filter((m) => m.status === MEMBER_STATUS.ACTIVE && m.user_id === ctx.uid), ...licencas, ...(rostersQ?.data || [])]
    .filter((x) => x.federation_id).map((x) => [x.federation_id, { id: x.federation_id, name: x.federation_name || '', acronym: x.federation_acronym || '' }])).values()];
  return (
    <div className="space-y-6">
      {falhas.length > 0 && <V2ErrorState inline title={t('Não carregaram as suas federações')} onRetry={() => falhas.forEach((q) => q.refetch())} />}
      {convites.length > 0 && (
        <Bloco id="federacoes-convites" icon={MailPlus} title={t('Convites para filiar')}>
          <ul className="space-y-2">{convites.map((inv) => <ConviteRow key={inv.id} inv={inv} />)}</ul>
        </Bloco>
      )}
      {finais.length > 0 && (
        <Bloco id="federacoes-finais" icon={Medal} title={t('Convites para finais de circuito')}>
          <MyFinalInvites invites={finais} />
        </Bloco>
      )}
      {convocacoes.length > 0 && (
        <Bloco id="federacoes-convocacoes" icon={Plane} title={t('Minhas convocações')}>
          <MyCallupInvites invites={convocacoes} />
        </Bloco>
      )}
      {editais.length > 0 && (
        <Bloco id="federacoes-editais" icon={FileSignature} title={t('Minhas inscrições em editais')}>
          <MyGrantApplications applications={editais} />
        </Bloco>
      )}
      {dirigidos.length > 0 && (
        <Bloco id="federacoes-diretor" icon={ClipboardCheck} title={t('Torneios que você dirige')}>
          <MyDirectedTournaments reports={dirigidos} />
        </Bloco>
      )}
      {arbitra && (
        <Bloco id="federacoes-escalas" icon={Flag} title={t('Minhas escalas de arbitragem')}>
          <MyRefereeAssignments rosters={rostersQ.data || []} assignments={assignmentsQ.data || []} />
        </Bloco>
      )}
      {fedsTrabalho.length > 0 && (ctx.isCoach || licencas.length > 0 || arbitra) && (
        <Bloco id="federacoes-licenca" icon={BadgeCheck} title={t('Licença de professor e proteção de menores')}>
          <ul className="space-y-3">{fedsTrabalho.map((f) => <MyCoachingFed key={f.id} fed={f} isCoach={Boolean(ctx.isCoach)} hasLicense={licencas.some((l) => l.federation_id === f.id)} />)}</ul>
        </Bloco>
      )}
      {abertas.length > 0 && (
        <Bloco id="federacoes-pagar" icon={HandCoins} title={t('Pagamentos da federação')}>
          <ul className="space-y-3">
            {abertas.map((c) => <li key={c.id}><CobrancaComFederacao charge={c} /></li>)}
          </ul>
        </Bloco>
      )}
      <Bloco id="federacoes-filiacoes" icon={Landmark} title={t('Suas filiações')} action={{ to: '/federacoes', label: t('Ver as federações') }}>
        {membersQ.isSuccess && filiacoes.length === 0 ? (
          <HomeEmpty icon={Landmark} actions={<HomeAction to="/federacoes" primary>{t('Conhecer as federações')}</HomeAction>}>
            {t('Você ainda não é filiado a nenhuma federação. Filiado, você recebe a carteirinha digital e pontua no ranking oficial dela.')}
          </HomeEmpty>
        ) : <ul className="space-y-2">{filiacoes.map((m) => <FiliacaoRow key={m.id} m={m} />)}</ul>}
      </Bloco>
      {transferencias.length > 0 && (
        <Bloco id="federacoes-transferencias" icon={ArrowLeftRight} title={t('Transferências em análise')}>
          <ul className="space-y-2">
            {transferencias.map((x) => (
              <li key={x.id} className="rounded-2xl border border-gray-100 p-3 text-sm">
                <p className="font-bold text-ink">{t(TRANSFER_KIND_LABELS[x.kind] || '')} · {x.federation_acronym || x.federation_name}</p>
                <p className="text-xs text-gray-500">{x.from_club_name || t('sem clube')} → {x.to_club_name || x.to_federation_name || '—'} · <V2Badge tone="amber">{t(TRANSFER_STATUS_LABELS[x.status] || x.status)}</V2Badge></p>
              </li>
            ))}
          </ul>
        </Bloco>
      )}
      {dependentes.length > 0 && (
        <Bloco id="federacoes-dependentes" icon={Users} title={t('Seus dependentes')}>
          <ul className="space-y-2">{dependentes.map((m) => <FiliacaoRow key={m.id} m={m} />)}</ul>
          <p className="mt-2 text-xs text-gray-500">{t('Você responde pela filiação do menor: a cobrança, a carteirinha e os documentos passam por você.')}</p>
        </Bloco>
      )}
      {credenciais.length > 0 && (
        <Bloco id="federacoes-credenciais" icon={ShieldCheck} title={t('Suas credenciais')}>
          <ul className="space-y-2">{credenciais.map((c) => <CredencialRow key={c.id} c={c} />)}</ul>
        </Bloco>
      )}
      <FedMySanctions titulo={t('Sanções disciplinares')} />
      {papeis.length > 0 && (
        <Bloco id="federacoes-equipe" icon={ShieldCheck} title={t('Você na equipe')}>
          <Atalhos itens={papeis.map((s) => ({ to: fedManagePath({ id: s.federation_id }), label: s.federation_name || t('Federação'), descricao: staffRoleName(s), icon: Landmark }))} />
        </Bloco>
      )}
    </div>
  );
}

/** O convite da secretaria: aceitar = pedir a filiação no plano do convite (entra sem esperar aprovação). */
function ConviteRow({ inv }) {
  const [confirmar, setConfirmar] = useState(false);
  const recusar = useFederationMutation(() => membershipAction({ federationId: inv.federation_id, action: 'invite_decline' }));
  return (
    <li className="space-y-2 rounded-2xl border border-gray-100 p-3">
      <p className="text-sm font-bold text-ink">{inv.federation_acronym || inv.federation_name}</p>
      <p className="text-xs text-gray-500">{t('Plano {plano} · vale até {data}', { plano: inv.plan_name, data: quando(inv.expires_at_ms) })}</p>
      {inv.note && <p className="text-sm text-gray-700">“{inv.note}”</p>}
      <div className="flex flex-wrap gap-2">
        <V2Button asChild size="sm"><Link to={`/federacoes/${inv.federation_id}/filiar`}>{t('Aceitar e filiar')}</Link></V2Button>
        <V2Button type="button" size="sm" variant="ghost" disabled={recusar.isPending} onClick={() => setConfirmar(true)}>{t('Recusar')}</V2Button>
      </div>
      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        destructive
        loading={recusar.isPending}
        title={t('Recusar o convite da {sigla}?', { sigla: inv.federation_acronym || inv.federation_name })}
        description={t('O convite deixa de valer e some daqui. Para se filiar depois, é um pedido comum, que passa pela aprovação da secretaria.')}
        confirmLabel={t('Recusar o convite')}
        cancelLabel={t('Voltar')}
        onConfirm={() => recusar.mutate(undefined, { onSuccess: () => { setConfirmar(false); toast.success(t('Convite recusado.')); }, onError: (e) => toast.error(e.message) })}
      />
    </li>
  );
}

/**
 * A cobrança precisa da federação (Pix e cor) para montar o QR. Completa — QR,
 * copia e cola e "Já paguei": todo aviso de cobrança leva para cá, então é
 * aqui que se paga (inclusive o dependente, o curso e a multa).
 */
function CobrancaComFederacao({ charge }) {
  const fq = useFederation(charge.federation_id);
  if (fq.isError) return <V2ErrorState inline title={t('Não carregou a federação desta cobrança')} onRetry={() => fq.refetch()} />;
  if (!fq.isSuccess) return <V2Skeleton lines={3} />;
  return <PixChargeBlock charge={charge} federation={fq.data} />;
}

export const SECOES = Object.freeze({
  [S.RESUMO]: ResumoSecao,
  [S.PERFIL]: PerfilSecao,
  [S.TREINO]: TreinoSecao,
  [S.JOGOS]: JogosSecao,
  [S.TORNEIOS]: TorneiosSecao,
  [S.TROFEUS]: TrofeusSecao,
  [S.MERCADO]: MercadoSecao,
  [S.FEDERACOES]: FederacoesSecao,
  [S.CLUBES]: ClubesSecao,
  [S.PROFESSOR]: ProfessorSecao,
  [S.ARENAS]: ArenasSecao,
  [S.ADMIN]: AdminSecao,
});
