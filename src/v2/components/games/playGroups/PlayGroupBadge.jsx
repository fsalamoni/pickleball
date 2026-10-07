/**
 * O SELO de um grupo do Play: um ponto na cor do grupo e o nome. É o mesmo em
 * toda tela — participantes, quadras, previsão, ordem de participação e telão
 * (`variant="dark"`). O nome sempre aparece: a cor ajuda a bater o olho, mas
 * ninguém precisa distingui-la para saber de que grupo se trata.
 */
import React from 'react';
import { cn } from '@/core/lib/utils';
import { themeOf } from './playGroupTheme';

/**
 * @param {{ name?: string|null, color?: string, variant?: 'light'|'dark',
 *           size?: 'xs'|'sm', className?: string, title?: string }} props
 *   Sem `name`, não renderiza nada — quem chama não precisa checar.
 */
export function PlayGroupBadge({ name, color, variant = 'light', size = 'sm', className, title }) {
  if (!name) return null;
  const tema = themeOf(color);
  const escuro = variant === 'dark';
  return (
    <span
      title={title || `Grupo ${name}`}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border font-semibold',
        size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        escuro ? tema.chipDark : tema.chip,
        className,
      )}
    >
      <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', escuro ? tema.dotDark : tema.dot)} />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** O selo de "quem está sem grupo". */
export function NoGroupBadge(props) {
  return <PlayGroupBadge name="Sem grupo" color="gray" title="Sem grupo" {...props} />;
}

/**
 * O selo de um grupo pelo id, lendo a configuração do dia. `null` (ou um grupo
 * que não existe mais) é "sem grupo" — mostrado só com `mostrarSemGrupo`.
 */
export function PlayGroupBadgeById({ groupId, config, mostrarSemGrupo = false, ...rest }) {
  const g = groupId ? (config?.groups || []).find((x) => x.id === groupId) : null;
  if (g) return <PlayGroupBadge name={g.name} color={g.color} {...rest} />;
  return mostrarSemGrupo ? <NoGroupBadge {...rest} /> : null;
}
