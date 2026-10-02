import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarRange, Clock, Sun } from 'lucide-react';
import { msUntilReset, formatTimeLeft } from '@/modules/progression/domain/missionDay';
import { MISSION_BONUS_XP } from '@/modules/progression/domain/missions';
import MissionList from '@/modules/progression/components/MissionList';
import { V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';

const SCOPES = [
  { value: 'daily', label: 'Hoje', icon: Sun, dica: 'missoes-hoje' },
  { value: 'weekly', label: 'Semana', icon: CalendarDays, dica: 'missoes-semana', module: 'missions_weekly' },
  { value: 'monthly', label: 'Mês', icon: CalendarRange, dica: 'missoes-mes', module: 'missions_monthly' },
];

const RESET_TEXT = {
  daily: 'Novas missões à meia-noite (horário de Brasília)',
  weekly: 'A semana vira na segunda-feira',
  monthly: 'O mês vira no dia 1º',
};

/** Tempo que falta para virar o período, atualizado a cada 30 s. */
function useTimeLeft(scope) {
  const [ms, setMs] = useState(() => msUntilReset(scope));
  useEffect(() => {
    setMs(msUntilReset(scope));
    const id = setInterval(() => setMs(msUntilReset(scope)), 30_000);
    return () => clearInterval(id);
  }, [scope]);
  return ms;
}

function ScopeBody({ scope, m, onTrack }) {
  const left = useTimeLeft(scope);
  const list = useMemo(() => (m?.missions || []).map((x) => ({
    ...x,
    done: (x.current || 0) >= (x.target || 1),
    xpReward: x.xp,
    description: x.description || x.title,
  })), [m?.missions]);

  if (!m || m.isLoading) return <V2Skeleton className="h-48 rounded-3xl" />;
  if (m.isError) return <V2ErrorState inline title="Não deu para carregar as missões" onRetry={m.refetch} />;
  return (
    <div className="space-y-3" data-testid={`missions-${scope}`}>
      <p className="flex items-center gap-1.5 text-xs text-gray-500">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        {RESET_TEXT[scope]} · <strong className="text-ink">{formatTimeLeft(left)}</strong>
      </p>
      <MissionList
        missions={list}
        scope={scope}
        bonusClaimed={m.doc?.bonusClaimed || false}
        onClaimBonus={() => { onTrack?.(scope, MISSION_BONUS_XP[scope]); m.claimBonus(); }}
      />
      {m.claimError && <p role="alert" className="text-xs text-red-600">Não deu para resgatar o bônus agora. Tente de novo.</p>}
      <p className="text-[11px] leading-4 text-gray-400">
        O progresso é medido pela sua atividade real — jogos, torneios, reservas, avaliações. Não há botão de marcar.
      </p>
    </div>
  );
}

/**
 * As missões do dia, da semana e do mês. Presentacional: quem busca e sincroniza
 * é o hub (uma instância de `useScopedMissions` por período, para não gravar duas vezes).
 *
 * @param {{ scopes: Record<'daily'|'weekly'|'monthly', object>, isModuleOn: (id: string) => boolean, onTrack?: Function, initial?: string }} props
 */
export default function MissionsPanel({ scopes, isModuleOn, onTrack, initial = 'daily' }) {
  const tabs = SCOPES.filter((s) => !s.module || isModuleOn(s.module))
    .map((s) => {
      const lista = scopes[s.value]?.missions || [];
      const feitas = lista.filter((x) => (x.current || 0) >= (x.target || 1)).length;
      return { ...s, label: lista.length ? `${s.label} ${feitas}/${lista.length}` : s.label };
    });
  const [scope, setScope] = useState(initial);
  const ativo = tabs.some((t) => t.value === scope) ? scope : 'daily';
  return (
    <V2Surface className="space-y-4" data-dica="missoes">
      {tabs.length > 1 && (
        <V2SubTabs tabs={tabs} activeValue={ativo} onSelect={(t) => setScope(t.value)} ariaLabel="Período das missões" />
      )}
      <ScopeBody key={ativo} scope={ativo} m={scopes[ativo]} onTrack={onTrack} />
    </V2Surface>
  );
}
