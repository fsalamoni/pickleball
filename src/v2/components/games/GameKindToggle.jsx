/**
 * SIMPLES × DUPLAS — as peças de tela (Onda CF).
 *
 * `GameKindToggle` é o seletor "Duplas | Simples", o MESMO em toda tela do
 * dia de jogo: na quadra do Play e do Americano aprimorado, no sorteio de
 * grade e na criação manual. Um grupo de botões com `aria-pressed` (e não um
 * select): são duas opções, e as duas precisam estar à vista.
 *
 * `GameKindBadge` é o selo de leitura. Só aparece para SIMPLES: duplas é o
 * padrão da plataforma, e marcar o padrão em toda quadra seria ruído.
 *
 * `variant="dark"` é a versão do telão (fundo escuro).
 */
import React from 'react';
import { User, Users } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import {
  GAME_KIND, GAME_KIND_LABELS, normalizeGameKind,
} from '@/modules/games/domain/gameKind';

const ICONE = { [GAME_KIND.DOUBLES]: Users, [GAME_KIND.SINGLES]: User };

/**
 * @param {{
 *   value?: string, onChange: (kind: string) => void, label?: string,
 *   size?: 'xs'|'sm', variant?: 'light'|'dark', disabled?: boolean, className?: string,
 * }} props
 */
export function GameKindToggle({
  value, onChange, label = 'Tipo de jogo', size = 'sm', variant = 'light', disabled = false, className,
}) {
  const atual = normalizeGameKind(value);
  const escuro = variant === 'dark';
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-full border p-0.5',
        escuro ? 'border-white/15 bg-white/5' : 'border-gray-200 bg-paper',
        className,
      )}
    >
      {[GAME_KIND.DOUBLES, GAME_KIND.SINGLES].map((kind) => {
        const Icone = ICONE[kind];
        const ativo = atual === kind;
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={ativo}
            disabled={disabled}
            onClick={() => { if (!ativo) onChange(kind); }}
            className={cn(
              'inline-flex items-center gap-1 rounded-full font-semibold transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-50',
              size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
              escuro
                ? (ativo ? 'bg-acid text-ink focus-visible:ring-acid' : 'text-white/60 hover:text-white focus-visible:ring-white/60')
                : (ativo ? 'bg-ink text-white focus-visible:ring-ink' : 'text-gray-500 hover:text-ink focus-visible:ring-ink'),
            )}
          >
            <Icone aria-hidden="true" className={size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            {GAME_KIND_LABELS[kind]}
          </button>
        );
      })}
    </div>
  );
}

/** O selo "Simples" — nada para duplas (o padrão). */
export function GameKindBadge({ kind, variant = 'light', className }) {
  if (normalizeGameKind(kind) !== GAME_KIND.SINGLES) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
        variant === 'dark' ? 'bg-white/10 text-white/80' : 'bg-blue-50 text-blue-700',
        className,
      )}
    >
      <User aria-hidden="true" className="h-3 w-3" />
      {GAME_KIND_LABELS[GAME_KIND.SINGLES]}
    </span>
  );
}
