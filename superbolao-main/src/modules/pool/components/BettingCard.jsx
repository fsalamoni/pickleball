import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  useTournamentStaticData,
  useMatchesByStage,
  usePoolCompetitors,
  usePoolMatchesByStage,
} from '@/modules/tournament/hooks/useTournament';
import { useMyBets } from '@/modules/bets/hooks/useBets';
import { saveBets } from '@/modules/bets/services/betsService';
import {
  applyPoolDeadlineOverrides,
  getStageSectionTitle,
  getPoolStages,
  normalizePoolSettings,
  normalizeScoreValue,
  POOL_TEMPLATE_CODES,
  stageAllowsTiebreaker,
  validateSportScorePair,
} from '@/modules/pool/domain/poolSettings';
import { getPenaltyWinner, MAX_PENALTY_SCORE, normalizePenaltyScore } from '@/modules/pool/domain/penaltyShootout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MatchBetRow } from './MatchBetRow';
import { DeadlineBadge } from './DeadlineBadge';
import { SpecialBetsForm } from './SpecialBetsForm';
import { TournamentNotInitialized } from './TournamentNotInitialized';

export function BettingCard({ poolId, pool }) {
  const isCustomWithoutTournament = pool?.template_code === POOL_TEMPLATE_CODES.custom && !pool?.tournament_id;
  return isCustomWithoutTournament ? <CustomBettingCard poolId={poolId} pool={pool} /> : <WorldCupBettingCard poolId={poolId} pool={pool} />;
}

function WorldCupBettingCard({ poolId, pool }) {
  const { tournament, stages: rawStages, teams, isLoading: staticLoading } = useTournamentStaticData(pool?.tournament_id);
  const stages = useMemo(() => applyPoolDeadlineOverrides(rawStages, pool), [rawStages, pool]);
  const teamsById = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);
  const stagesByCode = useMemo(() => Object.fromEntries(stages.map((s) => [s.code, s])), [stages]);
  const [activeStage, setActiveStage] = useState('group');
  const stageTabs = getPoolStages(pool);

  if (staticLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!tournament) {
    return <TournamentNotInitialized />;
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeStage} onValueChange={setActiveStage}>
        <TabsList className="flex h-auto flex-wrap border border-emerald-950/10 bg-white/70 p-1 shadow-sm shadow-emerald-950/5">
          {stageTabs.map((s) => (
            <TabsTrigger key={s.code} value={s.code}>
              {s.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="special">Campeão & Artilheiro</TabsTrigger>
        </TabsList>

        {stageTabs.map((s) => (
          <TabsContent key={s.code} value={s.code}>
            <StageBets
              poolId={poolId}
              tournamentId={tournament.id}
              stageCode={s.code}
              stageDoc={stagesByCode[s.code]}
              teamsById={teamsById}
            />
          </TabsContent>
        ))}

        <TabsContent value="special">
          <SpecialBetsForm poolId={poolId} teams={teams} championDeadline={stagesByCode.group?.bet_lock_at} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CustomBettingCard({ poolId, pool }) {
  const stages = getPoolStages(pool);
  const settings = normalizePoolSettings(pool?.settings);
  const { competitors, isLoading } = usePoolCompetitors(poolId);
  const competitorsById = useMemo(() => Object.fromEntries(competitors.map((c) => [c.id, c])), [competitors]);
  const [activeStage, setActiveStage] = useState(stages[0]?.code || 'regular');

  if (isLoading) return <Skeleton className="h-32" />;
  if (!competitors.length) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-slate-600">
          O admin ainda precisa cadastrar competidores e jogos para liberar palpites.
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs value={activeStage} onValueChange={setActiveStage}>
      <TabsList className="flex h-auto flex-wrap border border-emerald-950/10 bg-white/70 p-1 shadow-sm shadow-emerald-950/5">
        {stages.map((s) => <TabsTrigger key={s.code} value={s.code}>{s.label}</TabsTrigger>)}
      </TabsList>
      {stages.map((s) => (
        <TabsContent key={s.code} value={s.code}>
          <CustomStageBets
            poolId={poolId}
            stage={s}
            competitorsById={competitorsById}
            sportConfig={settings.sport_config}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function CustomStageBets({ poolId, stage, competitorsById, sportConfig }) {
  const { matches, isLoading } = usePoolMatchesByStage(poolId, stage.code);
  return (
    <StageBets
      poolId={poolId}
      tournamentId={null}
      stageCode={stage.code}
      stageDoc={{ code: stage.code, label: stage.label }}
      teamsById={competitorsById}
      externalMatches={matches}
      externalLoading={isLoading}
      forcePenalty={sportConfig?.supports_penalties === true}
      sportConfig={sportConfig}
    />
  );
}

function StageBets({ poolId, tournamentId, stageCode, stageDoc, teamsById, externalMatches = null, externalLoading = false, forcePenalty = null, sportConfig = null }) {
  const { user } = useAuth();
  const tournamentMatches = useMatchesByStage(tournamentId, stageCode);
  const matches = externalMatches || tournamentMatches.matches;
  const isLoading = externalMatches ? externalLoading : tournamentMatches.isLoading;
  const { betsByMatch, isLoading: betsLoading } = useMyBets(poolId);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [pendingSave, setPendingSave] = useState(null);

  const deadline = stageDoc?.bet_lock_at ? toDate(stageDoc.bet_lock_at) : null;
  const isKnockout = forcePenalty ?? stageAllowsTiebreaker(stageDoc, sportConfig);
  const matchById = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);
  const allMatchesLocked = matches.length > 0 && matches.every((match) => isMatchLocked(match, deadline));

  // Inicializa draft com bets existentes quando os dados chegam
  useEffect(() => {
    if (!betsLoading) {
      setDraft((prev) => {
        const next = { ...prev };
        for (const m of matches) {
          if (next[m.id]) continue;
          const b = betsByMatch[m.id];
          if (b) {
            next[m.id] = {
              predicted_home: b.predicted_home,
              predicted_away: b.predicted_away,
              predicted_home_penalties: b.predicted_home_penalties ?? null,
              predicted_away_penalties: b.predicted_away_penalties ?? null,
              penalty_winner_team_id: b.penalty_winner_team_id ?? null,
            };
          }
        }
        return next;
      });
    }
  }, [betsLoading, matches, betsByMatch]);

  const onChange = (matchId, partial) => {
    setDraft((prev) => ({
      ...prev,
      [matchId]: { ...(prev[matchId] || {}), ...partial },
    }));
  };

  const buildEntries = () => {
    const entries = [];
    for (const [matchId, v] of Object.entries(draft)) {
      if (!matchById.has(matchId)) continue;
      const normalizedHome = sportConfig ? normalizeScoreValue(v.predicted_home, sportConfig) : Number(v.predicted_home) || 0;
      const normalizedAway = sportConfig ? normalizeScoreValue(v.predicted_away, sportConfig) : Number(v.predicted_away) || 0;
      const penaltyHome = normalizePenaltyScore(v.predicted_home_penalties);
      const penaltyAway = normalizePenaltyScore(v.predicted_away_penalties);
      const hasAnyPenalty = penaltyHome !== null || penaltyAway !== null;
      if (hasAnyPenalty && (penaltyHome === null || penaltyAway === null)) {
        return { error: 'Informe os dois placares dos pênaltis ou deixe o desempate em branco.', entries: [] };
      }
      if (hasAnyPenalty && penaltyHome === penaltyAway) {
        return { error: 'O placar dos pênaltis não pode terminar empatado.', entries: [] };
      }
      const validation = sportConfig ? validateSportScorePair(normalizedHome, normalizedAway, sportConfig) : { ok: true };
      if (!validation.ok) {
        return { error: validation.message, entries: [] };
      }
      const match = matchById.get(matchId);
      const penaltyWinner = hasAnyPenalty ? getPenaltyWinner(match.home_team_id, match.away_team_id, penaltyHome, penaltyAway) : null;
      entries.push({
        match_id: matchId,
        predicted_home: normalizedHome,
        predicted_away: normalizedAway,
        predicted_home_penalties: penaltyHome,
        predicted_away_penalties: penaltyAway,
        penalty_winner_team_id: penaltyWinner ?? v.penalty_winner_team_id ?? null,
        max_score: sportConfig?.max_score,
        score_step: sportConfig?.score_step,
        penalty_max_score: MAX_PENALTY_SCORE,
        penalty_score_step: 1,
      });
    }
    return { entries };
  };

  const persistEntries = async (entries, skippedLocked = 0) => {
    if (!entries.length) {
      toast.warning(skippedLocked ? 'Os jogos selecionados ja estao encerrados.' : 'Nada a salvar.');
      return;
    }

    setBusy(true);
    try {
      await saveBets(user.uid, poolId, entries, user);
      toast.success(`${entries.length} palpite(s) salvos.${skippedLocked ? ` ${skippedLocked} jogo(s) encerrado(s) nao foram alterados.` : ''}`);
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar.');
    } finally {
      setBusy(false);
      setPendingSave(null);
    }
  };

  const onSave = async () => {
    const { entries, error } = buildEntries();
    if (error) {
      toast.error(error);
      return;
    }
    if (!entries.length) {
      toast.warning('Nada a salvar.');
      return;
    }

    const unlockedEntries = entries.filter((entry) => !isMatchLocked(matchById.get(entry.match_id), deadline));
    const skippedLocked = entries.length - unlockedEntries.length;
    const existingCount = unlockedEntries.filter((entry) => betsByMatch[entry.match_id]).length;

    if (!unlockedEntries.length) {
      toast.error('Todos os jogos deste envio ja estao encerrados.');
      return;
    }

    if (existingCount > 0) {
      setPendingSave({ entries: unlockedEntries, skippedLocked, existingCount });
      return;
    }

    await persistEntries(unlockedEntries, skippedLocked);
  };

  if (isLoading || betsLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  if (!matches.length) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-slate-600">
          Os jogos desta fase ainda não foram cadastrados. Aguarde o admin.
        </CardContent>
      </Card>
    );
  }

  const grouped = groupMatchesBySection(matches);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-emerald-900/15 bg-gradient-to-br from-emerald-950 to-teal-900 text-white">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-white">Cartão de Palpites</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2 text-emerald-50/80">
              {stageDoc?.label} {deadline && <DeadlineBadge deadline={deadline} />}
            </CardDescription>
          </div>
          <Button onClick={onSave} disabled={busy || allMatchesLocked} className="bg-emerald-400 text-slate-950 hover:bg-emerald-300">
            <Save className="w-4 h-4" />
            {busy ? 'Salvando...' : 'Salvar palpites'}
          </Button>
        </CardHeader>
      </Card>

      {Object.entries(grouped).map(([groupCode, list]) => (
        <Card key={groupCode} className="overflow-hidden">
          <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4">
            <CardTitle className="text-base">
               {getStageSectionTitle(stageDoc, groupCode)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 sm:p-4">
            {list.map((m) => (
              <MatchBetRow
                key={m.id}
                match={m}
                sportConfig={sportConfig}
                homeTeam={teamsById[m.home_team_id]}
                awayTeam={teamsById[m.away_team_id]}
                zebraTeam={teamsById[m.zebra_team_id]}
                bet={draft[m.id] || null}
                locked={isMatchLocked(m, deadline)}
                onChange={onChange}
                showPenalty={isKnockout}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={Boolean(pendingSave)} onOpenChange={(open) => !open && setPendingSave(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Atualizar palpites existentes?</AlertDialogTitle>
            <AlertDialogDescription>
              Existem {pendingSave?.existingCount || 0} palpite(s) ja salvo(s) neste envio. Os palpites mais recentes substituem os anteriores nos jogos ainda abertos.
              {pendingSave?.skippedLocked ? ` ${pendingSave.skippedLocked} jogo(s) encerrado(s) nao serao alterados.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <Button disabled={busy} onClick={() => persistEntries(pendingSave.entries, pendingSave.skippedLocked)}>
              {busy ? 'Salvando...' : 'Atualizar palpites'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function groupMatchesBySection(matches) {
  const hasSections = matches.some((match) => String(match.group_code || '').trim());
  if (!hasSections) return { __flat: matches };
  return matches.reduce((acc, match) => {
    const key = String(match.group_code || '').trim() || 'Sem seção';
    (acc[key] = acc[key] || []).push(match);
    return acc;
  }, {});
}

function toDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (typeof d.seconds === 'number') return new Date(d.seconds * 1000);
  if (typeof d.toDate === 'function') return d.toDate();
  return new Date(d);
}

function isMatchLocked(match, fallbackDeadline) {
  const deadline = toDate(match?.bet_lock_at) || fallbackDeadline;
  return deadline ? deadline.getTime() <= Date.now() : false;
}
