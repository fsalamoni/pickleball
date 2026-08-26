import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Info, RefreshCw, Search, Sparkles, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useDuprRanking, useRecomputeDuprRatings } from '@/modules/rating/hooks/useDuprRating';
import {
  V2Avatar,
  V2Button,
  V2Badge,
  V2EmptyState,
  V2SearchInput,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

const FORMATS = [
  { id: 'doubles', label: 'Duplas' },
  { id: 'singles', label: 'Simples' },
];

function medalEmoji(position) {
  if (position === 1) return '🥇';
  if (position === 2) return '🥈';
  if (position === 3) return '🥉';
  return null;
}

/** Formata o rating no padrão x.xxx (2.000–8.000). */
function fmt(rating) {
  const n = Number(rating);
  return Number.isFinite(n) ? n.toFixed(3) : '—';
}

function DuprExplainer() {
  return (
    <V2Surface className="mb-6 border-acid/30 bg-acid/5">
      <details>
        <summary className="flex cursor-pointer items-center gap-2 font-semibold text-ink">
          <Info className="h-4 w-4 text-ink" /> Como funciona este ranking (escala 2.0–8.0)
        </summary>
        <div className="mt-3 space-y-2 text-sm leading-6 text-gray-600">
          <p>
            É um <strong>ranking próprio da plataforma</strong>, na <strong>mesma escala do DUPR
            (2.000 a 8.000)</strong> e com comportamento semelhante: sobe ao vencer, desce ao
            perder, e converge mais rápido nos primeiros jogos.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong>Simples e duplas</strong> têm ratings separados (como no DUPR).</li>
            <li>A <strong>semente inicial</strong> vem do rating DUPR informado no perfil (quando houver) ou do seu nível de nivelamento.</li>
            <li>Conta os jogos finalizados de <strong>torneios e dias de jogo</strong> da plataforma.</li>
          </ul>
          <p className="text-xs text-gray-500">
            ⚠️ Este <strong>não é o rating oficial do DUPR</strong> (o algoritmo do DUPR é
            proprietário). É uma aproximação independente, para leitura interna, na mesma escala.
          </p>
        </div>
      </details>
    </V2Surface>
  );
}

export default function V2DuprRankingView() {
  const { user, isPlatformAdmin } = useAuth();
  const profilePageOn = useFeatureFlag(FEATURE_FLAG.ATHLETE_PROFILE_PAGE);
  const { data: rows = [], isLoading } = useDuprRanking();
  const recompute = useRecomputeDuprRatings();
  const [format, setFormat] = useState('doubles');
  const [search, setSearch] = useState('');

  const ranked = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (rows || [])
      .map((r) => ({
        ...r,
        rating: r[`${format}_rating`],
        games: r[`${format}_games`],
        wins: r[`${format}_wins`],
        losses: r[`${format}_losses`],
        provisional: r[`${format}_provisional`],
      }))
      .filter((r) => (r.games || 0) > 0)
      .filter((r) => !term || [r.platform_name, r.city, r.state].filter(Boolean).join(' ').toLowerCase().includes(term))
      .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.games || 0) - (a.games || 0))
      .map((r, i) => ({ ...r, position: i + 1 }));
  }, [rows, format, search]);

  async function handleRecompute() {
    try {
      const res = await recompute.mutateAsync();
      toast.success(`Ranking recalculado (${res.players} atleta(s)).`);
    } catch (err) {
      toast.error(err?.message || 'Falha ao recalcular o ranking.');
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink">
            <Sparkles className="h-5 w-5 text-acid" /> Nível de habilidade (escala 2.0–8.0)
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Ranking próprio no formato DUPR, calculado pelos jogos da plataforma. Não é o rating oficial do DUPR.
          </p>
        </div>
        {isPlatformAdmin && (
          <V2Button variant="secondary" size="sm" onClick={handleRecompute} disabled={recompute.isPending}>
            <RefreshCw className={cn('h-4 w-4', recompute.isPending && 'animate-spin')} />
            {recompute.isPending ? 'Recalculando…' : 'Recalcular'}
          </V2Button>
        )}
      </div>

      <DuprExplainer />

      <V2Surface className="mb-6 space-y-4">
        <div className="inline-flex rounded-full border border-gray-100 bg-paper-pure p-1">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={cn(
                'rounded-full px-5 py-2 text-sm font-bold transition-colors',
                format === f.id ? 'bg-ink text-white shadow-sm' : 'text-gray-500 hover:text-ink',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <V2SearchInput
          icon={Search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, cidade ou estado"
        />
      </V2Surface>

      {isLoading ? (
        <V2Skeleton className="h-96 rounded-4xl" />
      ) : ranked.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={TrendingUp}
            title={rows.length === 0 ? 'O ranking ainda não foi calculado' : 'Nenhum atleta neste formato'}
            description={rows.length === 0
              ? 'Assim que houver jogos finalizados e o recálculo for feito, os atletas aparecerão aqui.'
              : 'Troque entre Simples e Duplas ou ajuste a busca.'}
          />
        </V2Surface>
      ) : (
        <div className="space-y-3">
          {ranked.map((p) => {
            const isMe = p.uid === user?.uid || p.id === user?.uid;
            const medal = medalEmoji(p.position);
            const row = (
              <div
                className={cn(
                  'flex items-center gap-4 rounded-3xl border p-4 shadow-organic-sm transition-all',
                  isMe ? 'border-acid/40 bg-acid/10' : 'border-gray-100 bg-paper-pure hover:shadow-organic',
                )}
              >
                <div className={cn('w-8 text-center font-display text-xl font-black', p.position <= 3 ? 'text-ink' : 'text-gray-400')}>
                  {medal || p.position}
                </div>
                <div className="relative">
                  <V2Avatar name={p.platform_name} photoUrl={p.photo_url} size="md" />
                  {p.position === 1 && (
                    <div className="absolute -right-1 -top-1 rounded-full bg-white text-xs text-yellow-500"><Crown className="h-3.5 w-3.5" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">
                    {p.platform_name}
                    {isMe && <span className="ml-2 text-xs font-bold text-ink-lighter">(você)</span>}
                    {p.provisional && <V2Badge tone="neutral" className="ml-2 align-middle">provisório</V2Badge>}
                  </p>
                  <p className="text-xs text-gray-500">{[p.city, p.state].filter(Boolean).join(' / ') || 'Local não informado'}</p>
                </div>
                <div className="hidden items-center gap-4 sm:flex">
                  <Stat label="Jogos" value={p.games ?? '—'} />
                  <Stat label="V–D" value={`${p.wins ?? 0}–${p.losses ?? 0}`} />
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-gray-400">{format === 'doubles' ? 'Duplas' : 'Simples'}</p>
                  <p className="font-display text-xl font-bold text-ink tabular-nums">{fmt(p.rating)}</p>
                </div>
              </div>
            );
            return profilePageOn ? (
              <Link key={p.uid} to={`/atleta/${p.uid}`} className="block">{row}</Link>
            ) : (
              <div key={p.uid}>{row}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="font-semibold text-ink tabular-nums">{value}</p>
    </div>
  );
}
