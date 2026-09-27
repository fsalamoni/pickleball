import React from 'react';
import { cn } from '@/core/lib/utils';

/**
 * O símbolo da marca, na versão certa para o fundo: `logo-claro.png` (a
 * metade de baixo em ink) no claro, `logo-escuro.png` (em branco) no escuro —
 * a metade ink sumiria num fundo escuro. As duas imagens vão na página, e a
 * variante `dark:` escolhe (só na tela, nunca dentro de um `.tema-claro`).
 *
 * @param {{ className?: string, alt?: string }} props
 */
export default function BrandMark({ className, alt = 'PickleRush' }) {
  return (
    <>
      <img src="/logo-claro.png" alt={alt} className={cn('object-contain dark:hidden', className)} />
      <img src="/logo-escuro.png" alt={alt} className={cn('hidden object-contain dark:block', className)} />
    </>
  );
}
