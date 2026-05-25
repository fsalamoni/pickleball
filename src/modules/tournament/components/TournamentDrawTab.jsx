import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shuffle } from 'lucide-react';
import { toast } from 'sonner';
import {
  useModalities,
  useRunDraw,
  useMatches,
} from '@/modules/tournament/hooks/useTournament';
import { TOURNAMENT_STAGE_TYPE_LABELS } from '@/modules/tournament/domain/constants';

export default function TournamentDrawTab({ tournament, isAdmin }) {
  const { data: modalities = [] } = useModalities(tournament.id);

  if (modalities.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-500 text-center">
          Crie modalidades antes de sortear.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {modalities.map((m) => (
        <ModalityDrawBlock key={m.id} tournament={tournament} modality={m} isAdmin={isAdmin} />
      ))}
    </div>
  );
}

function ModalityDrawBlock({ tournament, modality, isAdmin }) {
  const drawMutation = useRunDraw();
  const { data: matches = [] } = useMatches(modality.id, 0);
  const [running, setRunning] = useState(false);

  async function handleDraw() {
    if (!confirm(`Sortear a fase "${modality.stages?.[0]?.name}"? Isso irá apagar jogos existentes desta fase.`)) return;
    setRunning(true);
    try {
      await drawMutation.mutateAsync({
        tournamentId: tournament.id,
        modalityId: modality.id,
        stageIndex: 0,
      });
      toast.success('Sorteio realizado!');
    } catch (err) {
      toast.error(err.message || 'Falha ao sortear.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h4 className="font-semibold">{modality.name}</h4>
            <p className="text-xs text-slate-500">
              Fase: {TOURNAMENT_STAGE_TYPE_LABELS[modality.stages?.[0]?.type]} ·{' '}
              {matches.length > 0 ? `${matches.length} jogos gerados` : 'Ainda não sorteado'}
            </p>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={handleDraw} disabled={running}>
              <Shuffle className="w-4 h-4 mr-1" /> {matches.length > 0 ? 'Re-sortear' : 'Sortear'}
            </Button>
          )}
        </div>
        {matches.length > 0 && (
          <div className="mt-3 arena-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-3 py-2">#</th>
                  {matches.some((m) => m.group) && <th className="px-3 py-2">Grupo</th>}
                  <th className="px-3 py-2">Rod.</th>
                  <th className="px-3 py-2">Lado A</th>
                  <th className="px-3 py-2">Lado B</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2">{i + 1}</td>
                    {matches.some((mm) => mm.group) && <td className="px-3 py-2">{m.group || '—'}</td>}
                    <td className="px-3 py-2">{m.round}</td>
                    <td className="px-3 py-2">{m.side_a || '—'}</td>
                    <td className="px-3 py-2">{m.side_b || '—'}</td>
                    <td className="px-3 py-2"><Badge variant="secondary">{m.status}</Badge></td>
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
