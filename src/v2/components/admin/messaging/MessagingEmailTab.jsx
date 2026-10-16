/**
 * Comunicações → E-mail: provedor (Amazon SES ou Resend), chaves, domínio e
 * registros DNS, remetente, "esqueci a senha" pelo domínio, teste e ligar.
 */
import React, { useState } from 'react';
import { CheckCircle2, RefreshCw, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMessagingAdminAction } from '@/modules/messaging/hooks/useMessaging';
import { DNS_CHECK_META, DNS_PURPOSE_META } from '@/modules/messaging/domain/meta';
import { normalizeDomain, fromAddress } from '@/modules/messaging/domain/policy';
import {
  GUIDE_DOMAIN, GUIDE_RESEND, GUIDE_SES, SES_PRODUCTION_REQUEST,
} from '@/modules/messaging/domain/guides';
import { cn } from '@/core/lib/utils';
import { V2Badge, V2Button, V2Field, V2Input, V2Select, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t, tk, fmtNumero } from '@/core/i18n';
import {
  Block, ChannelSwitch, CopyValue, Facts, GuideSteps, MissingChecklist, SaveBar, SecretsForm, TestSend, quando, useSectionDraft,
} from './messagingUi';

const PROVEDORES = [
  {
    id: 'ses',
    nome: 'Amazon SES',
    resumo: tk('O mais barato (cerca de US$ 0,10 a cada mil e-mails) e o que aguenta qualquer volume. A configuração é mais longa: conta na AWS, usuário com chave e pedido de saída do modo de teste. Devoluções e reclamações chegam sozinhas pela própria AWS.'),
  },
  {
    id: 'resend',
    nome: 'Resend',
    resumo: tk('O mais simples de configurar: uma chave e um webhook. Grátis até 3 mil e-mails por mês (100 por dia); acima disso, a partir de US$ 20 por mês.'),
  },
];

const REGIOES_SES = [
  { value: 'sa-east-1', label: 'South America (São Paulo) — sa-east-1' },
  { value: 'us-east-1', label: 'US East (N. Virginia) — us-east-1' },
  { value: 'us-east-2', label: 'US East (Ohio) — us-east-2' },
  { value: 'us-west-2', label: 'US West (Oregon) — us-west-2' },
  { value: 'eu-west-1', label: 'Europe (Ireland) — eu-west-1' },
];
const REGIOES_RESEND = [
  { value: 'sa-east-1', label: 'São Paulo — sa-east-1' },
  { value: 'us-east-1', label: 'North Virginia — us-east-1' },
  { value: 'eu-west-1', label: 'Ireland — eu-west-1' },
  { value: 'ap-northeast-1', label: 'Tokyo — ap-northeast-1' },
];

const ROTULO_CHECK = { dkim: tk('Assinatura (DKIM)'), mail_from: tk('Retorno (MAIL FROM)'), status: tk('Situação do domínio') };

const CAMPOS_SES = [
  { key: 'access_key_id', label: tk('Access key ID'), hint: tk('Começa com AKIA e tem 20 caracteres.'), placeholder: 'AKIA…' },
  { key: 'secret_access_key', label: tk('Secret access key'), hint: tk('Aparece uma vez só, quando a chave é criada.') },
];
const CAMPOS_RESEND = [
  { key: 'api_key', label: tk('Chave da API'), hint: tk('Começa com re_. Permissão: Full access.'), placeholder: 're_…' },
  { key: 'webhook_secret', label: tk('Segredo do webhook'), hint: tk('O Signing secret do webhook, que começa com whsec_.'), placeholder: 'whsec_…' },
];

export default function MessagingEmailTab({ estado }) {
  const { settings, secrets, missing, status = {}, webhooks = {}, runtime = {} } = estado;
  const form = useSectionDraft(settings, 'email');
  const provedor = settings.email.provider;
  return (
    <>
      <Block title={t('O que falta para o e-mail funcionar')} action={<ChannelSwitch channel="email" section="email" settings={settings} missing={missing} />}>
        <MissingChecklist channel="email" missing={missing} />
      </Block>

      <ProviderBlock form={form} provedor={provedor} />

      <Block
        title={provedor === 'ses' ? t('Chaves da Amazon SES') : t('Chaves do Resend')}
        description={t('Ficam guardadas só no servidor, num lugar que nem o painel lê. Para trocar, cole a nova por cima; para manter, deixe em branco.')}
      >
        <GuideSteps title={provedor === 'ses' ? t('Como criar a conta e a chave na Amazon SES') : t('Como criar a conta e a chave no Resend')} steps={provedor === 'ses' ? GUIDE_SES : GUIDE_RESEND} />
        {provedor === 'ses' && (
          <details className="rounded-2xl border border-gray-100 bg-paper p-4">
            <summary className="cursor-pointer text-sm font-bold text-ink">{t('Texto sugerido para o pedido de produção da SES')}</summary>
            <p className="mt-2 text-xs text-gray-500">{t('Em inglês, porque quem lê é a equipe da AWS. Copie e cole no campo de descrição do uso.')}</p>
            <div className="mt-2"><CopyValue value={SES_PRODUCTION_REQUEST} label={t('o texto')} /></div>
          </details>
        )}
        <SecretsForm group={provedor} fields={provedor === 'ses' ? CAMPOS_SES : CAMPOS_RESEND} summary={secrets} />
      </Block>

      <DomainBlock estado={estado} form={form} />

      {provedor === 'resend' && (
        <Block
          title={t('Retorno do Resend (webhook)')}
          description={t('É por aqui que a plataforma fica sabendo de e-mail entregue, devolvido ou marcado como spam. Cole este endereço no Resend (Webhooks → Add Endpoint) e o segredo que ele gerar na chave "Segredo do webhook" acima.')}
        >
          <CopyValue value={webhooks.resend} label={t('o endereço do webhook')} />
          <p className="text-xs text-gray-500">{t('Eventos: email.delivered, email.bounced, email.complained e email.delivery_delayed.')}</p>
          {status.email?.webhook_confirmed_at_ms
            ? <V2Badge tone="green">{t('Recebendo retornos desde {quando}', { quando: quando(status.email.webhook_confirmed_at_ms) })}</V2Badge>
            : <V2Badge tone="amber">{t('Nenhum retorno recebido ainda (normal até o primeiro e-mail sair)')}</V2Badge>}
        </Block>
      )}
      {provedor === 'ses' && (
        <Block
          title={t('Retorno da Amazon SES')}
          description={t('Na SES não há nada para colar: ao preparar o domínio, a plataforma cria sozinha o conjunto de configuração e o tópico do SNS que trazem as devoluções e reclamações para este endereço.')}
        >
          <CopyValue value={webhooks.ses} label={t('o endereço de retorno')} />
          {runtime.ses_events
            ? <V2Badge tone="green">{t('Canal de retornos criado')}</V2Badge>
            : <V2Badge tone="amber">{t('Ainda não criado: clique em "Preparar o domínio"')}</V2Badge>}
        </Block>
      )}

      <SenderBlock form={form} settings={settings} />

      <Block title={t('Teste')} description={t('Manda um e-mail de verdade pelo provedor, com o mesmo modelo dos avisos. Funciona mesmo com o canal desligado, assim que o domínio estiver verificado.')}>
        <TestSend channel="email" />
      </Block>
    </>
  );
}

function ProviderBlock({ form, provedor }) {
  const escolher = (id) => {
    if (id === provedor) return;
    form.salvar({ provider: id });
  };
  return (
    <Block
      title={t('Provedor de e-mail')}
      description={t('Quem entrega os e-mails. Trocar de provedor depois exige preparar e verificar o domínio de novo no provedor novo.')}
    >
      <div className="grid gap-3 md:grid-cols-2" role="radiogroup" aria-label={t('Provedor de e-mail')}>
        {PROVEDORES.map((p) => {
          const ativo = p.id === provedor;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={ativo}
              disabled={form.saving}
              onClick={() => escolher(p.id)}
              className={cn(
                'rounded-2xl border p-4 text-left transition-colors',
                ativo ? 'border-ink bg-paper ring-2 ring-acid/40' : 'border-gray-200 bg-paper-pure hover:border-ink',
              )}
            >
              <span className="flex items-center gap-2 font-display text-base font-bold text-ink">
                {ativo && <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden />} {p.nome}
              </span>
              <span className="mt-1 block text-sm leading-6 text-gray-600">{t(p.resumo)}</span>
            </button>
          );
        })}
      </div>
    </Block>
  );
}

function DomainBlock({ estado, form }) {
  const { settings, status = {} } = estado;
  const acao = useMessagingAdminAction();
  const e = settings.email;
  const st = status.email && status.email.domain === e.domain && status.email.provider === e.provider ? status.email : null;
  const valido = normalizeDomain(form.draft.domain || '');
  const mudouDominio = (form.draft.domain || '') !== (e.domain || '') || form.draft.ses_region !== e.ses_region || form.draft.resend_region !== e.resend_region;

  const rodar = async (action, ok) => {
    try {
      await acao.mutateAsync({ action });
      toast.success(ok);
    } catch (err) { toast.error(err?.message || t('Não foi possível falar com o provedor.')); }
  };
  const conta = st?.account;
  return (
    <Block
      title={t('Domínio')}
      description={t('O domínio de onde os e-mails saem. Enquanto ele não for comprado e verificado, nenhum e-mail sai — o resto pode ficar pronto antes.')}
    >
      <GuideSteps title={t('Como comprar o domínio e publicar os registros DNS')} steps={GUIDE_DOMAIN} />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <V2Field htmlFor="com-dominio" label={t('Domínio')} hint={t('Só o domínio: sem www e sem https://.')} error={form.draft.domain && !valido ? t('Domínio inválido.') : undefined}>
          <V2Input id="com-dominio" value={form.draft.domain || ''} onChange={(ev) => form.set('domain', ev.target.value.trim().toLowerCase())} placeholder="picklerush.com.br" autoComplete="off" spellCheck={false} />
        </V2Field>
        {e.provider === 'ses' ? (
          <V2Field htmlFor="com-regiao" label={t('Região da AWS')} hint={t('A mesma escolhida no console da AWS.')}>
            <V2Select id="com-regiao" value={form.draft.ses_region} onChange={(ev) => form.set('ses_region', ev.target.value)} options={REGIOES_SES} />
          </V2Field>
        ) : (
          <V2Field htmlFor="com-regiao" label={t('Região do Resend')} hint={t('Onde o Resend guarda o domínio.')}>
            <V2Select id="com-regiao" value={form.draft.resend_region} onChange={(ev) => form.set('resend_region', ev.target.value)} options={REGIOES_RESEND} />
          </V2Field>
        )}
        <V2Button type="button" size="sm" disabled={!mudouDominio || (form.draft.domain && !valido) || form.saving} onClick={() => form.salvar()}>
          {form.saving ? t('Salvando…') : t('Salvar o domínio')}
        </V2Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <V2Button type="button" size="sm" variant="secondary" disabled={!e.domain || mudouDominio || acao.isPending} onClick={() => rodar('email_domain_setup', t('Domínio preparado. Agora copie os registros para o DNS.'))}>
          <Wand2 className="h-4 w-4" aria-hidden /> {acao.isPending ? t('Falando com o provedor…') : t('Preparar o domínio')}
        </V2Button>
        <V2Button type="button" size="sm" variant="ghost" disabled={!st || mudouDominio || acao.isPending} onClick={() => rodar('email_domain_check', t('Verificação atualizada.'))}>
          <RefreshCw className="h-4 w-4" aria-hidden /> {t('Verificar agora')}
        </V2Button>
        {st && (st.verified
          ? <V2Badge tone="green"><CheckCircle2 className="h-3 w-3" aria-hidden /> {t('Domínio verificado')}</V2Badge>
          : <V2Badge tone="amber">{t('Esperando o DNS')}</V2Badge>)}
      </div>
      {!e.domain && <p className="text-sm text-gray-500">{t('Salve o domínio para preparar.')}</p>}
      {e.domain && !st && <p className="text-sm text-gray-500">{t('Clique em "Preparar o domínio" para a plataforma cadastrá-lo no provedor e mostrar os registros.')}</p>}

      {st?.records?.length > 0 && <DnsRecords records={st.records} />}

      {st && (
        <Facts items={[
          [t('Preparado em'), quando(st.prepared_at_ms)],
          [t('Última verificação'), quando(st.checked_at_ms)],
          st.verified_at_ms ? [t('Verificado em'), quando(st.verified_at_ms)] : null,
          ...Object.entries(st.checks || {}).map(([k, v]) => [ROTULO_CHECK[k] ? t(ROTULO_CHECK[k]) : k, DNS_CHECK_META[v] ? t(DNS_CHECK_META[v]) : String(v || '—')]),
          conta ? [t('Conta da SES'), conta.production ? t('Produção (pode mandar para qualquer endereço)') : t('Modo de teste (sandbox): só endereços verificados')] : null,
          conta && conta.max_24h ? [t('Cota de 24 horas'), t('{enviados} de {maximo} enviados', { enviados: fmtNumero(conta.sent_24h || 0), maximo: fmtNumero(conta.max_24h) })] : null,
          conta && conta.max_rate ? [t('Velocidade máxima'), t('{n} por segundo', { n: fmtNumero(conta.max_rate) })] : null,
        ]}
        />
      )}
    </Block>
  );
}

function DnsRecords({ records }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-ink">{t('Registros para colar no DNS ({n})', { n: records.length })}</p>
      <ul className="space-y-3">
        {records.map((r, i) => (
          <li key={`${r.type}-${r.name}-${i}`} className="space-y-2 rounded-2xl border border-gray-100 bg-paper p-4">
            <div className="flex flex-wrap items-center gap-2">
              <V2Badge tone="ink">{r.type}</V2Badge>
              {r.priority !== undefined && r.priority !== null && <V2Badge>{t('Prioridade {n}', { n: r.priority })}</V2Badge>}
              {r.status && <V2Badge tone={/verified|success/i.test(r.status) ? 'green' : 'amber'}>{DNS_CHECK_META[r.status] ? t(DNS_CHECK_META[r.status]) : r.status}</V2Badge>}
              {r.purpose && DNS_PURPOSE_META[r.purpose] && <span className="text-xs text-gray-500">{t(DNS_PURPOSE_META[r.purpose])}</span>}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="min-w-0"><p className="mb-1 text-xs text-gray-500">{t('Nome (host)')}</p><CopyValue value={r.name} label={t('o nome')} /></div>
              <div className="min-w-0"><p className="mb-1 text-xs text-gray-500">{t('Valor')}</p><CopyValue value={r.value} label={t('o valor')} /></div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SenderBlock({ form, settings }) {
  const d = form.draft;
  const exemplo = fromAddress({ email: { ...settings.email, from_local: d.from_local || settings.email.from_local, domain: settings.email.domain || 'seudominio.com.br' } });
  return (
    <Block
      title={t('Remetente e rodapé')}
      description={t('Como os e-mails aparecem na caixa de entrada de quem recebe.')}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <V2Field htmlFor="com-from-name" label={t('Nome do remetente')} hint={t('Aparece antes do assunto, na lista de e-mails.')}>
          <V2Input id="com-from-name" value={d.from_name || ''} maxLength={60} onChange={(ev) => form.set('from_name', ev.target.value)} />
        </V2Field>
        <V2Field htmlFor="com-from-local" label={t('Endereço do remetente')} hint={t('Fica assim: {endereco}. Ninguém precisa ler esta caixa; as respostas vão para o endereço abaixo.', { endereco: exemplo })}>
          <V2Input id="com-from-local" value={d.from_local || ''} maxLength={64} onChange={(ev) => form.set('from_local', ev.target.value.trim().toLowerCase())} placeholder="avisos" autoComplete="off" spellCheck={false} />
        </V2Field>
        <V2Field htmlFor="com-reply" label={t('Responder para')} hint={t('Uma caixa que alguém lê (ex.: o e-mail do suporte). Em branco, a resposta volta para o endereço do remetente e se perde.')}>
          <V2Input id="com-reply" type="email" value={d.reply_to || ''} onChange={(ev) => form.set('reply_to', ev.target.value.trim())} placeholder="suporte@seudominio.com.br" />
        </V2Field>
        <V2Field htmlFor="com-endereco" label={t('Endereço da empresa')} hint={t('Recomendado: as leis contra spam (e os grandes provedores) pedem um endereço físico no rodapé de quem manda e-mail em quantidade.')}>
          <V2Input id="com-endereco" value={d.postal_address || ''} maxLength={200} onChange={(ev) => form.set('postal_address', ev.target.value)} />
        </V2Field>
        <V2Field htmlFor="com-rodape" label={t('Recado no rodapé')} hint={t('Opcional, até 300 caracteres. Vai em todo e-mail, abaixo do aviso.')} className="md:col-span-2">
          <V2Textarea id="com-rodape" rows={2} value={d.footer_note || ''} maxLength={300} onChange={(ev) => form.set('footer_note', ev.target.value)} />
        </V2Field>
      </div>
      <div className="rounded-2xl border border-gray-100 bg-paper p-4">
        <V2Toggle
          id="com-login-emails"
          checked={d.login_emails === true}
          onChange={(v) => form.set('login_emails', v)}
          label={t('Mandar o "esqueci a senha" e a confirmação de e-mail pelo domínio')}
          hint={t('Ligado, esses e-mails saem do seu domínio, com a marca do PickleRush e no idioma da pessoa. Desligado (ou se o provedor falhar), saem pelo Firebase, como hoje. O modelo do Firebase não é alterado, porque o projeto é dividido com outro aplicativo.')}
        />
      </div>
      <SaveBar form={form} />
    </Block>
  );
}
