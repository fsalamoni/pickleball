/**
 * Editor da ORDEM dos critérios de desempate — o mesmo no torneio (regras
 * gerais, uma ordem para todas as modalidades e fases) e na liga (Temporada,
 * uma ordem para todas as divisões). Os critérios, as ordens prontas e a
 * conta moram em `core/domain/tiebreak.js`.
 *
 * Escolher uma ordem pronta, subir/descer, tirar e acrescentar — sem arrastar,
 * que não funciona no celular da beira da quadra. `[]` = o padrão de quem usa
 * (`defaultOrder`): o torneio usa o oficial da USA Pickleball; a liga, o dela.
 */
import React from 'react';
import { ArrowDown, ArrowUp, Check, Plus, RotateCcw, X } from 'lucide-react';
import { t } from '@/core/i18n';
import { cn } from '@/core/lib/utils';
import { DEFAULT_TIEBREAK_ORDER, TIEBREAK_CRITERIA, TIEBREAK_PRESETS, normalizeTiebreakOrder } from '@/core/domain/tiebreak';

const igual = (a, b) => a.length === b.length && a.every((k, i) => k === b[i]);

const chip = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition coarse:min-h-11 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30';
const iconBtn = 'inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-paper hover:text-ink disabled:pointer-events-none disabled:opacity-30 coarse:h-11 coarse:w-11 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30';

/**
 * @param {{
 *   value?: string[],
 *   onChange: (ordem: string[]) => void,
 *   defaultOrder?: string[],
 *   label?: string,
 *   className?: string,
 *   allowedKeys?: string[],
 * }} props `allowedKeys` limita os critérios (a escada da liga não tem
 *   confronto direto); com ele as ordens prontas, que o usam, não aparecem.
 */
export default function TiebreakOrderEditor({ value, onChange, defaultOrder = DEFAULT_TIEBREAK_ORDER, label, className, allowedKeys }) {
  const vale = (k) => !allowedKeys || allowedKeys.includes(k);
  const criterios = TIEBREAK_CRITERIA.filter((c) => vale(c.key));
  const padrao = normalizeTiebreakOrder(defaultOrder).filter(vale);
  const escolhida = Array.isArray(value) && value.length ? normalizeTiebreakOrder(value).filter(vale) : [];
  const ordem = escolhida.length ? escolhida : padrao;
  const porChave = new Map(criterios.map((c) => [c.key, c]));
  const foraDaOrdem = criterios.filter((c) => !ordem.includes(c.key));
  const ehPadrao = igual(ordem, padrao);

  const mover = (i, delta) => {
    const nova = ordem.slice();
    const j = i + delta;
    if (j < 0 || j >= nova.length) return;
    [nova[i], nova[j]] = [nova[j], nova[i]];
    onChange(nova);
  };
  const remover = (chave) => {
    const nova = ordem.filter((k) => k !== chave);
    onChange(nova.length ? nova : []);
  };

  return (
    <div className={cn('space-y-3', className)} data-dica="desempate-ordem">
      <div>
        <p className="text-sm font-semibold text-ink">{label || t('Ordem dos critérios de desempate')}</p>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          {t('Aplicados de cima para baixo. Quando um critério separa os empatados, os que continuam empatados são comparados de novo, a partir do primeiro critério, só entre eles.')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('Ordens prontas')}>
        {(allowedKeys ? [] : TIEBREAK_PRESETS).map((p) => {
          const ativo = igual(ordem, normalizeTiebreakOrder(p.order));
          return (
            <button key={p.id} type="button" title={t(p.help)} aria-pressed={ativo} onClick={() => onChange([...p.order])}
              className={cn(chip, ativo ? 'border-ink bg-ink text-white' : 'border-gray-200 bg-paper-pure text-ink hover:border-ink')}>
              {ativo && <Check className="h-3.5 w-3.5" aria-hidden="true" />} {t(p.label)}
            </button>
          );
        })}
        {!ehPadrao && (
          <button type="button" onClick={() => onChange([])} className={cn(chip, 'border-transparent bg-paper text-ink hover:bg-paper-dark')}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> {t('Voltar ao padrão')}
          </button>
        )}
      </div>

      <ol className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-paper-pure">
        {ordem.map((chave, i) => {
          const c = porChave.get(chave);
          return (
            <li key={chave} className="flex items-start gap-3 px-3 py-2.5">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-acid/20 text-2xs font-bold text-ink" aria-hidden="true">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{c ? t(c.label) : chave}</p>
                {c?.help && <p className="mt-0.5 text-xs leading-5 text-gray-500">{t(c.help)}</p>}
              </div>
              <div className="flex shrink-0 items-center">
                <button type="button" className={iconBtn} aria-label={t('Subir {criterio}', { criterio: c ? t(c.label) : chave })} disabled={i === 0} onClick={() => mover(i, -1)}>
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" className={iconBtn} aria-label={t('Descer {criterio}', { criterio: c ? t(c.label) : chave })} disabled={i === ordem.length - 1} onClick={() => mover(i, 1)}>
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" className={iconBtn} aria-label={t('Tirar {criterio}', { criterio: c ? t(c.label) : chave })} disabled={ordem.length <= 1} onClick={() => remover(chave)}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {foraDaOrdem.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">{t('Acrescentar:')}</span>
          {foraDaOrdem.map((c) => (
            <button key={c.key} type="button" title={t(c.help)} onClick={() => onChange([...ordem, c.key])}
              className={cn(chip, 'border-dashed border-gray-200 bg-transparent text-ink hover:border-ink')}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t(c.label)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
