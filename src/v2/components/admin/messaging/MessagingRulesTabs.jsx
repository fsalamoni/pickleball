/**
 * Comunicações → Regras (o que vai por onde, horários, resumo, código do
 * celular) e Limites (tetos por dia e orçamento do mês).
 *
 * A matriz é ÁREA × CANAL: para cada uma, o admin decide se o canal está
 * desligado, se a pessoa escolhe (com um padrão) ou se vai sempre. O que a
 * pessoa vê nas Configurações sai daqui (`effectiveValue`).
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useSaveMessagingSettings } from '@/modules/messaging/hooks/useMessaging';
import { AREAS, CHANNELS, EMAIL_MODES } from '@/modules/messaging/domain/policy';
import { AREA_MODE_META, CHANNEL_META, EMAIL_MODE_META, WEEKDAY_LABELS } from '@/modules/messaging/domain/meta';
import { noticeAreaMeta } from '@/modules/notifications/domain/noticeFeed';
import { V2Button, V2Field, V2Input, V2Select } from '@/v2/ui/primitives';
import { t, tk, fmtMoeda } from '@/core/i18n';
import { Block, NumInput, SaveBar, useSectionDraft } from './messagingUi';

export default function MessagingRulesTabs({ tab, estado }) {
  return tab === 'com-limites' ? <LimitsTab estado={estado} /> : <RulesTab estado={estado} />;
}

/* --------------------------------------------------------------- regras -- */

const MODOS = ['off', 'optional', 'always'];
const SIM_NAO = [{ value: 'true', label: tk('Ligado') }, { value: 'false', label: tk('Desligado') }];

function RulesTab({ estado }) {
  const { settings } = estado;
  return (
    <>
      <MatrixBlock settings={settings} />
      <TimesBlock settings={settings} />
      <VerificationBlock settings={settings} />
    </>
  );
}

function MatrixBlock({ settings }) {
  const form = useSectionDraft(settings, 'matrix');
  const m = form.draft;
  const mudar = (area, ch, campo, valor) => form.setDraft((atual) => {
    const cel = { ...atual[area][ch], [campo]: valor };
    if (campo === 'mode' && valor === 'always' && (cel.default === 'nao' || cel.default === false)) cel.default = ch === 'email' ? 'imediato' : true;
    return { ...atual, [area]: { ...atual[area], [ch]: cel } };
  });
  return (
    <Block
      title={t('O que vai por onde')}
      description={t('Para cada área de aviso e cada canal: "Desligado" (nunca vai e a pessoa nem vê a opção), "A pessoa escolhe" (vale o padrão até ela mudar) ou "Sempre" (vai mesmo que ela desligue — só para o indispensável). Promoções e novidades só vão para quem aceitou receber novidades, e nunca podem ser "Sempre".')}
    >
      <ul className="grid gap-x-6 gap-y-1 rounded-2xl bg-paper p-4 text-xs leading-5 text-gray-600 md:grid-cols-3">
        {MODOS.map((k) => <li key={k}><strong className="text-ink">{t(AREA_MODE_META[k].label)}:</strong> {t(AREA_MODE_META[k].hint)}</li>)}
      </ul>
      <div className="space-y-3">
        {AREAS.map((area) => (
          <fieldset key={area} className="rounded-2xl border border-gray-100 p-4">
            <legend className="px-1 text-sm font-bold text-ink">{t(noticeAreaMeta(area).label)}</legend>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {CHANNELS.map((ch) => {
                const cel = m[area]?.[ch] || { mode: 'off' };
                const modos = area === 'promocoes' ? MODOS.filter((x) => x !== 'always') : MODOS;
                const idModo = `matriz-${area}-${ch}-modo`;
                const idPadrao = `matriz-${area}-${ch}-padrao`;
                return (
                  <div key={ch} className="space-y-2 rounded-xl bg-paper p-3">
                    <label htmlFor={idModo} className="block text-xs font-bold text-ink">{t(CHANNEL_META[ch].label)}</label>
                    <V2Select id={idModo} value={cel.mode} onChange={(e) => mudar(area, ch, 'mode', e.target.value)} options={modos.map((k) => ({ value: k, label: t(AREA_MODE_META[k].label) }))} />
                    {cel.mode !== 'off' && (
                      <>
                        <label htmlFor={idPadrao} className="block text-xs text-gray-500">{cel.mode === 'always' ? t('Como vai') : t('Padrão')}</label>
                        {ch === 'email' ? (
                          <V2Select
                            id={idPadrao}
                            value={cel.default}
                            onChange={(e) => mudar(area, ch, 'default', e.target.value)}
                            options={EMAIL_MODES.filter((k) => cel.mode !== 'always' || k !== 'nao').map((k) => ({ value: k, label: t(EMAIL_MODE_META[k].label) }))}
                          />
                        ) : (
                          <V2Select
                            id={idPadrao}
                            value={String(cel.default === true)}
                            onChange={(e) => mudar(area, ch, 'default', e.target.value === 'true')}
                            options={SIM_NAO.filter((o) => cel.mode !== 'always' || o.value === 'true').map((o) => ({ value: o.value, label: t(o.label) }))}
                          />
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <p className="text-xs text-gray-500">{t('WhatsApp e SMS ligados por padrão só valem depois que a pessoa confirma o celular e diz "sim" ao canal. O e-mail vale para quem confirmou o e-mail.')}</p>
      <SaveBar form={form} label={t('Salvar as regras')} />
    </Block>
  );
}

const HORAS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${String(h).padStart(2, '0')}:00` }));

function TimesBlock({ settings }) {
  const quiet = useSectionDraft(settings, 'quiet_hours');
  const digest = useSectionDraft(settings, 'digest');
  const save = useSaveMessagingSettings();
  const [atraso, setAtraso] = useState(settings.chat_delay_minutes);
  useEffect(() => { setAtraso(settings.chat_delay_minutes); }, [settings.chat_delay_minutes]);
  const salvarAtraso = async () => {
    try {
      await save.mutateAsync({ patch: { chat_delay_minutes: atraso }, section: 'chat_delay_minutes' });
      toast.success(t('Configuração salva.'));
    } catch (err) { toast.error(err?.message || t('Não foi possível salvar.')); }
  };
  return (
    <Block title={t('Horários')} description={t('Os horários seguem o de Brasília.')}>
      <div className="space-y-3 rounded-2xl border border-gray-100 p-4">
        <p className="text-sm font-bold text-ink">{t('Horário silencioso')}</p>
        <p className="text-xs leading-5 text-gray-500">{t('WhatsApp e SMS que cairiam neste horário esperam ele acabar. Vale para todo mundo; cada pessoa pode escolher o próprio horário (e estender ao push) nas Configurações. O e-mail não espera: ele não toca no celular.')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field htmlFor="quiet-start" label={t('Começa às')}>
            <V2Input id="quiet-start" type="time" value={quiet.draft.start || ''} onChange={(e) => quiet.set('start', e.target.value)} />
          </V2Field>
          <V2Field htmlFor="quiet-end" label={t('Termina às')}>
            <V2Input id="quiet-end" type="time" value={quiet.draft.end || ''} onChange={(e) => quiet.set('end', e.target.value)} />
          </V2Field>
        </div>
        <SaveBar form={quiet} />
      </div>

      <div className="space-y-3 rounded-2xl border border-gray-100 p-4">
        <p className="text-sm font-bold text-ink">{t('Resumo por e-mail')}</p>
        <p className="text-xs leading-5 text-gray-500">{t('Quem escolhe "Resumo do dia" recebe um e-mail por dia neste horário; "Resumo da semana", um por semana, no dia escolhido. Avisos já lidos no aplicativo saem do resumo.')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field htmlFor="digest-hour" label={t('Horário do resumo')}>
            <V2Select id="digest-hour" value={String(digest.draft.hour)} onChange={(e) => digest.set('hour', Number(e.target.value))} options={HORAS} />
          </V2Field>
          <V2Field htmlFor="digest-day" label={t('Dia do resumo semanal')}>
            <V2Select id="digest-day" value={String(digest.draft.weekly_day)} onChange={(e) => digest.set('weekly_day', Number(e.target.value))} options={WEEKDAY_LABELS.map((l, i) => ({ value: String(i), label: t(l) }))} />
          </V2Field>
        </div>
        <SaveBar form={digest} />
      </div>

      <div className="space-y-3 rounded-2xl border border-gray-100 p-4">
        <p className="text-sm font-bold text-ink">{t('Mensagens de conversa')}</p>
        <V2Field htmlFor="chat-delay" label={t('Esperar antes de mandar por e-mail (minutos)')} hint={t('Mensagem de chat espera este tempo: se a pessoa ler no aplicativo antes, o e-mail não sai. Zero manda na hora.')}>
          <NumInput id="chat-delay" value={atraso} onChange={(n) => setAtraso(Math.min(240, Math.max(0, n)))} className="sm:max-w-[10rem]" />
        </V2Field>
        <V2Button type="button" size="sm" disabled={atraso === settings.chat_delay_minutes || save.isPending} onClick={salvarAtraso}>{save.isPending ? t('Salvando…') : t('Salvar')}</V2Button>
      </div>
    </Block>
  );
}

const CANAIS_DE_CODIGO = [
  { value: 'auto', label: tk('Automático: WhatsApp, e SMS se o WhatsApp não estiver pronto') },
  { value: 'whatsapp', label: tk('WhatsApp primeiro') },
  { value: 'sms', label: tk('SMS primeiro') },
];

function VerificationBlock({ settings }) {
  const form = useSectionDraft(settings, 'verification');
  return (
    <Block
      title={t('Código de confirmação do celular')}
      description={t('Para receber por WhatsApp ou SMS, a pessoa confirma o número com um código de 6 números, que vale 10 minutos. Até 5 códigos por dia por pessoa, e o código também conta no orçamento.')}
    >
      <V2Field htmlFor="verif-canal" label={t('Por onde vai o código')}>
        <V2Select id="verif-canal" value={form.draft.channel || 'auto'} onChange={(e) => form.set('channel', e.target.value)} options={CANAIS_DE_CODIGO.map((o) => ({ value: o.value, label: t(o.label) }))} />
      </V2Field>
      <SaveBar form={form} />
    </Block>
  );
}

/* -------------------------------------------------------------- limites -- */

const LIMITES = [
  { key: 'email_per_user_day', label: tk('E-mails por pessoa por dia'), hint: tk('Teto de e-mails que uma pessoa recebe num dia (o resumo conta como um). Protege a caixa dela e a reputação do domínio.') },
  { key: 'email_per_sender_day', label: tk('E-mails por remetente por dia'), hint: tk('Quanto UMA conta pode disparar por e-mail num dia, somando todos os destinatários (ex.: um organizador avisando os inscritos). Avisos da própria plataforma não contam.') },
  { key: 'per_pair_day', label: tk('Do mesmo remetente para a mesma pessoa, por dia'), hint: tk('Impede que alguém use os avisos para insistir com uma pessoa.') },
  { key: 'whatsapp_per_user_day', label: tk('WhatsApp por pessoa por dia'), hint: tk('Cada mensagem custa: mantenha baixo.') },
  { key: 'sms_per_user_day', label: tk('SMS por pessoa por dia'), hint: tk('O canal mais caro: mantenha baixo.') },
];

function LimitsTab({ estado }) {
  const { settings, stats = {} } = estado;
  const form = useSectionDraft(settings, 'limits');
  const d = form.draft;
  return (
    <>
      <Block title={t('Tetos por dia')} description={t('Quando um teto é atingido, o aviso fica só no sino (e no push) e o registro de entregas diz "Limite atingido". Os dias contam pelo horário de Brasília.')}>
        <div className="grid gap-4 md:grid-cols-2">
          {LIMITES.map((l) => (
            <V2Field key={l.key} htmlFor={`lim-${l.key}`} label={t(l.label)} hint={t(l.hint)}>
              <NumInput id={`lim-${l.key}`} value={d[l.key]} onChange={(n) => form.set(l.key, n)} />
            </V2Field>
          ))}
        </div>
        <SaveBar form={form} />
      </Block>
      <Block title={t('Orçamento e alerta')} description={t('E-mail é praticamente de graça; WhatsApp e SMS são cobrados por mensagem. A plataforma soma o custo de cada envio (pelo valor por mensagem das abas WhatsApp e SMS) e para esses dois canais quando o mês chega ao orçamento.')}>
        <div className="grid gap-4 md:grid-cols-2">
          <V2Field htmlFor="lim-orcamento" label={t('Orçamento do mês para WhatsApp e SMS (R$)')} hint={t('Gasto até agora neste mês: {valor}. Ao chegar em 80% aparece um alerta no Resumo; em 100%, os dois canais param até o mês virar. Zero desliga os envios pagos.', { valor: stats.month_cost === null || stats.month_cost === undefined ? '—' : fmtMoeda(stats.month_cost) })}>
            <NumInput id="lim-orcamento" decimal value={d.monthly_budget_brl} onChange={(n) => form.set('monthly_budget_brl', n)} />
          </V2Field>
          <V2Field htmlFor="lim-reclamacao" label={t('Alerta de reclamação de spam (%)')} hint={t('Acima desta taxa de reclamações no mês, o Resumo avisa. Os provedores costumam suspender contas acima de 0,3%; o recomendado é ficar abaixo de 0,1%.')}>
            <NumInput id="lim-reclamacao" decimal value={d.complaint_alert_pct} onChange={(n) => form.set('complaint_alert_pct', n)} />
          </V2Field>
        </div>
        <SaveBar form={form} />
      </Block>
    </>
  );
}
