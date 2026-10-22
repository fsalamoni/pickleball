/**
 * ARBITRAGEM da federação (Central → Arbitragem; permissão `courses` ou
 * `admin`; módulo `referees`): Escalas, Quadro, Avaliações e súmulas,
 * Diárias e Regras/níveis. Toda escrita passa pelo servidor
 * (`federationReferees`); a régua pura é `domain/referees.js`.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { useFederationCredentials } from '@/modules/federations/hooks/useFederations';
import { useFederationAssignments, useFederationReferees, useScalableEvents } from '@/modules/federations/hooks/useReferees';
import { normalizeRefereeRules } from '@/modules/federations/domain/referees';
import { fedPreviewPath } from '../profile/FedStaffBar';
import { V2Button } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import RefScalesTab from '../referees/RefScalesTab';
import RefRosterTab from '../referees/RefRosterTab';
import RefReportsTab from '../referees/RefReportsTab';
import RefFeesTab from '../referees/RefFeesTab';
import RefRulesTab from '../referees/RefRulesTab';

export default function FedRefereesPanel({ federation, tab = 'arbitragem' }) {
  const rules = normalizeRefereeRules(federation.referee_rules);
  const rosterQ = useFederationReferees(federation.id, { enabled: tab !== 'arbitragem-regras' });
  const assignmentsQ = useFederationAssignments(federation.id, { enabled: tab !== 'arbitragem-regras' && tab !== 'arbitragem-quadro' });
  const eventsQ = useScalableEvents(federation, { enabled: tab === 'arbitragem' });
  const credentialsQ = useFederationCredentials(federation.id, { enabled: tab === 'arbitragem-quadro' });
  return (
    <div className="space-y-4" data-dica="federacao-arbitragem">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{t('Arbitragem')}</h2>
          <p className="text-sm text-gray-500">{t('Quadro de árbitros por nível, escalas com convocação e confirmação, alertas de impedimento, súmulas, avaliações e diárias. Valores, notas e conflitos só a equipe e o próprio árbitro veem.')}</p>
        </div>
        <V2Button asChild variant="secondary" size="sm"><Link to={`${fedPreviewPath(federation)}#fed-arbitragem`}><Eye className="h-4 w-4" />{t('Ver como o público vê')}</Link></V2Button>
      </div>
      {tab === 'arbitragem' && <RefScalesTab federation={federation} rules={rules} rosterQ={rosterQ} assignmentsQ={assignmentsQ} eventsQ={eventsQ} />}
      {tab === 'arbitragem-quadro' && <RefRosterTab federation={federation} rules={rules} rosterQ={rosterQ} credentialsQ={credentialsQ} />}
      {tab === 'arbitragem-avaliacoes' && <RefReportsTab federation={federation} assignmentsQ={assignmentsQ} />}
      {tab === 'arbitragem-diarias' && <RefFeesTab federation={federation} assignmentsQ={assignmentsQ} />}
      {tab === 'arbitragem-regras' && <RefRulesTab key={JSON.stringify(federation.referee_rules || {})} federation={federation} rules={rules} />}
    </div>
  );
}
