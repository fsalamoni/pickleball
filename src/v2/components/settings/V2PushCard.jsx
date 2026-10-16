import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BellRing } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  enablePush, disablePush, isPushConfigured, getPermissionState, isPushActiveHere,
} from '@/core/services/pushService';
import { PUSH_FAILURE_META } from '@/modules/messaging/domain/meta';
import { V2Button } from '@/v2/ui/primitives';
import SettingsSection from './SettingsSection';
import { t } from '@/core/i18n';

/**
 * Card de opt-in de notificações push NESTE aparelho.
 * Gracioso: se o push não estiver configurado (sem VAPID, nem no build nem no
 * painel admin → Comunicações → Push) ou o navegador não suportar, mostra
 * apenas uma mensagem — nada é registrado. "Ativo" é a permissão do navegador
 * E o registro desta conta neste aparelho: a permissão sozinha não manda push.
 */
export default function V2PushCard() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  // A chave pode vir do build ou do painel admin (leitura no banco).
  const [configured, setConfigured] = useState(false);
  useEffect(() => {
    let vivo = true;
    isPushConfigured().then((ok) => { if (vivo) setConfigured(ok); });
    return () => { vivo = false; };
  }, []);
  const [state, setState] = useState(() => getPermissionState());
  const [ativo, setAtivo] = useState(() => isPushActiveHere(uid));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setAtivo(isPushActiveHere(uid)); }, [uid]);

  async function handleEnable() {
    setBusy(true);
    const res = await enablePush(user);
    setBusy(false);
    setState(getPermissionState());
    setAtivo(isPushActiveHere(uid));
    if (res.ok) {
      toast.success(t('Notificações push ativadas neste aparelho.'));
    } else {
      toast.error(t((PUSH_FAILURE_META[res.reason] || PUSH_FAILURE_META.error).label));
    }
  }

  async function handleDisable() {
    setBusy(true);
    await disablePush(user);
    setBusy(false);
    setState(getPermissionState());
    setAtivo(false);
    toast.success(t('Notificações push desativadas neste aparelho.'));
  }

  const resumo = !configured ? t('Em configuração na plataforma')
    : state === 'unsupported' ? t('Sem suporte neste navegador')
      : state === 'denied' ? t('Bloqueadas no navegador')
        : ativo ? t('Ativas neste aparelho') : t('Desativadas neste aparelho');

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
        <p className="mt-3 text-xs text-gray-500">{t(PUSH_FAILURE_META.unsupported.label)}</p>
      ) : state === 'denied' ? (
        <p className="mt-3 text-xs text-gray-500">
          {t('As notificações estão bloqueadas nas permissões do navegador para este site. Libere-as nas configurações do navegador e tente novamente.')}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {ativo ? (
            <V2Button type="button" variant="secondary" size="sm" onClick={handleDisable} disabled={busy}>
              {busy ? t('Desativando…') : t('Desativar push neste aparelho')}
            </V2Button>
          ) : (
            <V2Button type="button" size="sm" onClick={handleEnable} disabled={busy}>
              <BellRing className="h-4 w-4" aria-hidden /> {busy ? t('Ativando…') : t('Ativar notificações push')}
            </V2Button>
          )}
          <p className="text-xs text-gray-500">
            {t('Vale só para este aparelho: ative em cada celular ou computador em que quer receber. Com o app aberto na tela, o aviso aparece no sino, sem notificação.')}
          </p>
        </div>
      )}
    </SettingsSection>
  );
}
