import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Search, TrendingUp } from 'lucide-react';
import { useNationalRanking } from '@/modules/rating/hooks/useRating';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  V2Avatar,
  V2EmptyState,
  V2PageIntro,
  V2SearchInput,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

function medalEmoji(position) {
  if (position === 1) return '🥇';
  if (position === 2) return '🥈';
  if (position === 3) return '🥉';
  return null;
}

/** Saldo de pontos com sinal (+12 / -5 / 0), ou "—" quando ausente. */
function formatBalance(balance) {
  if (balance == null || Number.isNaN(Number(balance))) return '—';
  const n = Number(balance);
  return n > 0 ? `+${n}` : String(n);
}

/** Bloco compacto de estatística usado na linha do ranking. */
function Stat({ label, value }) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="font-semibold text-ink tabular-nums">{value}</p>
    </div>
  );
}

/** Explicação, em linguagem natural, de como o ranking é formado. */
function RankingExplainer() {
  return (
    <V2Surface className="mb-8">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
          <span className="font-semibold text-ink">Como funciona o ranking?</span>
          <span className="text-xs text-gray-400 group-open:hidden">ver explicação</span>
          <span className="hidden text-xs text-gray-400 group-open:inline">ocultar</span>
        </summary>
        <div className="mt-3 space-y-3 text-sm leading-6 text-gray-600">
          <p>
            O ranking é um <strong>rating de habilidade calculado pela própria plataforma</strong> (estilo
            Elo), a partir dos <strong>jogos já finalizados</strong>. A cada atualização, todos os jogos são
            reprocessados do zero, em ordem cronológica — então o resultado é sempre consistente.
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Cada atleta começa com uma pontuação derivada do seu <strong>nível declarado</strong> (nível mais alto começa mais alto; sem nível, começa no meio).</li>
            <li>A cada jogo, quem <strong>vence ganha pontos</strong> e quem perde cede pontos. O ajuste depende da <strong>força do adversário</strong>: vencer alguém mais forte vale mais; perder para alguém mais fraco custa mais.</li>
            <li>Nos <strong>primeiros jogos</strong> a pontuação se move mais rápido e depois estabiliza.</li>
            <li>Em <strong>duplas</strong>, a dupla é avaliada pela média e cada jogador recebe o próprio ajuste.</li>
            <li>Só entram jogos entre atletas <strong>com conta na plataforma</strong>.</li>
            <li>O ranking oficial considera apenas <strong>torneios públicos e já encerrados</strong>; torneios apagados saem automaticamente. A atualização é <strong>automática</strong> conforme os torneios são encerrados.</li>
          </ul>
          <p className="text-xs text-gray-500">
            <strong>Colunas:</strong> Torneios (disputados), Jogos, V–D (vitórias–derrotas), Saldo (pontos
            marcados − sofridos) e Rating (ordena o ranking).
          </p>
          <p className="text-xs text-gray-500">
            É um rating <strong>próprio da plataforma</strong>, para leitura interna — não é um rating oficial
            de federação (como DUPR ou UTPR).
          </p>
        </div>
      </details>
    </V2Surface>
  );
}

export default function V2Ranking() {
  const { data: players = [], isLoading } = useNationalRanking();
  const profilePageOn = useFeatureFlag(FEATURE_FLAG.ATHLETE_PROFILE_PAGE);
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return players;
    return players.filter((p) => [p.platform_name, p.city, p.state, p.level]
      .filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [players, search]);

  return (
    <div className="mx-auto max-w-[1100px]">
      <V2PageIntro title="Ranking nacional" subtitle="Rating calculado a partir dos jogos disputados nos torneios da plataforma." />

      <RankingExplainer />

      <V2Surface className="mb-8">
        <V2SearchInput
          icon={Search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, cidade, estado ou nível"
        />
      </V2Surface>

      {isLoading ? (
        <V2Skeleton className="h-96 rounded-4xl" />
      ) : filtered.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={TrendingUp}
            title={players.length === 0 ? 'O ranking ainda não foi calculado' : 'Nenhum atleta para o filtro'}
            description={players.length === 0
              ? 'Assim que houver jogos finalizados e o recálculo for feito, os atletas aparecerão aqui.'
              : 'Ajuste a busca para ampliar a leitura do ranking.'}
          />
        </V2Surface>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const isMe = p.id === user?.uid || p.uid === user?.uid;
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
                  <p className="truncate font-bold text-ink">{p.platform_name}{isMe && <span className="ml-2 text-xs font-bold text-ink-lighter">(você)</span>}</p>
                  <p className="text-xs text-gray-500">{[p.city, p.state].filter(Boolean).join(' / ') || 'Local não informado'}</p>
                </div>
                <div className="hidden items-center gap-4 sm:flex">
                  <Stat label="Torneios" value={p.tournaments ?? '—'} />
                  <Stat label="Jogos" value={p.games ?? '—'} />
                  <Stat label="V–D" value={`${p.wins ?? 0}–${p.losses ?? 0}`} />
                  <Stat label="Saldo" value={formatBalance(p.points_balance)} />
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-gray-400">Rating</p>
                  <p className="font-display text-xl font-bold text-ink tabular-nums">{p.rating}</p>
                </div>
              </div>
            );
            return profilePageOn ? (
              <Link key={p.id} to={`/atleta/${p.id}`} className="block">{row}</Link>
            ) : (
              <div key={p.id}>{row}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
