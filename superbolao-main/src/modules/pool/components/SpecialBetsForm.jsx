import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMySpecialBets } from '@/modules/bets/hooks/useBets';
import { saveSpecialBet } from '@/modules/bets/services/betsService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DeadlineBadge } from './DeadlineBadge';

export function SpecialBetsForm({ poolId, teams, championDeadline }) {
  const { user } = useAuth();
  const { specialByType, isLoading } = useMySpecialBets(poolId);
  const [championTeamId, setChampionTeamId] = useState('');
  const [topScorer, setTopScorer] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingSave, setPendingSave] = useState(null);

  useEffect(() => {
    if (!isLoading) {
      if (specialByType.champion?.team_id) setChampionTeamId(specialByType.champion.team_id);
      if (specialByType.top_scorer?.player_name) setTopScorer(specialByType.top_scorer.player_name);
    }
  }, [isLoading]); // eslint-disable-line

  const deadline = championDeadline ? toDate(championDeadline) : null;
  const isLocked = deadline ? deadline.getTime() <= Date.now() : false;

  const buildEntries = () => [
    championTeamId ? { type: 'champion', team_id: championTeamId } : null,
    topScorer.trim() ? { type: 'top_scorer', player_name: topScorer.trim() } : null,
  ].filter(Boolean);

  const persistEntries = async (entries) => {
    if (!entries.length) {
      toast.warning('Nada a salvar.');
      return;
    }

    setBusy(true);
    try {
      await Promise.all(entries.map((entry) => saveSpecialBet(user.uid, poolId, entry, user)));
      toast.success('Palpites especiais salvos.');
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar.');
    } finally {
      setBusy(false);
      setPendingSave(null);
    }
  };

  const onSave = async () => {
    if (isLocked) {
      toast.error('Palpites especiais ja estao encerrados.');
      return;
    }

    const entries = buildEntries();
    const existingCount = entries.filter((entry) => specialByType[entry.type]).length;

    if (existingCount > 0) {
      setPendingSave({ entries, existingCount });
      return;
    }

    await persistEntries(entries);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
        <CardTitle className="text-base text-slate-950">Quizzes da Copa</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          Acerte o Campeão (300 pts) e o Artilheiro (150 pts). {deadline && <DeadlineBadge deadline={deadline} />}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-4 sm:p-5">
        <div className="space-y-2 rounded-md border border-emerald-950/10 bg-white/60 p-3">
          <Label>Quem será o Campeão do Mundo? (300 pts)</Label>
          <select
            disabled={isLocked}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={championTeamId}
            onChange={(e) => setChampionTeamId(e.target.value)}
          >
            <option value="">— Selecione —</option>
            {teams
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
          </select>
        </div>

        <div className="space-y-2 rounded-md border border-emerald-950/10 bg-white/60 p-3">
          <Label htmlFor="top_scorer">Quem será o Artilheiro? (150 pts)</Label>
          <Input
            id="top_scorer"
            disabled={isLocked}
            value={topScorer}
            onChange={(e) => setTopScorer(e.target.value)}
            placeholder="Nome completo do jogador"
            maxLength={80}
          />
        </div>

        <Button onClick={onSave} disabled={busy || isLocked} className="bg-emerald-700 hover:bg-emerald-800">
          <Save className="w-4 h-4" /> {busy ? 'Salvando...' : 'Salvar palpites especiais'}
        </Button>

        <AlertDialog open={Boolean(pendingSave)} onOpenChange={(open) => !open && setPendingSave(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Atualizar palpites especiais?</AlertDialogTitle>
              <AlertDialogDescription>
                Existem {pendingSave?.existingCount || 0} palpite(s) especial(is) ja salvo(s). Os novos valores substituem os anteriores enquanto o prazo estiver aberto.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
              <Button disabled={busy} onClick={() => persistEntries(pendingSave.entries)} className="bg-emerald-700 hover:bg-emerald-800">
                {busy ? 'Salvando...' : 'Atualizar palpites'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function toDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (typeof d.seconds === 'number') return new Date(d.seconds * 1000);
  if (typeof d.toDate === 'function') return d.toDate();
  return new Date(d);
}
