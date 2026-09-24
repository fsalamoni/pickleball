/**
 * Encerrar o torneio da casa — e somar o resultado ao ladder.
 *
 * 🐞 O serviço (`finishInternalTournament`) existia e NENHUMA tela o chamava:
 * o torneio começava, virava dia de jogo e ficava "em andamento" para sempre,
 * e o ladder da casa nunca recebia um ponto.
 *
 * A classificação vem do dia de jogo em que o torneio foi jogado:
 * - formato COM placar (Americano, Mexicano, Rei da Quadra, Americano
 *   aprimorado): o pódio já vem do ranking do dia, e a arena confere;
 * - formato SEM placar (Play): a arena escolhe o pódio.
 *
 * Antes de confirmar, a arena vê quantos pontos cada pessoa vai levar — a
 * acumulação do ladder é a parte que ninguém confere de olho depois.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Medal, Trophy } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useGameDay, useGameDayGames, useGameDayParticipants } from '@/modules/games/hooks/useGameDays';
import { useFinishTournament } from '@/modules/arenas/hooks/useArenaV3';
import { formatHasScores } from '@/modules/clubs/domain/gameDayFormats';
import {
  PODIUM_SIZE, applyPodium, classificationForLadder, suggestedPodium, tournamentStandings,
} from '@/modules/arenas/domain/tournamentResult';
import { V2Button, V2Skeleton } from '@/v2/ui/primitives';

const ROTULO = ['Campeão', '2º lugar', '3º lugar', '4º lugar'];

export default function FinishTournamentDialog({ torneio, arenaId, open, onOpenChange }) {
  const gdId = open ? torneio.game_day_id : null;
  const diaQ = useGameDay(gdId);
  const participantesQ = useGameDayParticipants(gdId);
  const jogosQ = useGameDayGames(gdId);
  const encerrar = useFinishTournament();

  const carregando = Boolean(gdId) && (diaQ.isLoading || participantesQ.isLoading || jogosQ.isLoading);
  const formato = diaQ.data?.format || torneio.format;
  const comPlacar = formatHasScores(formato);

  const standings = useMemo(() => tournamentStandings({
    roster: torneio.roster || [],
    participants: participantesQ.data || [],
    games: jogosQ.data || [],
    hasScores: comPlacar,
  }), [torneio.roster, participantesQ.data, jogosQ.data, comPlacar]);

  const [podio, setPodio] = useState(() => Array(PODIUM_SIZE).fill(null));
  // Quando os dados chegam, o pódio parte do ranking do dia (se houver) —
  // mas nunca por cima do que a arena já escolheu à mão (uma nova busca em
  // segundo plano não pode desfazer a escolha dela).
  const mexeu = useRef(false);
  useEffect(() => {
    if (!carregando && !mexeu.current) setPodio(suggestedPodium(standings));
  }, [carregando, standings]);

  const classificacao = useMemo(
    () => classificationForLadder(applyPodium(standings, podio)),
    [standings, podio],
  );
  const semPodio = podio.every((u) => !u);

  const escolher = (i, uid) => setPodio((atual) => {
    mexeu.current = true;
    const novo = atual.map((u) => (u === uid ? null : u));
    novo[i] = uid || null;
    return novo;
  });

  const confirmar = () => encerrar.mutateAsync({
    arenaId, tournament: torneio, classificacao, period: 'geral',
  })
    .then(() => { toast.success('Torneio encerrado e classificação da casa atualizada.'); onOpenChange(false); })
    .catch((e) => toast.error(e?.message || 'Não foi possível encerrar.'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Encerrar “{torneio.name}”</DialogTitle>
          <DialogDescription>
            {comPlacar
              ? 'O pódio vem do ranking do dia. Confira e confirme — os pontos vão para a classificação da casa.'
              : 'Este formato não tem placar: escolha o pódio. Quem jogou e ficou fora dele leva os pontos de presença.'}
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <V2Skeleton lines={4} />
        ) : standings.length === 0 ? (
          <p className="text-sm text-gray-500">Ninguém com conta jogou este torneio — não há o que pontuar.</p>
        ) : (
          <>
            <div className="space-y-2">
              {ROTULO.map((rotulo, i) => (
                <label key={rotulo} className="flex items-center gap-2 text-sm">
                  <Medal className={`h-4 w-4 shrink-0 ${i === 0 ? 'text-amber-500' : 'text-gray-400'}`} />
                  <span className="w-20 shrink-0 font-bold text-ink">{rotulo}</span>
                  <select
                    aria-label={rotulo}
                    value={podio[i] || ''}
                    onChange={(e) => escolher(i, e.target.value)}
                    className="h-10 w-full rounded-2xl border border-gray-200 bg-paper-pure px-3 text-sm"
                  >
                    <option value="">Ninguém</option>
                    {standings.map((s) => (
                      <option key={s.user_id} value={s.user_id}>
                        {s.name}{s.played ? ` · ${s.won}V em ${s.played}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div className="mt-4 rounded-2xl bg-paper p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">O que cada um leva</p>
              <ul className="space-y-1 text-sm">
                {classificacao.map((c) => (
                  <li key={c.user_id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-ink">{c.position ? `${c.position}º · ` : ''}{c.name}</span>
                    <span className="shrink-0 font-bold text-ink">+{c.points}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <V2Button variant="ghost" onClick={() => onOpenChange(false)}>Voltar</V2Button>
          <V2Button disabled={carregando || standings.length === 0 || encerrar.isPending} onClick={confirmar}>
            {encerrar.isPending ? 'Encerrando…' : semPodio ? 'Encerrar sem pódio' : 'Encerrar e pontuar'}
          </V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
