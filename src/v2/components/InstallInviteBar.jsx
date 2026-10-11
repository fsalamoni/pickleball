/**
 * O convite para instalar o app, dentro do app logado (Fase 4.5): a partir da
 * 2ª visita, nunca na 1ª; "Agora não" silencia por 30 dias. Some sozinho quando
 * o app já está instalado ou o PWA está desligado (`usePwaInstall`).
 */
import React, { useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import InstallAppButton from '@/components/InstallAppButton';
import { usePwaInstall } from '@/core/pwa/usePwaInstall';
import { CHAVE_DISPENSADO, deveConvidar, registrarVisita } from '@/core/pwa/conviteInstalar';

function lerDispensado() {
  try { return window.localStorage.getItem(CHAVE_DISPENSADO); } catch { return null; }
}

export default function InstallInviteBar() {
  const { available } = usePwaInstall();
  const [visitas] = useState(() => registrarVisita());
  const [dispensadoEm, setDispensadoEm] = useState(lerDispensado);

  if (!available || !deveConvidar({ visitas, dispensadoEm })) return null;

  const dispensar = () => {
    const agora = new Date().toISOString();
    try { window.localStorage.setItem(CHAVE_DISPENSADO, agora); } catch { /* sem armazenamento: some só nesta tela */ }
    setDispensadoEm(agora);
  };

  return (
    <div role="region" aria-label="Instalar o aplicativo" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-b border-gray-100 bg-paper px-4 py-2 text-xs text-ink">
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <Smartphone className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
        Instale o PickleRush: abre mais rápido e fica na tela inicial.
      </span>
      <span className="inline-flex items-center gap-1">
        <InstallAppButton size="sm" variant="outline" label="Instalar" className="h-8 rounded-full text-xs" />
        <button type="button" onClick={dispensar} className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold text-gray-500 hover:text-ink coarse:min-h-11" aria-label="Agora não">
          <X className="h-3.5 w-3.5" aria-hidden /> Agora não
        </button>
      </span>
    </div>
  );
}
