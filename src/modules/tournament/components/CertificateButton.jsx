import React, { Suspense, lazy, useState } from 'react';
import { Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';

const CertificateDialog = lazy(() => import('./CertificateDialog.jsx'));

/**
 * Botão "Certificado" fechado pela flag `tournament_certificates`. O chamador
 * deve renderizá-lo apenas quando fizer sentido (ex.: torneio encerrado).
 *
 * @param {{ tournament: object, size?: string, variant?: string }} props
 */
export default function CertificateButton({ tournament, size = 'sm', variant = 'outline' }) {
  const enabled = useFeatureFlag(FEATURE_FLAG.TOURNAMENT_CERTIFICATES);
  const [open, setOpen] = useState(false);
  if (!enabled) return null;

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        <Award className="h-4 w-4" />
        <span className="ml-1 hidden sm:inline">Certificado</span>
      </Button>
      {open && (
        <Suspense fallback={null}>
          <CertificateDialog tournament={tournament} open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}
