/**
 * Portão de consentimento bloqueante para os documentos ESSENCIAIS
 * (flag legal_center). Enquanto houver documento essencial pendente (não aceito
 * ou desatualizado), exibe um overlay que exige o aceite antes de usar a
 * plataforma. Reaparece automaticamente quando a versão de um documento sobe.
 *
 * Não bloqueia usuários não autenticados (nada a consentir ainda).
 *
 * `pointer-events-auto`: se um diálogo do Radix abrir por baixo (atalho de
 * teclado, link com `?criar=1`), ele desliga os toques no `body` — e o aviso,
 * que fica por cima (z-100), tem de continuar respondendo.
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { pendingGateConsents } from '@/modules/legal/domain/consent';
import { useMyConsents, useAcceptConsents } from '@/modules/legal/hooks/useConsents';
import { useLegalTranslations } from '@/modules/legal/hooks/useLegalTranslations';
import { V2Button } from '@/v2/ui/primitives';
import ConsentChecklist, { AceiteProgresso } from './ConsentChecklist';
import { t } from '@/core/i18n';

export default function LegalConsentGate() {
  const { user, isLoadingAuth } = useAuth();
  const { consentMap, isLoading, isFetched } = useMyConsents();
  const acceptAll = useAcceptConsents();
  const [checked, setChecked] = useState({});

  const pending = useMemo(() => pendingGateConsents(consentMap), [consentMap]);
  // Só o que se MOSTRA é traduzido; o aceite grava o documento em português.
  const traducoes = useLegalTranslations(pending.length > 0);

  // Só bloqueia quando: flag on, usuário logado, consentimentos carregados e há
  // pendências. Evita "piscar" durante o carregamento.
  if (!user || isLoadingAuth || isLoading || !isFetched || pending.length === 0) {
    return null;
  }

  const allChecked = pending.every((d) => checked[d.key]);

  const handleAccept = async () => {
    if (!allChecked) return;
    try {
      await acceptAll.mutateAsync(pending.map((d) => ({ key: d.key, version: d.version, title: d.title })));
      toast.success(t('Consentimento registrado. Boa partida!'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível registrar o consentimento.'));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="aviso-consentimento-titulo"
      className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-ink/70 p-4 backdrop-blur-sm"
    >
      {/* 90vh antes de 90dvh: navegador sem `dvh` (Safari < 15.4) ignoraria a
          altura máxima e o botão de aceite ficaria fora da tela. */}
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-4xl bg-paper-pure shadow-organic supports-[height:100dvh]:max-h-[90dvh]">
        <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 p-4 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 id="aviso-consentimento-titulo" className="font-display text-xl font-bold text-ink">{t('Antes de continuar')}</h2>
            <p className="text-sm text-gray-500">{t('Leia e concorde com os documentos essenciais da plataforma.')}</p>
          </div>
        </div>

        <ConsentChecklist
          pending={pending}
          traducoes={traducoes}
          checked={checked}
          onCheck={(key, sim) => setChecked((s) => ({ ...s, [key]: sim }))}
          describe={(d, visto) => t('Li e concordo com {documento} (v{versao}).', { documento: visto.title.toLowerCase(), versao: d.version })}
        />

        <div className="shrink-0 space-y-2 border-t border-gray-100 p-4 sm:p-6">
          <V2Button type="button" className="w-full" onClick={handleAccept} disabled={!allChecked || acceptAll.isPending}>
            {acceptAll.isPending ? t('Registrando…') : t('Aceitar e continuar')}
          </V2Button>
          <AceiteProgresso pending={pending} checked={checked} />
        </div>
      </div>
    </div>
  );
}
