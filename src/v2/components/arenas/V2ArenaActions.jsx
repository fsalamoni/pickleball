import React, { Suspense, lazy, useState } from 'react';
import { Heart, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/core/lib/utils';
import { V2Button } from '@/v2/ui/primitives';
import { useMyFavoriteArenas, useToggleFavorite } from '@/modules/arenas/hooks/useArenas';
import { t } from '@/core/i18n';

const ArenaShareDialog = lazy(() => import('@/modules/arenas/components/ArenaShareDialog'));

export function V2FavoriteArenaButton({ arena, className }) {
  const { data: favorites = [] } = useMyFavoriteArenas();
  const toggle = useToggleFavorite();
  const isFavorite = favorites.includes(arena.id);

  async function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await toggle.mutateAsync({ arena, isFavorite });
    } catch (err) {
      toast.error(err?.message || t('Não foi possível atualizar os favoritos.'));
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
      aria-label={isFavorite ? t('Remover dos favoritos') : t('Adicionar aos favoritos')}
      title={isFavorite ? t('Remover dos favoritos') : t('Favoritar')}
    >
      <Heart className={cn('h-4 w-4', isFavorite && 'fill-red-500 text-red-500')} />
    </V2Button>
  );
}

export function V2ArenaShareButton({ arena, className }) {
  const [open, setOpen] = useState(false);
  if (!arena?.id) return null;
  return (
    <>
      <V2Button size="sm" variant="ghost" className={className} onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" />
        <span className="hidden sm:inline">{t('Compartilhar')}</span>
      </V2Button>
      {open && (
        <Suspense fallback={null}>
          <ArenaShareDialog arena={arena} open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}
