/**
 * Switch "Lançar resultados no ranking" para um dia de jogo de clube
 * (Wave C). Visível apenas para o criador do evento e admins do clube.
 *
 * Comportamento:
 *  - OFF (default): a chave de publicação está desligada; nada é
 *    espelhado em `club_event_games` e os jogos do dia não entram no
 *    ranking da plataforma.
 *  - ON: ao ligar (ou re-publicar), o serviço
 *    `rankingPublishingService.publishEventDateToRanking` espelha os
 *    jogos decididos (`score_a`/`score_b` definidos e diferentes) em
 *    `club_event_games/{eventId}_{dateId}_{gameId}` e dispara o
 *    recálculo do rating nacional. Jogos sem resultado (ou com guest)
 *    são pulados silenciosamente (ver `rankingPublishing`).
 *  - OFF após ON: despublica (remove do ranking) e recalcula.
 *
 * Tooltip + textos explicativos reforçam a regra "só jogos com
 * resultados lançados entram no ranking".
 */

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Trophy, Info, Loader2, RotateCcw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { useEventGames } from '@/modules/clubs/hooks/useClubs';
import {
  useEventDateRankingMeta,
  usePublishEventDateToRanking,
  useUnpublishEventDateFromRanking,
} from '@/modules/clubs/hooks/useClubs';
import { isGameDecided } from '../domain/rankingPublishing.js';

function isValidUid(side) {
  return Array.isArray(side) && side.length > 0 && side.every((p) => p && p.user_id);
}

function countEligibleGames(games, participants) {
  const byId = new Map((participants || []).map((p) => [p.id, p]));
  let decided = 0;
  let withUids = 0;
  let eligible = 0;
  (games || []).forEach((g) => {
    if (!isGameDecided(g)) return;
    decided += 1;
    const a = (g.side_a || []).map((p) => byId.get(p.id) || p);
    const b = (g.side_b || []).map((p) => byId.get(p.id) || p);
    const aOk = a.length > 0 && a.length <= 2 && isValidUid(a);
    const bOk = b.length > 0 && b.length <= 2 && isValidUid(b);
    if (aOk && bOk) {
      eligible += 1;
      withUids += 1;
    }
  });
  return { decided, withUids, eligible };
}

export default function PublishToRankingToggle({ event, clubId, dateId, canManage, participants }) {
  const { data: meta, isLoading: metaLoading } = useEventDateRankingMeta(event?.id, dateId);
  const { data: allGames = [] } = useEventGames(event?.id);
  const games = React.useMemo(
    () => (allGames || []).filter((g) => (g.date_id || null) === (dateId || null)),
    [allGames, dateId],
  );
  const publish = usePublishEventDateToRanking(event, clubId);
  const unpublish = useUnpublishEventDateFromRanking(event, clubId);

  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  if (!canManage) {
    if (meta?.date?.publish_to_ranking) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            <strong>Resultados deste dia estão no ranking nacional.</strong>
          </div>
        </div>
      );
    }
    return null;
  }

  if (metaLoading) {
    return <Skeleton className="h-20 rounded-lg" />;
  }

  const isPublished = Boolean(meta?.date?.publish_to_ranking);
  const publishedCount = meta?.publishedIds?.length || 0;
  const counts = countEligibleGames(games, participants);

  const handleToggle = async (next) => {
    try {
      if (next) {
        const result = await publish.mutateAsync({ dateId });
        const msg = [
          result.published ? `${result.published} jogo(s) publicado(s).` : null,
          result.already_published ? `${result.already_published} já estavam no ranking.` : null,
          result.skipped ? `${result.skipped} pulado(s) (sem resultado ou com guest).` : null,
        ]
          .filter(Boolean)
          .join(' ');
        toast.success(msg || 'Resultados publicados no ranking.');
      } else {
        setConfirmUnpublish(true);
      }
    } catch (err) {
      toast.error(err?.message || 'Não foi possível atualizar a publicação.');
    }
  };

  const handleRepublish = async () => {
    try {
      const result = await publish.mutateAsync({ dateId });
      toast.success(
        `Republicado: ${result.published} novo(s), ${result.already_published} já estava(m), ${result.skipped} pulado(s).`,
      );
    } catch (err) {
      toast.error(err?.message || 'Não foi possível republicar.');
    }
  };

  const handleConfirmUnpublish = async () => {
    try {
      const result = await unpublish.mutateAsync({ dateId });
      toast.success(`Removidos ${result.removed} jogo(s) do ranking.`);
      setConfirmUnpublish(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível despublicar.');
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-paper p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink">Lançar resultados no ranking</span>
              <button
                type="button"
                className="text-gray-400 hover:text-ink"
                onClick={() => setShowHelp((v) => !v)}
                aria-label="Mais informações"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Publica os jogos com placar definido no ranking da plataforma e no histórico dos atletas.
              {isPublished && (
                <> <strong className="text-ink">{publishedCount}</strong> jogo(s) já lançado(s).</>
              )}
            </p>
            {showHelp && (
              <p className="mt-2 rounded border border-amber-200 bg-amber-50/50 p-2 text-[11px] leading-5 text-amber-900">
                <strong>Apenas jogos com resultados lançados</strong> entram no ranking.
                Jogos sem placar (ou com placares empatados) são ignorados.
                Rodadas sorteadas e partidas avulsas contam igualmente.
                Para cada lado do jogo, todos os jogadores precisam ter conta na plataforma
                (convidados sem conta não contam). O lançamento é idempotente:
                pode ser refeito sem duplicar.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPublished && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRepublish}
              disabled={publish.isPending}
              title="Republicar (recalcular a partir dos jogos atuais)"
            >
              {publish.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Republicar
            </Button>
          )}
          <Switch
            checked={isPublished}
            onCheckedChange={handleToggle}
            disabled={publish.isPending || unpublish.isPending}
            aria-label="Lançar resultados no ranking"
          />
        </div>
      </div>

      {/* Resumo local dos jogos decididos (UX explicativa). */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="rounded-full font-normal">
          {counts.decided} decidido(s)
        </Badge>
        <Badge variant="secondary" className="rounded-full font-normal">
          {counts.eligible} elegíve(is) para o ranking
        </Badge>
        {counts.decided > counts.eligible && (
          <Badge variant="secondary" className="rounded-full font-normal text-amber-700">
            {counts.decided - counts.eligible} com guest ou sem conta
          </Badge>
        )}
      </div>

      <ConfirmDialog
        open={confirmUnpublish}
        onOpenChange={setConfirmUnpublish}
        title="Despublicar do ranking?"
        description={`Os ${publishedCount} jogo(s) lançado(s) deste dia serão removidos do ranking nacional. O histórico de resultados do dia continua salvo na organização de jogos do clube.`}
        confirmLabel="Despublicar"
        destructive
        loading={unpublish.isPending}
        onConfirm={handleConfirmUnpublish}
      />
    </div>
  );
}
