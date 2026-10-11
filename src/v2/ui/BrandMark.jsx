import React from 'react';
import { cn } from '@/core/lib/utils';

/**
 * Uma versão do logo (`claro` = a metade de baixo em ink, para fundo claro;
 * `escuro` = em branco, para fundo escuro). Serve o WebP (≈24 kB) e deixa o
 * PNG original (186/72 kB) só para navegador sem WebP e para o `og:image`.
 * Tem 320 px de lado: o maior uso na tela é 44 px, então sobra até em 3×.
 *
 * @param {{ versao: 'claro'|'escuro', className?: string, alt?: string }} props
 */
export function LogoImg({ versao, className, alt = 'PickleRush' }) {
  return (
    <picture className="contents">
      <source type="image/webp" srcSet={`/logo-${versao}.webp`} />
      <img src={`/logo-${versao}.png`} alt={alt} width={320} height={320} decoding="async" className={cn('w-auto object-contain', className)} />
    </picture>
  );
}

/**
 * O símbolo da marca, na versão certa para o fundo: `logo-claro` no claro,
 * `logo-escuro` no escuro — a metade ink sumiria num fundo escuro. As duas
 * imagens vão na página, e a variante `dark:` escolhe (só na tela, nunca
 * dentro de um `.tema-claro`).
 *
 * @param {{ className?: string, alt?: string }} props
 */
export default function BrandMark({ className, alt = 'PickleRush' }) {
  return (
    <>
      <LogoImg versao="claro" alt={alt} className={cn('dark:hidden', className)} />
      <LogoImg versao="escuro" alt={alt} className={cn('hidden dark:block', className)} />
    </>
  );
}
