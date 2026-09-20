/**
 * V2ArenaMatchmaking — encontrar parceiro nesta arena.
 *
 * Rota: `/arenas/:arenaId/matchmaking`
 * Módulo: `matchmaking_partner_finder`.
 *
 * ## O que estava errado
 *
 * O score de compatibilidade compara NÍVEL, e o nível que chegava aqui era
 * `userProfile.leveling_level || userProfile.level` — um CÓDIGO de faixa
 * (texto), não um número. `matchScore` exige `Number.isFinite` nos dois lados,
 * então a dimensão mais importante do score simplesmente não pontuava: a lista
 * saía ordenada só por cidade e ruído.
 *
 * Agora os dois lados vêm da RÉGUA ÚNICA (2.0–8.0), em UMA consulta para o
 * lote inteiro de candidatos. E a cidade de referência passou a ser a da
 * ARENA, não a de quem procura: quem busca parceiro nesta arena quer alguém
 * que jogue AQUI.
 */

import React, { useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Search, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena } from '@/modules/arenas/hooks/useArenas';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { useMyUnifiedLevel, useUnifiedLevels } from '@/modules/rating/hooks/useMyUnifiedLevel';
import { formatLevel } from '@/modules/arenas/domain/openMatch';
import {
  topMatches,
  scoreLabel,
  scoreTone,
  normalizeMatchmakingCriteria,
} from '@/modules/arenas/domain/matchmaking';
import { V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface, V2ErrorState } from '@/v2/ui/primitives';

function MatchCard({ candidate, score, arenaId, onChat }) {
  const tone = scoreTone(score);
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-paper-pure p-4 transition hover:border-gray-200">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">
        {candidate.photo_url ? (
          <img src={candidate.photo_url} alt={candidate.platform_name || 'Atleta'} className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-base font-bold text-ink">
            {(candidate.platform_name || candidate.full_name || 'A').slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-display text-base font-bold text-ink">
            {candidate.platform_name || candidate.full_name || 'Atleta'}
          </h3>
          {Number.isFinite(candidate.level) && (
            <V2Badge tone="neutral">Nível {formatLevel(candidate.level)}</V2Badge>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          {candidate.city && <span>{candidate.city}</span>}
          {candidate.state && <span>· {candidate.state}</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <V2Badge tone={tone}>{score}%</V2Badge>
        <button
          type="button"
          onClick={() => onChat(candidate)}
          className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-ink"
          aria-label="Abrir chat"
        >
          <MessageCircle className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function V2ArenaMatchmaking() {
  const { arenaId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: arena, isLoading: arenaLoading, isError: falhouArena, refetch: recarregarArena } = useArena(arenaId);
  const { isOn, isLoading: modulosLoading } = useArenaModules(arenaId);
  const canUseModule = isOn(ARENA_MODULE_ID.MATCHMAKING_PARTNER_FINDER);
  const { data: athletes = [], isLoading: athletesLoading, isError: falhouAtletas, refetch: recarregarAtletas } = useAthletes();
  const { level: meuNivel } = useMyUnifiedLevel();

  const [criteriaInput, setCriteriaInput] = useState({
    min_level_diff: 0,
    max_level_diff: 1.5,
    prefer_same_city: true,
  });

  // Hooks derivados precisam vir ANTES de qualquer early return (regras dos
  // hooks do React): a ordem de chamada deve ser estável entre renders.
  const criteriaValidation = useMemo(
    () => normalizeMatchmakingCriteria(criteriaInput),
    [criteriaInput],
  );
  const criteria = criteriaValidation.value;

  // Candidatos: todos menos eu. Cortado antes de buscar nível, para o lote
  // não crescer sem limite numa plataforma grande.
  const candidates = useMemo(
    () => athletes.filter((a) => a.uid && a.uid !== user?.uid).slice(0, 120),
    [athletes, user],
  );

  // Os níveis do lote inteiro em UMA consulta.
  const { levels } = useUnifiedLevels(candidates.map((a) => a.uid));

  const matches = useMemo(() => {
    const eu = {
      uid: user?.uid,
      level: meuNivel,
      // A cidade de referência é a da ARENA: quem procura parceiro aqui quer
      // alguém que jogue aqui, não alguém que more perto de mim.
      city: arena?.city,
      state: arena?.state,
    };
    const comNivel = candidates.map((a) => ({
      ...a,
      level: Number.isFinite(levels[a.uid]) ? levels[a.uid] : null,
    }));
    return topMatches(eu, comNivel, criteria, 30);
  }, [user?.uid, meuNivel, arena?.city, arena?.state, candidates, levels, criteria]);

  // Sem login
  if (!user) {
    return (
      <div className="mx-auto max-w-[500px]">
        <V2Surface>
          <V2EmptyState
            title="Faça login"
            description="Você precisa estar logado para buscar parceiros."
            action={<V2Button asChild><Link to="/login">Entrar</Link></V2Button>}
          />
        </V2Surface>
      </div>
    );
  }

  if (arenaLoading || modulosLoading) {
    return <V2Skeleton className="mx-auto h-96 max-w-[1000px] rounded-4xl" />;
  }

  if (falhouArena && !arena) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface>
          <V2ErrorState
            title="Não foi possível carregar a arena"
            description="A conexão falhou no meio do caminho."
            onRetry={() => recarregarArena()}
          />
        </V2Surface>
      </div>
    );
  }

  if (!arena) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface>
          <V2EmptyState
            title="Arena não encontrada"
            action={<Link to="/arenas" className="text-sm font-bold text-ink underline">← Voltar ao diretório</Link>}
          />
        </V2Surface>
      </div>
    );
  }

  if (!canUseModule) {
    return (
      <div className="mx-auto max-w-[700px]">
        <div className="mb-4">
          <Link
            to={`/arenas/${arena.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar à arena
          </Link>
        </div>
        <V2Surface>
          <V2EmptyState
            icon={Users}
            title="Busca de parceiro não está ativa nesta arena"
            description="Esta arena ainda não ativou o recurso. Você pode procurar parceiros em outras arenas."
            action={<V2Button asChild variant="secondary"><Link to="/arenas">Ver outras arenas</Link></V2Button>}
          />
        </V2Surface>
      </div>
    );
  }

  // Navegação de aplicação, não recarregamento de página: `window.location`
  // derrubava o estado inteiro (e o cache) para abrir uma conversa.
  const handleChat = (candidate) => navigate(`/chat?with=${candidate.uid}`);

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-6">
        <Link
          to={`/arenas/${arena.id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar à arena
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
              Encontrar parceiro · {arena.name}
            </h1>
            <p className="mt-2 font-medium text-gray-500">
              Atletas com nível próximo do seu
              {Number.isFinite(meuNivel) ? ` (${formatLevel(meuNivel)})` : ''}. Toque para conversar.
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <V2Surface className="mb-6">
        <h3 className="mb-3 font-display text-base font-bold text-ink">Filtros</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-bold text-gray-500">Diferença mínima de nível</span>
            <input
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={criteriaInput.min_level_diff}
              onChange={(e) => setCriteriaInput({ ...criteriaInput, min_level_diff: Number(e.target.value) })}
              className="mt-1 h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm text-ink"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-gray-500">Diferença máxima de nível</span>
            <input
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={criteriaInput.max_level_diff}
              onChange={(e) => setCriteriaInput({ ...criteriaInput, max_level_diff: Number(e.target.value) })}
              className="mt-1 h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm text-ink"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-gray-500">Preferir mesma cidade</span>
            <select
              value={criteriaInput.prefer_same_city ? 'sim' : 'nao'}
              onChange={(e) => setCriteriaInput({ ...criteriaInput, prefer_same_city: e.target.value === 'sim' })}
              className="mt-1 h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm text-ink"
            >
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </label>
        </div>
        {!criteriaValidation.valid && (
          <p className="mt-2 text-xs text-red-600">
            {Object.values(criteriaValidation.errors)[0]}
          </p>
        )}
      </V2Surface>

      {athletesLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <V2Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : matches.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Search}
            title={falhouAtletas ? 'A lista de atletas não carregou' : 'Nenhum match encontrado'}
            description={falhouAtletas
              ? 'Ninguém sumiu — o que falhou foi a consulta. Tente de novo.'
              : 'Tente aumentar a diferença máxima de nível ou desmarcar a preferência por cidade.'}
            action={falhouAtletas
              ? <button type="button" onClick={() => recarregarAtletas()} className="text-sm font-bold text-ink underline">Tentar de novo</button>
              : undefined}
          />
        </V2Surface>
      ) : (
        <div>
          <p className="mb-3 text-sm text-gray-500">
            {matches.length} sugestão{matches.length === 1 ? '' : 'ões'} para você
          </p>
          <div className="space-y-2">
            {matches.map((m) => (
              <MatchCard
                key={m.uid}
                candidate={m}
                score={m._score}
                arenaId={arena.id}
                onChat={handleChat}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
