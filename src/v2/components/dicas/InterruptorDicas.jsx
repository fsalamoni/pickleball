/**
 * O interruptor das dicas — o mesmo desenho das outras chaves da plataforma.
 *
 * Arquivo próprio de propósito: o cartão de Configurações usa só ele, e
 * importá-lo do painel levaria junto o catálogo inteiro de guias.
 */
import React from 'react';
import { cn } from '@/core/lib/utils';

export default function InterruptorDicas({ ligadas, onAlternar, id }) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={ligadas}
      aria-label="Dicas na tela"
      onClick={() => onAlternar(!ligadas)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/40',
        ligadas ? 'bg-acid' : 'bg-gray-200',
      )}
    >
      {/* Branco nos dois modos: `bg-white` é o cartão no modo escuro. */}
      <span className={cn('inline-block h-5 w-5 rounded-full bg-[#fff] shadow transition-transform', ligadas ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  );
}

