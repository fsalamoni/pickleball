/**
 * Peças pequenas das telas da LIGA: selo da situação, texto da regra da
 * divisão, a data curta e o id da pessoa. Nada aqui consulta o banco.
 */
import React from 'react';
import { t, fmtData, fmtNumero } from '@/core/i18n';
import { V2Badge } from '@/v2/ui/primitives';
import { LEAGUE_STATUS_LABELS, formatMeta } from '@/modules/leagues/domain/leagueFormats';
import { DIVISION_GENDER_LABELS, describeDivisionRule } from '@/modules/leagues/domain/leagueDivisions';

const STATUS_TONE = { draft: 'neutral', open: 'green', running: 'blue', finished: 'neutral', cancelled: 'red' };

export function LeagueStatusBadge({ status }) {
  return <V2Badge tone={STATUS_TONE[status] || 'neutral'}>{t(LEAGUE_STATUS_LABELS[status] || status || '')}</V2Badge>;
}

const tres = (n) => fmtNumero(Number(n), { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** "DUPR 3,500 a 4,000", "Soma até 16,300 (ninguém acima de 4,600)", "Aberta a todos os níveis". */
export function divisionRuleText(division) {
  const d = describeDivisionRule(division, tres);
  if (d.key === 'bracket') return d.numeric ? t('DUPR: {faixa}', { faixa: d.text }) : d.text;
  if (d.key === 'range') return t('DUPR {min} a {max}', d);
  if (d.key === 'min') return t('DUPR a partir de {min}', d);
  if (d.key === 'max') return t('DUPR até {max}', d);
  if (d.key === 'sum') return t('Soma do DUPR até {cap}', d);
  if (d.key === 'sum_ind') return t('Soma do DUPR até {cap} (ninguém acima de {ind})', d);
  return t('Aberta a todos os níveis');
}

/** Regra + gênero numa linha ("Mista · DUPR 3,500 a 4,000"). */
export function divisionSummary(division) {
  const g = division?.gender && division.gender !== 'open' ? `${t(DIVISION_GENDER_LABELS[division.gender])} · ` : '';
  return `${g}${divisionRuleText(division)}`;
}

/** Quem se inscreve: "equipe", "dupla" ou "atleta". */
export const entryNoun = (format, plural = false) => {
  const meta = formatMeta(format);
  if (meta?.entry === 'team') return plural ? t('equipes') : t('equipe');
  const duplas = meta?.players === 2;
  if (plural) return duplas ? t('duplas') : t('atletas');
  return duplas ? t('dupla') : t('atleta');
};

/** "12 de nov." para uma data ISO (AAAA-MM-DD), no fuso local. */
export const shortDate = (iso) => (iso ? fmtData(`${iso}T12:00:00`, { day: '2-digit', month: 'short' }) : '');

/** O id de uma pessoa vinda do diretório. */
export const personUid = (p) => p?.user_id || p?.uid || p?.id || null;
