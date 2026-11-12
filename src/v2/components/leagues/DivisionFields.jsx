/**
 * Os campos de UMA divisão da liga: nome, categoria, regra de nível (aberta,
 * faixa de DUPR ou soma do DUPR) e limite de inscritos. O mesmo no assistente
 * de criação e na gestão. Quem confere de verdade é o servidor.
 */
import React from 'react';
import { t, tk } from '@/core/i18n';
import { V2Field, V2Input, V2Select, V2Toggle } from '@/v2/ui/primitives';
import { V2NumberInput } from '@/v2/ui/V2NumberInput';
import { DIVISION_GENDER_LABELS, DIVISION_RULE, DIVISION_RULE_LABELS } from '@/modules/leagues/domain/leagueDivisions';

/** Divisões sugeridas por faixa de DUPR (o organizador ajusta depois). */
export const SUGGESTED_DIVISIONS = Object.freeze([
  { name: tk('Iniciante'), gender: 'open', rule: { kind: 'dupr_range', min: '', max: '3.000', allow_unrated: true }, max_entries: 0 },
  { name: tk('Intermediário'), gender: 'open', rule: { kind: 'dupr_range', min: '3.000', max: '3.750', allow_unrated: true }, max_entries: 0 },
  { name: tk('Avançado'), gender: 'open', rule: { kind: 'dupr_range', min: '3.750', max: '4.500', allow_unrated: false }, max_entries: 0 },
  { name: tk('Elite'), gender: 'open', rule: { kind: 'dupr_range', min: '4.500', max: '', allow_unrated: false }, max_entries: 0 },
]);

export const emptyDivision = (n = 1) => ({ name: t('Divisão {n}', { n }), gender: 'open', rule: { kind: 'open' }, max_entries: 0 });

export default function DivisionFields({ value, onChange, idPrefix, pairs = true }) {
  const d = value || {};
  const rule = d.rule || { kind: 'open' };
  const set = (patch) => onChange({ ...d, ...patch });
  const setRule = (patch) => set({ rule: { ...rule, ...patch } });
  const id = (k) => `${idPrefix}-${k}`;
  const generos = Object.entries(DIVISION_GENDER_LABELS)
    .filter(([k]) => pairs || k !== 'mixed')
    .map(([value, label]) => ({ value, label: t(label) }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <V2Field label={t('Nome da divisão')} htmlFor={id('nome')} required>
          <V2Input id={id('nome')} value={d.name || ''} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
        </V2Field>
        <V2Field label={t('Categoria')} htmlFor={id('genero')}>
          <V2Select id={id('genero')} value={d.gender || 'open'} onChange={(e) => set({ gender: e.target.value })} options={generos} />
        </V2Field>
      </div>

      <V2Field label={t('Nível de quem pode entrar')} htmlFor={id('regra')} hint={t('Pelo DUPR que está no perfil de cada atleta.')}>
        <V2Select
          id={id('regra')}
          value={rule.kind || 'open'}
          onChange={(e) => set({ rule: { kind: e.target.value } })}
          options={Object.entries(DIVISION_RULE_LABELS).map(([value, label]) => ({ value, label: t(label) }))}
        />
      </V2Field>

      {rule.kind === DIVISION_RULE.DUPR_RANGE && (
        <div className="space-y-3 rounded-2xl bg-paper p-4">
          <div className="grid grid-cols-2 gap-3">
            <V2Field label={t('DUPR mínimo')} htmlFor={id('min')} hint={t('Em branco: sem piso.')}>
              <V2Input id={id('min')} type="number" inputMode="decimal" step="0.001" min="2" max="8" value={rule.min ?? ''} onChange={(e) => setRule({ min: e.target.value })} />
            </V2Field>
            <V2Field label={t('DUPR máximo')} htmlFor={id('max')} hint={t('Em branco: sem teto.')}>
              <V2Input id={id('max')} type="number" inputMode="decimal" step="0.001" min="2" max="8" value={rule.max ?? ''} onChange={(e) => setRule({ max: e.target.value })} />
            </V2Field>
          </div>
          <p className="text-xs leading-5 text-gray-500">
            {pairs ? t('Vale a média do DUPR da dupla.') : t('Vale o DUPR do atleta.')}
          </p>
          <V2Toggle
            id={id('sem-dupr')}
            checked={rule.allow_unrated !== false}
            onChange={(v) => setRule({ allow_unrated: v })}
            label={t('Aceitar quem ainda não tem DUPR')}
            hint={t('Desligado, todo atleta precisa ter o DUPR no perfil.')}
          />
        </div>
      )}

      {rule.kind === DIVISION_RULE.DUPR_SUM && (
        <div className="space-y-3 rounded-2xl bg-paper p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <V2Field label={t('Teto da soma')} htmlFor={id('teto')}>
              <V2Input id={id('teto')} type="number" inputMode="decimal" step="0.001" min="2" max="40" value={rule.cap ?? ''} onChange={(e) => setRule({ cap: e.target.value })} />
            </V2Field>
            <V2Field label={t('Teto individual')} htmlFor={id('teto-ind')} hint={t('Em branco: sem teto.')}>
              <V2Input id={id('teto-ind')} type="number" inputMode="decimal" step="0.001" min="2" max="8" value={rule.individual_cap ?? ''} onChange={(e) => setRule({ individual_cap: e.target.value })} />
            </V2Field>
            <V2Field label={t('Valor de quem não tem DUPR')} htmlFor={id('sem-valor')}>
              <V2Input id={id('sem-valor')} type="number" inputMode="decimal" step="0.001" min="2" max="8" value={rule.unrated_value ?? '3.000'} onChange={(e) => setRule({ unrated_value: e.target.value })} />
            </V2Field>
          </div>
          <p className="text-xs leading-5 text-gray-500">{t('Soma o DUPR de todos os atletas da inscrição. Quem não tem DUPR entra com o valor acima.')}</p>
        </div>
      )}

      <V2Field label={t('Limite de inscrições')} htmlFor={id('limite')} hint={t('0 = sem limite (até 32).')}>
        <V2NumberInput
          id={id('limite')}
          className="max-w-[12rem]"
          min={0}
          max={32}
          value={Number(d.max_entries) || 0}
          onChange={(e) => set({ max_entries: Number(e.target.value) || 0 })}
          rotulo={t('Limite de inscrições')}
        />
      </V2Field>
    </div>
  );
}
