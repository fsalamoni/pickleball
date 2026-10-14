import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, Flame, Sparkles, Target } from 'lucide-react';
import { usePlayerStats } from '@/modules/performance/hooks/usePlayerStats';
import { usePlayerMatchDates, useGoals } from '@/modules/progression/hooks/useProgression';
import { computeXp, levelFromXp, computeWeekStreak } from '@/modules/progression/domain/progression';
import { computeAchievements } from '@/modules/achievements/domain/achievements';
import { useNationalRanking } from '@/modules/rating/hooks/useRating';
import { V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';

/**
 * Faixa de gamificação: streak, nível/XP, próxima conquista e metas.
 * Exportada para a tela inicial personalizada reaproveitar (mesma faixa).
 */
export function EvolutionStrip({ uid, className }) {
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
    <section className={className}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUpIcon />
          <h2 className="font-display text-xl font-bold text-ink">{t('Sua evolução')}</h2>
        </div>
        <Link to="/meu-desempenho" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-ink">
          {t('Ver desempenho')} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <V2Skeleton key={i} className="h-28 rounded-4xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Streak */}
          <MiniCard icon={Flame} accent="acid" label={t('Sequência ativa')}>
            <span className="font-display text-2xl font-black text-ink">{streak}</span>
            <span className="text-sm text-gray-500"> {streak === 1 ? 'semana' : 'semanas'}</span>
          </MiniCard>

          {/* Nível / XP */}
          <V2Surface className="p-5 sm:p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wide text-gray-500">{t('Nível de perfil')}</span>
              <Sparkles className="h-4 w-4 text-acid" />
            </div>
            <div className="font-display text-2xl font-black text-ink">{t('Nível {n}', { n: level.level })}</div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper">
              <div className="h-full rounded-full bg-acid" style={{ width: `${Math.round((level.progress || 0) * 100)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">{t('{atual} / {proximo} XP para o próximo', { atual: level.xpIntoLevel, proximo: level.xpForNext })}</p>
          </V2Surface>

          {/* Próxima conquista */}
          <MiniCard icon={Award} accent="ink" label={t('Próxima conquista')}>
            {nextAchievement ? (
              <>
                <span className="block truncate font-display text-base font-bold text-ink">{nextAchievement.name}</span>
                <span className="block truncate text-xs text-gray-500">{nextAchievement.description}</span>
              </>
            ) : (
              <span className="text-sm font-semibold text-ink">{t('Tudo desbloqueado! 🏆')}</span>
            )}
          </MiniCard>

          {/* Metas */}
          <Link to="/meu-desempenho" className="group rounded-4xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm transition-colors hover:border-gray-300">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wide text-gray-500">{t('Metas')}</span>
              <Target className="h-4 w-4 text-ink" />
            </div>
            {activeGoals > 0 ? (
              <>
                <span className="font-display text-2xl font-black text-ink">{activeGoals}</span>
                <span className="text-sm text-gray-500"> {activeGoals > 1 ? t('ativas') : t('ativa')}</span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink">
                {t('Definir uma meta')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
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
    <V2Surface className="p-5 sm:p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-2xs font-bold uppercase tracking-wide text-gray-500">{label}</span>
        <Icon className={cn('h-4 w-4', accent === 'acid' ? 'text-acid' : 'text-ink')} />
      </div>
      <div>{children}</div>
    </V2Surface>
  );
}

/** Ícone de tendência simples (evita import extra no topo). */
function TrendingUpIcon() {
  return <Sparkles className="h-5 w-5 text-acid" />;
}
