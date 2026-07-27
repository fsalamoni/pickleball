/**
 * V2CoachActions — Ações do perfil público do professor.
 *
 * Espelha o padrão de V2ArenaActions (Heart + Share2). Sem dependência
 * de residencies/admin na UI pública — só Like e Share.
 *
 * Wave B.3.
 */

import React, { Suspense, lazy, useState } from 'react';
import { Heart, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/core/lib/utils';
import { V2Button } from '@/v2/ui/primitives';
import { useMyFavoriteCoaches, useToggleFavoriteCoach } from '@/modules/coaches/hooks/useCoaches';

const CoachShareDialog = lazy(() => import('@/modules/coaches/components/CoachShareDialog'));

export function V2FavoriteCoachButton({ coach, className }) {
  const { data: favorites = [] } = useMyFavoriteCoaches();
  const toggle = useToggleFavoriteCoach();
  const isFavorite = favorites.includes(coach?.id);

  if (!coach?.id) return null;

  async function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await toggle.mutateAsync({ coach, isFavorite });
    } catch (err) {
      toast.error(err?.message || 'Não foi possível atualizar os favoritos.');
    }
  }

  return (
    <V2Button
      size="icon"
      variant="ghost"
      className={className}
      onClick={handleClick}
      disabled={toggle.isPending}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? 'Remover dos favoritos' : 'Favoritar professor'}
      title={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
    >
      <Heart className={cn('h-4 w-4', isFavorite && 'fill-red-500 text-red-500')} />
    </V2Button>
  );
}

export function V2CoachShareButton({ coach, className }) {
  const [open, setOpen] = useState(false);
  if (!coach?.id) return null;
  return (
    <>
      <V2Button size="sm" variant="ghost" className={className} onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" />
        <span className="hidden sm:inline">Compartilhar</span>
      </V2Button>
      {open && (
        <Suspense fallback={null}>
          <CoachShareDialog coach={coach} open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}
