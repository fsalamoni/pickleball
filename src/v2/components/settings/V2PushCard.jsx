import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BellRing } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  enablePush, disablePush, isPushConfigured, getPermissionState,
} from '@/core/services/pushService';
import { V2Button } from '@/v2/ui/primitives';
import SettingsSection from './SettingsSection';
import { t } from '@/core/i18n';

/**
 * Card de opt-in de notificações push (flag push_notifications).
 * Gracioso: se o push não estiver configurado (sem VAPID, nem no build nem no
 * painel admin → Comunicações → Push) ou o navegador não
 * suportar, mostra apenas uma mensagem — nada é registrado.
 */
export default function V2PushCard() {
  const { user } = useAuth();
  // A chave pode vir do build ou do painel admin (leitura no banco).
  const [configured, setConfigured] = useState(false);
  useEffect(() => {
    let vivo = true;
    isPushConfigured().then((ok) => { if (vivo) setConfigured(ok); });
    return () => { vivo = false; };
  }, []);
  const [state, setState] = useState(() => getPermissionState());
  const [busy, setBusy] = useState(false);
  const granted = state === 'granted';

  async function handleEnable() {
    setBusy(true);
    const res = await enablePush(user);
    setBusy(false);
    if (res.ok) {
      setState('granted');
      toast.success(t('Notificações push ativadas neste aparelho.'));
    } else if (res.reason === 'denied') {
      setState('denied');
      toast.error(t('Permissão negada pelo navegador.'));
    } else if (res.reason === 'unsupported') {
      toast.error(t('Seu navegador não suporta notificações push.'));
    } else if (res.reason === 'unconfigured') {
      toast.error(t('O push ainda não foi configurado na plataforma.'));
    } else {
      toast.error(t('Não foi possível ativar as notificações push.'));
    }
  }

  async function handleDisable() {
    setBusy(true);
    await disablePush(user);
    setBusy(false);
    setState(getPermissionState());
    toast.success(t('Notificações push desativadas neste aparelho.'));
  }

  const resumo = !configured ? t('Em configuração na plataforma')
    : state === 'unsupported' ? t('Sem suporte neste navegador')
      : state === 'denied' ? t('Bloqueadas no navegador')
        : granted ? t('Ativas neste aparelho') : t('Desativadas neste aparelho');

  return (
    <SettingsSection id="notificacoes-push" dica="config-push" icon={BellRing} title={t('Notificações push')} summary={resumo}>
      <p className="text-sm text-gray-500">
        {t('Receba avisos no seu aparelho, mesmo com o app fechado: jogo chegando, novidades do torneio, convites de dupla e mensagens.')}
      </p>

      {!configured ? (
        <p className="mt-3 rounded-2xl bg-paper px-3 py-2 text-xs text-gray-500">
          {t('Recurso em configuração. Assim que o push for habilitado na plataforma, a opção de ativar aparece aqui.')}
        </p>
      ) : state === 'unsupported' ? (
        <p className="mt-3 text-xs text-gray-500">{t('Seu navegador não suporta notificações push.')}</p>
      ) : state === 'denied' ? (
        <p className="mt-3 text-xs text-gray-500">
          {t('As notificações estão bloqueadas nas permissões do navegador para este site. Libere-as nas configurações do navegador e tente novamente.')}
        </p>
      ) : (
        <div className="mt-3">
          {granted ? (
            <V2Button variant="secondary" size="sm" onClick={handleDisable} disabled={busy}>
              {busy ? t('Desativando…') : t('Desativar push neste aparelho')}
            </V2Button>
          ) : (
            <V2Button size="sm" onClick={handleEnable} disabled={busy}>
              <BellRing className="h-4 w-4" /> {busy ? t('Ativando…') : t('Ativar notificações push')}
            </V2Button>
          )}
        </div>
      )}
    </SettingsSection>
  );
}
