/**
 * Reunião e assembleia do calendário oficial (Central → Agenda): a
 * CONVOCAÇÃO (data, edital do acervo, quórum e a pauta) e o RESULTADO
 * (presença, chamada, quórum, o que se decidiu em cada item, a ata, a lista
 * de presença e o registro de votação). Os dois passam pelo servidor
 * (`federationAgenda`, ações `convene` e `record`); mudar a pauta de uma
 * reunião divulgada e corrigir um resultado pedem motivo e vão ao histórico.
 * O clube usa os mesmos formulários (`clubAgenda`, Bloco F1): `agendaScope`
 * escolhe a função do servidor, de onde vêm os documentos e quem é avisado.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { callAgenda, isClubAgenda, useAgendaMutation, useScopedAcervo } from '../agenda/agendaScope';
import { EVENT_REASON_MIN } from '@/modules/federations/domain/agenda';
import {
  ITEM_KINDS, MEETING_CALLS, MEETING_DOC_TYPES, MEETING_ITEMS_MAX, convocationDraft, convocationNotice, isMeetingConvened, isMeetingRecorded,
  recordDraft, resultsFor, validateConvocation, validateRecord,
} from '@/modules/federations/domain/meeting';
import { normalizeFederationRules } from '@/modules/federations/domain/federation';
import { docDisplayTitle } from '@/modules/federations/domain/acervo';
import { V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAvisoNaoSalvo } from './naoSalvo';
import { t } from '@/core/i18n';

/** Escolha de um documento publicado do acervo (do tipo certo, quando há lista). */
function DocSelect({ id, label, hint, docs, tipos, value, salvo, onChange }) {
  const opcoes = (docs || []).filter((d) => !tipos || tipos.includes(d.type));
  const fora = value && !opcoes.some((d) => d.id === value) && salvo?.doc_id === value ? [{ id: value, code: salvo.code, title: salvo.title }] : [];
  return (
    <V2Field label={label} htmlFor={id} hint={hint}>
      <V2Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('Nenhum')}</option>
        {[...fora, ...opcoes].map((d) => <option key={d.id} value={d.id}>{docDisplayTitle(d) || d.code}</option>)}
      </V2Select>
    </V2Field>
  );
}

function Motivo({ id, value, onChange, hint }) {
  return (
    <V2Field label={t('Motivo')} htmlFor={id} required hint={hint}>
      <V2Input id={id} maxLength={500} value={value} onChange={(e) => onChange(e.target.value)} />
    </V2Field>
  );
}

/* ------------------------------------------------------------ convocação -- */

export function ConveneForm({ federation, ev, onFechar }) {
  const [f, setF] = useState(() => convocationDraft(ev));
  const [base] = useState(f);
  const [notify, setNotify] = useState(true);
  const [reason, setReason] = useState('');
  const [tentou, setTentou] = useState(false);
  const [tirando, setTirando] = useState(null); // índice do item a confirmar
  useAvisoNaoSalvo(Boolean(reason.trim()) || JSON.stringify(f) !== JSON.stringify(base));
  const acervo = useScopedAcervo(federation);
  const clube = isClubAgenda(federation);
  const r = validateConvocation(f, { eventDate: ev.date });
  const ja = isMeetingConvened(ev);
  const precisaMotivo = ja && Boolean(ev.ever_visible);
  const divulga = !ja && ev.visibility !== 'staff';
  const min = normalizeFederationRules(federation.rules).convocation_min_days;
  const prazo = convocationNotice({ date: ev.date, meeting: { convened_on: f.convened_on } }, min);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setItem = (i, patch) => setF((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const move = (i, d) => setF((x) => {
    const items = [...x.items];
    [items[i], items[i + d]] = [items[i + d], items[i]];
    return { ...x, items };
  });
  const tirarItem = (i) => { setF((x) => ({ ...x, items: x.items.filter((_, j) => j !== i) })); setTirando(null); };
  const m = useAgendaMutation(federation, () => callAgenda(federation, {
    action: 'convene', eventId: ev.id, convocation: r.value, notify: divulga && notify, reason: precisaMotivo ? reason : '',
  }));
  const enviar = (e) => {
    e.preventDefault();
    setTentou(true);
    if (!r.ok) { toast.error(Object.values(r.errors)[0]); return; }
    if (precisaMotivo && reason.trim().length < EVENT_REASON_MIN) { toast.error(t('Diga o motivo da mudança (mínimo {n} caracteres).', { n: EVENT_REASON_MIN })); return; }
    m.mutate(undefined, {
      onSuccess: (res) => { toast.success(res?.notified ? (clube ? t('Convocação salva. {n} associados avisados.', { n: res.notified }) : t('Convocação salva. {n} seguidores avisados.', { n: res.notified })) : t('Convocação salva.')); onFechar(); },
      onError: (er) => toast.error(er.message),
    });
  };
  const erro = (k) => (tentou ? r.errors[k] : undefined);
  return (
    <form onSubmit={enviar} noValidate className="space-y-4" data-dica="federacao-reuniao-convocar">
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label={t('Data da convocação')} htmlFor="cv-data" required error={erro('convened_on')} hint={t('Quando o edital foi publicado ou enviado.')}>
          <V2Input id="cv-data" type="date" max={ev.date || undefined} value={f.convened_on} onChange={(e) => set('convened_on', e.target.value)} />
        </V2Field>
        {acervo.ligado && (
          <DocSelect id="cv-edital" label={t('Edital de convocação (acervo)')} docs={acervo.docs} tipos={MEETING_DOC_TYPES.edital} value={f.edital_doc_id} salvo={ev.meeting?.edital} onChange={(v) => set('edital_doc_id', v)} />
        )}
      </div>
      {prazo && prazo.late && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t('Convocação com {dias} dias de antecedência; o estatuto pede {min}. Confira se há exceção de urgência antes de seguir.', { dias: Math.max(0, prazo.days), min: prazo.min })}
        </p>
      )}
      {acervo.isError && <V2ErrorState inline title={t('Não carregou o acervo')} onRetry={acervo.refetch} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label={t('Quórum da primeira chamada')} htmlFor="cv-q1" hint={t('Como o estatuto diz. Ex.: maioria absoluta dos filiados aptos.')}><V2Input id="cv-q1" maxLength={300} value={f.quorum_first} onChange={(e) => set('quorum_first', e.target.value)} /></V2Field>
        <V2Field label={t('Segunda chamada (horário)')} htmlFor="cv-h2" error={erro('second_call_time')}><V2Input id="cv-h2" type="time" value={f.second_call_time} onChange={(e) => set('second_call_time', e.target.value)} /></V2Field>
      </div>
      {f.second_call_time && <V2Field label={t('Quórum da segunda chamada')} htmlFor="cv-q2" hint={t('Ex.: qualquer número de presentes.')}><V2Input id="cv-q2" maxLength={300} value={f.quorum_second} onChange={(e) => set('quorum_second', e.target.value)} /></V2Field>}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-ink">{t('Pauta (ordem do dia)')}</legend>
        {erro('items') && <p className="text-sm text-red-700">{erro('items')}</p>}
        <ol className="space-y-3">
          {f.items.map((it, i) => (
            <li key={i}>
              <V2Surface variant="compacto" className="space-y-2 p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <span className="pb-2 text-sm font-bold text-gray-500">{i + 1}.</span>
                  <div className="min-w-0 flex-1"><V2Field label={t('Item')} htmlFor={`cv-it-${i}`}><V2Input id={`cv-it-${i}`} maxLength={200} value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} /></V2Field></div>
                  <V2Field label={t('Tipo do item')} htmlFor={`cv-tp-${i}`}>
                    <V2Select id={`cv-tp-${i}`} value={it.kind} onChange={(e) => setItem(i, { kind: e.target.value })}>{ITEM_KINDS.map((k) => <option key={k.id} value={k.id}>{t(k.label)}</option>)}</V2Select>
                  </V2Field>
                  <div className="flex gap-1 pb-1">
                    <V2Button type="button" size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('Subir o item {n}', { n: i + 1 })}><ArrowUp className="h-4 w-4" /></V2Button>
                    <V2Button type="button" size="sm" variant="ghost" disabled={i === f.items.length - 1} onClick={() => move(i, 1)} aria-label={t('Descer o item {n}', { n: i + 1 })}><ArrowDown className="h-4 w-4" /></V2Button>
                    <V2Button type="button" size="sm" variant="ghost" disabled={f.items.length === 1} onClick={() => (String(it.title || '').trim() || String(it.description || '').trim() ? setTirando(i) : tirarItem(i))} aria-label={t('Tirar o item {n}', { n: i + 1 })}><Trash2 className="h-4 w-4" /></V2Button>
                  </div>
                </div>
                <V2Textarea aria-label={t('Detalhe do item {n}', { n: i + 1 })} rows={2} maxLength={1000} placeholder={t('Detalhe (opcional)')} value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} />
              </V2Surface>
            </li>
          ))}
        </ol>
        {f.items.length < MEETING_ITEMS_MAX && <V2Button type="button" size="sm" variant="secondary" onClick={() => set('items', [...f.items, { title: '', description: '', kind: 'deliberation' }])}><Plus className="h-4 w-4" />{t('Acrescentar item')}</V2Button>}
      </fieldset>
      {divulga && (clube
        ? <V2Toggle id="cv-avisar" checked={notify} onChange={setNotify} label={t('Avisar os associados em dia')} hint={t('Os associados em dia recebem um aviso com a convocação.')} />
        : <V2Toggle id="cv-avisar" checked={notify} onChange={setNotify} label={t('Avisar quem segue a federação')} hint={t('Quem segue recebe um aviso com a convocação.')} />)}
      {precisaMotivo && <Motivo id="cv-motivo" value={reason} onChange={setReason} hint={clube ? t('A convocação já foi divulgada: a mudança fica no histórico, com o motivo, e os associados são avisados.') : t('A convocação já foi divulgada: a mudança fica no histórico, com o motivo, e quem segue é avisado.')} />}
      <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={onFechar}>{t('Cancelar')}</V2Button><V2Button type="submit" disabled={m.isPending}>{m.isPending ? t('Salvando…') : t('Salvar a convocação')}</V2Button></div>
      <ConfirmDialog
        open={tirando != null}
        onOpenChange={(v) => { if (!v) setTirando(null); }}
        destructive
        title={t('Tirar o item {n} da pauta?', { n: (tirando ?? 0) + 1 })}
        description={t('"{item}" sai da pauta e os itens seguintes sobem uma posição. A mudança só vale quando você salvar a convocação.', { item: String(f.items[tirando ?? 0]?.title || '').trim() || t('Item sem título') })}
        confirmLabel={t('Tirar da pauta')}
        cancelLabel={t('Voltar')}
        onConfirm={() => tirarItem(tirando)}
      />
    </form>
  );
}

/* ------------------------------------------------------------- resultado -- */

const COM_VOTO = ['approved', 'rejected', 'elected'];

export function RecordForm({ federation, ev, onFechar }) {
  const [f, setF] = useState(() => recordDraft(ev));
  const [base] = useState(f);
  const [reason, setReason] = useState('');
  useAvisoNaoSalvo(Boolean(reason.trim()) || JSON.stringify(f) !== JSON.stringify(base));
  const [tentou, setTentou] = useState(false);
  const acervo = useScopedAcervo(federation);
  const clube = isClubAgenda(federation);
  const pauta = ev.meeting?.items || [];
  const r = validateRecord(f, pauta);
  const ja = isMeetingRecorded(ev);
  const precisaMotivo = ja && Boolean(ev.ever_visible);
  const salvo = ev.meeting?.record || {};
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setItem = (i, patch) => setF((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const m = useAgendaMutation(federation, () => callAgenda(federation, { action: 'record', eventId: ev.id, record: f, reason: precisaMotivo ? reason : '' }));
  const enviar = (e) => {
    e.preventDefault();
    setTentou(true);
    if (!r.ok) { toast.error(Object.values(r.errors)[0]); return; }
    if (precisaMotivo && reason.trim().length < EVENT_REASON_MIN) { toast.error(t('Diga o motivo da correção (mínimo {n} caracteres).', { n: EVENT_REASON_MIN })); return; }
    m.mutate(undefined, {
      onSuccess: (res) => { toast.success(res?.notified ? (clube ? t('Resultado salvo. {n} associados avisados.', { n: res.notified }) : t('Resultado salvo. {n} seguidores avisados.', { n: res.notified })) : t('Resultado salvo.')); onFechar(); },
      onError: (er) => toast.error(er.message),
    });
  };
  const erro = (k) => (tentou ? r.errors[k] : undefined);
  return (
    <form onSubmit={enviar} noValidate className="space-y-4" data-dica="federacao-reuniao-resultado">
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label={t('Chamada')} htmlFor="rs-chamada" required error={erro('call')}>
          <V2Select id="rs-chamada" value={f.call} onChange={(e) => set('call', e.target.value)}>{MEETING_CALLS.map((c) => <option key={c.id} value={c.id}>{t(c.label)}</option>)}</V2Select>
        </V2Field>
        <V2Field label={t('Abertura (horário)')} htmlFor="rs-abertura" error={erro('opened_at')}><V2Input id="rs-abertura" type="time" value={f.opened_at} onChange={(e) => set('opened_at', e.target.value)} /></V2Field>
        <V2Field label={t('Presentes')} htmlFor="rs-presentes" required error={erro('present')}><V2Input id="rs-presentes" inputMode="numeric" value={f.present} onChange={(e) => set('present', e.target.value)} /></V2Field>
        <V2Field label={t('Aptos a participar')} htmlFor="rs-aptos" error={erro('eligible')} hint={t('Opcional. Quem tinha direito a voto.')}><V2Input id="rs-aptos" inputMode="numeric" value={f.eligible} onChange={(e) => set('eligible', e.target.value)} /></V2Field>
      </div>
      <V2Toggle id="rs-quorum" checked={f.quorum_reached} onChange={(v) => set('quorum_reached', v)} label={t('Houve quórum')} />
      {!f.quorum_reached && <p className="text-sm text-gray-500">{t('Sem quórum nada se decide: cada item fica adiado ou sai da pauta.')}</p>}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-ink">{t('O que se decidiu')}</legend>
        <ol className="space-y-3">
          {pauta.map((p, i) => {
            const it = f.items[i] || {};
            const opcoes = resultsFor(p.kind).filter((o) => f.quorum_reached || ['postponed', 'withdrawn'].includes(o.id));
            return (
              <li key={p.id}>
                <V2Surface variant="compacto" className="space-y-2 p-3">
                  <p className="font-semibold text-ink">{i + 1}. {p.title}</p>
                  {erro(`item_${p.id}`) && <p className="text-sm text-red-700">{erro(`item_${p.id}`)}</p>}
                  <V2Field label={t('Resultado')} htmlFor={`rs-res-${i}`}>
                    <V2Select id={`rs-res-${i}`} value={it.result} onChange={(e) => setItem(i, { result: e.target.value })}>
                      <option value="">{t('Escolha…')}</option>
                      {opcoes.map((o) => <option key={o.id} value={o.id}>{t(o.label)}</option>)}
                    </V2Select>
                  </V2Field>
                  {p.kind !== 'information' && COM_VOTO.includes(it.result) && (
                    <div className="grid grid-cols-3 gap-2">
                      {[['yes', t('A favor')], ['no', t('Contra')], ['abstain', t('Abstenções')]].map(([k, rotulo]) => (
                        <V2Field key={k} label={rotulo} htmlFor={`rs-${k}-${i}`}><V2Input id={`rs-${k}-${i}`} inputMode="numeric" value={it.votes?.[k] ?? ''} onChange={(e) => setItem(i, { votes: { ...it.votes, [k]: e.target.value } })} /></V2Field>
                      ))}
                    </div>
                  )}
                  <V2Textarea aria-label={t('Resumo do item {n}', { n: i + 1 })} rows={2} maxLength={1000} placeholder={t('Resumo da decisão ou de quem foi eleito (opcional)')} value={it.summary} onChange={(e) => setItem(i, { summary: e.target.value })} />
                  {acervo.ligado && <DocSelect id={`rs-ato-${i}`} label={t('Ato que saiu deste item')} docs={acervo.docs} value={it.doc_id} salvo={(salvo.items || []).find((x) => x.id === p.id)?.doc} onChange={(v) => setItem(i, { doc_id: v })} />}
                </V2Surface>
              </li>
            );
          })}
        </ol>
      </fieldset>
      {acervo.ligado && (
        <div className="grid gap-3 sm:grid-cols-3">
          <DocSelect id="rs-ata" label={t('Ata')} docs={acervo.docs} tipos={MEETING_DOC_TYPES.minutes} value={f.minutes_doc_id} salvo={salvo.minutes} onChange={(v) => set('minutes_doc_id', v)} />
          <DocSelect id="rs-lista" label={t('Lista de presença')} docs={acervo.docs} tipos={MEETING_DOC_TYPES.attendance} value={f.attendance_doc_id} salvo={salvo.attendance} onChange={(v) => set('attendance_doc_id', v)} />
          <DocSelect id="rs-votos" label={t('Registro de votação')} docs={acervo.docs} tipos={MEETING_DOC_TYPES.votes} value={f.votes_doc_id} salvo={salvo.votes} onChange={(v) => set('votes_doc_id', v)} />
        </div>
      )}
      {acervo.isError && <V2ErrorState inline title={t('Não carregou o acervo')} onRetry={acervo.refetch} />}
      <V2Field label={t('Observações')} htmlFor="rs-obs"><V2Textarea id="rs-obs" rows={3} maxLength={2000} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></V2Field>
      {precisaMotivo && <Motivo id="rs-motivo" value={reason} onChange={setReason} hint={clube ? t('O resultado já foi divulgado: a correção fica no histórico, com o motivo, e os associados são avisados.') : t('O resultado já foi divulgado: a correção fica no histórico, com o motivo, e quem segue é avisado.')} />}
      <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={onFechar}>{t('Cancelar')}</V2Button><V2Button type="submit" disabled={m.isPending}>{m.isPending ? t('Salvando…') : t('Salvar o resultado')}</V2Button></div>
    </form>
  );
}
