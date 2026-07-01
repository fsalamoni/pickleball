import React, { Suspense, lazy, useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ArenaShareDialog = lazy(() => import('./ArenaShareDialog.jsx'));

/** Botão "Compartilhar" da arena (abre o card com QR sob demanda). */
export default function ArenaShareButton({ arena, size = 'sm', variant = 'outline', className }) {
  const [open, setOpen] = useState(false);
  if (!arena?.id) return null;
  return (
    <>
      <Button size={size} variant={variant} className={className} onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" />
        <span className="ml-1 hidden sm:inline">Compartilhar</span>
      </Button>
      {open && (
        <Suspense fallback={null}>
          <ArenaShareDialog arena={arena} open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}
