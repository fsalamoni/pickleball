import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { RefreshCw, Sprout } from 'lucide-react';
import { db, functions } from '@/core/config/firebase';
import { useTournamentStaticData, useMatchesByStage } from '@/modules/tournament/hooks/useTournament';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getPenaltyWinner, MAX_PENALTY_SCORE, normalizePenaltyScore } from '@/modules/pool/domain/penaltyShootout';

const STAGES = ['group', 'r16', 'qf', 'sf', 'semi', 'third', 'final'];

export default function AdminMatches() {
  const { tournament, teams, isLoading } = useTournamentStaticData();
  const teamsById = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);
  const [tab, setTab] = useState('group');

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }
  if (!tournament) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <p className="text-sm text-slate-700">Torneio não inicializado.</p>
          <Button asChild>
            <Link to="/admin/seed">
              <Sprout className="w-4 h-4" />
              Ir para o seed inicial
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Card className="overflow-hidden border-emerald-900/15 bg-gradient-to-br from-emerald-950 to-teal-900 text-white">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-white">Jogos & Resultados</CardTitle>
            <CardDescription className="text-emerald-50/80">Edite placares oficiais, pênaltis e zebras. Ao marcar como finalizado, o scoring engine processa os pontos.</CardDescription>
          </div>
          <FifaSyncButton tournamentId={tournament.id} />
        </CardHeader>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap border border-emerald-950/10 bg-white/70 p-1 shadow-sm shadow-emerald-950/5">
          {STAGES.map((s) => (
            <TabsTrigger key={s} value={s}>{stageLabel(s)}</TabsTrigger>
          ))}
        </TabsList>
        {STAGES.map((s) => (
          <TabsContent key={s} value={s} className="mt-3">
            <StageMatches tournamentId={tournament.id} stageCode={s} teamsById={teamsById} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function FifaSyncButton({ tournamentId }) {
  const [busy, setBusy] = useState(false);

  const onSync = async () => {
    setBusy(true);
    try {
      const syncFifaResults = httpsCallable(functions, 'syncFifaResults');
      const result = await syncFifaResults({ tournament_id: tournamentId });
      const summary = result.data || {};
      toast.success(`FIFA: ${summary.updated || 0} jogos atualizados, ${summary.linked || 0} vinculados, ${summary.unmatched || 0} sem correspondência.`);
    } catch (err) {
      toast.error(err.message || 'Não foi possível sincronizar com a FIFA.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={onSync} disabled={busy} title="Buscar placares no calendário oficial da FIFA" className="border-emerald-300/40 bg-white/10 text-white hover:bg-white/20 hover:text-white">
      <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
      {busy ? 'Atualizando' : 'Atualizar via FIFA'}
    </Button>
  );
}

function stageLabel(s) {
  return { group: 'Grupos', r16: '16-avos', qf: 'Oitavas', sf: 'Quartas', semi: 'Semis', third: '3º', final: 'Final' }[s] || s;
}

function StageMatches({ tournamentId, stageCode, teamsById }) {
  const { matches, isLoading } = useMatchesByStage(tournamentId, stageCode);
  if (isLoading) return <Skeleton className="h-32" />;
  if (!matches.length) return <p className="rounded-md border border-emerald-950/10 bg-white/60 p-4 text-sm text-slate-500">Nenhum jogo cadastrado nesta fase.</p>;
  return (
    <div className="space-y-2">
      {matches.map((m) => (
        <AdminMatchRow key={m.id} match={m} teamsById={teamsById} />
      ))}
    </div>
  );
}

function AdminMatchRow({ match, teamsById }) {
  const home = teamsById[match.home_team_id]?.name || match.home_placeholder || '—';
  const away = teamsById[match.away_team_id]?.name || match.away_placeholder || '—';
  const [hs, setHs] = useState(match.official_home_score ?? '');
  const [as, setAs] = useState(match.official_away_score ?? '');
  const [phs, setPhs] = useState(match.official_home_penalties ?? '');
  const [pas, setPas] = useState(match.official_away_penalties ?? '');
  const [zebraTeamId, setZebraTeamId] = useState(match.zebra_team_id ?? '');
  const [zebraMultiplier, setZebraMultiplier] = useState(match.zebra_multiplier ? String(match.zebra_multiplier) : '2');
  const [busy, setBusy] = useState(false);
  const hasScore = hs !== '' && as !== '';
  const penaltyEligible = match.stage_code !== 'group' && hasScore && Number(hs) === Number(as) && match.home_team_id && match.away_team_id;
  const hasAnyPenaltyScore = phs !== '' || pas !== '';
  const hasCompletePenaltyScore = phs !== '' && pas !== '';
  const zebraOptions = [
    match.home_team_id ? { id: match.home_team_id, label: home } : null,
    match.away_team_id ? { id: match.away_team_id, label: away } : null,
  ].filter(Boolean);

  const onSave = async () => {
    setBusy(true);
    try {
      if (penaltyEligible && !hasCompletePenaltyScore) {
        toast.error('Jogo empatado em mata-mata precisa do placar dos pênaltis.');
        setBusy(false);
        return;
      }
      if (penaltyEligible && Number(phs) === Number(pas)) {
        toast.error('O placar dos pênaltis não pode terminar empatado.');
        setBusy(false);
        return;
      }
      const penaltyWinnerTeamId = penaltyEligible && hasAnyPenaltyScore ? getPenaltyWinner(match.home_team_id, match.away_team_id, phs, pas) : null;
      const selectedZebra = zebraOptions.some((team) => team.id === zebraTeamId) ? zebraTeamId : '';
      const normalizedMultiplier = selectedZebra ? Math.max(2, Math.min(4, Number(zebraMultiplier) || 2)) : null;
      const updates = {
        official_home_score: hs === '' ? null : Number(hs),
        official_away_score: as === '' ? null : Number(as),
        official_home_penalties: penaltyEligible && hasAnyPenaltyScore ? normalizePenaltyScore(phs) : null,
        official_away_penalties: penaltyEligible && hasAnyPenaltyScore ? normalizePenaltyScore(pas) : null,
        penalty_winner_team_id: penaltyWinnerTeamId,
        zebra_team_id: selectedZebra || null,
        zebra_multiplier: normalizedMultiplier,
        status: hs !== '' && as !== '' ? 'finished' : 'scheduled',
        updated_at: serverTimestamp(),
      };
      await updateDoc(doc(db, 'matches', match.id), updates);
      toast.success(`Resultado salvo: ${home} ${updates.official_home_score ?? '?'} × ${updates.official_away_score ?? '?'} ${away}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="match-surface p-3 grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_minmax(13rem,auto)_minmax(13rem,auto)_auto] gap-2 items-center">
      <div className="text-right text-sm font-medium truncate">{home}</div>
      <div className="flex items-center gap-1">
        <Input type="number" min={0} value={hs} onChange={(e) => setHs(e.target.value)} className="w-16 text-center" />
        <span>×</span>
        <Input type="number" min={0} value={as} onChange={(e) => setAs(e.target.value)} className="w-16 text-center" />
      </div>
      <div className="text-left text-sm font-medium truncate">{away}</div>
      <div className="flex items-center justify-center gap-1 text-xs">
        <span className="text-slate-500">Pen.</span>
        <Input type="number" min={0} max={MAX_PENALTY_SCORE} value={penaltyEligible ? phs : ''} onChange={(e) => setPhs(e.target.value)} disabled={!penaltyEligible} className="w-14 text-center text-xs" />
        <span>×</span>
        <Input type="number" min={0} max={MAX_PENALTY_SCORE} value={penaltyEligible ? pas : ''} onChange={(e) => setPas(e.target.value)} disabled={!penaltyEligible} className="w-14 text-center text-xs" />
      </div>
      <div className="flex items-center gap-1">
        <select value={zebraTeamId} onChange={(e) => setZebraTeamId(e.target.value)} className="text-xs h-8 min-w-0 flex-1 rounded border px-1" title="Time-zebra definido pelo Admin da plataforma">
          <option value="">Sem zebra</option>
          {zebraOptions.map((team) => <option key={team.id} value={team.id}>Zebra: {team.label}</option>)}
        </select>
        <Input
          type="number"
          min={2}
          max={4}
          value={zebraMultiplier}
          onChange={(e) => setZebraMultiplier(e.target.value)}
          disabled={!zebraTeamId}
          className="w-14 text-center text-xs"
          title="Multiplicador da zebra"
        />
      </div>
      <Button size="sm" onClick={onSave} disabled={busy}>{busy ? '…' : 'Salvar'}</Button>
    </div>
  );
}
