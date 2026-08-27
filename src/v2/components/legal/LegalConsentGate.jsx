/**
 * Portão de consentimento bloqueante para os documentos ESSENCIAIS
 * (flag legal_center). Enquanto houver documento essencial pendente (não aceito
 * ou desatualizado), exibe um overlay que exige o aceite antes de usar a
 * plataforma. Reaparece automaticamente quando a versão de um documento sobe.
 *
 * Não bloqueia usuários não autenticados (nada a consentir ainda).
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, ExternalLink } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { pendingGateConsents } from '@/modules/legal/domain/consent';
import { useMyConsents, useAcceptConsents } from '@/modules/legal/hooks/useConsents';
import { V2Button } from '@/v2/ui/primitives';
import { legalIcon } from './legalIcons';

export default function LegalConsentGate() {
  const { user, isLoadingAuth } = useAuth();
  const { consentMap, isLoading, isFetched } = useMyConsents();
  const acceptAll = useAcceptConsents();
  const [checked, setChecked] = useState({});

  const pending = useMemo(() => pendingGateConsents(consentMap), [consentMap]);

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
      toast.success('Consentimento registrado. Boa partida!');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível registrar o consentimento.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-4xl bg-paper-pure shadow-organic">
        <div className="flex items-center gap-3 border-b border-gray-100 p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Antes de continuar</h2>
            <p className="text-sm text-gray-500">Leia e concorde com os documentos essenciais da plataforma.</p>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-6">
          {pending.map((d) => {
            const Icon = legalIcon(d.icon);
            return (
              <label
                key={d.key}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-100 bg-paper p-3 transition-colors hover:border-acid-dark/40"
              >
                <input
                  type="checkbox"
                  checked={!!checked[d.key]}
                  onChange={(e) => setChecked((s) => ({ ...s, [d.key]: e.target.checked }))}
                  className="mt-1 h-4 w-4 shrink-0 accent-ink"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-semibold text-ink">
                    <Icon className="h-4 w-4 text-gray-400" /> {d.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    Li e concordo com {d.title.toLowerCase()} (v{d.version}).{' '}
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

        <div className="border-t border-gray-100 p-6">
          <V2Button className="w-full" onClick={handleAccept} disabled={!allChecked || acceptAll.isPending}>
            {acceptAll.isPending ? 'Registrando…' : 'Aceitar e continuar'}
          </V2Button>
          <p className="mt-2 text-center text-[11px] text-gray-400">
            Marque todos os itens para continuar. Seu aceite fica registrado com data e versão.
          </p>
        </div>
      </div>
    </div>
  );
}
