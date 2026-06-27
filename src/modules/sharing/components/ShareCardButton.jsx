import React, { Suspense, lazy, useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';

// Carregado sob demanda: as libs de imagem/QR só entram no bundle ao abrir.
const ShareCardDialog = lazy(() => import('./ShareCardDialog.jsx'));

/**
 * Botão "Compartilhar" que abre o card de divulgação do torneio. Fechado atrás
 * da flag `share_cards`: desligada, renderiza `null` (nada muda no fluxo atual).
 *
 * @param {{ tournament: object, size?: string, variant?: string }} props
 */
export default function ShareCardButton({ tournament, size = 'sm', variant = 'outline' }) {
  const enabled = useFeatureFlag(FEATURE_FLAG.SHARE_CARDS);
  const [open, setOpen] = useState(false);

  if (!enabled) return null;

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" />
        <span className="ml-1 hidden sm:inline">Compartilhar</span>
      </Button>
      {open && (
        <Suspense fallback={null}>
          <ShareCardDialog tournament={tournament} open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}
