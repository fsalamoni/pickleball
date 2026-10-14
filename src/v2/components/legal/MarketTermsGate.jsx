/**
 * Aviso de termos do Mercado: no primeiro acesso a `/mercado` (e quando a
 * versão de um documento do Mercado sobe), a pessoa lê e aceita os termos
 * gerais, os do comprador, os do vendedor e a política de imagens e IA antes
 * de usar o Mercado. Mesmo molde do portão da entrada na plataforma
 * (`LegalConsentGate`); o aceite fica em `legal_consents`, com data e versão.
 *
 * É um Dialog (Radix) de propósito: se o cadastro inicial também estiver
 * aberto, os dois convivem sem um travar os cliques do outro.
 */
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ExternalLink, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { pendingMarketConsents } from '@/modules/legal/domain/consent';
import { useMyConsents, useAcceptConsents } from '@/modules/legal/hooks/useConsents';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { V2Button } from '@/v2/ui/primitives';
import { legalIcon } from './legalIcons';

export default function MarketTermsGate() {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const { consentMap, isLoading, isFetched } = useMyConsents();
  const accept = useAcceptConsents();
  const [checked, setChecked] = useState({});
  const pending = useMemo(() => pendingMarketConsents(consentMap), [consentMap]);

  if (!user || isLoadingAuth || isLoading || !isFetched || pending.length === 0) return null;

  const allChecked = pending.every((d) => checked[d.key]);
  const aceitar = async () => {
    if (!allChecked) return;
    try {
      await accept.mutateAsync(pending.map((d) => ({ key: d.key, version: d.version, title: d.title })));
      toast.success('Termos do Mercado aceitos. Boas compras e boas vendas!');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível registrar o aceite. Tente de novo.');
    }
  };
  const bloquear = (e) => e.preventDefault();

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent hideClose className="flex max-w-lg flex-col gap-0 p-0" onEscapeKeyDown={bloquear} onPointerDownOutside={bloquear} onInteractOutside={bloquear}>
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-gray-100 p-6 text-left">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid">
            <ShoppingBag className="h-6 w-6" />
          </span>
          <span>
            <DialogTitle className="font-display text-xl font-bold text-ink">Antes de entrar no Mercado</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">Leia e concorde com os termos do Mercado.</DialogDescription>
          </span>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto p-6">
          <p className="rounded-2xl bg-paper p-3 text-sm text-gray-700">
            O Mercado só aproxima quem quer vender de quem quer comprar. A PickleRush não vende, não recebe o pagamento, não entrega e não garante os produtos: <strong>a venda e o transporte são responsabilidade do vendedor</strong>, e <strong>quem compra responde pela própria decisão de compra</strong>. Os direitos que a lei garante continuam valendo entre vocês.
          </p>
          {pending.map((d) => {
            const Icon = legalIcon(d.icon);
            return (
              <label key={d.key} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-100 bg-paper p-3 transition-colors hover:border-acid-dark/40">
                <input
                  type="checkbox"
                  checked={!!checked[d.key]}
                  onChange={(e) => setChecked((s) => ({ ...s, [d.key]: e.target.checked }))}
                  className="mt-1 h-4 w-4 shrink-0 accent-ink"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-semibold text-ink">
                    <Icon className="h-4 w-4 text-gray-500" /> {d.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {d.description}{' '}
                    <a
                      href={`/legal/${d.route}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-0.5 font-semibold text-ink underline"
                    >
                      Ler documento <ExternalLink className="h-3 w-3" />
                    </a>
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="space-y-2 border-t border-gray-100 p-6">
          <V2Button type="button" className="w-full" onClick={aceitar} disabled={!allChecked || accept.isPending}>
            {accept.isPending ? 'Registrando…' : 'Li e aceito, entrar no Mercado'}
          </V2Button>
          <V2Button type="button" variant="ghost" className="w-full" onClick={() => navigate('/')}>Agora não</V2Button>
          <p className="text-center text-2xs text-gray-500">Marque todos os itens para entrar. O aceite fica registrado com data e versão.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
