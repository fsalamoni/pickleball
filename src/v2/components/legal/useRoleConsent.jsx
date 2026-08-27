/**
 * Hook de consentimento por papel para os fluxos que "assumem um papel"
 * (criar torneio → Organizador, criar arena → Arena, virar professor → Professor).
 * Flag legal_center.
 *
 * Retorna:
 *  - `field`: nó JSX com a caixa "Li e aceito os Termos do X" (ou aviso de já
 *    aceito). Renderiza null quando a flag está desligada ou o documento não
 *    existe.
 *  - `guardBeforeSubmit()`: true se pode prosseguir (flag off / já aceito /
 *    marcado); caso contrário exibe um toast e retorna false.
 *  - `recordAfterSuccess()`: registra o aceite (best-effort) após a ação.
 */

import React, { useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, CheckCircle2 } from 'lucide-react';
import { getLegalDocument } from '@/modules/legal/domain/legalDocuments';
import { isDocAccepted } from '@/modules/legal/domain/consent';
import { useMyConsents, useAcceptConsent } from '@/modules/legal/hooks/useConsents';

export function useRoleConsent(docKey) {
  const doc = getLegalDocument(docKey);
  const { consentMap } = useMyConsents();
  const accept = useAcceptConsent();
  const [checked, setChecked] = useState(false);

  const alreadyAccepted = !!doc && isDocAccepted(consentMap, doc);
  const active = !!doc && !alreadyAccepted;

  const guardBeforeSubmit = () => {
    if (!active) return true;
    if (!checked) {
      toast.error(`Você precisa aceitar os "${doc.title}" para continuar.`);
      return false;
    }
    return true;
  };

  const recordAfterSuccess = async () => {
    if (!doc || alreadyAccepted) return;
    try {
      await accept.mutateAsync({ key: doc.key, version: doc.version, title: doc.title });
    } catch {
      // best-effort: não interrompe o fluxo principal se o registro falhar
    }
  };

  let field = null;
  if (doc) {
    field = alreadyAccepted ? (
      <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>Você já aceitou os <strong>{doc.title}</strong>.</span>
      </div>
    ) : (
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 bg-paper p-3 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-ink"
        />
        <span className="text-gray-600">
          Li e aceito os <strong className="text-ink">{doc.title}</strong>.{' '}
          <a
            href={`/legal/${doc.route}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 font-semibold text-ink underline"
          >
            Ler <ExternalLink className="h-3 w-3" />
          </a>
        </span>
      </label>
    );
  }

  return { field, guardBeforeSubmit, recordAfterSuccess, active, alreadyAccepted };
}
