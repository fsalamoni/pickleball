import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Search, TrendingUp } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useDuprRanking } from '@/modules/rating/hooks/useDuprRating';
import {
  V2Avatar,
  V2Badge,
  V2EmptyState,
  V2ErrorState,
  V2PageIntro,
  V2SearchInput,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';

const FORMATS = [
  { id: 'doubles', get label() { return t('Duplas'); } },
  { id: 'singles', get label() { return t('Simples'); } },
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

/** Explicador no MESMO padrão do ranking nacional (V2Surface + <details>). */
function DuprExplainer() {
  return (
    <V2Surface className="mb-8">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
          <span className="font-semibold text-ink">{t('Como funciona este ranking?')}</span>
          <span className="text-xs text-gray-500 group-open:hidden">{t('ver explicação')}</span>
          <span className="hidden text-xs text-gray-500 group-open:inline">{t('ocultar')}</span>
        </summary>
        <div className="mt-3 space-y-3 text-sm leading-6 text-gray-600">
          <p>
            {t('É um ranking próprio da plataforma, na mesma escala do DUPR (2.000 a 8.000) e desenhado para se comportar como ele.')}
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>{t('Baseado no placar')}</strong>{': '}{t('não só em vitória/derrota: uma derrota apertada contra um adversário mais forte pode subir o rating; uma vitória magra sobre iguais quase não mexe.')}</li>
            <li><strong>{t('Confiabilidade')}</strong>{': '}{t('cresce com os jogos — ratings maduros se movem pouco; novatos convergem rápido (por isso a marca provisório no começo).')}</li>
            <li><strong>{t('Simples e duplas')}</strong> {t('têm ratings separados (como no DUPR).')}</li>
            <li>{t('A semente inicial vem do rating DUPR informado no perfil (quando houver) ou do seu nível de nivelamento; W.O. não conta.')}</li>
            <li>{t('Conta os jogos finalizados de torneios públicos e dias de jogo publicados da plataforma, em que todos os atletas têm conta — partida com alguém inscrito só pelo nome fica de fora para todos.')}</li>
          </ul>
          <p className="text-xs text-gray-500">
            {t('⚠️ Não é o rating oficial do DUPR (o algoritmo do DUPR é proprietário) — é uma aproximação independente, na mesma escala.')}
          </p>
        </div>
      </details>
    </V2Surface>
  );
}

export default function V2DuprRankingView() {
  const { user } = useAuth();
  const { data: rows = [], isLoading, isError, refetch } = useDuprRanking();
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
        reliability: r[`${format}_reliability`],
        provisional: r[`${format}_provisional`],
      }))
      .filter((r) => (r.games || 0) > 0)
      .filter((r) => !term || [r.platform_name, r.city, r.state].filter(Boolean).join(' ').toLowerCase().includes(term))
      .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.games || 0) - (a.games || 0))
      .map((r, i) => ({ ...r, position: i + 1 }));
  }, [rows, format, search]);

  return (
    <div>
      <V2PageIntro
        title={t('Nível de habilidade · escala 2.0–8.0')}
        subtitle={t('Ranking próprio no formato DUPR, calculado pelos jogos da plataforma. Não é o rating oficial do DUPR.')}
        /* Não há "Recalcular": o servidor refaz os três rankings a cada
           resultado que entra, muda ou sai. Ver `RankingAutomatico`. */
      />

      <DuprExplainer />

      <V2Surface className="mb-8 space-y-4">
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
              {t(f.label)}
            </button>
          ))}
        </div>
        <V2SearchInput
          icon={Search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('Buscar por nome, cidade ou estado')}
        />
      </V2Surface>

      {isLoading ? (
        <V2Skeleton className="h-96 rounded-4xl" />
      ) : isError ? (
        // Falha não é "ranking ainda não calculado" (docs/27-FALHA-NAO-E-VAZIO.md).
        <V2Surface>
          <V2ErrorState
            title={t('Não foi possível carregar o ranking')}
            description={t('O rating continua calculado — só não conseguimos buscá-lo agora.')}
            onRetry={() => refetch()}
          />
        </V2Surface>
      ) : ranked.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={TrendingUp}
            title={rows.length === 0 ? t('O ranking ainda não foi calculado') : t('Nenhum atleta neste formato')}
            description={rows.length === 0
              ? t('Assim que houver jogos finalizados e o recálculo for feito, os atletas aparecerão aqui.')
              : t('Troque entre Simples e Duplas ou ajuste a busca.')}
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
                    {isMe && <span className="ml-2 text-xs font-bold text-ink-lighter">{t('(você)')}</span>}
                    {p.provisional && <V2Badge tone="neutral" className="ml-2 align-middle">{t('provisório')}</V2Badge>}
                  </p>
                  <p className="text-xs text-gray-500">{[p.city, p.state].filter(Boolean).join(' / ') || t('Local não informado')}</p>
                </div>
                <div className="hidden items-center gap-4 sm:flex">
                  <Stat label={t('Jogos')} value={p.games ?? '—'} />
                  <Stat label={t('V–D')} value={`${p.wins ?? 0}–${p.losses ?? 0}`} />
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-gray-500">{format === 'doubles' ? t('Duplas') : t('Simples')}</p>
                  <p className="font-display text-xl font-bold text-ink tabular-nums">{fmt(p.rating)}</p>
                  {Number.isFinite(p.reliability) && (
                    <p className="text-2xs text-gray-500" title={t('Confiabilidade — cresce com o número de jogos')}>
                      {t('conf. {n}%', { n: p.reliability })}
                    </p>
                  )}
                </div>
              </div>
            );
            return (
              <Link key={p.uid} to={`/atleta/${p.uid}`} className="block">{row}</Link>
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
      <p className="text-2xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="font-semibold text-ink tabular-nums">{value}</p>
    </div>
  );
}
