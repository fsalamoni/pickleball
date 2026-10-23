/**
 * Peças comuns da ARBITRAGEM (Central, página pública e Minha área): data do
 * evento, função, situação da escala e os alertas da convocação.
 */
import React from 'react';
import { AlertTriangle, Check, TrendingUp } from 'lucide-react';
import { ASSIGNMENT_STATUS_LABELS, PROMOTION_CHECK_LABELS, REFEREE_FUNCTION_LABELS, WARNING_LABELS, isoDateBR, levelLabel, monthsBetween } from '@/modules/federations/domain/referees';
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

/**
 * Quanto falta para o próximo nível (cópia que o servidor grava no
 * cadastro). Os meses andam sozinhos: são refeitos com a data de hoje.
 */
export function PromotionProgress({ progress, className = '' }) {
  if (!progress?.next) return null;
  const hoje = isoDateBR();
  const checks = (progress.checks || []).map((c) => {
    if (c.key !== 'months' || !progress.since) return c;
    const have = monthsBetween(progress.since, hoje);
    return { ...c, have, ok: have >= c.need };
  });
  const formata = (k, v) => (v == null ? '—' : k === 'avg' ? String(v).replace('.', ',') : String(v));
  return (
    <div className={`space-y-1 rounded-xl bg-gray-50 p-3 text-sm ${className}`}>
      <p className="flex items-center gap-2 font-semibold text-ink"><TrendingUp className="h-4 w-4" aria-hidden="true" />{t('Próximo nível: {nivel}', { nivel: progress.next.label })}</p>
      {checks.length === 0
        ? <p className="text-xs text-gray-500">{t('Sem requisitos definidos: a equipe decide.')}</p>
        : (
          <ul className="space-y-0.5">
            {checks.map((c) => (
              <li key={c.key} className={`flex items-center gap-1 text-xs ${c.ok ? 'text-green-700' : 'text-gray-500'}`}>
                {c.ok ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <span className="inline-block h-3.5 w-3.5" aria-hidden="true" />}
                {t(PROMOTION_CHECK_LABELS[c.key])}: {formata(c.key, c.have)} / {formata(c.key, c.need)}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
