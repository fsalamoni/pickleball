import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight, Award, Bell, CalendarClock, CheckCircle2, ChevronRight, Flame,
  Handshake, MapPin, Megaphone, MessageCircle, Sparkles, Target, Trophy, Users,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useNotifications } from '@/modules/notifications/hooks/useNotifications';
import { NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { usePublicTournaments } from '@/modules/tournament/hooks/useTournament';
import { getMyUpcomingMatches } from '@/modules/tournament/services/upcomingService';
import { usePlayerStats } from '@/modules/performance/hooks/usePlayerStats';
import { usePlayerMatchDates, useGoals } from '@/modules/progression/hooks/useProgression';
import { computeXp, levelFromXp, computeWeekStreak } from '@/modules/progression/domain/progression';
import { computeAchievements } from '@/modules/achievements/domain/achievements';
import { useNationalRanking } from '@/modules/rating/hooks/useRating';
import { TOURNAMENT_STATUS } from '@/modules/tournament/domain/constants';
import { V2Skeleton } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

/** Ícone por tipo de notificação (fallback: sino). */
const NOTIF_ICON = {
  [NOTIFICATION_TYPE.PARTNER_INVITE]: Handshake,
  [NOTIFICATION_TYPE.PARTNER_RESPONSE]: Handshake,
  [NOTIFICATION_TYPE.CHAT_MESSAGE]: MessageCircle,
  [NOTIFICATION_TYPE.CHAT_INVITE]: MessageCircle,
  [NOTIFICATION_TYPE.TOURNAMENT_ANNOUNCEMENT]: Megaphone,
  [NOTIFICATION_TYPE.TOURNAMENT_OPEN]: Trophy,
  [NOTIFICATION_TYPE.EVENT_INVITE]: CalendarClock,
  [NOTIFICATION_TYPE.CLUB_JOIN_REQUEST]: Users,
  [NOTIFICATION_TYPE.CLUB_INVITE]: Users,
  [NOTIFICATION_TYPE.CLUB_EVENT_PUBLISHED]: CalendarClock,
};

function formatWhen(ms) {
  if (!ms) return 'Horário a definir';
  return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Painéis "orientados a ação" da home (flag action_home). Aditivo: reúne o que
 * o atleta precisa fazer agora (próximo jogo, pendências, torneios perto) e a
 * sua evolução (streak, nível/XP, próxima conquista, metas). Todos os dados
 * vêm de hooks já existentes — nada de novo no banco.
 */
export default function V2ActionHome() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const uid = user?.uid || null;

  const { notifications = [], markAsRead } = useNotifications();
  const { data: publicTournaments = [] } = usePublicTournaments();
  const { data: upcoming = [], isLoading: loadingUpcoming } = useQuery({
    queryKey: ['dashboard-upcoming', uid],
    queryFn: () => getMyUpcomingMatches(uid, { limit: 4 }),
    enabled: !!uid,
    staleTime: 30_000,
  });

  const nextMatch = upcoming[0] || null;

  const pending = useMemo(
    () => notifications.filter((n) => !n.read).slice(0, 4),
    [notifications],
  );

  const myCity = (userProfile?.city || '').trim().toLowerCase();
  const nearby = useMemo(() => {
    if (!myCity) return [];
    return publicTournaments
      .filter((t) => !t.archived
        && (t.city || '').trim().toLowerCase() === myCity
        && t.status === TOURNAMENT_STATUS.REGISTRATIONS_OPEN)
      .slice(0, 3);
  }, [publicTournaments, myCity]);

  const nothingToDo = !nextMatch && pending.length === 0 && nearby.length === 0;

  function openNotification(n) {
    if (!n.read && n.id) markAsRead(n.id).catch(() => {});
    if (n.link) navigate(n.link);
  }

  return (
    <div className="mb-10 space-y-8">
      {/* ---------- O QUE FAZER AGORA ---------- */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-acid" />
          <h2 className="font-display text-xl font-bold text-ink">O que fazer agora</h2>
        </div>

        {loadingUpcoming ? (
          <V2Skeleton className="h-32 rounded-4xl" />
        ) : nothingToDo ? (
          <div className="flex items-center gap-3 rounded-4xl border border-gray-100 bg-paper-pure p-6 text-sm text-gray-500 shadow-organic-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-acid" />
            Tudo em dia — nenhuma pendência no momento. Que tal encontrar um parceiro ou marcar um jogo?
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Próximo jogo (destaque) */}
            {nextMatch && (
              <Link
                to={`/torneios/${nextMatch.tournamentId}`}
                className="group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-4xl bg-ink p-6 text-white shadow-organic transition-transform hover:-translate-y-0.5 lg:col-span-1"
              >
                <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-acid opacity-20 blur-[60px]" />
                <div className="relative z-10">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-acid">
                    <CalendarClock className="h-3.5 w-3.5" /> Próximo jogo
                  </span>
                  <p className="mt-3 font-display text-2xl font-bold">vs {nextMatch.opponent || 'a definir'}</p>
                  <p className="mt-1 text-sm text-gray-300">{nextMatch.tournamentName}</p>
                </div>
                <div className="relative z-10 mt-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-200">
                    {formatWhen(nextMatch.scheduledAt)}{nextMatch.court ? ` · ${nextMatch.court}` : ''}
                  </span>
                  <ArrowRight className="h-5 w-5 text-acid transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            )}

            {/* Pendências (notificações não lidas) */}
            <div className={cn('rounded-4xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm', nextMatch ? 'lg:col-span-1' : 'lg:col-span-2')}>
              <div className="mb-3 flex items-center gap-2">
                <Bell className="h-4 w-4 text-ink" />
                <h3 className="font-display text-sm font-bold text-ink">Pendências</h3>
                {pending.length > 0 && (
                  <span className="rounded-full bg-acid/20 px-2 py-0.5 text-xs font-bold text-ink">{pending.length}</span>
                )}
              </div>
              {pending.length === 0 ? (
                <p className="flex items-center gap-2 py-2 text-sm text-gray-500">
                  <CheckCircle2 className="h-4 w-4 text-acid" /> Nada pendente.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {pending.map((n) => {
                    const Icon = NOTIF_ICON[n.type] || Bell;
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => openNotification(n)}
                          className="flex w-full items-center gap-3 rounded-2xl border border-transparent p-2 text-left transition-colors hover:border-gray-100 hover:bg-paper"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-paper text-ink">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">{n.title || 'Novidade'}</span>
                            {n.message && <span className="block truncate text-xs text-gray-500">{n.message}</span>}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Torneios perto de você */}
            {nearby.length > 0 && (
              <div className="rounded-4xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm lg:col-span-1">
                <div className="mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-ink" />
                  <h3 className="font-display text-sm font-bold text-ink">Perto de você</h3>
                </div>
                <ul className="space-y-1.5">
                  {nearby.map((t) => (
                    <li key={t.id}>
                      <Link
                        to={`/torneios/${t.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-transparent p-2 transition-colors hover:border-gray-100 hover:bg-paper"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-paper text-ink">
                          <Trophy className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">{t.name}</span>
                          <span className="block truncate text-xs text-gray-500">Inscrições abertas · {[t.city, t.state].filter(Boolean).join(' / ')}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---------- SUA EVOLUÇÃO ---------- */}
      <EvolutionStrip uid={uid} />
    </div>
  );
}

/** Faixa de gamificação: streak, nível/XP, próxima conquista e metas. */
function EvolutionStrip({ uid }) {
  const { stats, isLoading } = usePlayerStats();
  const { data: matchDates = [] } = usePlayerMatchDates(uid);
  const { data: goals = [] } = useGoals(uid);
  const { data: ranking = [] } = useNationalRanking();

  const me = useMemo(() => ranking.find((p) => p.id === uid || p.uid === uid) || null, [ranking, uid]);

  const streak = useMemo(() => computeWeekStreak(matchDates), [matchDates]);
  const summary = useMemo(
    () => ({ ...(stats || {}), rating: me?.rating, weekStreak: streak }),
    [stats, me?.rating, streak],
  );
  const xp = useMemo(() => computeXp(summary), [summary]);
  const level = useMemo(() => levelFromXp(xp), [xp]);
  const achievements = useMemo(() => computeAchievements(summary), [summary]);
  const nextAchievement = achievements.locked[0] || null;
  const activeGoals = Array.isArray(goals) ? goals.length : 0;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUpIcon />
          <h2 className="font-display text-xl font-bold text-ink">Sua evolução</h2>
        </div>
        <Link to="/meu-desempenho" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-ink">
          Ver desempenho <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <V2Skeleton key={i} className="h-28 rounded-4xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Streak */}
          <MiniCard icon={Flame} accent="acid" label="Sequência ativa">
            <span className="font-display text-2xl font-black text-ink">{streak}</span>
            <span className="text-sm text-gray-500"> {streak === 1 ? 'semana' : 'semanas'}</span>
          </MiniCard>

          {/* Nível / XP */}
          <div className="rounded-4xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Nível de perfil</span>
              <Sparkles className="h-4 w-4 text-acid" />
            </div>
            <div className="font-display text-2xl font-black text-ink">Nível {level.level}</div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper">
              <div className="h-full rounded-full bg-acid" style={{ width: `${Math.round((level.progress || 0) * 100)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">{level.xpIntoLevel} / {level.xpForNext} XP para o próximo</p>
          </div>

          {/* Próxima conquista */}
          <MiniCard icon={Award} accent="ink" label="Próxima conquista">
            {nextAchievement ? (
              <>
                <span className="block truncate font-display text-base font-bold text-ink">{nextAchievement.name}</span>
                <span className="block truncate text-xs text-gray-500">{nextAchievement.description}</span>
              </>
            ) : (
              <span className="text-sm font-semibold text-ink">Tudo desbloqueado! 🏆</span>
            )}
          </MiniCard>

          {/* Metas */}
          <Link to="/meu-desempenho" className="group rounded-4xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm transition-colors hover:border-gray-300">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Metas</span>
              <Target className="h-4 w-4 text-ink" />
            </div>
            {activeGoals > 0 ? (
              <>
                <span className="font-display text-2xl font-black text-ink">{activeGoals}</span>
                <span className="text-sm text-gray-500"> ativa{activeGoals > 1 ? 's' : ''}</span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink">
                Definir uma meta <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            )}
          </Link>
        </div>
      )}
    </section>
  );
}

function MiniCard({ icon: Icon, accent = 'ink', label, children }) {
  return (
    <div className="rounded-4xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
        <Icon className={cn('h-4 w-4', accent === 'acid' ? 'text-acid' : 'text-ink')} />
      </div>
      <div>{children}</div>
    </div>
  );
}

/** Ícone de tendência simples (evita import extra no topo). */
function TrendingUpIcon() {
  return <Sparkles className="h-5 w-5 text-acid" />;
}
