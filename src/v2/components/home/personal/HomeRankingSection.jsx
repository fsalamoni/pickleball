/**
 * "Ranking e duplas" na tela inicial — onde a pessoa está, sem abrir a tabela.
 *
 * Três leituras PEQUENAS, todas da própria pessoa: o documento do rating
 * nacional (já com a posição gravada pelo servidor), o documento do nível
 * 2.0–8.0 e as parcerias dela no ranking de duplas (`array-contains`). A
 * tabela inteira só é lida quando ela abre o ranking.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Handshake, Medal, Sparkles } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyDoublesRankings, useMyPlayerRating } from '@/modules/rating/hooks/useRating';
import { useDuprRatingForUid } from '@/modules/rating/hooks/useDuprRating';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { HomeSection } from './HomeSection';

function fmt(n, casas = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) : '—';
}

function Tile({ to, icon: Icon, label, value, detail, carregando, falhou, onRetry }) {
  if (carregando) return <V2Skeleton className="h-28 rounded-3xl" />;
  if (falhou) return <V2ErrorState inline title={`Não carregou: ${label.toLowerCase()}`} description="" onRetry={onRetry} />;
  return (
    <Link
      to={to}
      className="group flex min-w-0 flex-col justify-between rounded-3xl border border-gray-100 bg-paper p-4 transition-all hover:border-gray-300 hover:bg-paper-pure focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
    >
      <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-gray-400">
        {label}
        <Icon className="h-4 w-4 text-ink" aria-hidden="true" />
      </span>
      <span className="mt-2 block font-display text-2xl font-black text-ink">{value}</span>
      <span className="mt-1 flex items-center justify-between gap-2 text-xs text-gray-500">
        <span className="truncate">{detail}</span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
      </span>
    </Link>
  );
}

export default function HomeRankingSection({ reason }) {
  const { user } = useAuth();
  const nacional = useMyPlayerRating();
  const nivel = useDuprRatingForUid(user?.uid, true);
  const duplas = useMyDoublesRankings();

  const r = nacional.data;
  const n = nivel.data;
  const melhorDupla = (duplas.data || [])[0] || null;
  const parceiro = melhorDupla
    ? (melhorDupla.players || []).find((p) => (p.uid || p.id) !== user?.uid)?.name
    : null;
  const nivelDuplas = n && (n.doubles_games || 0) > 0 ? n.doubles_rating : null;
  const nivelSimples = n && (n.singles_games || 0) > 0 ? n.singles_rating : null;

  return (
    <HomeSection id="ranking" icon={Medal} title="Ranking e duplas" reason={reason} action={{ to: '/ranking', label: 'Ranking' }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile
          to="/ranking"
          icon={Medal}
          label="Ranking nacional"
          carregando={nacional.isLoading}
          falhou={nacional.isError}
          onRetry={nacional.refetch}
          value={r?.position ? `${r.position}º` : '—'}
          detail={r ? `Rating ${fmt(r.rating)} · ${r.wins || 0}V ${r.losses || 0}D` : 'Sem jogos publicados no ranking'}
        />
        <Tile
          to="/meu-desempenho"
          icon={Sparkles}
          label="Nível 2.0–8.0"
          carregando={nivel.isLoading}
          falhou={nivel.isError}
          onRetry={nivel.refetch}
          value={nivelDuplas != null ? fmt(nivelDuplas, 2) : (nivelSimples != null ? fmt(nivelSimples, 2) : '—')}
          detail={nivelDuplas != null
            ? `Duplas${nivelSimples != null ? ` · simples ${fmt(nivelSimples, 2)}` : ''}`
            : (nivelSimples != null ? 'Simples' : 'Calculado com os jogos publicados')}
        />
        <Tile
          to="/ranking/duplas"
          icon={Handshake}
          label="Melhor dupla"
          carregando={duplas.isLoading}
          falhou={duplas.isError}
          onRetry={duplas.refetch}
          value={melhorDupla?.position ? `${melhorDupla.position}º` : '—'}
          detail={melhorDupla
            ? `${parceiro ? `com ${parceiro} · ` : ''}${melhorDupla.wins || 0}V ${melhorDupla.losses || 0}D`
            : 'Jogue em dupla para entrar no ranking'}
        />
      </div>
    </HomeSection>
  );
}
