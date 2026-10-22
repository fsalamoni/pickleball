/**
 * O que uma categoria de torneio da federação pede e quanto vale — para o
 * organizador antes de pedir a chancela e para a equipe antes de aprovar.
 */
import React from 'react';
import { t, tn } from '@/core/i18n';

export default function FedTierRequirements({ tier }) {
  if (!tier) return null;
  const req = tier.requirements || {};
  const linhas = [
    t('Campeão {p} pontos · tabela até o {n}º · participação {q}', { p: tier.points_by_place?.[1] ?? 0, n: tier.places || 1, q: tier.participation ?? 0 }),
    req.min_entrants ? tn(req.min_entrants, 'Mínimo de {n} inscrição', 'Mínimo de {n} inscrições') : '',
    req.prize ? t('Premiação mínima: {p}', { p: req.prize }) : '',
    req.notes || '',
  ].filter(Boolean);
  return <ul className="space-y-1 rounded-2xl bg-paper p-3 text-xs text-gray-600">{linhas.map((l) => <li key={l}>{l}</li>)}</ul>;
}
