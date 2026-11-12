/**
 * Os campos de UMA divisão da liga: nome, categoria, nível e limite de
 * inscritos. O mesmo no assistente de criação e na gestão. Quem confere de
 * verdade é o servidor.
 *
 * O nível é a lista OFICIAL de faixas da plataforma (`core/domain/levelBrackets`,
 * a mesma da Carreira e do torneio). A faixa numérica confere o DUPR; a
 * descritiva é o nome da divisão e não barra ninguém. A soma do DUPR só
 * aparece em formato de equipe (o modelo da MiLP); a faixa de DUPR digitada da
 * primeira versão continua editável na divisão que já a usa.
 */
import React from 'react';
import { t, fmtNumero } from '@/core/i18n';
import { V2Field, V2Input, V2Select, V2Toggle } from '@/v2/ui/primitives';
import { V2NumberInput } from '@/v2/ui/V2NumberInput';
import { bracketRange, levelBracketOptions, levelBracketText } from '@/core/domain/levelBrackets';
import { DIVISION_GENDER_LABELS, DIVISION_RULE, DIVISION_RULE_LABELS } from '@/modules/leagues/domain/leagueDivisions';

/** As faixas numéricas da lista oficial, uma divisão cada (o organizador ajusta depois). */
const SUGERIDAS = ['2.000-2.999', '3.000-3.499', '3.500-3.999', '4.000-4.499', '4.500+'];

export const suggestedDivisions = () => SUGERIDAS.map((bracket) => ({
  name: levelBracketText(bracket), gender: 'open', rule: { kind: DIVISION_RULE.BRACKET, bracket, allow_unrated: true }, max_entries: 0,
}));

export const emptyDivision = (n = 1) => ({ name: t('Divisão {n}', { n }), gender: 'open', rule: { kind: 'open' }, max_entries: 0 });

const tres = (n) => fmtNumero(n, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function DivisionFields({ value, onChange, idPrefix, pairs = true, teams = false }) {
  const d = value || {};
  const rule = d.rule || { kind: 'open' };
  const set = (patch) => onChange({ ...d, ...patch });
  const setRule = (patch) => set({ rule: { ...rule, ...patch } });
  const id = (k) => `${idPrefix}-${k}`;
  const generos = Object.entries(DIVISION_GENDER_LABELS)
    .filter(([k]) => pairs || k !== 'mixed')
    .map(([value, label]) => ({ value, label: t(label) }));
  const kinds = [DIVISION_RULE.OPEN, DIVISION_RULE.BRACKET]
    .concat(teams || rule.kind === DIVISION_RULE.DUPR_SUM ? [DIVISION_RULE.DUPR_SUM] : [])
    .concat(rule.kind === DIVISION_RULE.DUPR_RANGE ? [DIVISION_RULE.DUPR_RANGE] : []);
  const faixa = rule.kind === DIVISION_RULE.BRACKET ? bracketRange(rule.bracket) : null;

  function escolherFaixa(bracket) {
    // O nome acompanha a faixa enquanto a pessoa não escreveu um nome próprio.
    const nomeAutomatico = !d.name?.trim() || d.name === levelBracketText(rule.bracket, rule.label) || /^\D+ \d+$/.test(d.name);
    onChange({ ...d, ...(nomeAutomatico && bracket !== 'other' ? { name: levelBracketText(bracket) } : {}), rule: { ...rule, bracket } });
  }

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
          onChange={(e) => set({ rule: e.target.value === DIVISION_RULE.BRACKET ? { kind: DIVISION_RULE.BRACKET, bracket: '3.000-3.499', allow_unrated: true } : { kind: e.target.value } })}
          options={kinds.map((k) => ({ value: k, label: t(DIVISION_RULE_LABELS[k]) }))}
        />
      </V2Field>

      {rule.kind === DIVISION_RULE.BRACKET && (
        <div className="space-y-3 rounded-2xl bg-paper p-4">
          <V2Field label={t('Faixa de nível')} htmlFor={id('faixa')} hint={t('A lista oficial da plataforma, a mesma da Carreira e dos torneios.')}>
            <V2Select id={id('faixa')} value={rule.bracket || ''} onChange={(e) => escolherFaixa(e.target.value)} options={levelBracketOptions(rule.bracket)} />
          </V2Field>
          {rule.bracket === 'other' && (
            <V2Field label={t('Nome da faixa')} htmlFor={id('faixa-nome')}>
              <V2Input id={id('faixa-nome')} value={rule.label || ''} maxLength={40} onChange={(e) => setRule({ label: e.target.value })} />
            </V2Field>
          )}
          {faixa ? (
            <>
              <p className="text-xs leading-5 text-gray-500">
                {faixa.max != null
                  ? t('Entra quem tem DUPR de {min} a {max}.', { min: tres(faixa.min), max: tres(faixa.max) })
                  : t('Entra quem tem DUPR a partir de {min}.', { min: tres(faixa.min) })}
                {' '}{pairs ? t('Vale a média do DUPR da dupla.') : t('Vale o DUPR do atleta.')}
              </p>
              <V2Toggle
                id={id('sem-dupr')}
                checked={rule.allow_unrated !== false}
                onChange={(v) => setRule({ allow_unrated: v })}
                label={t('Aceitar quem ainda não tem DUPR')}
                hint={t('Desligado, todo atleta precisa ter o DUPR no perfil.')}
              />
            </>
          ) : (
            <p className="text-xs leading-5 text-gray-500">{t('É o nome da divisão: ninguém é barrado pelo nível. A organização confere quem entra.')}</p>
          )}
        </div>
      )}

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
