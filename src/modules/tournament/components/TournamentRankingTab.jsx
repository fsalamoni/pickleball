import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Info, Medal } from 'lucide-react';
import { useModalities, useModalityRanking } from '@/modules/tournament/hooks/useTournament';

export default function TournamentRankingTab({ tournament }) {
  const { data: modalities = [] } = useModalities(tournament.id);

  if (modalities.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-500 text-center">
          Sem modalidades.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="p-4 flex items-start gap-2 text-sm text-emerald-950">
          <Info className="w-4 h-4 mt-0.5 text-emerald-700 shrink-0" />
          <div>
            <strong>Como funciona a classificação:</strong> a posição é definida pelo número de vitórias.
            Em caso de empate, valem na ordem: <strong>saldo de pontos</strong> (a favor − contra),
            <strong> pontos marcados</strong> e, por fim, <strong>menor número de pontos sofridos</strong>.
          </div>
        </CardContent>
      </Card>
      {modalities.map((m) => (
        <ModalityRankingBlock key={m.id} modality={m} />
      ))}
    </div>
  );
}

const MEDAL_BY_POSITION = {
  1: { color: 'text-amber-500', label: 'Ouro' },
  2: { color: 'text-slate-400', label: 'Prata' },
  3: { color: 'text-amber-700', label: 'Bronze' },
};

const ROW_TONE_BY_POSITION = {
  1: 'bg-amber-50/70 hover:bg-amber-100/70',
  2: 'bg-slate-50/70 hover:bg-slate-100/70',
  3: 'bg-orange-50/60 hover:bg-orange-100/60',
};

function PositionCell({ position }) {
  const medal = MEDAL_BY_POSITION[position];
  return (
    <span className="inline-flex items-center gap-1 font-bold tabular-nums">
      {medal && <Medal className={`w-4 h-4 ${medal.color}`} aria-label={medal.label} />}
      {position}
    </span>
  );
}

function ModalityRankingBlock({ modality }) {
  const { data: ranking = [], isLoading } = useModalityRanking(modality.id);

  return (
    <Card>
      <CardContent className="p-4">
        <h4 className="font-semibold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-emerald-600" /> {modality.name}
        </h4>
        {isLoading ? (
          <p className="text-sm text-slate-500 mt-2">Carregando…</p>
        ) : ranking.length === 0 ? (
          <p className="text-sm text-slate-500 mt-2">Aguardando resultados.</p>
        ) : (
          <div className="mt-3 arena-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="text-left">
                  <th className="px-3 py-2">Pos.</th>
                  <th className="px-3 py-2">Participante</th>
                  <th className="px-3 py-2 text-center">PJ</th>
                  <th className="px-3 py-2 text-center" title="Vitórias — critério principal de classificação">V</th>
                  <th className="px-3 py-2 text-center">D</th>
                  <th className="px-3 py-2 text-center">Sets (G–P)</th>
                  <th className="px-3 py-2 text-center" title="Pontos a favor (somados em todos os jogos)">PF</th>
                  <th className="px-3 py-2 text-center" title="Pontos sofridos">PC</th>
                  <th className="px-3 py-2 text-center" title="Saldo de pontos (PF − PC) — 1º critério de desempate">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r) => {
                  const balance = (r.points_for || 0) - (r.points_against || 0);
                  const tone = ROW_TONE_BY_POSITION[r.position] || '';
                  return (
                    <tr key={r.participant_id} className={`border-t ${tone}`}>
                      <td className="px-3 py-2"><PositionCell position={r.position} /></td>
                      <td className="px-3 py-2">{r.label}</td>
                      <td className="px-3 py-2 text-center">{r.played}</td>
                      <td className="px-3 py-2 text-center font-semibold">{r.wins}</td>
                      <td className="px-3 py-2 text-center">{r.losses}</td>
                      <td className="px-3 py-2 text-center">{r.sets_won}–{r.sets_lost}</td>
                      <td className="px-3 py-2 text-center">{r.points_for}</td>
                      <td className="px-3 py-2 text-center">{r.points_against}</td>
                      <td className={`px-3 py-2 text-center font-medium ${balance > 0 ? 'text-emerald-700' : balance < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                        {balance > 0 ? `+${balance}` : balance}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
