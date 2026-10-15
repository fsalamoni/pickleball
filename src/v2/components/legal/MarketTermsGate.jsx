/**
 * Aviso de termos do Mercado: no primeiro acesso a `/mercado` (e quando a
 * versão de um documento do Mercado sobe), a pessoa lê e aceita os termos
 * gerais, os do comprador, os do vendedor e a política de imagens e IA antes
 * de usar o Mercado. Mesmo molde do portão da entrada na plataforma
 * (`LegalConsentGate`); o aceite fica em `legal_consents`, com data e versão.
 *
 * 🐞 Não abre junto com o cadastro inicial: os dois são Dialogs do Radix, e o
 * de cima desliga os toques no de baixo — no celular, quem tinha o cadastro
 * por completar via os termos e nenhum toque respondia. Quem decide a vez é o
 * `V2Layout` (os termos primeiro; o cadastro depois do aceite).
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ShoppingBag } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { pendingMarketConsents } from '@/modules/legal/domain/consent';
import { useMyConsents, useAcceptConsents } from '@/modules/legal/hooks/useConsents';
import { useLegalTranslations } from '@/modules/legal/hooks/useLegalTranslations';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { V2Button } from '@/v2/ui/primitives';
import ConsentChecklist, { AceiteProgresso } from './ConsentChecklist';
import { t } from '@/core/i18n';

export default function MarketTermsGate() {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const { consentMap, isLoading, isFetched } = useMyConsents();
  const accept = useAcceptConsents();
  const [checked, setChecked] = useState({});
  const pending = useMemo(() => pendingMarketConsents(consentMap), [consentMap]);
  // Só o que se MOSTRA é traduzido; o aceite grava o documento em português.
  const traducoes = useLegalTranslations(pending.length > 0);

  if (!user || isLoadingAuth || isLoading || !isFetched || pending.length === 0) return null;

  const allChecked = pending.every((d) => checked[d.key]);
  const aceitar = async () => {
    if (!allChecked) return;
    try {
      await accept.mutateAsync(pending.map((d) => ({ key: d.key, version: d.version, title: d.title })));
      toast.success(t('Termos do Mercado aceitos. Boas compras e boas vendas!'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível registrar o aceite. Tente de novo.'));
    }
  };
  const bloquear = (e) => e.preventDefault();

  return (
    <Dialog open onOpenChange={() => {}}>
      {/* 90vh antes de 90dvh: sem `dvh` (Safari < 15.4) a altura máxima seria ignorada. */}
      <DialogContent
        hideClose
        className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0 supports-[height:100dvh]:max-h-[90dvh]"
        onEscapeKeyDown={bloquear}
        onPointerDownOutside={bloquear}
        onInteractOutside={bloquear}
      >
        <DialogHeader className="shrink-0 flex-row items-center gap-3 space-y-0 border-b border-gray-100 p-4 text-left sm:p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid">
            <ShoppingBag className="h-6 w-6" />
          </span>
          <span>
            <DialogTitle className="font-display text-xl font-bold text-ink">{t('Antes de entrar no Mercado')}</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">{t('Leia e concorde com os termos do Mercado.')}</DialogDescription>
          </span>
        </DialogHeader>

        <ConsentChecklist
          pending={pending}
          traducoes={traducoes}
          checked={checked}
          onCheck={(key, sim) => setChecked((s) => ({ ...s, [key]: sim }))}
          describe={(d, visto) => visto.description}
        >
          <p className="rounded-2xl bg-paper p-3 text-sm text-gray-700">
            {t('O Mercado só aproxima quem quer vender de quem quer comprar. A PickleRush não vende, não recebe o pagamento, não entrega e não garante os produtos:')} <strong>{t('a venda e o transporte são responsabilidade do vendedor')}</strong>, {t('e')} <strong>{t('quem compra responde pela própria decisão de compra')}</strong>. {t('Os direitos que a lei garante continuam valendo entre vocês.')}
          </p>
        </ConsentChecklist>

        <div className="shrink-0 space-y-2 border-t border-gray-100 p-4 sm:p-6">
          <V2Button type="button" className="w-full" onClick={aceitar} disabled={!allChecked || accept.isPending}>
            {accept.isPending ? t('Registrando…') : t('Li e aceito, entrar no Mercado')}
          </V2Button>
          <V2Button type="button" variant="ghost" className="w-full" onClick={() => navigate('/')}>{t('Agora não')}</V2Button>
          <AceiteProgresso pending={pending} checked={checked} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
