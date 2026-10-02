import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, BarChart3, CalendarClock, Info, ListChecks, Medal, Percent, Swords, Trophy } from 'lucide-react';
import { usePlayerStats } from '@/modules/performance/hooks/usePlayerStats';
import { MODALITY_FORMAT_LABELS } from '@/modules/tournament/domain/constants';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useRatingHistory } from '@/modules/rating/hooks/useRating';
import { usePlayerMatchDates } from '@/modules/progression/hooks/useProgression';
import { computeWeekStreak } from '@/modules/progression/domain/progression';
import ProgressionCard from '@/modules/progression/components/ProgressionCard';
import GoalsCard from '@/modules/progression/components/GoalsCard';
import RatingSparkline from '@/modules/rating/components/RatingSparkline';
import V2DuprEvolution from '@/v2/components/rating/V2DuprEvolution';
import AchievementsCard from '@/modules/achievements/components/AchievementsCard';
import MyGamesPanel from '@/v2/components/performance/MyGamesPanel';
import { useMyPlayerRating } from '@/modules/rating/hooks/useRating';
import { OUT_OF_RANKING_REASON } from '@/modules/games/domain/myGames';
import {
  V2ErrorState,
  V2PageIntro,
  V2Skeleton,
  V2StatCard,
  V2Surface,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

function formatPercent(rate) {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}

export default function V2Performance() {
  const athleteAgendaOn = true;
  const [tab, setTab] = useState('estatistica');

  return (
    <div className="mx-auto max-w-[1200px]">
      <V2PageIntro title="Meu desempenho" subtitle="Estatísticas, histórico e evolução dos seus jogos e torneios." />

      {athleteAgendaOn && (
        <div className="mb-6 inline-flex gap-1.5 rounded-full border border-gray-100 bg-paper-pure p-1.5">
          <button type="button" onClick={() => setTab('estatistica')}
            className={cn('inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
              tab === 'estatistica' ? 'bg-ink text-white' : 'text-gray-500 hover:text-ink')}>
            <BarChart3 className="h-4 w-4" /> Estatística
          </button>
          <button type="button" onClick={() => setTab('jogos')}
            className={cn('inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
              tab === 'jogos' ? 'bg-ink text-white' : 'text-gray-500 hover:text-ink')}>
            <CalendarClock className="h-4 w-4" /> Meus jogos
          </button>
        </div>
      )}

      {athleteAgendaOn && tab === 'jogos' ? <MyGamesPanel /> : <StatsPanel />}
    </div>
  );
}

function StatsPanel() {
  const { user } = useAuth();
  const achievementsOn = true;
  const ratingHistoryOn = true;
  const progressionOn = true;
  const {
    stats, coverage, isLoading, isError, refetch,
  } = usePlayerStats();
  const { data: ratingHistory = [] } = useRatingHistory(user?.uid, ratingHistoryOn);
  const { data: matchDates = [] } = usePlayerMatchDates(user?.uid, progressionOn);
  const currentRating = ratingHistory.length ? ratingHistory[ratingHistory.length - 1].rating : 0;
  const formats = Object.entries(stats?.byFormat || {});

  return (
    <>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <V2Skeleton key={i} className="h-40 rounded-4xl" />)}
        </div>
      ) : (
        <>
          {/* Falha não é zero (docs/27-FALHA-NAO-E-VAZIO.md): com uma das fontes
              faltando, o total seria parcial apresentado como total. */}
          {isError && (
            <V2ErrorState
              inline
              className="mb-4"
              title="Parte dos seus jogos não carregou"
              description="Os números ficam em branco até tudo chegar."
              onRetry={refetch}
            />
          )}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <V2StatCard icon={Trophy} accent="ink" label="Torneios" value={isError ? '—' : stats.tournaments} />
            <V2StatCard icon={ListChecks} accent="blue" label="Inscrições" value={isError ? '—' : stats.registrations} />
            <V2StatCard icon={Swords} accent="ink" label="Jogos" value={isError ? '—' : stats.played} />
            <V2StatCard icon={Percent} accent="acid" label="Aproveitamento" value={isError ? '—' : formatPercent(stats.winRate)} hint={isError ? undefined : `${stats.wins}V – ${stats.losses}D`} />
            <V2StatCard icon={Award} accent="green" label="Títulos" value={isError ? '—' : stats.titles} />
            <V2StatCard icon={Medal} accent="ink" label="Pódios" value={isError ? '—' : stats.podiums} />
          </div>

          {!isError && <RankingCoverageCard coverage={coverage} played={stats.played} />}

          {formats.length > 0 && (
            <V2Surface className="mt-8">
              <h2 className="mb-4 font-display text-lg font-bold text-ink">Desempenho por formato</h2>
              <div className="space-y-2">
                {formats.map(([format, b]) => (
                  <div key={format} className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-paper p-4">
                    <span className="text-sm font-semibold text-ink">{MODALITY_FORMAT_LABELS[format] || format}</span>
                    <span className="text-xs text-gray-500 tabular-nums">
                      {b.played} jogo(s) · {b.wins}V – {b.losses}D · <strong className="text-ink">{formatPercent(b.winRate)}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </V2Surface>
          )}

          {progressionOn && (
            <div className="mt-8"><ProgressionCard summary={stats} matchDates={matchDates} /></div>
          )}

          {ratingHistoryOn && ratingHistory.length >= 2 && (
            <div className="mt-8"><RatingSparkline points={ratingHistory} /></div>
          )}

          {/* Evolução do Nível 2.0–8.0 (estilo DUPR) — auto-oculto pela flag/dados. */}
          <V2DuprEvolution uid={user?.uid} />


          {achievementsOn && (
            <div className="mt-8"><AchievementsCard summary={{ ...stats, weekStreak: computeWeekStreak(matchDates) }} /></div>
          )}

          {progressionOn && (
            <div className="mt-8">
              <GoalsCard
                uid={user?.uid}
                values={{ games: stats.played, wins: stats.wins, tournaments: stats.tournaments, rating: currentRating }}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}

/**
 * POR QUE alguns dos meus jogos não estão no ranking. "Meu desempenho" conta
 * todos; o ranking, só os que dá para atribuir a gente com conta, em torneio
 * público ou dia de jogo publicado. Sem isto, "joguei 30 e o ranking mostra
 * 12" parecia defeito — e a pessoa não sabia o que pedir a quem organiza.
 */
function RankingCoverageCard({ coverage, played }) {
  const { data: rating } = useMyPlayerRating();
  if (!coverage || coverage.totalFora === 0) return null;
  const { torneio, diaDeJogo, dias } = coverage;
  const linhas = [
    [diaDeJogo.naoPublicado, 'de dias de jogo que quem organiza ainda não publicou no ranking.'],
    [diaDeJogo.convidado + torneio.semConta, 'com alguém sem conta na plataforma na partida (inscrito ou inserido só pelo nome) — a partida sai do ranking para todos.'],
    [torneio.torneioFora, 'de torneios em rascunho, privados ou cancelados — esses não contam para ninguém.'],
    [diaDeJogo.pendente, 'publicados, mas ainda não atualizados no ranking — quem organiza toca em “Atualizar publicação”.'],
  ].filter(([n]) => n > 0);
  const motivoDoDia = (m) => (m === OUT_OF_RANKING_REASON.NOT_PUBLISHED ? 'não publicado'
    : m === OUT_OF_RANKING_REASON.GUEST ? 'com convidado sem conta' : 'publicação desatualizada');

  return (
    <V2Surface className="mt-8 border-amber-200 bg-amber-50/40">
      <div className="flex items-start gap-3">
        <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-ink">
            {coverage.totalFora} de {played} jogo(s) seus não estão no ranking
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Aqui contam todos os seus jogos. O ranking e o rating só contam partidas em que todos têm
            conta, de torneios públicos e de dias de jogo publicados.
            {rating ? ` Hoje o ranking tem ${rating.games} jogo(s) seus.` : ''}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
            {linhas.map(([n, texto]) => (
              <li key={texto}><strong className="tabular-nums text-ink">{n}</strong> {texto}</li>
            ))}
          </ul>
          {dias.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {dias.map((d) => (
                <Link
                  key={d.id}
                  to={`/dia-de-jogo/${d.id}`}
                  className="rounded-full border border-gray-200 bg-paper-pure px-3 py-1.5 text-xs font-semibold text-ink hover:border-gray-300"
                >
                  {d.label} · {d.jogos} jogo(s) · {motivoDoDia(d.motivo)}
                </Link>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-gray-500">
            Quem organiza resolve: publicando o dia de jogo, ou ligando o convidado à conta dele
            (no dia de jogo, em “Resultados no ranking”; no torneio, no lápis da inscrição).
          </p>
        </div>
      </div>
    </V2Surface>
  );
}
