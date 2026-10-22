/**
 * Peças comuns da ARBITRAGEM (Central, página pública e Minha área): data do
 * evento, função, situação da escala e os alertas da convocação.
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ASSIGNMENT_STATUS_LABELS, REFEREE_FUNCTION_LABELS, WARNING_LABELS, levelLabel } from '@/modules/federations/domain/referees';
import { V2Badge } from '@/v2/ui/primitives';
import { fmtData, t } from '@/core/i18n';

/** "07/11/2026" no idioma ativo (a data ISO é um dia de Brasília: meio-dia evita a virada). */
export const dataCurta = (iso) => (iso ? fmtData(`${iso}T12:00:00`, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

/** O período do evento: um dia, ou "07/11 a 08/11/2026". */
export function periodo(event) {
  if (!event?.date) return '';
  if (!event.end_date || event.end_date === event.date) return dataCurta(event.date);
  return t('{ini} a {fim}', { ini: dataCurta(event.date), fim: dataCurta(event.end_date) });
}

export const funcao = (fn) => t(REFEREE_FUNCTION_LABELS[fn] || fn || '');

const TOM = { invited: 'amber', confirmed: 'green', done: 'green', declined: 'red', no_show: 'red', replaced: 'neutral', cancelled: 'neutral' };

export function AssignmentBadge({ status }) {
  return <V2Badge tone={TOM[status] || 'neutral'}>{t(ASSIGNMENT_STATUS_LABELS[status] || status)}</V2Badge>;
}

/** Os alertas (não barram: a equipe decide). */
export function WarningsList({ warnings = [], rules, className = '' }) {
  if (!warnings?.length) return null;
  return (
    <ul className={`space-y-0.5 text-xs font-semibold text-amber-700 ${className}`}>
      {warnings.map((w) => (
        <li key={`${w.kind}${w.detail}`} className="flex items-start gap-1">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {t(WARNING_LABELS[w.kind] || w.kind)}
            {w.kind === 'same_day' && w.detail ? `: ${w.detail}` : ''}
            {w.kind === 'level_below' && w.detail ? ` (${t('mínimo: {nivel}', { nivel: levelLabel(rules, w.detail) })})` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}
