import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Shuffle, AlertTriangle } from 'lucide-react';
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState(null);

  async function performDraw() {
    setError(null);
    setRunning(true);
    try {
      await drawMutation.mutateAsync({
        tournamentId: tournament.id,
        modalityId: modality.id,
        stageIndex: 0,
      });
      toast.success('Sorteio realizado!');
      setConfirmOpen(false);
    } catch (err) {
      // Expor erro também no card para o admin entender o motivo do "não funcionou".
      const message = err?.message || 'Falha ao sortear.';
      setError(message);
      toast.error(message);
    } finally {
      setRunning(false);
    }
  }

  const stageName = modality.stages?.[0]?.name || 'fase 1';

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
            <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={running}>
              <Shuffle className="w-4 h-4 mr-1" /> {matches.length > 0 ? 'Re-sortear' : 'Sortear'}
            </Button>
          )}
        </div>
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Não foi possível sortear.</div>
              <div>{error}</div>
            </div>
          </div>
        )}
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

      <Dialog open={confirmOpen} onOpenChange={(o) => !running && setConfirmOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sortear &quot;{stageName}&quot;</DialogTitle>
            <DialogDescription>
              {matches.length > 0
                ? 'Os jogos atuais desta fase serão apagados e novos jogos serão gerados.'
                : 'Serão gerados os jogos desta fase a partir das inscrições confirmadas.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={running}>
              Cancelar
            </Button>
            <Button onClick={performDraw} disabled={running}>
              {running ? 'Sorteando…' : 'Confirmar sorteio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
