import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
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
      {modalities.map((m) => (
        <ModalityRankingBlock key={m.id} modality={m} />
      ))}
    </div>
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
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-3 py-2">Pos.</th>
                  <th className="px-3 py-2">Participante</th>
                  <th className="px-3 py-2 text-center">PJ</th>
                  <th className="px-3 py-2 text-center">V</th>
                  <th className="px-3 py-2 text-center">D</th>
                  <th className="px-3 py-2 text-center">Sets (G–P)</th>
                  <th className="px-3 py-2 text-center">Pts (PF–PC)</th>
                  <th className="px-3 py-2 text-right">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r) => (
                  <tr key={r.participant_id} className="border-t">
                    <td className="px-3 py-2 font-bold">{r.position}</td>
                    <td className="px-3 py-2">{r.label}</td>
                    <td className="px-3 py-2 text-center">{r.played}</td>
                    <td className="px-3 py-2 text-center">{r.wins}</td>
                    <td className="px-3 py-2 text-center">{r.losses}</td>
                    <td className="px-3 py-2 text-center">{r.sets_won}–{r.sets_lost}</td>
                    <td className="px-3 py-2 text-center">{r.points_for}–{r.points_against}</td>
                    <td className="px-3 py-2 text-right font-semibold">{r.ranking_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
