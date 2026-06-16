import React from 'react';
import { cn } from '@/core/lib/utils';

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
};

export function initialsFor(name) {
  return (
    String(name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

/**
 * Avatar do usuário: mostra a foto quando disponível ou as iniciais como
 * fallback. Reutilizável em todos os locais onde um atleta aparece.
 */
export function UserAvatar({ name, photoUrl, size = 'sm', className, title }) {
  const dim = SIZES[size] || SIZES.sm;
  const base = 'shrink-0 rounded-full border border-emerald-900/10 object-cover';
  if (photoUrl) {
    return <img src={photoUrl} alt="" title={title || name || ''} className={cn(dim, base, className)} />;
  }
  return (
    <div
      title={title || name || ''}
      className={cn(dim, 'flex shrink-0 items-center justify-center rounded-full bg-emerald-900 font-semibold text-emerald-50', className)}
    >
      {initialsFor(name)}
    </div>
  );
}

/**
 * Grupo de avatares sobrepostos (ex.: dupla). `people` = [{ name, photoUrl }].
 */
export function AvatarGroup({ people = [], size = 'sm', className }) {
  const list = people.filter(Boolean);
  if (list.length === 0) return null;
  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {list.map((person, index) => (
        <UserAvatar
          key={`${person.name || 'p'}-${index}`}
          name={person.name}
          photoUrl={person.photoUrl}
          size={size}
          className="ring-2 ring-white"
        />
      ))}
    </div>
  );
}
