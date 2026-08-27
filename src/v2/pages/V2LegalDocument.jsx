/**
 * V2LegalDocument — página de um documento legal (/legal/:docRoute).
 * Renderiza o conteúdo no padrão de design e, para o usuário autenticado,
 * mostra o estado de aceite + botão "Li e concordo". Flag legal_center.
 */

import React from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { getLegalDocumentByRoute } from '@/modules/legal/domain/legalDocuments';
import { isDocAccepted } from '@/modules/legal/domain/consent';
import { useMyConsents, useAcceptConsent } from '@/modules/legal/hooks/useConsents';
import { V2Badge, V2Button, V2EmptyState, V2Surface } from '@/v2/ui/primitives';
import LegalDocumentView from '@/v2/components/legal/LegalDocumentView';

export default function V2LegalDocument() {
  const enabled = true;
  const { docRoute } = useParams();
  const { user } = useAuth();
  const doc = getLegalDocumentByRoute(docRoute);
  const { consentMap } = useMyConsents();
  const accept = useAcceptConsent();

  if (!enabled) return <Navigate to="/politica-uso" replace />;

  if (!doc) {
    return (
      <div className="mx-auto max-w-[900px]">
        <V2Surface>
          <V2EmptyState
            title="Documento não encontrado"
            description="O documento que você procura não existe ou foi movido."
            action={<V2Button asChild><Link to="/legal">Ver todos os documentos</Link></V2Button>}
          />
        </V2Surface>
      </div>
    );
  }

  const accepted = isDocAccepted(consentMap, doc);

  const handleAccept = async () => {
    try {
      await accept.mutateAsync({ key: doc.key, version: doc.version, title: doc.title });
      toast.success('Concordância registrada.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível registrar.');
    }
  };

  const action = user ? (
    accepted ? (
      <V2Badge tone="green"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Você concordou</V2Badge>
    ) : (
      <V2Button onClick={handleAccept} disabled={accept.isPending}>
        {accept.isPending ? 'Registrando…' : 'Li e concordo'}
      </V2Button>
    )
  ) : null;

  return (
    <div>
      <div className="mx-auto mb-3 max-w-[900px]">
        <Link to="/legal" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink">
          <ChevronLeft className="h-4 w-4" /> Documentos
        </Link>
      </div>
      <LegalDocumentView doc={doc} action={action} />
    </div>
  );
}
