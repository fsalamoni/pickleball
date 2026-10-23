/**
 * Campos comuns das CONTAS na Central: a reunião da agenda em que o
 * orçamento ou as contas foram votados, o motivo (reformular, estornar,
 * reabrir) e o arquivo (nota, recibo, demonstração).
 */
import React, { useMemo, useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useVisibleAgenda } from '@/modules/federations/hooks/useFederations';
import { eventKind } from '@/modules/federations/domain/agenda';
import { ACCOUNT_FILE_TYPES, ACCOUNT_REASON_MIN } from '@/modules/federations/domain/accounts';
import { discardAccountUpload, uploadAccountFile } from '@/modules/federations/services/accountsService';
import { V2Button, V2Field, V2Select, V2Textarea } from '@/v2/ui/primitives';
import { t, tk, fmtData } from '@/core/i18n';
import { quando } from '../../federationUi';

/** Os anos que aparecem no seletor: os que têm movimento ou orçamento, mais o atual e o próximo. */
export function accountYears(items = [], budgets = [], anoAtual) {
  const anos = new Set([anoAtual, anoAtual + 1]);
  items.forEach((x) => { const a = Number(String(x.date || '').slice(0, 4)); if (a) anos.add(a); });
  budgets.forEach((b) => { if (b.year) anos.add(Number(b.year)); });
  return [...anos].sort((a, b) => b - a);
}

export function YearSelect({ id, value, onChange, years }) {
  return (
    <V2Field label={t('Ano')} htmlFor={id} className="w-32">
      <V2Select id={id} value={String(value)} onChange={(e) => onChange(Number(e.target.value))}>
        {years.map((a) => <option key={a} value={a}>{a}</option>)}
      </V2Select>
    </V2Field>
  );
}

/** A reunião/assembleia da agenda (opcional; sem o calendário ligado, o campo some). */
export function MeetingSelect({ federation, id, value, onChange }) {
  const ag = useVisibleAgenda(federation);
  const reunioes = useMemo(() => (ag.items || []).filter((e) => !e.derived && eventKind(e.kind)?.meeting).sort((a, b) => String(b.date).localeCompare(String(a.date))), [ag.items]);
  if (!ag.ligado) return null;
  return (
    <V2Field label={t('Reunião da agenda (opcional)')} htmlFor={id} hint={ag.isError ? t('A agenda não carregou: dá para registrar sem a reunião.') : t('A assembleia ou reunião em que se votou. Liga o registro à ata.')}>
      <V2Select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={ag.isLoading}>
        <option value="">{t('Sem vínculo com a agenda')}</option>
        {reunioes.map((e) => <option key={e.id} value={e.id}>{quando(e.date)} · {e.title}</option>)}
      </V2Select>
    </V2Field>
  );
}

export const motivoOk = (m) => String(m || '').trim().length >= ACCOUNT_REASON_MIN;

export function ReasonField({ id, value, onChange, hint }) {
  return (
    <V2Field label={t('Motivo')} htmlFor={id} required hint={hint || t('Mínimo {n} caracteres. Fica no histórico.', { n: ACCOUNT_REASON_MIN })}>
      <V2Textarea id={id} rows={3} maxLength={500} value={value} onChange={(e) => onChange(e.target.value)} />
    </V2Field>
  );
}

/**
 * Escolher e enviar um arquivo (PDF ou imagem, até 9 MB) para a pasta de
 * quem envia. `value` = o arquivo enviado (`{ name, path, size, content_type }`).
 */
export function AccountFileInput({ id, value, onChange, label, hint }) {
  const { user } = useAuth();
  const ref = useRef(null);
  const [progresso, setProgresso] = useState(null);
  const [erro, setErro] = useState('');
  const escolher = async (file) => {
    if (!file) return;
    setErro('');
    setProgresso(0);
    try {
      const enviado = await uploadAccountFile({ uid: user?.uid, file, onProgress: setProgresso });
      if (value?.path) discardAccountUpload(value.path);
      onChange(enviado);
    } catch (e) {
      setErro(e.message);
    } finally {
      setProgresso(null);
      if (ref.current) ref.current.value = '';
    }
  };
  return (
    <V2Field label={label || t('Anexo (opcional)')} htmlFor={id} error={erro} hint={hint || t('Nota fiscal, recibo ou comprovante: PDF ou imagem de até 9 MB.')}>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={ref} id={id} type="file" accept={ACCOUNT_FILE_TYPES.join(',')} className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
        <V2Button type="button" variant="secondary" size="sm" disabled={progresso != null} onClick={() => ref.current?.click()}><Paperclip className="h-4 w-4" />{progresso != null ? t('Enviando… {p}%', { p: Math.round(progresso * 100) }) : value ? t('Trocar arquivo') : t('Escolher arquivo')}</V2Button>
        {value && (
          <span className="inline-flex items-center gap-1 text-sm text-gray-700">
            {value.name}
            <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" aria-label={t('Tirar {nome}', { nome: value.name })} onClick={() => { discardAccountUpload(value.path); onChange(null); }}><X className="h-4 w-4" /></button>
          </span>
        )}
      </div>
    </V2Field>
  );
}

/** Baixa o arquivo entregue pelo servidor (base64): a pasta oficial é fechada à regra. */
export function baixarArquivoDoServidor(r) {
  const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: r.contentType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = r.name || 'arquivo';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const HISTORY_LABELS = {
  created: tk('Criado'), reformulated: tk('Reformulado'), submitted: tk('Enviado'), approved: tk('Aprovado'), published: tk('Publicado'),
  opened: tk('Aberta'), reopened: tk('Reaberta'), opinion: tk('Parecer do conselho fiscal'), assembly: tk('Assembleia'),
};

/** O histórico (orçamento e prestação): o que foi feito, por quem, quando e o motivo. */
export function HistoryList({ history }) {
  const itens = [...(Array.isArray(history) ? history : [])].reverse();
  if (!itens.length) return null;
  return (
    <details className="text-sm">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-ink">{t('Histórico ({n})', { n: itens.length })}</summary>
      <ol className="mt-2 space-y-1.5">
        {itens.map((h, i) => (
          <li key={i} className="text-gray-700">
            <span className="font-semibold text-ink">{HISTORY_LABELS[h.kind] ? t(HISTORY_LABELS[h.kind]) : h.kind}</span>
            <span className="text-gray-500"> · {h.at_ms ? fmtData(new Date(h.at_ms), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}{h.by_name ? ` · ${h.by_name}` : ''}</span>
            {h.reason && <span className="block text-gray-500">{t('Motivo: {m}', { m: h.reason })}</span>}
          </li>
        ))}
      </ol>
    </details>
  );
}
