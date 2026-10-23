/**
 * Peças comuns da LICENÇA DE PROFESSOR (Central e Minha área): a situação da
 * licença e os requisitos que o servidor conferiu para um nível. Leves de
 * propósito: a Minha área importa daqui sem puxar o painel da Central.
 */
import React from 'react';
import { LICENSE_REQ_LABELS, LICENSE_STATUS_LABELS, licenseState } from '@/modules/federations/domain/coachLicenses';
import { isoDateBR } from '@/modules/federations/domain/referees';
import { V2Badge } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { dataCurta } from '../referees/refUi';

const TOM = { pending: 'amber', active: 'green', declined: 'neutral', suspended: 'red', revoked: 'red', expired: 'neutral' };

/** A situação da licença hoje, com o pedido de renovação junto. */
export function LicenseBadge({ lic, hoje = isoDateBR() }) {
  const s = licenseState(lic, hoje);
  return (
    <span className="inline-flex flex-wrap gap-1">
      <V2Badge tone={TOM[s.status] || 'neutral'}>{t(LICENSE_STATUS_LABELS[s.status] || s.status)}</V2Badge>
      {s.renewing && <V2Badge tone="amber">{t('renovação pedida')}</V2Badge>}
      {s.expiring && !s.renewing && <V2Badge tone="amber">{t('vence em breve')}</V2Badge>}
    </span>
  );
}

/** O que o servidor conferiu para o nível: credencial, horas e proteção de menores. */
export function RequirementsList({ req }) {
  if (!req?.level) return null;
  const linha = (ok, rotulo, detalhe) => (
    <li className={`flex items-start gap-2 text-sm ${ok ? 'text-gray-700' : 'font-semibold text-red-700'}`}>
      <span aria-hidden="true">{ok ? '✓' : '✗'}</span>
      <span>{rotulo}{detalhe ? ` · ${detalhe}` : ''}<span className="sr-only">{ok ? ` (${t('em dia')})` : ` (${t('falta')})`}</span></span>
    </li>
  );
  return (
    <ul className="space-y-1">
      {req.credential.required && linha(req.credential.ok, t(LICENSE_REQ_LABELS.credential), req.credential.found ? [req.credential.found.course_name, req.credential.found.valid_until && t('até {data}', { data: dataCurta(req.credential.found.valid_until) })].filter(Boolean).join(' · ') : t('nenhuma credencial do nível'))}
      {req.hours.needed > 0 && linha(req.hours.ok, t(LICENSE_REQ_LABELS.hours), t('{feitas} de {precisa} h', { feitas: req.hours.done, precisa: req.hours.needed }))}
      {req.safeguarding.required && linha(req.safeguarding.ok, t(LICENSE_REQ_LABELS.safeguarding), req.safeguarding.until ? t('até {data}', { data: dataCurta(req.safeguarding.until) }) : '')}
    </ul>
  );
}

