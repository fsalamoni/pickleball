import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Award, Building2, ChevronRight, GraduationCap, Hash, Medal, Percent, ShieldCheck, Swords, Trophy } from 'lucide-react';
import { useAthleteProfile } from '@/modules/athletes/hooks/useAthleteProfile';
import { genderLabel } from '@/modules/athletes/domain/constants';
import { MODALITY_FORMAT_LABELS } from '@/modules/tournament/domain/constants';
import { useRatingHistory } from '@/modules/rating/hooks/useRating';
import { useHeadToHead } from '@/modules/rating/hooks/useHeadToHead';
import { useFollowers } from '@/modules/social/hooks/useFollow';
import { useCoach } from '@/modules/coaches/hooks/useCoaches';
import { useAthleteValidations } from '@/modules/coaches/hooks/useValidations';
import { latestValidation } from '@/modules/coaches/domain/validation';
import FollowButton from '@/modules/social/components/FollowButton';
import RatingSparkline from '@/modules/rating/components/RatingSparkline';
import HeadToHeadCard from '@/modules/rating/components/HeadToHeadCard';
import AchievementsCard from '@/modules/achievements/components/AchievementsCard';
import V2ChatLauncherButton from '@/v2/components/chat/V2ChatLauncherButton';
import { V2Avatar, V2Badge, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface, V2BackLink } from '@/v2/ui/primitives';
import V2DuprRatingBadge from '@/v2/components/rating/V2DuprRatingBadge';
import V2DuprEvolution from '@/v2/components/rating/V2DuprEvolution';
import TrophyShelf from '@/v2/components/trophies/TrophyShelf';
import { t, tn, fmtData } from '@/core/i18n';

function formatPercent(rate) {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}

function clubNames(athlete) {
  return (athlete?.clubs || []).map((c) => (typeof c === 'string' ? { id: c, name: c } : c)).filter((c) => c?.name);
}

export default function V2AthleteProfile() {
  const enabled = true;
  const followOn = true;
  const ratingHistoryOn = true;
  const headToHeadOn = true;
  const achievementsOn = true;
  const coachResidentOn = true;
  const levelingOn = true;
  const { uid } = useParams();
  const { data, isLoading, isError, refetch } = useAthleteProfile(uid);
  const { data: ratingHistory = [] } = useRatingHistory(uid, ratingHistoryOn);
  const { data: h2hData } = useHeadToHead(uid, headToHeadOn);
  const { data: followers = [] } = useFollowers(uid, followOn);
  const { data: coachProfile } = useCoach(coachResidentOn ? uid : null);
  const { data: validations = [] } = useAthleteValidations(levelingOn ? uid : null);
  const validatedLevel = levelingOn ? latestValidation(validations) : null;

  if (!enabled) return <Navigate to="/atletas" replace />;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1000px] space-y-6">
        <V2Skeleton className="h-64 rounded-4xl" />
        <V2Skeleton className="h-40 rounded-4xl" />
      </div>
    );
  }

  if (isError) {
    // Falhar não é "o perfil não existe" (docs/27-FALHA-NAO-E-VAZIO.md).
    return (
      <div className="mx-auto max-w-[720px]">
        <V2Surface>
          <V2ErrorState
            title={t('Não foi possível carregar o perfil')}
            description={t('O perfil continua lá — só não conseguimos buscá-lo agora.')}
            onRetry={() => refetch()}
          />
        </V2Surface>
      </div>
    );
  }

  const athlete = data?.athlete;
  if (!athlete) {
    return (
      <div className="mx-auto max-w-[720px]">
        <V2Surface>
          <V2EmptyState
            icon={Trophy}
            title={t('Atleta não encontrado')}
            description={t('O perfil que você procura não existe ou não está mais disponível.')}
            action={<Link to="/atletas" className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">{t('Voltar aos atletas')}</Link>}
          />
        </V2Surface>
      </div>
    );
  }

  const { rating, history = [], gameDayGames = [], stats, historicoFalhou } = data;
  const location = [athlete.city, athlete.state].filter(Boolean).join(' / ');
  const clubs = clubNames(athlete);
  const formats = Object.entries(stats?.byFormat || {});

  return (
    <div className="mx-auto max-w-[1000px]">
      <V2BackLink to="/atletas" className="mb-5">{t('Voltar aos atletas')}</V2BackLink>

      {/* Hero */}
      <V2Surface className="overflow-hidden">
        <div className="relative h-56 bg-mesh">
          <div className="absolute inset-0 bg-gradient-to-t from-paper-pure to-transparent" />
        </div>
        <div className="relative px-6 pb-8 sm:px-8">
          <div className="-mt-16 mb-6 flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="rounded-full border-8 border-paper-pure bg-paper-pure shadow-md">
              <V2Avatar name={athlete.platform_name} photoUrl={athlete.photo_url} size="xl" className="h-32 w-32 text-4xl" />
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              {followOn && <FollowButton targetUid={uid} />}
              <V2ChatLauncherButton athlete={athlete} label={t('Conversar')} className="w-full sm:w-auto" />
            </div>
          </div>

          <div className="text-center sm:text-left">
            <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{athlete.platform_name}</h1>
            <p className="mt-1 font-medium text-gray-500">
              {[
                Number.isFinite(athlete.age) ? tn(athlete.age, '{n} ano', '{n} anos') : null,
                genderLabel(athlete.gender),
                location,
                followOn ? tn(followers.length, '{n} seguidor', '{n} seguidores') : null,
              ].filter(Boolean).join(' • ') || t('Atleta da comunidade')}
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
              {rating && (
                <div className="flex items-center gap-2 rounded-2xl border border-acid/40 bg-acid/15 px-4 py-2 text-sm font-semibold text-ink">
                  <Medal className="h-4 w-4" /> {t('Rating {n}', { n: rating.rating })}{rating.position ? ` · ${rating.position}º` : ''}
                </div>
              )}
              {/* Nível 2.0–8.0 (ranking estilo DUPR) — auto-oculto pela flag/dados. */}
              <V2DuprRatingBadge uid={uid} />
              {athlete.level && (
                <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-paper px-4 py-2 text-sm font-semibold text-gray-600">
                  <Award className="h-4 w-4" /> {athlete.level}
                </div>
              )}
              {athlete.dupr_id && (
                <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-paper px-4 py-2 text-sm font-semibold text-gray-600">
                  <Hash className="h-4 w-4" /> DUPR {athlete.dupr_id}
                </div>
              )}
              {validatedLevel?.level_id && (
                <div
                  className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700"
                  title={validatedLevel.coach_name ? t('Validado por {nome}', { nome: validatedLevel.coach_name }) : t('Validado por professor')}
                >
                  <ShieldCheck className="h-4 w-4" /> {t('Nível {nivel} validado', { nivel: validatedLevel.level_badge || validatedLevel.level_name })}
                </div>
              )}
            </div>

            {clubs.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {clubs.map((c) => (
                  <Link key={c.id} to={`/clubes/${c.id}`}>
                    <V2Badge tone="neutral"><Building2 className="h-3 w-3" /> {c.name}</V2Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </V2Surface>

      {/* Stats — com o histórico sem carregar, os números são "—", nunca zero. */}
      {historicoFalhou && (
        <V2ErrorState
          inline
          className="mt-8"
          title={t('O histórico de jogos não carregou por completo')}
          description={t('Os números abaixo ficam em branco até ele chegar — um total pela metade pareceria o total.')}
          onRetry={() => refetch()}
        />
      )}
      <div className={`${historicoFalhou ? 'mt-4' : 'mt-8'} grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6`}>
        <MiniStat icon={Trophy} label={t('Torneios')} value={historicoFalhou ? '—' : stats.tournaments} />
        <MiniStat icon={Swords} label={t('Jogos')} value={historicoFalhou ? '—' : stats.played} />
        <MiniStat icon={Percent} label={t('Aproveit.')} value={historicoFalhou ? '—' : formatPercent(stats.winRate)} />
        <MiniStat icon={Award} label={t('Títulos')} value={historicoFalhou ? '—' : stats.titles} />
        <MiniStat icon={Medal} label={t('Pódios')} value={historicoFalhou ? '—' : stats.podiums} />
        <MiniStat icon={Trophy} label={t('Inscrições')} value={historicoFalhou ? '—' : stats.registrations} />
      </div>

      {coachResidentOn && coachProfile?.active && (
        <V2Surface className="mt-8 border-acid/40 bg-acid/5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink text-acid">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-ink">{t('Também é professor')}</h2>
                <p className="mt-0.5 text-sm text-gray-600">
                  {t('{nome} atua como professor na plataforma. Veja o perfil profissional para conhecer horários, aulas e contato.', { nome: athlete.platform_name })}
                </p>
                {coachProfile.modalities?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {coachProfile.modalities.slice(0, 4).map((m) => <V2Badge key={m} tone="blue">{m}</V2Badge>)}
                  </div>
                )}
              </div>
            </div>
            <Link to={`/coaches/${uid}`} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-bold text-acid transition-colors hover:bg-ink/90">
              <GraduationCap className="h-4 w-4" /> {t('Ver perfil profissional')}
            </Link>
          </div>
        </V2Surface>
      )}

      {formats.length > 0 && (
        <V2Surface className="mt-8">
          <h2 className="mb-4 font-display text-lg font-bold text-ink">{t('Desempenho por formato')}</h2>
          <div className="space-y-2">
            {formats.map(([format, b]) => (
              <div key={format} className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-paper p-4">
                <span className="text-sm font-semibold text-ink">{MODALITY_FORMAT_LABELS[format] || format}</span>
                <span className="text-xs text-gray-500 tabular-nums">
                  {tn(b.played, '{n} jogo', '{n} jogos')} · {t('{v}V – {d}D', { v: b.wins, d: b.losses })} · <strong className="text-ink">{formatPercent(b.winRate)}</strong>
                </span>
              </div>
            ))}
          </div>
        </V2Surface>
      )}

      {ratingHistoryOn && ratingHistory.length >= 2 && (
        <div className="mt-8"><RatingSparkline points={ratingHistory} /></div>
      )}

      {/* Evolução do Nível 2.0–8.0 (estilo DUPR) — auto-oculto pela flag/dados. */}
      <V2DuprEvolution uid={uid} />

      {achievementsOn && !historicoFalhou && (
        <div className="mt-8"><AchievementsCard summary={{ ...stats, rating: rating?.rating }} /></div>
      )}

      {headToHeadOn && h2hData?.h2h?.length > 0 && (
        <div className="mt-8"><HeadToHeadCard records={h2hData.h2h} /></div>
      )}

      {/* A estante de troféus: pódios de torneio e de dia de jogo, com o cartão
          e o "Parabenizar" (um kudo, com XP para quem torce). */}
      <V2Surface className="mt-8">
        <h2 className="mb-4 inline-flex items-center gap-2 font-display text-lg font-bold text-ink"><Medal className="h-5 w-5" aria-hidden="true" /> {t('Troféus')}</h2>
        <TrophyShelf uid={uid} nome={athlete?.name || ''} compacto />
      </V2Surface>

      {gameDayGames.length > 0 && <RecentGameDayGames games={gameDayGames} />}

      {history.length > 0 && (
        <V2Surface className="mt-8">
          <h2 className="mb-4 font-display text-lg font-bold text-ink">{t('Torneios recentes')}</h2>
          <div className="space-y-2">
            {history.slice(0, 8).map((g) => (
              <Link
                key={g.tournamentId}
                to={`/torneios/${g.tournamentId}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-paper p-4 transition-colors hover:border-gray-200"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-ink">{g.tournament?.name || 'Torneio'}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
              </Link>
            ))}
          </div>
        </V2Surface>
      )}
    </div>
  );
}

function formatGameDate(ms) {
  if (!ms) return '';
  return fmtData(ms, { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/**
 * Os últimos jogos de dia de jogo publicados no ranking — os que o ranking
 * conta. Sem eles, quem só joga em dia de jogo tinha um perfil sem nenhum
 * jogo à vista.
 */
function RecentGameDayGames({ games }) {
  const lista = games.slice(0, 8);
  return (
    <V2Surface className="mt-8">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-ink">{t('Jogos recentes em dias de jogo')}</h2>
        <span className="text-xs text-gray-500">{tn(games.length, '{n} jogo no ranking', '{n} jogos no ranking')}</span>
      </div>
      <div className="space-y-2">
        {lista.map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-paper p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {g.partner ? `${t('com {nome}', { nome: g.partner })} ` : ''}<span className="font-normal text-gray-400">{t('vs')}</span> {g.opponent}
              </p>
              <p className="truncate text-xs text-gray-500">{[g.label, formatGameDate(g.at)].filter(Boolean).join(' · ')}</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold tabular-nums ${g.won ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {g.won ? 'V' : 'D'} {g.myScore}–{g.oppScore}
            </span>
          </div>
        ))}
      </div>
    </V2Surface>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <V2Surface className="p-5 text-center sm:p-5">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-paper text-ink"><Icon className="h-5 w-5" /></div>
      <p className="font-display text-2xl font-bold text-ink tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
    </V2Surface>
  );
}
