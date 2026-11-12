/**
 * Como a tabela da liga ordena: pontos corridos (quanto vale vitória, derrota
 * e W.O.) ou aproveitamento, e a ORDEM dos critérios de desempate — o mesmo
 * editor do torneio (`TiebreakOrderEditor`), com a ordem da liga como padrão.
 */
import React from 'react';
import { t } from '@/core/i18n';
import { V2Field, V2Select } from '@/v2/ui/primitives';
import { V2NumberInput } from '@/v2/ui/V2NumberInput';
import TiebreakOrderEditor from '@/v2/components/competition/TiebreakOrderEditor';
import { LEAGUE_DEFAULT_TIEBREAK_ORDER, STANDINGS_MODE, STANDINGS_MODE_LABELS } from '@/modules/leagues/domain/leagueResults';

export default function PointsFields({ value, onChange, idPrefix = 'pontos' }) {
  const s = value || {};
  const set = (patch) => onChange({ ...s, ...patch });
  const id = (k) => `${idPrefix}-${k}`;
  const campo = (k, label, padrao) => (
    <V2Field label={label} htmlFor={id(k)}>
      <V2NumberInput id={id(k)} min={0} max={10} value={s[k] ?? padrao} onChange={(e) => set({ [k]: Number(e.target.value) || 0 })} rotulo={label} />
    </V2Field>
  );
  return (
    <div className="space-y-5">
      <V2Field label={t('Classificação')} htmlFor={id('modo')}>
        <V2Select
          id={id('modo')}
          value={s.mode || STANDINGS_MODE.POINTS}
          onChange={(e) => set({ mode: e.target.value })}
          options={Object.entries(STANDINGS_MODE_LABELS).map(([v, label]) => ({ value: v, label: t(label) }))}
        />
      </V2Field>
      {(s.mode || STANDINGS_MODE.POINTS) === STANDINGS_MODE.POINTS && (
        <div className="grid gap-4 sm:grid-cols-3">
          {campo('win', t('Vitória vale'), 3)}
          {campo('loss', t('Derrota vale'), 1)}
          {campo('wo_loss', t('W.O. vale'), 0)}
        </div>
      )}
      <TiebreakOrderEditor
        label={t('Desempate entre quem fica com os mesmos pontos')}
        value={s.tiebreak_order}
        defaultOrder={LEAGUE_DEFAULT_TIEBREAK_ORDER}
        onChange={(ordem) => set({ tiebreak_order: ordem })}
      />
    </div>
  );
}
