/**
 * Portão de consentimento bloqueante para os documentos ESSENCIAIS
 * (flag legal_center). Enquanto houver documento essencial pendente (não aceito
 * ou desatualizado), exibe o aviso que exige o aceite antes de usar a
 * plataforma. Reaparece automaticamente quando a versão de um documento sobe.
 *
 * Não bloqueia usuários não autenticados (nada a consentir ainda).
 */

import React, { useMemo } from 'react';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { pendingGateConsents } from '@/modules/legal/domain/consent';
import { useMyConsents, useAcceptConsents } from '@/modules/legal/hooks/useConsents';
import { useLegalTranslations } from '@/modules/legal/hooks/useLegalTranslations';
import ConsentNotice from './ConsentNotice';
import { t } from '@/core/i18n';

export default function LegalConsentGate() {
  const { user, isLoadingAuth } = useAuth();
  const { consentMap, isLoading, isFetched } = useMyConsents();
  const acceptAll = useAcceptConsents();

  const pending = useMemo(() => pendingGateConsents(consentMap), [consentMap]);
  // Só o que se MOSTRA é traduzido; o aceite grava o documento em português.
  const traducoes = useLegalTranslations(pending.length > 0);

  // Só bloqueia quando: flag on, usuário logado, consentimentos carregados e há
  // pendências. Evita "piscar" durante o carregamento.
  if (!user || isLoadingAuth || isLoading || !isFetched || pending.length === 0) {
    return null;
  }

  const handleAccept = async () => {
    if (acceptAll.isPending) return;
    try {
      await acceptAll.mutateAsync(pending.map((d) => ({ key: d.key, version: d.version, title: d.title })));
      toast.success(t('Consentimento registrado. Boa partida!'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível registrar o consentimento.'));
    }
  };

  return (
    <ConsentNotice
      id="aviso-consentimento-titulo"
      icon={ShieldCheck}
      title={t('Antes de continuar')}
      subtitle={t('Leia e concorde com os documentos essenciais da plataforma.')}
      pending={pending}
      traducoes={traducoes}
      acceptLabel={t('Aceitar e continuar')}
      onAccept={handleAccept}
      busy={acceptAll.isPending}
    />
  );
}
