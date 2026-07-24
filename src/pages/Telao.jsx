/**
 * Telao — Modo Telão/TV do torneio (flag tournament_tv_mode).
 *
 * Página pública em tela cheia (fundo escuro, tipografia grande) para exibir num
 * telão durante o evento: jogos em andamento, próximos chamados e resultados
 * recentes. Atualiza sozinha (refetch periódico). Rota /torneios/:id/telao.
 */

import React, { useMemo } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Radio, Clock, CheckCircle2, MapPin } from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { getTournament } from '@/modules/tournament/services/tournamentService';
import { listModalities } from '@/modules/tournament/services/modalityService';
import { listAllMatchesForModality } from '@/modules/tournament/services/matchService';
import { listRegistrations } from '@/modules/tournament/services/registrationService';
import { categorizeBoardMatches } from '@/modules/tournament/domain/tournamentBoard';

function regLabel(reg) {
  if (!reg) return '';
  return reg.label || `${reg.player_a_name || ''}${reg.player_b_name ? ' / ' + reg.player_b_name : ''}`.trim();
}

function sideLabel(ids, labelById) {
  return (ids || []).map((id) => labelById.get(id) || '—').join(' / ') || 'A definir';
}

async function loadBoard(tournamentId) {
  const [tournament, modalities] = await Promise.all([
    getTournament(tournamentId),
    listModalities(tournamentId),
  ]);
  const perModality = await Promise.all(
    (modalities || []).map(async (m) => {
      const [matches, regs] = await Promise.all([
        listAllMatchesForModality(m.id),
        listRegistrations(m.id),
      ]);
      const labelById = new Map((regs || []).map((r) => [r.id, regLabel(r)]));
      return (matches || []).map((mt) => ({
        ...mt,
        modality_name: m.name,
        side_a_label: sideLabel(mt.side_a_ids, labelById),
        side_b_label: sideLabel(mt.side_b_ids, labelById),
      }));
    }),
  );
  return { tournament, matches: perModality.flat() };
}

function scoreText(m) {
  const games = Array.isArray(m.games) ? m.games : [];
  const a = games.reduce((s, g) => s + (Number(g.a) || 0), 0);
  const b = games.reduce((s, g) => s + (Number(g.b) || 0), 0);
  return `${a} × ${b}`;
}

function timeText(value) {
  if (!value) return '';
  const d = typeof value === 'object' && value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function Telao() {
  const { tournamentId } = useParams();
  const tvOn = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_TV_MODE);

  const { data, isLoading } = useQuery({
    queryKey: ['telao', tournamentId],
    queryFn: () => loadBoard(tournamentId),
    enabled: tvOn && !!tournamentId,
    refetchInterval: 20_000,
  });

  const board = useMemo(() => categorizeBoardMatches(data?.matches || []), [data]);

  if (!tvOn) return <Navigate to={`/p/${tournamentId}`} replace />;

  return (
    <div className="min-h-screen bg-ink text-white">
      <div className="mx-auto max-w-[1600px] px-8 py-6">
        <header className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h1 className="font-display text-4xl font-bold text-acid">{data?.tournament?.name || 'Torneio'}</h1>
            <p className="mt-1 text-lg text-gray-300">Acompanhe os jogos ao vivo</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Radio className="h-5 w-5 animate-pulse text-acid" /> Atualiza automaticamente
          </div>
        </header>

        {isLoading ? (
          <p className="py-20 text-center text-2xl text-gray-400">Carregando…</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Em andamento */}
            <section className="lg:col-span-2">
              <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-acid">
                <Radio className="h-5 w-5" /> Em andamento ({board.inProgress.length})
              </h2>
              {board.inProgress.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-lg text-gray-400">Nenhum jogo em andamento.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {board.inProgress.map((m) => (
                    <div key={m.id} className="rounded-3xl border border-acid/30 bg-white/5 p-5">
                      <div className="mb-2 flex items-center justify-between text-sm text-gray-400">
                        <span>{m.modality_name}</span>
                        {m.court && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> Quadra {m.court}</span>}
                      </div>
                      <div className="space-y-1 text-2xl font-bold">
                        <div className="truncate">{m.side_a_label}</div>
                        <div className="truncate text-gray-300">{m.side_b_label}</div>
                      </div>
                      <div className="mt-2 font-display text-3xl font-bold text-acid">{scoreText(m)}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Próximos + Recentes */}
            <aside className="space-y-6">
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-white">
                  <Clock className="h-5 w-5" /> Próximos
                </h2>
                <div className="space-y-2">
                  {board.upcoming.length === 0 ? (
                    <p className="text-gray-500">Sem próximos jogos.</p>
                  ) : board.upcoming.map((m) => (
                    <div key={m.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{m.modality_name}</span>
                        <span>{m.court ? `Quadra ${m.court}` : ''} {timeText(m.scheduled_at)}</span>
                      </div>
                      <div className="mt-1 truncate text-lg font-semibold">{m.side_a_label}</div>
                      <div className="truncate text-lg text-gray-300">{m.side_b_label}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-white">
                  <CheckCircle2 className="h-5 w-5" /> Resultados recentes
                </h2>
                <div className="space-y-2">
                  {board.recent.length === 0 ? (
                    <p className="text-gray-500">Sem resultados ainda.</p>
                  ) : board.recent.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">{m.side_a_label}</div>
                        <div className="truncate text-base text-gray-300">{m.side_b_label}</div>
                      </div>
                      <div className="ml-3 shrink-0 font-display text-xl font-bold text-acid">
                        {m.status === 'walkover' ? 'WO' : scoreText(m)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
