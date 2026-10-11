/**
 * A faixa global de conexão, sob o cabeçalho (Fase 4.1 do plano de UX):
 * sem rede, diz que o que está na tela pode estar velho; ao voltar, diz por
 * alguns segundos que está tentando de novo (o React Query refaz as consultas
 * ativas ao reconectar) e some. Zero banco.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useOnline } from '@/core/lib/useOnline';
import { AVISO_DE_VOLTA_MS, estadoDeConexao } from '@/core/domain/connectivity';
import { cn } from '@/core/lib/utils';

export default function V2OfflineBanner() {
  const online = useOnline();
  const [voltouEm, setVoltouEm] = useState(null);
  const estavaOffline = useRef(false);

  useEffect(() => {
    if (!online) { estavaOffline.current = true; return undefined; }
    if (!estavaOffline.current) return undefined;
    estavaOffline.current = false;
    setVoltouEm(Date.now());
    const id = setTimeout(() => setVoltouEm(null), AVISO_DE_VOLTA_MS);
    return () => clearTimeout(id);
  }, [online]);

  const estado = estadoDeConexao({ online, voltouEm });
  if (!estado) return null;
  const Icone = estado.tipo === 'offline' ? WifiOff : Wifi;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-semibold',
        estado.tipo === 'offline' ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-900',
      )}
    >
      <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {estado.texto}
    </div>
  );
}
