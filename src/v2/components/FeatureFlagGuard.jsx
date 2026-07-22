import React, { useState } from 'react';
import { Flag, ArrowRight, Power } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { V2Button, V2Surface, V2EmptyState } from '@/v2/ui/primitives';
import { setFeatureFlag } from '@/core/services/platformSettingsService';
import { toast } from 'sonner';

/**
 * Em vez de redirecionar silenciosamente, mostra empty state explicando
 * que a funcionalidade está desativada. Se o user for platform_admin,
 * oferece um botão para ativar com 1 clique.
 */
export default function FeatureFlagGuard({ flag, label, description, children }) {
  const enabled = useFeatureFlag(flag);
  const { isPlatformAdmin, user } = useAuth();
  const [activating, setActivating] = useState(false);

  if (enabled) return children;

  const handleActivate = async () => {
    setActivating(true);
    try {
      await setFeatureFlag(flag, true, user);
      toast.success(`${label} ativado.`);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível ativar.');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="mx-auto max-w-[700px]">
      <V2Surface>
        <V2EmptyState
          icon={Flag}
          title={`${label} está desativado`}
          description={
            isPlatformAdmin
              ? `${description} Ative agora para liberar esta área.`
              : `${description} Peça ao admin da plataforma para ativar em Admin › Funcionalidades.`
          }
          action={
            isPlatformAdmin ? (
              <V2Button onClick={handleActivate} disabled={activating}>
                <Power className="h-4 w-4" />
                {activating ? 'Ativando…' : `Ativar ${label}`}
              </V2Button>
            ) : null
          }
        />
      </V2Surface>
    </div>
  );
}
