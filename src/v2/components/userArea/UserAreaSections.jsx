/**
 * As seções da Minha área. Cada uma é montada SÓ quando está aberta — então
 * só ela consulta. Nenhuma afirma "não há" sem a leitura ter respondido
 * (`isSuccess`); falha vira `V2ErrorState` com "Tentar de novo".
 *
 * As peças de outras telas entram como são (planos e compras nas arenas,
 * aulas, códigos de indicação, progresso): a Minha área JUNTA, não copia.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Award, BarChart3, Bell, BookOpen, Building2, CalendarDays, ClipboardList, Dumbbell, FileText, GraduationCap,
  HelpCircle, Inbox, LayoutDashboard, LayoutGrid, MapPin, MessageCircleQuestion, PanelLeft, Search, Settings, ShieldCheck,
  Medal, ShoppingBag, Store, Swords, Trophy, User, Users,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';

import { useNavRotulos } from '@/core/lib/useNavRotulos';

import { useMyPlayerRating } from '@/modules/rating/hooks/useRating';
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
import { USER_AREA_SECTION as S } from '@/modules/athletes/domain/userArea';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
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
            mercadoOn && { to: '/mercado/vender', label: t('Vender no Mercado'), descricao: t('Anúncios, vendas e o seu Pix'), icon: Store },
            mercadoOn && { to: '/mercado/pedidos', label: t('Compras no Mercado'), descricao: t('Pedidos e ofertas'), icon: ShoppingBag },
            mercadoOn && { to: '/mercado/buscas', label: t('Buscas salvas'), descricao: t('Aviso quando chega anúncio novo'), icon: Bell },
            isPlatformAdmin && { to: '/admin/painel', label: t('Painel admin'), descricao: t('A plataforma inteira'), icon: LayoutDashboard },
          ]}
        />
      </Bloco>
    </div>
  );
}

/** Perfil E conta: os números, o editor, a progressão e as configurações — uma seção só. */
function PerfilSecao() {
  const { user } = useAuth();
  const gamificationOn = true;
  const inicioOn = useHomeCardsOn();
  const rating = useMyPlayerRating();
  const me = rating.data;
  return (
    <div className="space-y-6">
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

/** A estante de troféus: pódios de torneio e de dia de jogo, com o cartão. */
function TrofeusSecao() {
  const { user } = useAuth();
  return (
    <Bloco id="trofeus" icon={Medal} title={t('Seus troféus')}>
      <TrophyShelf uid={user?.uid} nome={user?.displayName || ''} mine />
    </Bloco>
  );
}

export const SECOES = Object.freeze({
  [S.RESUMO]: ResumoSecao,
  [S.PERFIL]: PerfilSecao,
  [S.TREINO]: TreinoSecao,
  [S.JOGOS]: JogosSecao,
  [S.TORNEIOS]: TorneiosSecao,
  [S.TROFEUS]: TrofeusSecao,
  [S.CLUBES]: ClubesSecao,
  [S.PROFESSOR]: ProfessorSecao,
  [S.ARENAS]: ArenasSecao,
  [S.ADMIN]: AdminSecao,
});
