/**
 * Como a tabela da liga ordena: pontos corridos (quanto vale vitória, derrota
 * e W.O.) ou aproveitamento, e a ORDEM dos critérios de desempate — o mesmo
 * editor do torneio (`TiebreakOrderEditor`), com a ordem da liga como padrão.
 * Na ESCADA (`ladder`) não há pontos: a classificação é a posição, e o editor
 * decide só quem fica à frente na quadra (sem confronto direto).
 */
import React from 'react';
import { t } from '@/core/i18n';
import { V2Field, V2Select } from '@/v2/ui/primitives';
import { V2NumberInput } from '@/v2/ui/V2NumberInput';
import TiebreakOrderEditor from '@/v2/components/competition/TiebreakOrderEditor';
import { LEAGUE_DEFAULT_TIEBREAK_ORDER, STANDINGS_MODE, STANDINGS_MODE_LABELS } from '@/modules/leagues/domain/leagueResults';
import { LADDER_DEFAULT_ORDER, LADDER_TIEBREAK_KEYS } from '@/modules/leagues/domain/leagueLadder';

export default function PointsFields({ value, onChange, idPrefix = 'pontos', ladder = false }) {
  const s = value || {};
  const set = (patch) => onChange({ ...s, ...patch });
  if (ladder) {
    return (
      <div className="space-y-3">
        <p className="rounded-2xl bg-paper p-4 text-sm leading-6 text-gray-600">
          {t('Na escada, a classificação é a posição: o 1º de cada quadra sobe e o último desce a cada sessão. Não há pontos por vitória.')}
        </p>
        <TiebreakOrderEditor
          label={t('Na quadra, quem fica à frente')}
          value={s.tiebreak_order}
          defaultOrder={LADDER_DEFAULT_ORDER}
          allowedKeys={LADDER_TIEBREAK_KEYS}
          onChange={(ordem) => set({ tiebreak_order: ordem })}
        />
        <p className="text-xs leading-5 text-gray-500">{t('Confronto direto não entra: na quadra o parceiro muda a cada jogo. Empate em tudo fica com quem estava acima na escada.')}</p>
      </div>
    );
  }
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
