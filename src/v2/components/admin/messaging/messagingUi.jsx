/**
 * Painel admin → Comunicações: as peças que as abas dividem (guia passo a
 * passo, valor para copiar, formulário de chaves, rascunho de uma seção da
 * configuração, envio de teste, ligar/desligar o canal).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Copy, Check, ExternalLink, KeyRound, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useClipboard } from '@/core/lib/useClipboard';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useMessagingAdminAction, useSaveMessagingSettings } from '@/modules/messaging/hooks/useMessaging';
import { MISSING_META } from '@/modules/messaging/domain/meta';
import { IDIOMAS } from '@/core/i18n/languages';
import { cn } from '@/core/lib/utils';
import { V2Badge, V2Button, V2Field, V2Input, V2Select, V2Surface } from '@/v2/ui/primitives';
import { t, fmtData } from '@/core/i18n';

export const quando = (ms) => (ms ? fmtData(ms, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const numero = (n) => (n === null || n === undefined ? '—' : String(n));

/** Um bloco da aba: título, explicação e o conteúdo. */
export function Block({ title, description, action, children, className }) {
  return (
    <V2Surface variant="compacto" className={cn('space-y-4 sm:p-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-3xl">
          <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
          {description && <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </V2Surface>
  );
}

/** Guia passo a passo (fechado por padrão: quem já configurou não precisa dele). */
export function GuideSteps({ title, steps, defaultOpen = false }) {
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-gray-100 bg-paper p-4">
      <summary className="cursor-pointer select-none text-sm font-bold text-ink">
        {title}
        <span className="ml-2 text-xs font-medium text-gray-500">{t('{n} passos', { n: steps.length })}</span>
      </summary>
      <ol className="mt-4 space-y-4">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-acid">{i + 1}</span>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-ink">{t(s.title)}</p>
              <p className="text-sm leading-6 text-gray-600">{t(s.body)}</p>
              {s.link && (
                <a href={s.link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 underline-offset-2 hover:underline">
                  {t(s.link.label)} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}

/** Um valor (endereço, registro DNS, token) com o botão de copiar ao lado. */
export function CopyValue({ value, label }) {
  const { copy, copied } = useClipboard();
  if (!value) return <span className="text-sm text-gray-500">—</span>;
  const Icone = copied ? Check : Copy;
  return (
    <div className="flex min-w-0 items-start gap-2">
      <code className="min-w-0 flex-1 break-all rounded-lg bg-paper-pure px-2 py-1 font-mono text-xs leading-5 text-ink ring-1 ring-gray-100">{value}</code>
      <button
        type="button"
        onClick={() => copy(value, t('Copiado.'), t('Não foi possível copiar. Selecione o texto e copie à mão.'))}
        aria-label={label ? t('Copiar {o_que}', { o_que: label }) : t('Copiar')}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-paper-pure text-ink hover:border-ink coarse:h-11 coarse:w-11"
      >
        <Icone className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

/**
 * O rascunho de UMA seção da configuração (`email`, `whatsapp`, `limits`…).
 * Volta ao gravado quando o gravado muda; `save` grava só a seção.
 */
export function useSectionDraft(settings, section) {
  const gravado = settings?.[section];
  const chave = JSON.stringify(gravado ?? null);
  const [draft, setDraft] = useState(gravado);
  useEffect(() => { setDraft(gravado); }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useSaveMessagingSettings();
  const dirty = JSON.stringify(draft ?? null) !== chave;
  const set = (campo, valor) => setDraft((d) => ({ ...(d || {}), [campo]: valor }));
  const salvar = async (extra) => {
    try {
      await save.mutateAsync({ patch: { [section]: { ...(draft || {}), ...(extra || {}) } }, section });
      toast.success(t('Configuração salva.'));
      return true;
    } catch (err) {
      toast.error(err?.message || t('Não foi possível salvar.'));
      return false;
    }
  };
  return { draft: draft || {}, set, setDraft, dirty, salvar, saving: save.isPending };
}

/** Rodapé de "Salvar" de uma seção. */
export function SaveBar({ form, label }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <V2Button type="button" size="sm" disabled={!form.dirty || form.saving} onClick={() => form.salvar()}>
        {form.saving ? t('Salvando…') : label || t('Salvar')}
      </V2Button>
      {form.dirty && <span className="text-xs font-medium text-amber-700">{t('Há mudanças não salvas.')}</span>}
    </div>
  );
}

/**
 * As chaves de um provedor. Nunca mostra o que está gravado (o servidor não
 * devolve): só "configurada" e, no que não é segredo, os últimos caracteres.
 * Campo em branco = manter o que está gravado.
 * @param {{ group: string, fields: Array<{ key: string, label: string, hint?: string, placeholder?: string }>, summary: object }} props
 */
export function SecretsForm({ group, fields, summary }) {
  const acao = useMessagingAdminAction();
  const [valores, setValores] = useState({});
  const [confirmar, setConfirmar] = useState(false);
  const estado = summary?.[group] || {};
  const algum = Object.values(estado).some((x) => x?.set);
  const preenchido = Object.values(valores).some((v) => String(v || '').trim());
  const salvar = async () => {
    try {
      await acao.mutateAsync({ action: 'save_secrets', group, values: valores });
      setValores({});
      toast.success(t('Chaves salvas. Elas ficam só no servidor.'));
    } catch (err) { toast.error(err?.message || t('Não foi possível salvar.')); }
  };
  const apagar = async () => {
    try {
      await acao.mutateAsync({ action: 'save_secrets', group, clear: true });
      toast.success(t('Chaves apagadas.'));
      setConfirmar(false);
    } catch (err) { toast.error(err?.message || t('Não foi possível apagar.')); }
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((f) => {
          const e = estado[f.key] || {};
          const id = `seg-${group}-${f.key}`;
          return (
            <V2Field
              key={f.key}
              htmlFor={id}
              label={(
                <span className="inline-flex flex-wrap items-center gap-2">
                  {f.label}
                  {e.set
                    ? <V2Badge tone="green"><KeyRound className="h-3 w-3" aria-hidden /> {e.hint ? t('Configurada ({fim})', { fim: e.hint }) : t('Configurada')}</V2Badge>
                    : <V2Badge tone="amber">{t('Não configurada')}</V2Badge>}
                </span>
              )}
              hint={f.hint}
            >
              <V2Input
                id={id}
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={e.set ? t('Deixe em branco para manter a atual') : f.placeholder || ''}
                value={valores[f.key] || ''}
                onChange={(ev) => setValores((v) => ({ ...v, [f.key]: ev.target.value }))}
              />
            </V2Field>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        <V2Button type="button" size="sm" disabled={!preenchido || acao.isPending} onClick={salvar}>
          {acao.isPending ? t('Salvando…') : t('Salvar as chaves')}
        </V2Button>
        {algum && (
          <V2Button type="button" size="sm" variant="ghost" disabled={acao.isPending} onClick={() => setConfirmar(true)}>{t('Apagar as chaves')}</V2Button>
        )}
      </div>
      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title={t('Apagar as chaves deste provedor?')}
        description={t('O canal para de enviar até você colar chaves novas. As do provedor continuam valendo lá: se quiser, desative-as no painel dele.')}
        confirmLabel={t('Apagar')}
        destructive
        loading={acao.isPending}
        onConfirm={apagar}
      />
    </div>
  );
}

/** O que falta para o canal funcionar, com o que já está feito marcado. */
export function MissingChecklist({ channel, missing }) {
  const itens = Object.entries(MISSING_META[channel] || {});
  const falta = new Set(missing?.[channel] || []);
  return (
    <ul className="space-y-1.5">
      {itens.map(([k, m]) => (
        <li key={k} className="flex items-start gap-2 text-sm">
          {falta.has(k)
            ? <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden />
            : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden />}
          <span className={falta.has(k) ? 'text-ink' : 'text-gray-500 line-through'}>{t(m.label)}</span>
          <span className="sr-only">{falta.has(k) ? t('(falta)') : t('(feito)')}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Ligar ou desligar o canal. Só liga com tudo pronto (menos o próprio
 * "ligar"): ligado pela metade, o canal só acumularia "não enviado".
 */
export function ChannelSwitch({ channel, section, settings, missing }) {
  const save = useSaveMessagingSettings();
  const ligado = settings?.[section]?.enabled === true;
  const falta = (missing?.[channel] || []).filter((f) => f !== 'disabled');
  const mudar = async (v) => {
    try {
      await save.mutateAsync({ patch: { [section]: { enabled: v } }, section });
      toast.success(v ? t('Canal ligado.') : t('Canal desligado.'));
    } catch (err) { toast.error(err?.message || t('Não foi possível salvar.')); }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      {ligado ? <V2Badge tone="green">{t('Ligado')}</V2Badge> : <V2Badge>{t('Desligado')}</V2Badge>}
      {ligado ? (
        <V2Button type="button" size="sm" variant="ghost" disabled={save.isPending} onClick={() => mudar(false)}>{t('Desligar o canal')}</V2Button>
      ) : (
        <V2Button type="button" size="sm" disabled={save.isPending || falta.length > 0} onClick={() => mudar(true)}>{t('Ligar o canal')}</V2Button>
      )}
      {!ligado && falta.length > 0 && <span className="text-xs text-gray-500">{t('Termine as etapas acima para poder ligar.')}</span>}
    </div>
  );
}

const IDIOMAS_DE_TESTE = IDIOMAS.map((i) => ({ value: i.codigo, label: i.nomeNativo }));

/** Mandar um teste de verdade pelo canal (antes de ligar para todo mundo). */
export function TestSend({ channel, defaultTo = '' }) {
  const acao = useMessagingAdminAction();
  const [para, setPara] = useState(defaultTo);
  const [lang, setLang] = useState('pt-BR');
  const [resultado, setResultado] = useState(null);
  const celular = channel !== 'email';
  const enviar = async () => {
    setResultado(null);
    try {
      const r = await acao.mutateAsync({ action: 'send_test', channel, to: para.trim(), lang });
      setResultado(r);
      if (r?.ok) toast.success(t('Teste enviado para {destino}.', { destino: r.to }));
    } catch (err) { setResultado({ ok: false, error: err?.message || '' }); }
  };
  const idPara = `teste-${channel}-para`;
  const idLang = `teste-${channel}-lang`;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
        <V2Field htmlFor={idPara} label={celular ? t('Celular que recebe o teste') : t('E-mail que recebe o teste')} hint={celular ? t('Com DDD. Fora do Brasil, comece com + e o código do país.') : t('Em branco, vai para o e-mail da sua conta.')}>
          <V2Input id={idPara} type={celular ? 'tel' : 'email'} inputMode={celular ? 'tel' : 'email'} value={para} onChange={(e) => setPara(e.target.value)} placeholder={celular ? '51 99999-8888' : 'voce@exemplo.com'} />
        </V2Field>
        <V2Field htmlFor={idLang} label={t('Idioma')}>
          <V2Select id={idLang} value={lang} onChange={(e) => setLang(e.target.value)} options={IDIOMAS_DE_TESTE} />
        </V2Field>
        <V2Button type="button" size="sm" disabled={acao.isPending || (celular && !para.trim())} onClick={enviar}>
          <Send className="h-4 w-4" aria-hidden /> {acao.isPending ? t('Enviando…') : t('Mandar teste')}
        </V2Button>
      </div>
      {resultado && (resultado.ok ? (
        <p className="rounded-2xl bg-green-50 p-3 text-sm text-green-700">
          {t('O provedor aceitou o envio para {destino}. Confira se chegou (e, no e-mail, a pasta de spam).', { destino: resultado.to })}
        </p>
      ) : (
        <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-600">
          {t('O provedor recusou: {erro}', { erro: resultado.error || t('sem detalhe') })}
        </p>
      ))}
    </div>
  );
}

/** Lista simples "rótulo → valor" (estado da conta, número, etc.). */
export function Facts({ items }) {
  const linhas = useMemo(() => items.filter(Boolean), [items]);
  return (
    <dl className="grid gap-x-6 gap-y-2 rounded-2xl bg-paper p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {linhas.map(([rotulo, valor]) => (
        <div key={rotulo} className="min-w-0">
          <dt className="text-xs text-gray-500">{rotulo}</dt>
          <dd className="break-words font-medium text-ink">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Campo de número que aceita vírgula e deixa digitar "0,0" até virar "0,05". */
export function NumInput({ value, onChange, id, decimal = false, ...rest }) {
  const [texto, setTexto] = useState(value === undefined || value === null ? '' : String(value).replace('.', decimal ? ',' : '.'));
  useEffect(() => {
    const atual = Number(texto.replace(',', '.'));
    if (value !== undefined && value !== null && atual !== Number(value)) setTexto(String(value).replace('.', decimal ? ',' : '.'));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <V2Input
      id={id}
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={texto}
      onChange={(e) => {
        const v = e.target.value.replace(decimal ? /[^\d.,]/g : /\D/g, '');
        setTexto(v);
        const n = Number(v.replace(',', '.'));
        if (v !== '' && Number.isFinite(n)) onChange(decimal ? n : Math.round(n));
      }}
      {...rest}
    />
  );
}
