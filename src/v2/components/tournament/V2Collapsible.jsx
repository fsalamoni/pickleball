import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/core/lib/utils';

/**
 * Preferência de aberto/fechado por VISUALIZADOR (por navegador), guardada em
 * localStorage. Nada disso toca o banco/Firestore — é só conveniência de UI.
 * `persistId` deve ser estável e único por card (ex.: id da modalidade + seção).
 */
const STORAGE_PREFIX = 'v2:collapsible:';

function readStoredOpen(persistId) {
  if (!persistId || typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STORAGE_PREFIX + persistId);
    if (v === '1') return true;
    if (v === '0') return false;
    return null; // nunca salvo → usa o default (primeira visualização)
  } catch {
    return null; // modo privado / storage indisponível
  }
}

function writeStoredOpen(persistId, open) {
  if (!persistId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + persistId, open ? '1' : '0');
  } catch {
    /* modo privado / storage indisponível — ignora silenciosamente */
  }
}

/**
 * Seção colapsável nativa v2 (usada nas abas de ranking/jogos do torneio).
 *
 * @param {object} props
 * @param {boolean} [props.defaultOpen=true] Estado inicial quando não há
 *   preferência salva (primeira visualização).
 * @param {string} [props.persistId] Quando informado, o último movimento do
 *   usuário (abrir/fechar) é lembrado neste navegador para este card.
 */
export default function V2Collapsible({ title, subtitle, badges, defaultOpen = true, persistId, children, tone = 'surface' }) {
  const [open, setOpen] = useState(() => {
    const stored = readStoredOpen(persistId);
    return stored === null ? defaultOpen : stored;
  });
  const container = tone === 'nested'
    ? 'rounded-3xl border border-gray-100 bg-paper'
    : 'rounded-4xl border border-gray-100 bg-paper-pure shadow-organic-sm';

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      writeStoredOpen(persistId, next);
      return next;
    });
  };

  return (
    <div className={cn('overflow-hidden', container)}>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="min-w-0">
          <div className="font-display text-base font-bold text-ink">{title}</div>
          {subtitle && <div className="mt-0.5 text-xs text-gray-500">{subtitle}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badges}
          <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', open && 'rotate-180')} />
        </div>
      </button>
      {open && <div className="border-t border-gray-100 p-4 sm:p-5">{children}</div>}
    </div>
  );
}
