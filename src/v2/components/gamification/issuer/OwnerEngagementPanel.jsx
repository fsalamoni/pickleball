import React, { useState } from 'react';
import { Gift, LineChart, Trophy } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useGamificationConfig } from '@/modules/progression/hooks/useGamificationConfig';
import { V2EmptyState } from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import IssuerChallengesManager from './IssuerChallengesManager';
import IssuerRewardsManager from './IssuerRewardsManager';
import GoalsCard from './GoalsCard';
import { Sparkles } from 'lucide-react';

/**
 * A moldura do "Engajamento" de quem oferece — professor, arena ou clube:
 * Resumo (saúde, sugestões e metas), Desafios e Recompensas. Cada parte some se
 * o admin desligou o módulo. O conteúdo do resumo é de cada um (`summary`).
 *
 * @param {{
 *   ownerType: 'coach'|'arena'|'club', issuer: { type: string, id: string, name?: string },
 *   summary: React.ReactNode, actuals: Record<string, number|null>, monthKey: string,
 * }} props
 */
export default function OwnerEngagementPanel({ ownerType, issuer, summary, actuals, monthKey }) {
  const on = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);
  const { user } = useAuth();
  const { isModuleOn } = useGamificationConfig();
  const [aba, setAba] = useState('resumo');

  if (!on || (!isModuleOn('supply_panels') && !isModuleOn('challenges') && !isModuleOn('rewards'))) {
    return <V2EmptyState icon={Sparkles} title="O engajamento ainda não está ligado" description="Quando a plataforma ativar a gamificação para quem oferece aulas, quadras e clubes, o resumo, os desafios e as recompensas aparecem aqui." />;
  }

  const tabs = [
    isModuleOn('supply_panels') && { value: 'resumo', label: 'Resumo', icon: LineChart, dica: 'oferta-aba-resumo' },
    isModuleOn('challenges') && { value: 'desafios', label: 'Desafios', icon: Trophy, dica: 'oferta-aba-desafios' },
    isModuleOn('rewards') && { value: 'recompensas', label: 'Recompensas', icon: Gift, dica: 'oferta-aba-recompensas' },
  ].filter(Boolean);
  const ativa = tabs.some((t) => t.value === aba) ? aba : tabs[0].value;
  const actor = { uid: user?.uid, email: user?.email, displayName: user?.displayName };

  return (
    <div className="space-y-4" data-testid="owner-engagement">
      {tabs.length > 1 && <V2SubTabs tabs={tabs} activeValue={ativa} onSelect={(t) => setAba(t.value)} ariaLabel="Engajamento" />}
      {ativa === 'resumo' && (
        <div className="space-y-4">
          {summary}
          <GoalsCard ownerType={ownerType} ownerId={issuer.id} monthKey={monthKey} actuals={actuals} />
        </div>
      )}
      {ativa === 'desafios' && <IssuerChallengesManager issuer={issuer} actor={actor} />}
      {ativa === 'recompensas' && <IssuerRewardsManager issuer={issuer} actor={actor} />}
    </div>
  );
}
