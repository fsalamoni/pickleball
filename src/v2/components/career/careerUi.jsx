/**
 * Peças pequenas da Carreira: o grupo de botões (Simples / Duplas /
 * Equipe; Masc / Fem / Mista; a medalha), a data do torneio de fora e o selo.
 */
import React from 'react';
import { instanteDoDiaEmMs } from '@/core/domain/instant.js';
import { cn } from '@/core/lib/utils';
import { V2Badge } from '@/v2/ui/primitives';
import { SEAL, SEAL_LABEL } from '@/modules/career/domain/timeline.js';
import { CAREER_FORMAT, CAREER_FORMAT_LABEL, CAREER_GENDER_LABEL, PLACEMENT } from '@/modules/career/domain/careerEvent.js';
import { fmtData, t, tk } from '@/core/i18n';

/** Os três formatos e os três gêneros do registro rápido (o "Aberta" fica na ficha). */
export const FORMAT_CHOICES = Object.values(CAREER_FORMAT).map((v) => ({ value: v, label: CAREER_FORMAT_LABEL[v] }));
export const GENDER_CHOICES = ['male', 'female', 'mixed'].map((v) => ({ value: v, label: CAREER_GENDER_LABEL[v] }));
export const GENDER_CHOICES_ALL = [...GENDER_CHOICES, { value: 'open', label: CAREER_GENDER_LABEL.open }];
/** A medalha opcional: 🥇🥈🥉 ou "—" (sem medalha). */
export const MEDAL_CHOICES = [
  { value: PLACEMENT.CHAMPION, label: '🥇', aria: tk('Ouro') },
  { value: PLACEMENT.RUNNER_UP, label: '🥈', aria: tk('Prata') },
  { value: PLACEMENT.THIRD, label: '🥉', aria: tk('Bronze') },
  { value: null, label: '—', aria: tk('Sem medalha') },
];

/**
 * Um grupo de botões de escolha única. `allowNone`: tocar no escolhido desmarca.
 * @param {{ label: string, options: Array<{ value: any, label: string, aria?: string }>, value: any, onChange: Function, allowNone?: boolean, dica?: string }} p
 */
export function ChoiceGroup({ label, options, value, onChange, allowNone = false, dica }) {
  return (
    <div role="group" aria-label={label} data-dica={dica} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const ativo = value === o.value;
        return (
          <button type="button" key={String(o.value)}
            aria-pressed={ativo}
            aria-label={o.aria ? t(o.aria) : undefined}
            onClick={() => onChange(allowNone && ativo ? null : o.value)}
            className={cn(
              'min-h-11 min-w-11 rounded-2xl border px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink',
              ativo ? 'border-ink bg-ink text-acid' : 'border-gray-200 bg-paper-pure text-ink hover:border-ink/40',
            )}
          >
            {o.aria ? o.label : t(o.label)}
          </button>
        );
      })}
    </div>
  );
}

/** "12 de out. de 2025" (dia) ou "2025" (só o ano, do modo lista). */
export function careerDateLabel(iso, precision = 'day') {
  if (!iso) return '';
  if (precision === 'year') return String(iso).slice(0, 4);
  const ms = instanteDoDiaEmMs(iso);
  return ms ? fmtData(new Date(ms), { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

/**
 * O selo derivado: oficial (da plataforma), confirmado pela dupla ou declarado.
 * `awaiting` acrescenta "Aguardando a dupla" (pedido de confirmação em aberto).
 */
export function SealBadge({ seal, awaiting = false }) {
  const tom = seal === SEAL.OFFICIAL ? 'green' : seal === SEAL.CONFIRMED ? 'blue' : 'neutral';
  return (
    <>
      <V2Badge tone={tom}>{t(SEAL_LABEL[seal] || SEAL_LABEL.declared)}</V2Badge>
      {awaiting && <V2Badge tone="neutral">{t('Aguardando a dupla')}</V2Badge>}
    </>
  );
}
