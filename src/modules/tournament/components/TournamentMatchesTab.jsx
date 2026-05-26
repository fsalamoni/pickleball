import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Trophy } from 'lucide-react';
import {
  useModalities,
  useMatches,
  useRecordMatchResult,
  useRegistrations,
} from '@/modules/tournament/hooks/useTournament';
import { MATCH_STATUS, MATCH_STATUS_LABELS } from '@/modules/tournament/domain/constants';
import { normalizeScoringConfig } from '@/modules/tournament/domain/scoring';

export default function TournamentMatchesTab({ tournament, isAdmin }) {
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
        <ModalityMatchesBlock key={m.id} tournament={tournament} modality={m} isAdmin={isAdmin} />
      ))}
    </div>
  );
}

function ModalityMatchesBlock({ tournament, modality, isAdmin }) {
  const { data: matches = [] } = useMatches(modality.id, 0);
  const { data: registrations = [] } = useRegistrations(modality.id);
  const labelById = useMemo(() => {
    const map = new Map();
    registrations.forEach((r) => map.set(r.id, r.label || r.player_a_name));
    return map;
  }, [registrations]);

  const cfg = normalizeScoringConfig(modality.scoring_override || tournament.scoring);
  const [openMatchId, setOpenMatchId] = useState(null);
  const openMatch = matches.find((m) => m.id === openMatchId);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap mb-3">
          <div>
            <h4 className="font-semibold">{modality.name}</h4>
            <p className="text-xs text-slate-500">{matches.length} jogos · {cfg.target_score} pontos por game · best-of-{cfg.sets_per_match}</p>
          </div>
        </div>
        {matches.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum jogo gerado ainda.</p>
        ) : (
          <div className="arena-table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  {matches.some((m) => m.group) && <th className="px-3 py-2">Grupo</th>}
                  <th className="px-3 py-2">Rod.</th>
                  <th className="px-3 py-2">Partida</th>
                  <th className="px-3 py-2">Placar (sets)</th>
                  <th className="px-3 py-2">Status</th>
                  {isAdmin && <th className="px-3 py-2 text-right">Resultado</th>}
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => {
                  const sideA = m.side_a_ids?.map((id) => labelById.get(id) || id).join(' + ') || m.side_a;
                  const sideB = m.side_b_ids?.map((id) => labelById.get(id) || id).join(' + ') || m.side_b;
                  const finished = m.status === MATCH_STATUS.FINISHED || m.status === MATCH_STATUS.WALKOVER;
                  const winA = finished && m.winner_side === 'a';
                  const winB = finished && m.winner_side === 'b';
                  return (
                    <tr key={m.id} className="border-t">
                      {matches.some((mm) => mm.group) && <td className="px-3 py-2">{m.group || '—'}</td>}
                      <td className="px-3 py-2">{m.round}</td>
                      <td className="px-3 py-2">
                        <div className={`flex items-center gap-1 ${winA ? 'font-bold text-emerald-700' : 'font-medium'}`}>
                          {winA && <Trophy className="w-3.5 h-3.5 text-emerald-600" aria-label="Vencedor" />}
                          <span>{sideA}</span>
                        </div>
                        <div className="text-xs text-slate-400">vs</div>
                        <div className={`flex items-center gap-1 ${winB ? 'font-bold text-emerald-700' : 'font-medium'}`}>
                          {winB && <Trophy className="w-3.5 h-3.5 text-emerald-600" aria-label="Vencedor" />}
                          <span>{sideB}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {(m.games || []).length === 0 ? '—' : m.games.map((g, i) => (
                          <span key={i} className="mr-2">{g.a}-{g.b}</span>
                        ))}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={finished ? 'success' : 'secondary'}>
                          {MATCH_STATUS_LABELS[m.status] || m.status}
                        </Badge>
                      </td>
                      {isAdmin && (
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => setOpenMatchId(m.id)}>
                            {finished ? 'Editar' : 'Lançar'}
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      {openMatch && (
        <ScoreEntryDialog
          match={openMatch}
          modalityId={modality.id}
          scoringConfig={cfg}
          labelById={labelById}
          onClose={() => setOpenMatchId(null)}
        />
      )}
    </Card>
  );
}

function ScoreEntryDialog({ match, modalityId, scoringConfig, labelById, onClose }) {
  const setsCount = scoringConfig.sets_per_match || 1;
  const [games, setGames] = useState(() => {
    const initial = match.games?.length ? match.games : [];
    while (initial.length < setsCount) initial.push({ a: '', b: '' });
    return initial.slice(0, setsCount).map((g) => ({ a: g.a ?? '', b: g.b ?? '' }));
  });
  const [walkover, setWalkover] = useState(match.walkover || '');
  const recordMutation = useRecordMatchResult(modalityId, scoringConfig);

  const sideA = match.side_a_ids?.map((id) => labelById.get(id) || id).join(' + ') || match.side_a;
  const sideB = match.side_b_ids?.map((id) => labelById.get(id) || id).join(' + ') || match.side_b;

  async function handleSave() {
    try {
      const payload = walkover
        ? { walkover, games: [] }
        : {
            walkover: null,
            games: games
              .map((g) => ({ a: Number(g.a), b: Number(g.b) }))
              .filter((g) => Number.isFinite(g.a) && Number.isFinite(g.b)),
          };
      await recordMutation.mutateAsync({ matchId: match.id, payload });
      toast.success('Resultado lançado.');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Falha ao salvar.');
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {sideA} vs {sideB}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!walkover && (
            <div className="space-y-2">
              {games.map((g, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                  <div>
                    <Label>Set {i + 1} — Lado A</Label>
                    <Input
                      type="number"
                      min={0}
                      value={g.a}
                      onChange={(e) => setGames((arr) => arr.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
                    />
                  </div>
                  <span className="pb-2 text-slate-400">×</span>
                  <div>
                    <Label>Lado B</Label>
                    <Input
                      type="number"
                      min={0}
                      value={g.b}
                      onChange={(e) => setGames((arr) => arr.map((x, j) => (j === i ? { ...x, b: e.target.value } : x)))}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div>
            <Label>Walkover (WO) — opcional</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={walkover}
              onChange={(e) => setWalkover(e.target.value)}
            >
              <option value="">— sem WO —</option>
              <option value="a">WO para Lado A</option>
              <option value="b">WO para Lado B</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={recordMutation.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
