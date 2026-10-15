/**
 * Termos do Mercado: no primeiro acesso a `/mercado` (e quando a versão de um
 * documento do Mercado sobe), a pessoa lê e aceita os termos gerais, os do
 * comprador, os do vendedor e a política de imagens e IA antes de usar o
 * Mercado. O aceite fica em `legal_consents`, com data e versão.
 *
 * É uma PÁGINA, no lugar do Mercado (o `V2Layout` a monta no `<main>`), e não
 * uma janela por cima: rola como qualquer página do app, os termos vêm em
 * ordem e o botão de aceite é a última coisa, sem nada depois. "Agora não"
 * fica no topo, ao lado do título.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { pendingMarketConsents } from '@/modules/legal/domain/consent';
import { useMyConsents, useAcceptConsents } from '@/modules/legal/hooks/useConsents';
import { useLegalTranslations } from '@/modules/legal/hooks/useLegalTranslations';
import { V2Button, V2Page, V2PageIntro, V2Surface } from '@/v2/ui/primitives';
import { ConsentAccept, ConsentDocs } from './ConsentNotice';
import { t } from '@/core/i18n';

export default function MarketTermsGate() {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const { consentMap, isLoading, isFetched } = useMyConsents();
  const accept = useAcceptConsents();
  const pending = useMemo(() => pendingMarketConsents(consentMap), [consentMap]);
  // Só o que se MOSTRA é traduzido; o aceite grava o documento em português.
  const traducoes = useLegalTranslations(pending.length > 0);

  if (!user || isLoadingAuth || isLoading || !isFetched || pending.length === 0) return null;

  const aceitar = async () => {
    if (accept.isPending) return;
    try {
      await accept.mutateAsync(pending.map((d) => ({ key: d.key, version: d.version, title: d.title })));
      toast.success(t('Termos do Mercado aceitos. Boas compras e boas vendas!'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível registrar o aceite. Tente de novo.'));
    }
  };

  return (
    <V2Page role="region" aria-label={t('Antes de entrar no Mercado')} className="space-y-6">
      <V2PageIntro
        className="mb-0"
        title={t('Antes de entrar no Mercado')}
        subtitle={t('Leia e concorde com os termos do Mercado.')}
        action={<V2Button type="button" variant="ghost" onClick={() => navigate('/')}>{t('Agora não')}</V2Button>}
      />
      <V2Surface className="max-w-2xl space-y-4 p-4 sm:p-6">
        <p className="rounded-2xl bg-paper p-3 text-sm text-gray-700">
          {t('O Mercado só aproxima quem quer vender de quem quer comprar. A PickleRush não vende, não recebe o pagamento, não entrega e não garante os produtos:')} <strong>{t('a venda e o transporte são responsabilidade do vendedor')}</strong>, {t('e')} <strong>{t('quem compra responde pela própria decisão de compra')}</strong>. {t('Os direitos que a lei garante continuam valendo entre vocês.')}
        </p>
        <ConsentDocs pending={pending} traducoes={traducoes} />
        <ConsentAccept acceptLabel={t('Li e aceito, entrar no Mercado')} onAccept={aceitar} busy={accept.isPending} />
      </V2Surface>
    </V2Page>
  );
}
