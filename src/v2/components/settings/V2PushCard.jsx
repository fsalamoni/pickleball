import React, { useState } from 'react';
import { toast } from 'sonner';
import { BellRing } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  enablePush, disablePush, isPushConfigured, getPermissionState,
} from '@/core/services/pushService';
import { V2Button, V2Surface } from '@/v2/ui/primitives';

/**
 * Card de opt-in de notificações push (flag push_notifications).
 * Gracioso: se o push não estiver configurado (sem VAPID) ou o navegador não
 * suportar, mostra apenas uma mensagem — nada é registrado.
 */
export default function V2PushCard() {
  const { user } = useAuth();
  const configured = isPushConfigured();
  const [state, setState] = useState(() => getPermissionState());
  const [busy, setBusy] = useState(false);
  const granted = state === 'granted';

  async function handleEnable() {
    setBusy(true);
    const res = await enablePush(user);
    setBusy(false);
    if (res.ok) {
      setState('granted');
      toast.success('Notificações push ativadas neste aparelho.');
    } else if (res.reason === 'denied') {
      setState('denied');
      toast.error('Permissão negada pelo navegador.');
    } else if (res.reason === 'unsupported') {
      toast.error('Seu navegador não suporta notificações push.');
    } else if (res.reason === 'unconfigured') {
      toast.error('O push ainda não foi configurado na plataforma.');
    } else {
      toast.error('Não foi possível ativar as notificações push.');
    }
  }

  async function handleDisable() {
    setBusy(true);
    await disablePush(user);
    setBusy(false);
    setState(getPermissionState());
    toast.success('Notificações push desativadas neste aparelho.');
  }

  return (
    <V2Surface>
      <div className="flex items-center gap-2">
        <BellRing className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Notificações push</h2>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Receba avisos no seu aparelho, mesmo com o app fechado: jogo chegando, novidades do
        torneio, convites de dupla e mensagens.
      </p>

      {!configured ? (
        <p className="mt-3 rounded-2xl bg-paper px-3 py-2 text-xs text-gray-500">
          Recurso em configuração. Assim que o push for habilitado na plataforma, a opção de
          ativar aparece aqui.
        </p>
      ) : state === 'unsupported' ? (
        <p className="mt-3 text-xs text-gray-500">Seu navegador não suporta notificações push.</p>
      ) : state === 'denied' ? (
        <p className="mt-3 text-xs text-gray-500">
          As notificações estão bloqueadas nas permissões do navegador para este site. Libere-as
          nas configurações do navegador e tente novamente.
        </p>
      ) : (
        <div className="mt-3">
          {granted ? (
            <V2Button variant="secondary" size="sm" onClick={handleDisable} disabled={busy}>
              {busy ? 'Desativando…' : 'Desativar push neste aparelho'}
            </V2Button>
          ) : (
            <V2Button size="sm" onClick={handleEnable} disabled={busy}>
              <BellRing className="h-4 w-4" /> {busy ? 'Ativando…' : 'Ativar notificações push'}
            </V2Button>
          )}
        </div>
      )}
    </V2Surface>
  );
}
