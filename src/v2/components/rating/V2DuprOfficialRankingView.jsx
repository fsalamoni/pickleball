import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Search, TrendingUp } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useVerifiedDuprProfiles } from '@/modules/rating/hooks/useDuprMode';
import { buildOfficialDuprRanking } from '@/modules/rating/domain/duprOfficialRanking';
import {
  V2Avatar, V2EmptyState, V2ErrorState, V2PageIntro, V2SearchInput, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';

const FORMATS = [
  { id: 'doubles', get label() { return t('Duplas'); } },
  { id: 'singles', get label() { return t('Simples'); } },
];

const fmt = (n) => (Number.isFinite(Number(n)) ? Number(n).toFixed(3) : '—');

/**
 * Ranking com o rating OFICIAL do DUPR, de quem conectou a conta pelo login do
 * DUPR. Aparece no lugar do rating próprio quando a integração vale para a
 * pessoa (`useDuprMode`). O número vem do DUPR; a plataforma só ordena.
 */
export default function V2DuprOfficialRankingView() {
  const { user } = useAuth();
  const { data: profiles, isLoading, isError, refetch } = useVerifiedDuprProfiles();
  const [format, setFormat] = useState('doubles');
  const [search, setSearch] = useState('');

  const ranked = useMemo(() => {
    const term = search.trim().toLowerCase();
    return buildOfficialDuprRanking(profiles, format)
      .filter((r) => !term || [r.name, r.city, r.state].join(' ').toLowerCase().includes(term));
  }, [profiles, format, search]);

  return (
    <div>
      <V2PageIntro
        title={t('Ranking DUPR')}
        subtitle={t('O rating oficial do DUPR de quem conectou a conta. Ele muda quando o DUPR recalcula, a partir das partidas enviadas a ele.')}
      />

      <V2Surface className="mb-8 space-y-4">
        <div className="inline-flex rounded-full border border-gray-100 bg-paper-pure p-1">
          {FORMATS.map((f) => (
            <button type="button"
              key={f.id}
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
          placeholder={t('Buscar por nome, cidade ou estado')}
        />
        <p className="text-xs text-gray-500">
          {t('Só entra quem conectou a conta em Perfil → Editar perfil → DUPR. O rating digitado à mão não conta.')}
        </p>
      </V2Surface>

      {isLoading ? (
        <V2Skeleton className="h-96 rounded-4xl" />
      ) : isError ? (
        <V2Surface>
          <V2ErrorState
            title={t('Não foi possível carregar o ranking')}
            description={t('Os ratings continuam no DUPR — só não conseguimos buscá-los agora.')}
            onRetry={() => refetch()}
          />
        </V2Surface>
      ) : ranked.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={TrendingUp}
            title={search ? t('Ninguém com esse nome ou local') : t('Ainda não há contas DUPR conectadas neste formato')}
            description={search
              ? t('Ajuste a busca ou troque entre Simples e Duplas.')
              : t('Conecte a sua conta DUPR no seu perfil para aparecer aqui.')}
          />
        </V2Surface>
      ) : (
        <div className="space-y-3">
          {ranked.map((p) => {
            const isMe = p.uid === user?.uid;
            return (
              <Link key={p.uid} to={`/atleta/${p.uid}`} className="block">
                <div
                  className={cn(
                    'flex items-center gap-4 rounded-3xl border p-4 shadow-organic-sm transition-all',
                    isMe ? 'border-acid/40 bg-acid/10' : 'border-gray-100 bg-paper-pure hover:shadow-organic',
                  )}
                >
                  <div className={cn('w-8 text-center font-display text-xl font-black', p.position <= 3 ? 'text-ink' : 'text-gray-500')}>
                    {p.position}
                  </div>
                  <V2Avatar name={p.name} photoUrl={p.photo_url} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">
                      {p.name}
                      {isMe && <span className="ml-2 text-xs font-bold text-ink-lighter">{t('(você)')}</span>}
                    </p>
                    <p className="text-xs text-gray-500">{[p.city, p.state].filter(Boolean).join(' / ') || t('Local não informado')}</p>
                  </div>
                  <div className="text-right">
                    <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-gray-500">
                      <BadgeCheck className="h-3.5 w-3.5 text-acid" aria-hidden="true" />
                      {format === 'doubles' ? t('Duplas') : t('Simples')}
                    </p>
                    <p className="font-display text-xl font-bold text-ink tabular-nums">{fmt(p.rating)}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
