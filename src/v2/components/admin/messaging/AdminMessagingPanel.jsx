/**
 * Painel admin → Comunicações (abas `com-*`): tudo o que a plataforma usa
 * para mandar avisos por e-mail, WhatsApp, SMS e push — configurar cada
 * canal (com o passo a passo do provedor), decidir o que vai por onde, os
 * limites e o orçamento, ver os modelos e conferir as entregas.
 *
 * O estado vem de UMA chamada ao servidor (`messagingAdmin('status')`), que
 * sabe o que está gravado, o que falta e as chaves configuradas (sem nunca
 * devolvê-las). Ver docs/49-AVISOS-POR-EMAIL-E-CELULAR.md.
 */
import React, { Suspense, lazy, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Mail, MessageCircle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { setFeatureFlag } from '@/core/services/platformSettingsService';
import { hasBuildVapidKey } from '@/core/services/pushService';
import { messagingKeys, useMessagingAdminStatus } from '@/modules/messaging/hooks/useMessaging';
import { ALERT_META, CHANNEL_META, MISSING_META } from '@/modules/messaging/domain/meta';
import { V2Badge, V2Button, V2ErrorState, V2Skeleton, V2Toggle } from '@/v2/ui/primitives';
import { t, fmtMoeda, fmtNumero } from '@/core/i18n';
import { Block, numero } from './messagingUi';

const EmailTab = lazy(() => import('./MessagingEmailTab'));
const PhoneTabs = lazy(() => import('./MessagingPhoneTabs'));
const RulesTabs = lazy(() => import('./MessagingRulesTabs'));
const DeliveriesTabs = lazy(() => import('./MessagingDeliveriesTabs'));

const ICONE = { email: Mail, whatsapp: MessageCircle, sms: Smartphone, push: Bell };
const ABA_DO_CANAL = { email: 'com-email', whatsapp: 'com-whatsapp', sms: 'com-sms', push: 'com-push' };

export default function AdminMessagingPanel({ tab, onTab }) {
  const q = useMessagingAdminStatus();
  if (q.isError) {
    return (
      <V2ErrorState
        onRetry={() => q.refetch()}
        description={q.error?.message || t('A conexão falhou no meio do caminho. Isso quase sempre se resolve tentando de novo.')}
      />
    );
  }
  if (q.isLoading || !q.data) return <V2Skeleton className="h-64 rounded-3xl" />;
  const estado = q.data;
  const props = { estado, onTab };
  return (
    <div className="space-y-5">
      <Suspense fallback={<V2Skeleton className="h-64 rounded-3xl" />}>
        {tab === 'com-resumo' && <SummaryTab {...props} />}
        {tab === 'com-email' && <EmailTab {...props} />}
        {['com-whatsapp', 'com-sms', 'com-push'].includes(tab) && <PhoneTabs tab={tab} {...props} />}
        {['com-regras', 'com-limites'].includes(tab) && <RulesTabs tab={tab} {...props} />}
        {['com-modelos', 'com-entregas'].includes(tab) && <DeliveriesTabs tab={tab} {...props} />}
      </Suspense>
    </div>
  );
}

/* --------------------------------------------------------------- resumo -- */

function SummaryTab({ estado, onTab }) {
  const { user } = useAuth();
  const { flags, refresh } = useFeatureFlags();
  const qc = useQueryClient();
  const [mudando, setMudando] = useState(false);
  const ligada = Boolean(flags?.[FEATURE_FLAG.EXTERNAL_MESSAGING]);

  const mudarFlag = async (v) => {
    setMudando(true);
    try {
      await setFeatureFlag(FEATURE_FLAG.EXTERNAL_MESSAGING, v, user);
      await refresh?.();
      qc.invalidateQueries({ queryKey: messagingKeys.adminStatus });
      toast.success(v ? t('Avisos por e-mail e celular ligados.') : t('Avisos por e-mail e celular desligados.'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível alterar a funcionalidade.'));
    } finally { setMudando(false); }
  };

  const { stats = {}, people = {}, alerts = [], ready = {}, missing = {} } = estado;
  const orcamento = estado.settings?.limits?.monthly_budget_brl || 0;
  const externoPronto = ready.email || ready.whatsapp || ready.sms;
  // O push não tem interruptor: pronto = a chave pública salva (ou no build).
  const pushPronto = Boolean(ready.push || hasBuildVapidKey);

  return (
    <>
      <Block
        title={t('Avisos por e-mail e celular')}
        description={t('Todo aviso da plataforma continua no sino. Com isto ligado, ele também pode sair por e-mail, WhatsApp e SMS, conforme as regras desta seção e a escolha de cada pessoa em Configurações → E-mail e celular. O push (notificação no aparelho) funciona à parte, desde que a chave esteja configurada.')}
      >
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-gray-600">
          <li>{t('Configure um canal na aba dele (E-mail, WhatsApp ou SMS), com o passo a passo do provedor.')}</li>
          <li>{t('Mande um teste para você e confira se chegou.')}</li>
          <li>{t('Ligue o canal (o botão só aparece com tudo pronto).')}</li>
          <li>{t('Ligue a chave geral abaixo: a partir daí as pessoas veem o cartão "E-mail e celular" nas Configurações e os avisos começam a sair.')}</li>
        </ol>
        <div className="rounded-2xl border border-gray-100 bg-paper p-4">
          <V2Toggle
            id="com-flag"
            checked={ligada}
            onChange={(v) => { if (!mudando) mudarFlag(v); }}
            label={t('Chave geral: avisos por e-mail e celular')}
            hint={ligada
              ? t('Ligada. Só saem os canais prontos e ligados; desligue aqui para parar tudo de uma vez.')
              : t('Desligada: nada sai da plataforma por e-mail, WhatsApp ou SMS, e as pessoas não veem as opções. O push segue como sempre.')}
          />
          {ligada && !externoPronto && (
            <p className="mt-3 flex items-start gap-2 text-sm text-amber-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {pushPronto
                ? t('O push já está pronto e saindo. E-mail, WhatsApp e SMS ainda não: termine a configuração de pelo menos um para os avisos saírem também por eles.')
                : t('Nenhum canal está pronto ainda: por enquanto nada sai. Termine a configuração de pelo menos um.')}
            </p>
          )}
        </div>
      </Block>

      {alerts.length > 0 && (
        <Block title={t('Atenção')}>
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.code} className={a.level === 'danger' ? 'rounded-2xl bg-red-50 p-3 text-sm text-red-600' : 'rounded-2xl bg-amber-50 p-3 text-sm text-amber-700'}>
                {t(ALERT_META[a.code]?.label || a.code)}
              </li>
            ))}
          </ul>
        </Block>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {['email', 'whatsapp', 'sms', 'push'].map((ch) => {
          const Icone = ICONE[ch];
          const pronto = ch === 'push' ? pushPronto : ready[ch];
          const ligadoCanal = ch === 'push' ? pushPronto : estado.settings?.[ch]?.enabled === true;
          const falta = ch === 'push' && hasBuildVapidKey ? [] : (missing[ch] || []);
          return (
            <Block
              key={ch}
              title={(
                <span className="inline-flex items-center gap-2">
                  <Icone className="h-5 w-5" aria-hidden /> {t(CHANNEL_META[ch].label)}
                </span>
              )}
              description={t(CHANNEL_META[ch].hint)}
              action={pronto
                ? <V2Badge tone="green"><CheckCircle2 className="h-3 w-3" aria-hidden /> {ch === 'push' ? t('Configurado') : t('Pronto e ligado')}</V2Badge>
                : <V2Badge tone={ligadoCanal ? 'amber' : 'neutral'}>{t('Não pronto')}</V2Badge>}
            >
              {falta.length > 0 && (
                <ul className="space-y-1 text-sm text-gray-600">
                  {falta.map((f) => <li key={f}>• {t(MISSING_META[ch]?.[f]?.label || f)}</li>)}
                </ul>
              )}
              {ch === 'push' && (
                <p className="text-xs text-gray-500">
                  {t('Aparelhos com o push ativo: {n}', { n: numero(people.push_devices) })}
                </p>
              )}
              {ch !== 'push' && (
                <p className="text-xs text-gray-500">
                  {t('Hoje: {hoje} · Neste mês: {mes}', { hoje: numero(stats.today?.[ch]), mes: numero(stats.month?.[ch]) })}
                </p>
              )}
              <V2Button type="button" size="sm" variant="ghost" onClick={() => onTab(ABA_DO_CANAL[ch])}>{t('Abrir a configuração')}</V2Button>
            </Block>
          );
        })}
      </div>

      <Block title={t('Números do mês')} description={t('Contam tudo o que saiu pela plataforma neste mês (horário de Brasília), inclusive testes e códigos.')}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Numero rotulo={t('Gasto com WhatsApp e SMS')} valor={stats.month_cost === null || stats.month_cost === undefined ? '—' : fmtMoeda(stats.month_cost)} detalhe={orcamento > 0 ? t('de {orcamento} de orçamento', { orcamento: fmtMoeda(orcamento) }) : t('sem orçamento definido')} />
          <Numero rotulo={t('E-mails devolvidos')} valor={numero(stats.issues?.email?.bounce)} detalhe={t('endereço que não existe ou recusou')} />
          <Numero rotulo={t('Reclamações de spam')} valor={numero(stats.issues?.email?.complaint)} detalhe={t('cada uma bloqueia o endereço')} />
          <Numero rotulo={t('Na lista de bloqueio')} valor={numero(estado.suppressions)} detalhe={t('endereços e números que não recebem mais')} />
        </dl>
      </Block>

      <Block title={t('Pessoas')} description={t('Quem já confirmou o celular e o que escolheu nas Configurações.')}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <Numero rotulo={t('Celular confirmado')} valor={numero(people.phones_verified)} />
          <Numero rotulo={t('WhatsApp ligado')} valor={numero(people.whatsapp_on)} />
          <Numero rotulo={t('SMS ligado')} valor={numero(people.sms_on)} />
          <Numero rotulo={t('E-mail desligado')} valor={numero(people.email_off)} />
          <Numero rotulo={t('Aceitam novidades')} valor={numero(people.marketing_on)} />
        </dl>
      </Block>
    </>
  );
}

function Numero({ rotulo, valor, detalhe }) {
  return (
    <div className="rounded-2xl bg-paper p-4">
      <dt className="text-xs text-gray-500">{rotulo}</dt>
      <dd className="mt-1 font-display text-2xl font-bold text-ink">{typeof valor === 'number' ? fmtNumero(valor) : valor}</dd>
      {detalhe && <p className="mt-0.5 text-xs text-gray-500">{detalhe}</p>}
    </div>
  );
}
