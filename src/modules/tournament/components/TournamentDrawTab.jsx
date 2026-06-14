import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Shuffle, AlertTriangle, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
  useModalities,
  useRunDraw,
  useMatches,
  useRegistrations,
  useSubstitutePlayer,
} from '@/modules/tournament/hooks/useTournament';
import {
  TOURNAMENT_STAGE_TYPE_LABELS,
  REGISTRATION_STATUS,
} from '@/modules/tournament/domain/constants';

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
  const { data: registrations = [] } = useRegistrations(modality.id);
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState(null);
  const [substitution, setSubstitution] = useState(null);

  const labelById = useMemo(() => {
    const map = new Map();
    registrations.forEach((r) => map.set(r.id, r.label || r.player_a_name));
    return map;
  }, [registrations]);

  const activeRegistrations = useMemo(
    () =>
      registrations.filter(
        (r) =>
          r.status === REGISTRATION_STATUS.CONFIRMED ||
          r.status === REGISTRATION_STATUS.CHECKED_IN,
      ),
    [registrations],
  );

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
      const message = err?.message || 'Falha ao sortear.';
      setError(message);
      toast.error(message);
    } finally {
      setRunning(false);
    }
  }

  const stageName = modality.stages?.[0]?.name || 'fase 1';
  const hasGroups = matches.some((m) => m.group);

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
                  {hasGroups && <th className="px-3 py-2">Grupo</th>}
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
                    {hasGroups && <td className="px-3 py-2">{m.group || '—'}</td>}
                    <td className="px-3 py-2">{m.round}</td>
                    <td className="px-3 py-2">
                      <SideCell
                        ids={m.side_a_ids}
                        rawSide={m.side_a}
                        labelById={labelById}
                        isAdmin={isAdmin}
                        onSubstitute={(regId) => setSubstitution({ match: m, registrationId: regId })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <SideCell
                        ids={m.side_b_ids}
                        rawSide={m.side_b}
                        labelById={labelById}
                        isAdmin={isAdmin}
                        onSubstitute={(regId) => setSubstitution({ match: m, registrationId: regId })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{m.status}</Badge>
                    </td>
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

      {substitution && (
        <SubstitutePlayerDialog
          match={substitution.match}
          registrationId={substitution.registrationId}
          modalityId={modality.id}
          labelById={labelById}
          activeRegistrations={activeRegistrations}
          onClose={() => setSubstitution(null)}
        />
      )}
    </Card>
  );
}

function SideCell({ ids, rawSide, labelById, isAdmin, onSubstitute }) {
  if (!ids || ids.length === 0) {
    return <span className="text-slate-400">{rawSide || '—'}</span>;
  }
  return (
    <div className="space-y-0.5">
      {ids.map((regId) => {
        const name = labelById.get(regId) || regId;
        return (
          <div key={regId} className="flex items-center gap-1">
            <span>{name}</span>
            {isAdmin && (
              <button
                onClick={() => onSubstitute(regId)}
                title="Substituir jogador"
                className="text-slate-400 hover:text-slate-700 transition-colors ml-1"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SubstitutePlayerDialog({
  match,
  registrationId,
  modalityId,
  labelById,
  activeRegistrations,
  onClose,
}) {
  const substituteMutation = useSubstitutePlayer(modalityId);
  const [selectedId, setSelectedId] = useState('');

  const currentName = labelById.get(registrationId) || registrationId;

  const takenIds = new Set([...(match.side_a_ids || []), ...(match.side_b_ids || [])]);
  const available = activeRegistrations
    .filter((r) => !takenIds.has(r.id))
    .sort((a, b) =>
      (a.label || a.player_a_name || '').localeCompare(b.label || b.player_a_name || ''),
    );

  async function handleConfirm() {
    if (!selectedId) return;
    try {
      await substituteMutation.mutateAsync({
        matchId: match.id,
        oldRegistrationId: registrationId,
        newRegistrationId: selectedId,
      });
      toast.success('Jogador substituído com sucesso.');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Falha ao substituir jogador.');
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Substituir jogador</DialogTitle>
          <DialogDescription>
            Substituindo: <strong>{currentName}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Substituto</Label>
            {available.length === 0 ? (
              <p className="text-sm text-slate-500 mt-1">
                Nenhum jogador disponível para substituição.
              </p>
            ) : (
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm mt-1"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">— selecione um jogador —</option>
                {available.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label || r.player_a_name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedId || substituteMutation.isPending}
          >
            {substituteMutation.isPending ? 'Substituindo…' : 'Confirmar substituição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
