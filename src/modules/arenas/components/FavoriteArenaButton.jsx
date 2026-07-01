import React from 'react';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/core/lib/utils';
import { useMyFavoriteArenas, useToggleFavorite } from '../hooks/useArenas.js';

/** Botão de favoritar/desfavoritar uma arena. */
export default function FavoriteArenaButton({ arena, size = 'icon', variant = 'outline', className }) {
  const { data: favorites = [] } = useMyFavoriteArenas();
  const toggle = useToggleFavorite();
  const isFavorite = favorites.includes(arena.id);

  async function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await toggle.mutateAsync({ arena, isFavorite });
    } catch (err) {
      toast.error(err?.message || 'Não foi possível atualizar os favoritos.');
    }
  }

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={handleClick}
      disabled={toggle.isPending}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      title={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
    >
      <Heart className={cn('h-4 w-4', isFavorite && 'fill-red-500 text-red-500')} />
    </Button>
  );
}
