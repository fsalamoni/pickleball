/**
 * Comunicações → WhatsApp, SMS e Push.
 *  - WhatsApp: identificadores, token, webhook, modelos da Meta, custo, teste.
 *  - SMS: provedor (Twilio ou Zenvia), chaves, remetente, custo, teste.
 *  - Push: a chave pública do Web Push (o resto o Firebase já faz) e o
 *    teste de ponta a ponta neste aparelho.
 */
import React, { useState } from 'react';
import { BellRing, CheckCircle2, RefreshCw, Send, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMessagingAdminAction } from '@/modules/messaging/hooks/useMessaging';
import { PUSH_FAILURE_META, PUSH_TEST_ERROR_META, WA_TEMPLATE_STATUS_META } from '@/modules/messaging/domain/meta';
import { normalizeVapidKey, vapidKeyProblem } from '@/modules/messaging/domain/policy';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  enablePush, forgetVapidKey, getPermissionState, hasBuildVapidKey, isPushActiveHere,
} from '@/core/services/pushService';
import { GUIDE_PUSH, GUIDE_TWILIO, GUIDE_WHATSAPP, GUIDE_ZENVIA } from '@/modules/messaging/domain/guides';
import { cn } from '@/core/lib/utils';
import { V2Badge, V2Button, V2Field, V2Input } from '@/v2/ui/primitives';
import { t, tk, fmtMoeda, idiomaAtivo } from '@/core/i18n';
import {
  Block, ChannelSwitch, CopyValue, Facts, GuideSteps, MissingChecklist, NumInput, SaveBar, SecretsForm, TestSend, numero, quando, useSectionDraft,
} from './messagingUi';

export default function MessagingPhoneTabs({ tab, estado }) {
  if (tab === 'com-whatsapp') return <WhatsAppTab estado={estado} />;
  if (tab === 'com-sms') return <SmsTab estado={estado} />;
  return <PushTab estado={estado} />;
}

const custo = (v) => (Number.isFinite(Number(v)) ? fmtMoeda(Number(v)) : '—');

/* ------------------------------------------------------------ WhatsApp -- */

const CAMPOS_WA = [
  { key: 'access_token', label: tk('Token de acesso (permanente)'), hint: tk('Do usuário do sistema, com validade "Never". O token de 24 horas da tela API Setup não serve.') },
  { key: 'app_secret', label: tk('Segredo do app'), hint: tk('App settings → Basic → App secret. Confere que os retornos vieram da Meta.') },
];

function WhatsAppTab({ estado }) {
  const { settings, secrets, missing, status = {}, webhooks = {} } = estado;
  const form = useSectionDraft(settings, 'whatsapp');
  const acao = useMessagingAdminAction();
  const [token, setToken] = useState('');
  const d = form.draft;
  const wa = status.whatsapp || {};
  const rodar = async (action, ok) => {
    try {
      const r = await acao.mutateAsync({ action });
      toast.success(ok);
      return r;
    } catch (err) { toast.error(err?.message || t('Não foi possível falar com a Meta.')); return null; }
  };
  const gerarToken = async () => {
    const r = await rodar('whatsapp_verify_token', t('Token gerado. Cole na Meta agora: ele não aparece de novo.'));
    if (r?.token) setToken(r.token);
  };
  const temIds = Boolean(settings.whatsapp.phone_number_id && settings.whatsapp.waba_id);
  const temToken = Boolean(secrets?.whatsapp?.access_token?.set);
  return (
    <>
      <Block title={t('O que falta para o WhatsApp funcionar')} action={<ChannelSwitch channel="whatsapp" section="whatsapp" settings={settings} missing={missing} />}>
        <MissingChecklist channel="whatsapp" missing={missing} />
        <p className="text-xs text-gray-500">{t('Só recebe por WhatsApp quem confirmou o celular e disse "sim" nas Configurações. O mesmo canal pode mandar o código de confirmação do celular.')}</p>
      </Block>

      <Block title={t('Conta do WhatsApp na Meta')} description={t('A plataforma usa a API oficial (WhatsApp Cloud API). Fora da conversa que a pessoa começou, a Meta só deixa mandar mensagens com modelo aprovado — por isso os modelos abaixo.')}>
        <GuideSteps title={t('Como criar a conta, o número e o token na Meta')} steps={GUIDE_WHATSAPP} />
        <div className="grid gap-4 md:grid-cols-2">
          <V2Field htmlFor="wa-phone-id" label={t('Phone number ID')} hint={t('WhatsApp → API Setup. Só números.')}>
            <V2Input id="wa-phone-id" inputMode="numeric" value={d.phone_number_id || ''} onChange={(e) => form.set('phone_number_id', e.target.value.replace(/\D/g, ''))} />
          </V2Field>
          <V2Field htmlFor="wa-waba-id" label={t('WhatsApp Business Account ID')} hint={t('Na mesma tela. Só números.')}>
            <V2Input id="wa-waba-id" inputMode="numeric" value={d.waba_id || ''} onChange={(e) => form.set('waba_id', e.target.value.replace(/\D/g, ''))} />
          </V2Field>
          <V2Field htmlFor="wa-custo" label={t('Custo por mensagem (R$)')} hint={t('O valor que a Meta cobra por mensagem de Utilidade no Brasil. Entra no orçamento do mês.')}>
            <NumInput id="wa-custo" decimal value={d.unit_cost_brl} onChange={(n) => form.set('unit_cost_brl', n)} />
          </V2Field>
          <V2Field htmlFor="wa-graph" label={t('Versão da API da Meta')} hint={t('Deixe como está, a não ser que a Meta avise que esta versão vai sair.')}>
            <V2Input id="wa-graph" value={d.graph_version || ''} onChange={(e) => form.set('graph_version', e.target.value.trim())} placeholder="v23.0" />
          </V2Field>
        </div>
        <details className="rounded-2xl border border-gray-100 bg-paper p-4">
          <summary className="cursor-pointer text-sm font-bold text-ink">{t('Nomes dos modelos (avançado)')}</summary>
          <p className="mt-2 text-xs text-gray-500">{t('Só mude se você criou os modelos com outro nome na Meta. Letras minúsculas, números e _.')}</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <V2Field htmlFor="wa-tpl-aviso" label={t('Modelo do aviso')}>
              <V2Input id="wa-tpl-aviso" value={d.template_aviso || ''} onChange={(e) => form.set('template_aviso', e.target.value.trim())} />
            </V2Field>
            <V2Field htmlFor="wa-tpl-codigo" label={t('Modelo do código')}>
              <V2Input id="wa-tpl-codigo" value={d.template_codigo || ''} onChange={(e) => form.set('template_codigo', e.target.value.trim())} />
            </V2Field>
          </div>
        </details>
        <SaveBar form={form} />
      </Block>

      <Block title={t('Chaves do WhatsApp')} description={t('Ficam guardadas só no servidor. Para trocar, cole a nova por cima; para manter, deixe em branco.')}>
        <SecretsForm group="whatsapp" fields={CAMPOS_WA} summary={secrets} />
      </Block>

      <Block
        title={t('Retorno do WhatsApp (webhook)')}
        description={t('Por aqui chegam a entrega, a leitura, a falha e o PARAR de quem não quer mais receber. Na Meta: WhatsApp → Configuration → Webhook → Edit, cole o endereço e o token de verificação, e assine o campo "messages".')}
      >
        <div><p className="mb-1 text-xs text-gray-500">{t('Callback URL')}</p><CopyValue value={webhooks.whatsapp} label={t('o endereço do webhook')} /></div>
        <div className="space-y-2">
          <p className="text-xs text-gray-500">{t('Verify token')}</p>
          {token
            ? <CopyValue value={token} label={t('o token de verificação')} />
            : (
              <p className="text-sm text-gray-600">
                {secrets?.whatsapp?.verify_token?.set ? t('Já existe um token gravado. Gere outro só se for configurar o webhook de novo.') : t('Ainda não há token. Gere um e cole na Meta.')}
              </p>
            )}
          <V2Button type="button" size="sm" variant="ghost" disabled={acao.isPending} onClick={gerarToken}>{t('Gerar token de verificação')}</V2Button>
        </div>
        {wa.webhook_confirmed_at_ms
          ? <V2Badge tone="green">{t('A Meta confirmou o webhook em {quando}', { quando: quando(wa.webhook_confirmed_at_ms) })}</V2Badge>
          : <V2Badge tone="amber">{t('A Meta ainda não confirmou o webhook')}</V2Badge>}
      </Block>

      <Block
        title={t('Modelos de mensagem e número')}
        description={t('Dois modelos, em português, inglês e espanhol: o aviso (Utilidade: título, texto e botão "Abrir") e o código de confirmação do celular (Autenticação). A plataforma cria os dois na Meta para você.')}
      >
        <div className="flex flex-wrap gap-3">
          <V2Button type="button" size="sm" variant="secondary" disabled={!temIds || !temToken || acao.isPending} onClick={() => rodar('whatsapp_templates_create', t('Modelos enviados para a análise da Meta.'))}>
            <Wand2 className="h-4 w-4" aria-hidden /> {acao.isPending ? t('Falando com a Meta…') : t('Criar os modelos na Meta')}
          </V2Button>
          <V2Button type="button" size="sm" variant="ghost" disabled={!temIds || !temToken || acao.isPending} onClick={() => rodar('whatsapp_check', t('Situação atualizada.'))}>
            <RefreshCw className="h-4 w-4" aria-hidden /> {t('Conferir na Meta')}
          </V2Button>
        </div>
        {(!temIds || !temToken) && <p className="text-sm text-gray-500">{t('Salve os identificadores e o token primeiro.')}</p>}
        {wa.templates_error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-600">{t('A Meta respondeu: {erro}', { erro: wa.templates_error })}</p>}
        {wa.templates?.length > 0 && (
          <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
            {wa.templates.map((m) => (
              <li key={`${m.name}-${m.language}`} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span className="font-mono text-xs text-ink">{m.name} · {m.language}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {m.category && <span className="text-xs text-gray-500">{m.category}</span>}
                  <V2Badge tone={m.status === 'APPROVED' ? 'green' : m.status === 'REJECTED' ? 'red' : 'amber'}>
                    {WA_TEMPLATE_STATUS_META[m.status] ? t(WA_TEMPLATE_STATUS_META[m.status]) : m.status}
                  </V2Badge>
                </span>
                {m.rejected_reason && m.rejected_reason !== 'NONE' && <p className="w-full text-xs text-red-600">{t('Motivo da recusa: {motivo}', { motivo: m.rejected_reason })}</p>}
              </li>
            ))}
          </ul>
        )}
        {wa.number_error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-600">{t('A Meta respondeu: {erro}', { erro: wa.number_error })}</p>}
        {wa.number && (
          <Facts items={[
            [t('Número'), wa.number.display_phone || '—'],
            [t('Nome aprovado'), wa.number.verified_name || '—'],
            [t('Qualidade'), wa.number.quality || '—'],
            [t('Situação do nome'), wa.number.name_status || '—'],
            [t('Conferido em'), quando(wa.checked_at_ms)],
          ]}
          />
        )}
      </Block>

      <Block title={t('Teste')} description={t('Manda o modelo de aviso para um celular. Funciona com o canal desligado, assim que os modelos estiverem aprovados.')}>
        <TestSend channel="whatsapp" />
      </Block>
    </>
  );
}

/* ----------------------------------------------------------------- SMS -- */

const PROVEDORES_SMS = [
  { id: 'twilio', nome: 'Twilio', resumo: tk('Funciona no mundo todo, cobra em dólar e traz de volta a entrega e o PARAR.') },
  { id: 'zenvia', nome: 'Zenvia', resumo: tk('Brasileira, cobra em reais e entrega bem no Brasil. As respostas (PARAR) não voltam para a plataforma.') },
];
const CAMPOS_TWILIO = [
  { key: 'account_sid', label: tk('Account SID'), hint: tk('Começa com AC e tem 34 caracteres.'), placeholder: 'AC…' },
  { key: 'auth_token', label: tk('Auth Token'), hint: tk('Account Info, na página inicial do console.') },
];
const CAMPOS_ZENVIA = [
  { key: 'api_token', label: tk('Token da API'), hint: tk('Developers → Tokens e Webhooks.') },
];

function SmsTab({ estado }) {
  const { settings, secrets, missing, webhooks = {} } = estado;
  const form = useSectionDraft(settings, 'sms');
  const d = form.draft;
  const provedor = settings.sms.provider;
  return (
    <>
      <Block title={t('O que falta para o SMS funcionar')} action={<ChannelSwitch channel="sms" section="sms" settings={settings} missing={missing} />}>
        <MissingChecklist channel="sms" missing={missing} />
        <p className="text-xs text-gray-500">{t('SMS é o canal mais caro: por padrão só vai o que tem prazo (jogos, reservas, aulas). Só recebe quem confirmou o celular e disse "sim" nas Configurações.')}</p>
      </Block>

      <Block title={t('Provedor de SMS')} description={t('Trocar de provedor não perde nada: só passa a usar as chaves do outro.')}>
        <div className="grid gap-3 md:grid-cols-2" role="radiogroup" aria-label={t('Provedor de SMS')}>
          {PROVEDORES_SMS.map((p) => {
            const ativo = p.id === provedor;
            return (
              <button type="button"
                key={p.id}
                                role="radio"
                aria-checked={ativo}
                disabled={form.saving}
                onClick={() => { if (!ativo) form.salvar({ provider: p.id }); }}
                className={cn('rounded-2xl border p-4 text-left transition-colors', ativo ? 'border-ink bg-paper ring-2 ring-acid/40' : 'border-gray-200 bg-paper-pure hover:border-ink')}
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

      <Block title={provedor === 'twilio' ? t('Conta da Twilio') : t('Conta da Zenvia')}>
        <GuideSteps title={provedor === 'twilio' ? t('Como criar a conta e o remetente na Twilio') : t('Como criar a conta e o token na Zenvia')} steps={provedor === 'twilio' ? GUIDE_TWILIO : GUIDE_ZENVIA} />
        <SecretsForm group={provedor} fields={provedor === 'twilio' ? CAMPOS_TWILIO : CAMPOS_ZENVIA} summary={secrets} />
      </Block>

      <Block title={t('Remetente e custo')}>
        <div className="grid gap-4 md:grid-cols-3">
          <V2Field htmlFor="sms-sender" label={t('Remetente')} hint={provedor === 'twilio' ? t('O SID do Messaging Service (MG…) ou o número no formato +15550001111.') : t('O identificador do canal de SMS da sua conta Zenvia.')}>
            <V2Input id="sms-sender" value={d.sender || ''} onChange={(e) => form.set('sender', e.target.value.trim())} autoComplete="off" spellCheck={false} />
          </V2Field>
          <V2Field htmlFor="sms-custo" label={t('Custo por SMS (R$)')} hint={t('O preço de um SMS de até 160 letras. Mensagem maior conta como várias. Entra no orçamento do mês.')}>
            <NumInput id="sms-custo" decimal value={d.unit_cost_brl} onChange={(n) => form.set('unit_cost_brl', n)} />
          </V2Field>
          <V2Field htmlFor="sms-max" label={t('Tamanho máximo (letras)')} hint={t('O aviso é cortado neste tamanho, com o link no fim. 300 letras dão cerca de 2 SMS.')}>
            <NumInput id="sms-max" value={d.max_chars} onChange={(n) => form.set('max_chars', n)} />
          </V2Field>
        </div>
        <p className="text-xs text-gray-500">{t('Custo atual gravado: {valor} por SMS.', { valor: custo(settings.sms.unit_cost_brl) })}</p>
        <SaveBar form={form} />
      </Block>

      {provedor === 'twilio' && (
        <Block title={t('Respostas (PARAR)')} description={t('Cole este endereço na Twilio, no número ou no Messaging Service, em "A message comes in" (Webhook, HTTP POST). Quem responder PARAR, SAIR ou STOP deixa de receber SMS.')}>
          <CopyValue value={webhooks.twilio} label={t('o endereço do webhook')} />
        </Block>
      )}

      <Block title={t('Teste')} description={t('Manda um SMS de exemplo. Funciona com o canal desligado, assim que as chaves e o remetente estiverem salvos.')}>
        <TestSend channel="sms" />
      </Block>
    </>
  );
}

/* ---------------------------------------------------------------- Push -- */

const PROBLEMA_DA_CHAVE = {
  private_key: tk('Esta é a chave PRIVADA (43 letras). Cole a pública: a da coluna "Key pair", com 87 letras, começando por B.'),
  format: tk('Isto não parece a chave pública do Web Push: ela tem 87 letras (só letras, números, - e _) e começa por B.'),
};

function PushTab({ estado }) {
  const { user } = useAuth();
  const form = useSectionDraft(estado.settings, 'push');
  const valor = form.draft.vapid_public_key || '';
  const problema = valor ? vapidKeyProblem(valor) : '';
  const gravado = estado.settings.push?.vapid_public_key || '';
  const configurado = Boolean(gravado || hasBuildVapidKey);
  const salvar = async () => {
    // A tela que já tinha perguntado pela chave não fica com a resposta velha.
    if (await form.salvar()) forgetVapidKey();
  };
  return (
    <>
      <Block
        title={t('Push (notificação no aparelho)')}
        description={t('O push usa o Firebase Cloud Messaging, que já faz parte do projeto. Só falta a chave pública do Web Push: com ela, as pessoas veem "Ativar notificações push" nas Configurações. O push não tem custo por envio e não tem interruptor próprio: com a chave salva, ele está pronto.')}
      >
        <GuideSteps title={t('Como pegar a chave pública no Firebase')} steps={GUIDE_PUSH} defaultOpen={!gravado} />
        {hasBuildVapidKey && (
          <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-700">
            {t('Este build tem a chave na variável VITE_FIREBASE_VAPID_KEY, e ela vale no lugar da salva aqui.')}
          </p>
        )}
        <V2Field htmlFor="push-vapid" label={t('Chave pública do Web Push (VAPID)')} hint={t('Espaços e "=" no fim são tirados sozinhos.')} error={problema ? t(PROBLEMA_DA_CHAVE[problema] || PROBLEMA_DA_CHAVE.format) : undefined}>
          <V2Input id="push-vapid" value={valor} onChange={(e) => form.set('vapid_public_key', normalizeVapidKey(e.target.value))} autoComplete="off" spellCheck={false} placeholder="B…" />
        </V2Field>
        <div className="flex flex-wrap items-center gap-3">
          <V2Button type="button" size="sm" disabled={!form.dirty || Boolean(problema) || form.saving} onClick={salvar}>{form.saving ? t('Salvando…') : t('Salvar a chave')}</V2Button>
          {gravado ? <V2Badge tone="green">{t('Chave salva')}</V2Badge> : <V2Badge tone="amber">{t('Sem chave')}</V2Badge>}
          <span className="text-xs text-gray-500">{t('Aparelhos com o push ativo: {n}', { n: numero(estado.people?.push_devices) })}</span>
        </div>
      </Block>

      <Block
        title={t('Testar neste aparelho')}
        description={t('A prova de que tudo conversa (chave, navegador e Firebase): ative o push neste aparelho e mande um push de teste para você. Se ele aparecer, as pessoas também vão receber.')}
      >
        <PushDeviceTest user={user} configurado={configurado} />
      </Block>

      <Block title={t('Como o push funciona')}>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-gray-600">
          <li>{t('Cada pessoa ativa em Configurações → Notificações push, aparelho por aparelho.')}</li>
          <li>{t('Todo aviso do sino vira push. Com a chave geral ligada, ele obedece às áreas da aba Regras (coluna Push), à escolha de cada pessoa e ao horário de silêncio de quem o estendeu ao push.')}</li>
          <li>{t('Com o app aberto e à vista, o aviso fica só no sino, sem notificação. O teste daqui aparece sempre.')}</li>
          <li>{t('No iPhone e no iPad, o push só funciona com o PickleRush adicionado à Tela de Início (iOS 16.4 ou mais novo).')}</li>
          <li>{t('Aparelho que deixou de receber (push desativado, navegador limpo) sai da lista sozinho no envio seguinte.')}</li>
        </ul>
      </Block>
    </>
  );
}

function PushDeviceTest({ user, configurado }) {
  const acao = useMessagingAdminAction();
  const uid = user?.uid || null;
  const lerAparelho = () => ({ permissao: getPermissionState(), ativo: isPushActiveHere(uid) });
  const [aparelho, setAparelho] = useState(lerAparelho);
  const [ativando, setAtivando] = useState(false);
  const [falha, setFalha] = useState(null);
  const [resultado, setResultado] = useState(null);

  const ativar = async () => {
    setAtivando(true);
    setFalha(null);
    const r = await enablePush(user);
    setAtivando(false);
    setAparelho(lerAparelho());
    if (r.ok) toast.success(t('Push ativado neste aparelho.'));
    else setFalha(r);
  };
  const testar = async () => {
    setResultado(null);
    try {
      setResultado(await acao.mutateAsync({ action: 'push_test', lang: idiomaAtivo() }));
    } catch (err) {
      setResultado({ ok: false, devices: null, errors: [err?.message || t('sem detalhe')] });
    }
  };

  if (!configurado) {
    return <p className="text-sm text-gray-600">{t('Salve a chave acima para poder testar.')}</p>;
  }
  const meta = falha ? (PUSH_FAILURE_META[falha.reason] || PUSH_FAILURE_META.error) : null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {aparelho.permissao === 'unsupported' && <p className="text-sm text-gray-600">{t(PUSH_FAILURE_META.unsupported.label)}</p>}
        {aparelho.permissao === 'denied' && <p className="text-sm text-gray-600">{t(PUSH_FAILURE_META.denied.label)}</p>}
        {aparelho.ativo && <V2Badge tone="green"><CheckCircle2 className="h-3 w-3" aria-hidden /> {t('Ativo neste aparelho')}</V2Badge>}
        {!aparelho.ativo && !['unsupported', 'denied'].includes(aparelho.permissao) && (
          <V2Button type="button" size="sm" variant="secondary" disabled={ativando} onClick={ativar}>
            <BellRing className="h-4 w-4" aria-hidden /> {ativando ? t('Ativando…') : t('Ativar o push neste aparelho')}
          </V2Button>
        )}
        <V2Button type="button" size="sm" disabled={acao.isPending} onClick={testar}>
          <Send className="h-4 w-4" aria-hidden /> {acao.isPending ? t('Enviando…') : t('Mandar um push de teste para mim')}
        </V2Button>
      </div>
      {meta && (
        <div className="space-y-1 rounded-2xl bg-red-50 p-3 text-sm text-red-600">
          <p>{t(meta.admin || meta.label)}</p>
          {falha.detail && <p className="text-xs">{t('Detalhe do navegador: {erro}', { erro: falha.detail })}</p>}
        </div>
      )}
      {resultado && <PushTestResult r={resultado} />}
    </div>
  );
}

function PushTestResult({ r }) {
  if (r.devices === 0) {
    return (
      <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-700">
        {t('Você ainda não tem o push ativo em nenhum aparelho. Ative neste aparelho (botão acima) e mande o teste de novo.')}
      </p>
    );
  }
  const erros = (r.errors || []).map((e) => (PUSH_TEST_ERROR_META[e] ? t(PUSH_TEST_ERROR_META[e]) : e));
  return (
    <div className={cn('space-y-1 rounded-2xl p-3 text-sm', r.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
      {r.ok ? (
        <p>{t('Enviado para {sent} de {devices} aparelho(s). A notificação aparece em segundos; se não aparecer, confira se o sistema não está em "Não perturbe" e se as notificações do navegador estão liberadas.', { sent: r.sent, devices: r.devices })}</p>
      ) : (
        <p>{t('O push não saiu.')}</p>
      )}
      {erros.map((e) => <p key={e} className="text-xs">• {e}</p>)}
    </div>
  );
}
