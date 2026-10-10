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
  HelpCircle, Inbox, LayoutDashboard, LayoutGrid, MapPin, MessageCircleQuestion, Search, Settings, ShieldCheck,
  Swords, Trophy, User, Users,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
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
import { MyArenaEnrollments, MyTaughtArenaClasses } from '@/v2/components/arenas/classes/MyArenaClasses';
import { MiniStat } from './ProfileShowcase';

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

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/* ------------------------------ seções ------------------------------- */

function ResumoSecao({ ctx }) {
  const { isPlatformAdmin } = useAuth();
  const arenaModulesOn = useFeatureFlag(FEATURE_FLAG.ARENA_MODULES);
  const trainingOn = useFeatureFlag(FEATURE_FLAG.TRAINING_CENTER);
  const arenas = ctx.arenasQ.isSuccess ? ctx.arenasQ.data : [];
  return (
    <div className="space-y-6">
      {/* A chamada da fila tem prazo: aparece onde a pessoa estiver. */}
      {arenaModulesOn && <HomeWaitlistCalls />}
      {trainingOn && <TreinoDaSemana uid={ctx.uid} compacto />}
      <Bloco id="atalhos" icon={LayoutGrid} title="Atalhos">
        <Atalhos
          itens={[
            { to: '/meu-desempenho', label: 'Meu desempenho', descricao: 'Todos os seus jogos e o seu rating', icon: BarChart3 },
            { to: '/minhas-reservas', label: 'Minhas reservas', descricao: 'Quadras, jogos abertos e compras', icon: CalendarDays },
            { to: '/dia-de-jogo', label: 'Dia de jogo', descricao: 'Os seus dias e os com vaga', icon: Swords },
            { to: '/perfil/torneios', label: 'Torneios que organizo', descricao: 'Os que você criou ou ajuda a organizar', icon: Trophy },
            ctx.isCoach && { to: '/aulas', label: 'Painel do professor', descricao: 'Agenda, alunos e pacotes', icon: GraduationCap },
            ...arenas.slice(0, 3).map((a) => ({ to: `/arenas/${a.id}/gerir`, label: a.name || 'Minha arena', descricao: 'Central da arena', icon: Building2 })),
            isPlatformAdmin && { to: '/admin/painel', label: 'Painel admin', descricao: 'A plataforma inteira', icon: LayoutDashboard },
          ]}
        />
      </Bloco>
    </div>
  );
}

function PerfilSecao() {
  const { user } = useAuth();
  const gamificationOn = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);
  const rating = useMyPlayerRating();
  const me = rating.data;
  return (
    <div className="space-y-6">
      <Bloco id="numeros" icon={Award} title="Seus números no ranking" action={me ? { to: '/ranking', label: 'Ver no ranking' } : undefined}>
        {rating.isPending ? (
          <V2Skeleton className="h-28 rounded-3xl" />
        ) : rating.isError ? (
          <V2ErrorState inline title="Não carregou o seu rating" description="Os seus jogos continuam lá — tente de novo." onRetry={() => rating.refetch()} />
        ) : me ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Posição" value={me.position ? `${me.position}º` : '—'} />
            <MiniStat label="Rating" value={me.rating ?? '—'} />
            <MiniStat label="Vitórias" value={me.wins ?? '—'} />
            <MiniStat label="Jogos" value={me.games ?? '—'} />
          </div>
        ) : (
          <HomeEmpty icon={BarChart3} actions={<HomeAction to="/meu-desempenho">Meu desempenho</HomeAction>}>
            Você ainda não aparece no ranking nacional. Ele conta os jogos publicados — em Meu desempenho está o porquê de cada jogo.
          </HomeEmpty>
        )}
        <p className="mt-4 text-sm text-gray-500">
          Todos os seus jogos — e, se algum não contar no ranking, o porquê — estão em{' '}
          <Link to="/meu-desempenho" className="font-bold text-ink underline">Meu desempenho</Link>.
        </p>
      </Bloco>

      <div className="rounded-4xl border border-dashed border-gray-200 bg-paper p-6 text-sm text-gray-500">
        Edite seus dados, nivelamento e privacidade no editor de perfil.{' '}
        <Link to="/perfil/editar" className="font-bold text-ink underline">Abrir editor de perfil</Link>
      </div>

      {gamificationOn && user && <ProfileProgressionSection uid={user.uid} />}
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
    <Bloco id={compacto ? 'treino-resumo' : 'treino'} icon={Dumbbell} title="Treino desta semana" action={{ to: '/treino', label: 'Abrir o treino' }}>
      {falhou ? (
        <V2ErrorState
          inline
          title="Não carregou a sua semana de treino"
          description="Os seus planos e registros continuam lá."
          onRetry={() => { planos.refetch(); sessoes.refetch(); }}
        />
      ) : !resumo ? (
        <V2Skeleton className="h-16 rounded-3xl" />
      ) : (
        <>
          <WeekStrip summary={resumo} />
          <p className="mt-3 text-sm text-gray-500">
            {resumo.sessionsCount > 0
              ? `${plural(resumo.sessionsCount, 'treino registrado', 'treinos registrados')} nesta semana${resumo.minutes ? `, ${resumo.minutes} min` : ''}.`
              : 'Nenhum treino registrado nesta semana ainda.'}
            {' '}{ativo ? `Plano ativo: ${ativo.title || 'sem nome'}.` : 'Sem plano ativo.'}
          </p>
        </>
      )}
      {!compacto && (
        <div className="mt-5">
          <Atalhos
            itens={[
              { to: '/treino?aba=hoje', label: 'Hoje', descricao: 'O treino de hoje e o registro', icon: Dumbbell },
              { to: '/treino?aba=planos', label: 'Planos', descricao: 'A sua semana planejada', icon: CalendarDays },
              { to: '/treino?aba=diario', label: 'Diário', descricao: 'O que você treinou', icon: ClipboardList },
              { to: '/treino?aba=biblioteca', label: 'Biblioteca', descricao: 'Exercícios e treinos prontos', icon: BookOpen },
              {
                to: '/treino?aba=recebidos', label: 'Recebidos', descricao: 'O que o professor e os amigos mandaram', icon: Inbox,
                badge: novos ? `${novos} novo${novos === 1 ? '' : 's'}` : undefined, badgeTone: 'acid',
              },
              { to: '/treino?aba=duvidas', label: 'Dúvidas', descricao: 'Conversas com o professor', icon: MessageCircleQuestion },
            ]}
          />
          {inbox.isError && (
            <V2ErrorState inline className="mt-3" title="Não carregou o que você recebeu" onRetry={() => inbox.refetch()} />
          )}
        </div>
      )}
    </Bloco>
  );
}

function TreinoSecao({ ctx }) {
  return <TreinoDaSemana uid={ctx.uid} />;
}

function JogoSecao() {
  const gamificationOn = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);
  return (
    <Bloco id="jogo" icon={BarChart3} title="Jogo">
      <Atalhos
        itens={[
          { to: '/meu-desempenho', label: 'Meu desempenho', descricao: 'Jogos, evolução e o que conta no ranking', icon: BarChart3 },
          { to: '/ranking', label: 'Ranking', descricao: 'Nacional, duplas e 2.0–8.0', icon: Trophy },
          { to: '/meus-jogos', label: 'Meus jogos', descricao: 'As partidas que você tem marcadas', icon: Swords },
          { to: '/dia-de-jogo', label: 'Dia de jogo', descricao: 'Os seus dias e os com vaga', icon: CalendarDays },
          { to: '/procura-jogo', label: 'Procura-se jogo', descricao: 'Jogos abertos e convites', icon: Search },
          gamificationOn && { to: '/conquistas', label: 'Conquistas', descricao: 'Medalhas e progresso', icon: Award },
        ]}
      />
    </Bloco>
  );
}

function AgendaSecao() {
  const arenaModulesOn = useFeatureFlag(FEATURE_FLAG.ARENA_MODULES);
  return (
    <div className="space-y-6">
      {arenaModulesOn && (
        <>
          <MyArenaEnrollments />
          <MyArenaPlans />
          <MyShopPurchases />
        </>
      )}
      <Bloco id="agenda" icon={CalendarDays} title="Agenda">
        <Atalhos
          itens={[
            { to: '/minhas-reservas', label: 'Minhas reservas', descricao: 'Quadras, jogos abertos e compras nas arenas', icon: CalendarDays },
            { to: '/minhas-aulas', label: 'Minhas aulas', descricao: 'Aulas com professores e nas arenas', icon: GraduationCap },
            { to: '/meus-jogos', label: 'Meus jogos', descricao: 'As partidas que você tem marcadas', icon: Swords },
            { to: '/dia-de-jogo', label: 'Dia de jogo', descricao: 'Os seus dias de jogo', icon: Users },
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
  const userHubOn = useFeatureFlag(FEATURE_FLAG.USER_HUB);
  const meusQ = useMyTournaments();
  const hoje = hojeLocal();
  const meus = useMemo(() => (meusQ.isSuccess ? myTournamentsForHome(meusQ.data || [], hoje) : []), [meusQ.isSuccess, meusQ.data, hoje]);
  return (
    <Bloco id="torneios" icon={Trophy} title="Seus torneios" action={{ to: '/perfil/torneios', label: userHubOn ? 'Torneios que organizo' : 'Meus torneios' }}>
      {meusQ.isPending ? (
        <V2Skeleton lines={3} />
      ) : meusQ.isError ? (
        <V2ErrorState inline title="Não carregou os seus torneios" description="Os seus torneios continuam lá." onRetry={() => meusQ.refetch()} />
      ) : meus.length === 0 ? (
        <HomeEmpty
          icon={Trophy}
          actions={(
            <>
              <HomeAction to="/torneios">Ver torneios</HomeAction>
              <HomeAction to="/torneios/criar" primary>Criar torneio</HomeAction>
            </>
          )}
        >
          Nenhum torneio seu em andamento agora — nem para jogar, nem para organizar.
        </HomeEmpty>
      ) : (
        <ul className="space-y-1">
          {meus.map((item) => {
            const { tournament: t, phase, organizo, inscrito } = item;
            return (
              <li key={t.id}>
                <HomeRow
                  to={organizo && !inscrito ? `/torneios/${t.id}/gerenciar` : `/torneios/${t.id}`}
                  icon={organizo ? ClipboardList : Trophy}
                  title={t.name}
                  subtitle={[meuPapelTexto(item), periodoTexto(t, hoje)].filter(Boolean).join(' · ')}
                  badge={TOURNAMENT_PHASE_LABEL[phase]}
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
        <Bloco id="convites" icon={Bell} title="Convites para responder">
          <ul className="space-y-1">
            {convites.map((c) => (
              <li key={c.id}>
                <HomeRow to={`/clubes/${c.club_id}`} icon={Users} title={c.club_name || 'Clube'} subtitle="Convite para entrar no clube" badge="Responder" badgeTone="acid" />
              </li>
            ))}
            {eventos.map((e) => (
              <li key={e.id}>
                <HomeRow
                  to={`/clubes/${e.club_id}/eventos/${e.event_id}`}
                  icon={CalendarDays}
                  title="Convite para um evento"
                  subtitle={nomeDoClube.get(e.club_id) || 'Evento de clube'}
                  badge="Responder"
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
          title="Não carregaram os seus convites"
          description="Pode haver convite esperando — tente de novo."
          onRetry={() => { clubInvitesQ.refetch(); eventInvitesQ.refetch(); }}
        />
      )}

      <Bloco id="clubes" icon={Users} title="Seus clubes" action={{ to: '/clubes', label: 'Ver clubes' }}>
        {clubsQ.isPending ? (
          <V2Skeleton lines={3} />
        ) : clubsQ.isError ? (
          <V2ErrorState inline title="Não carregaram os seus clubes" description="Você continua membro deles." onRetry={() => clubsQ.refetch()} />
        ) : (clubsQ.data || []).length === 0 ? (
          <HomeEmpty icon={Users} actions={<HomeAction to="/clubes">Encontrar clubes</HomeAction>}>
            Você ainda não é membro de nenhum clube.
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
          <V2ErrorState inline title="Não carregaram os seus pedidos para entrar" onRetry={() => pedidosQ.refetch()} />
        )}
        {pedidos.length > 0 && (
          <p className="mt-3 text-sm text-gray-500">
            {plural(pedidos.length, 'pedido para entrar esperando', 'pedidos para entrar esperando')} o clube responder
            {': '}{pedidos.map((p) => p.club_name).filter(Boolean).join(', ')}.
          </p>
        )}
      </Bloco>
    </div>
  );
}

function ProfessorSecao({ ctx }) {
  const arenaModulesOn = useFeatureFlag(FEATURE_FLAG.ARENA_MODULES);
  const trainingOn = useFeatureFlag(FEATURE_FLAG.TRAINING_CENTER);
  const { lessonsQ, coachQ, uid } = ctx;
  if (coachQ.isError) {
    return <V2ErrorState title="Não carregou o seu perfil de professor" description="Ele continua lá — tente de novo." onRetry={() => coachQ.refetch()} />;
  }
  const proximas = lessonsQ.isSuccess ? partitionLessons(lessonsQ.data || []).upcoming : null;
  const aResponder = proximas ? lessonsAwaitingReply(proximas).length : undefined;
  return (
    <div className="space-y-6">
      <Bloco id="professor" icon={GraduationCap} title="Professor" action={{ to: '/aulas', label: 'Painel do professor' }}>
        {lessonsQ.isError && (
          <V2ErrorState inline className="mb-3" title="Não carregou a sua agenda de aulas" onRetry={() => lessonsQ.refetch()} />
        )}
        <Atalhos
          itens={[
            {
              to: '/aulas?aba=agenda', label: 'Agenda', icon: CalendarDays,
              descricao: proximas ? plural(proximas.length, 'próxima aula', 'próximas aulas') : 'As suas aulas',
              badge: aResponder ? `${aResponder} a responder` : undefined, badgeTone: 'acid',
            },
            { to: '/aulas?aba=alunos', label: 'Alunos', descricao: 'Quem treina com você', icon: Users },
            trainingOn && { to: '/treino?aba=alunos', label: 'Treino dos alunos', descricao: 'O que eles registraram e perguntaram', icon: Dumbbell },
            uid && { to: `/coaches/${uid}`, label: 'Perfil público', descricao: 'Como os alunos veem você', icon: User },
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
    <Bloco id="arenas" icon={Building2} title="Suas arenas" action={{ to: '/arenas/criar', label: 'Cadastrar arena' }}>
      {arenasQ.isPending ? (
        <V2Skeleton lines={3} />
      ) : arenasQ.isError ? (
        <V2ErrorState inline title="Não carregaram as suas arenas" description="Você continua gerindo cada uma delas." onRetry={() => arenasQ.refetch()} />
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
                    title={a.name || 'Arena'}
                    subtitle={[a.city, a.state].filter(Boolean).join(', ') || 'Central da arena'}
                    badge={n ? plural(n, 'pedido', 'pedidos') : undefined}
                    badgeTone="acid"
                  />
                </li>
              );
            })}
          </ul>
          {arenaSummary.pendingError && (
            <V2ErrorState inline className="mt-3" title="Não deu para contar os pedidos de reserva de todas as arenas" onRetry={() => arenaSummary.refetch?.()} />
          )}
        </>
      )}
    </Bloco>
  );
}

function ContaSecao() {
  const arenaModulesOn = useFeatureFlag(FEATURE_FLAG.ARENA_MODULES);
  const notificacoesOn = useFeatureFlag(FEATURE_FLAG.NOTIFICATIONS_CENTER);
  const regiaoOn = useFeatureFlag(FEATURE_FLAG.MY_REGION);
  const ajudaOn = useFeatureFlag(FEATURE_FLAG.HELP_CENTER);
  const inicioOn = useHomeCardsOn();
  return (
    <div className="space-y-6">
      <Bloco id="conta" icon={Settings} title="Conta">
        <Atalhos
          itens={[
            { to: '/perfil/editar', label: 'Editar perfil', descricao: 'Dados, nível e privacidade', icon: User },
            { to: '/configuracoes', label: 'Configurações', descricao: 'Aparência, dicas e preferências', icon: Settings },
            { to: '/configuracoes#notificacoes', label: 'Avisos', descricao: 'O que chega para você', icon: Bell },
            notificacoesOn && { to: '/notificacoes', label: 'Notificações', descricao: 'Todos os avisos, inclusive os antigos', icon: Inbox },
            regiaoOn && { to: '/configuracoes#minha-regiao', label: 'Minha região', descricao: 'Cidade e raio das buscas', icon: MapPin },
            inicioOn && { to: '/configuracoes#pagina-inicial', label: 'Página inicial', descricao: 'Os cards do seu início', icon: LayoutGrid },
            { to: '/legal', label: 'Privacidade e documentos', descricao: 'Termos, LGPD e os seus dados', icon: ShieldCheck },
            ajudaOn && { to: helpLinkFor('/perfil'), label: 'Ajuda', descricao: 'O manual da plataforma', icon: HelpCircle },
          ]}
        />
      </Bloco>
      {arenaModulesOn && <MyReferralCodes />}
    </div>
  );
}

function AdminSecao() {
  const trainingOn = useFeatureFlag(FEATURE_FLAG.TRAINING_CENTER);
  return (
    <Bloco id="admin" icon={LayoutDashboard} title="Administração">
      <Atalhos
        itens={[
          { to: '/admin/painel', label: 'Painel admin', descricao: 'Funcionalidades, cadastros e métricas', icon: LayoutDashboard },
          trainingOn && { to: '/admin/painel?tab=treino-revisao', label: 'Revisão de treinos', descricao: 'O que espera aprovação', icon: FileText },
          trainingOn && { to: '/admin/painel?tab=treino-conteudo', label: 'Conteúdo de treino', descricao: 'Itens da biblioteca', icon: BookOpen },
        ]}
      />
    </Bloco>
  );
}

export const SECOES = Object.freeze({
  [S.RESUMO]: ResumoSecao,
  [S.PERFIL]: PerfilSecao,
  [S.TREINO]: TreinoSecao,
  [S.JOGO]: JogoSecao,
  [S.AGENDA]: AgendaSecao,
  [S.TORNEIOS]: TorneiosSecao,
  [S.CLUBES]: ClubesSecao,
  [S.PROFESSOR]: ProfessorSecao,
  [S.ARENAS]: ArenasSecao,
  [S.CONTA]: ContaSecao,
  [S.ADMIN]: AdminSecao,
});
