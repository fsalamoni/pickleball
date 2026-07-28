/**
 * ClubRankingBackfillPanel — Painel Admin para o ranking interno dos clubes (Wave C.5).
 *
 * Mostra:
 *  1. Resumo: total de clubes, quantos com materializado, quantos vazios.
 *  2. Botão "Recalcular rankings de TODOS os clubes" (platform admin) — backfill
 *     total via callable `recomputeAllClubInternalRankings`.
 *  3. Lista de clubes com materializado vazio, com botão "Recalcular" por clube
 *     (recálculo granular via `recomputeOneClubInternalRanking`).
 *
 * Visibilidade: o painel só aparece se a flag `CLUB_INTERNAL_BACKFILL` estiver
 * ON. O usuário já precisa ser `isPlatformAdmin` para acessar o Painel.
 *
 * O painel é reutilizável: usado em `V2AdminConsole` (Visão geral) e em
 * `V2AdminMetrics` (página dedicada de Métricas).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { collection, getCountFromServer, getDocs, query, where } from 'firebase/firestore';
import { db, firebaseDisabledReason, firebaseServicesEnabled } from '@/core/config/firebase';
import { V2Button, V2Surface } from '@/v2/ui/primitives';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  useRecomputeAllClubRankings,
  useRecomputeOneClubRanking,
} from '@/modules/clubs/hooks/useClubRankingAdmin';

const COL_CLUBS = 'clubs';
const COL_RANKINGS = 'club_internal_ratings';

export default function ClubRankingBackfillPanel() {
  const backfillOn = useFeatureFlag(FEATURE_FLAG.CLUB_INTERNAL_BACKFILL);
  const rankingOn = useFeatureFlag(FEATURE_FLAG.CLUB_INTERNAL_RANKING);
  const [stats, setStats] = useState({ clubs: 0, materialized: 0, total: 0, loading: true, error: null });
  const [emptyClubs, setEmptyClubs] = useState([]);
  const [loadingEmpty, setLoadingEmpty] = useState(true);

  const all = useRecomputeAllClubRankings();
  const one = useRecomputeOneClubRanking();

  // Carrega contagens e a lista de clubes com materializado vazio.
  async function load() {
    if (!firebaseServicesEnabled || !db) {
      setStats((s) => ({ ...s, loading: false, error: 'Firebase indisponível' }));
      setLoadingEmpty(false);
      return;
    }
    try {
      const [clubsSnap, materializedSnap, rankingsDocs] = await Promise.all([
        getCountFromServer(collection(db, COL_CLUBS)),
        getCountFromServer(collection(db, COL_RANKINGS)),
        getDocs(query(collection(db, COL_RANKINGS))),
      ]);
      const clubsCount = clubsSnap.data().count;
      const matCount = materializedSnap.data().count;
      // clubes distintos com pelo menos 1 doc materializado
      const clubIdsWithMat = new Set(rankingsDocs.docs.map((d) => d.data().club_id).filter(Boolean));
      // Lista todos os clubes para detectar os vazios
      const allClubsSnap = await getDocs(query(collection(db, COL_CLUBS)));
      const empties = allClubsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => !clubIdsWithMat.has(c.id));
      setStats({
        clubs: clubsCount,
        materialized: clubIdsWithMat.size,
        total: matCount,
        loading: false,
        error: null,
      });
      setEmptyClubs(empties);
      setLoadingEmpty(false);
    } catch (e) {
      setStats((s) => ({ ...s, loading: false, error: e.message || String(e) }));
      setLoadingEmpty(false);
    }
  }

  useEffect(() => {
    if (!backfillOn || !rankingOn) return undefined;
    load();
  }, [backfillOn, rankingOn]);

  async function handleRecomputeAll() {
    if (!window.confirm(
      'Recalcular o ranking interno de TODOS os clubes?\n\n'
      + 'Itera sobre todos os clubes, recalcula o materializado a partir dos '
      + 'placares existentes, e pode levar 1-3 minutos para plataformas grandes.',
    )) return;
    try {
      const result = await all.mutateAsync();
      const okMsg = `Backfill concluído: ${result.processed}/${result.total} clube(s) OK`
        + (result.failed ? `, ${result.failed} falha(s)` : '');
      if (result.failed > 0) {
        toast.warning(okMsg);
        if (Array.isArray(result.errors) && result.errors.length > 0) {
          console.error('Backfill com falhas:', result.errors);
        }
      } else {
        toast.success(okMsg);
      }
      await load();
    } catch (err) {
      const detail = err?.details || err?.message || 'Falha no backfill';
      toast.error(`Falha: ${detail}`);
    }
  }

  async function handleRecomputeOne(club) {
    try {
      await one.mutateAsync(club.id);
      toast.success(`Ranking de ${club.name || club.id} recalculado.`);
      await load();
    } catch (err) {
      toast.error(err?.message || `Falha ao recalcular ${club.name || club.id}`);
    }
  }

  const isPending = all.isPending || one.isPending;

  // A flag é a chave — sem flag, sem painel.
  if (!backfillOn || !rankingOn) return null;
  if (!firebaseServicesEnabled) {
    return (
      <V2Surface className="border-amber-200 bg-amber-50">
        <p className="text-sm text-amber-800">
          Backfill do ranking indisponível — Firebase não configurado
          {firebaseDisabledReason ? ` (${firebaseDisabledReason})` : ''}.
        </p>
      </V2Surface>
    );
  }

  return (
    <V2Surface>
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">
          Ranking interno dos clubes
        </h2>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Materializado no Firestore pelas Cloud Functions (Wave C.3). Use os botões abaixo
        se um clube estiver com o materializado vazio/defasado — por exemplo, logo após
        um deploy da Wave C.3 ou se um clube não atualizou há muito tempo.
      </p>

      {/* Resumo */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <SummaryCard
          loading={stats.loading}
          label="Clubes"
          value={stats.clubs}
          accent="ink"
        />
        <SummaryCard
          loading={stats.loading}
          label="Materializados"
          value={stats.materialized}
          accent="green"
        />
        <SummaryCard
          loading={stats.loading}
          label="Vazios"
          value={emptyClubs.length}
          accent={emptyClubs.length > 0 ? 'amber' : 'green'}
        />
      </div>

      {/* Ação global */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <V2Button
          onClick={handleRecomputeAll}
          disabled={isPending || stats.clubs === 0}
          variant="primary"
        >
          {all.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {all.isPending ? 'Recalculando…' : 'Recalcular rankings de TODOS os clubes'}
        </V2Button>
        {all.data && (
          <span className="text-xs text-gray-500">
            Último: {all.data.processed}/{all.data.total} OK
            {all.data.failed > 0 ? `, ${all.data.failed} falha(s)` : ''}.
          </span>
        )}
      </div>

      {/* Lista de clubes vazios (granular) */}
      <div className="mt-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Clubes com materializado vazio ({emptyClubs.length})
        </h3>
        {loadingEmpty ? (
          <p className="mt-2 text-xs text-gray-500">Carregando…</p>
        ) : emptyClubs.length === 0 ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Nenhum clube vazio. Materializado em dia.
          </p>
        ) : (
          <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-gray-100">
            <ul className="divide-y divide-gray-100">
              {emptyClubs.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 bg-paper px-4 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">
                      {c.name || c.id}
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {c.city || c.state || '—'} · {c.id}
                    </div>
                  </div>
                  <V2Button
                    size="sm"
                    onClick={() => handleRecomputeOne(c)}
                    disabled={isPending}
                  >
                    {one.isPending && one.variables === c.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Recalcular
                  </V2Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {stats.error && (
        <p className="mt-3 text-xs text-red-600">Erro: {stats.error}</p>
      )}
    </V2Surface>
  );
}

function SummaryCard({ label, value, accent, loading }) {
  const accentClass = {
    ink: 'text-ink',
    green: 'text-green-700',
    amber: 'text-amber-600',
  }[accent] || 'text-ink';
  return (
    <div className="rounded-2xl border border-gray-100 bg-paper p-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 font-display text-2xl font-bold ${accentClass}`}>
        {loading ? '…' : value}
      </div>
    </div>
  );
}
