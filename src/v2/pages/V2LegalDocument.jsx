/**
 * V2LegalDocument — página de um documento legal (/legal/:docRoute).
 * Renderiza o conteúdo no padrão de design e, para o usuário autenticado,
 * mostra o estado de aceite (no topo) ou o botão "Li e concordo" — este no FIM,
 * depois do texto: concordar é a última coisa, nunca antes de ler.
 */

import React from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { getLegalDocumentByRoute } from '@/modules/legal/domain/legalDocuments';
import { isDocAccepted } from '@/modules/legal/domain/consent';
import { useMyConsents, useAcceptConsent } from '@/modules/legal/hooks/useConsents';
import { V2Badge, V2Button, V2EmptyState, V2Surface, V2Page } from '@/v2/ui/primitives';
import LegalDocumentView from '@/v2/components/legal/LegalDocumentView';
import { t } from '@/core/i18n';

export default function V2LegalDocument() {
  const enabled = true;
  const { docRoute } = useParams();
  const { user } = useAuth();
  const { flags, isLoading: flagsCarregando } = useFeatureFlags();
  const registrado = getLegalDocumentByRoute(docRoute);
  const doc = registrado && registrado.flag && !flagsCarregando && !flags?.[registrado.flag] ? null : registrado;
  const { consentMap } = useMyConsents();
  const accept = useAcceptConsent();

  if (!enabled) return <Navigate to="/politica-uso" replace />;

  if (!doc) {
    return (
      <V2Page>
        <V2Surface>
          <V2EmptyState
            title={t('Documento não encontrado')}
            description={t('O documento que você procura não existe ou foi movido.')}
            action={<V2Button asChild><Link to="/legal">{t('Ver todos os documentos')}</Link></V2Button>}
          />
        </V2Surface>
      </V2Page>
    );
  }

  const accepted = isDocAccepted(consentMap, doc);

  const handleAccept = async () => {
    try {
      await accept.mutateAsync({ key: doc.key, version: doc.version, title: doc.title });
      toast.success(t('Concordância registrada.'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível registrar.'));
    }
  };

  const status = user && accepted
    ? <V2Badge tone="green"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> {t('Você concordou')}</V2Badge>
    : null;
  const action = user && !accepted ? (
    <V2Button type="button" className="w-full sm:w-auto" onClick={handleAccept} disabled={accept.isPending}>
      {accept.isPending ? t('Registrando…') : t('Li e concordo')}
    </V2Button>
  ) : null;

  return (
    <V2Page>
      <div className="mb-3">
        <Link to="/legal" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink">
          <ChevronLeft className="h-4 w-4" /> {t('Documentos')}
        </Link>
      </div>
      <LegalDocumentView doc={doc} status={status} action={action} />
    </V2Page>
  );
}
