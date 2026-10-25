/**
 * Calendário oficial da federação (Central → Agenda; `admin` ou `docs` em
 * qualquer evento, `competitions` só na agenda esportiva; módulo `calendar`).
 * Marcar, editar, adiar, cancelar e apagar passam pelo servidor
 * (`federationAgenda`): o evento já divulgado não muda de data nem some
 * calado — pede motivo, fica no histórico e avisa quem segue a federação.
 * Os torneios chancelados entram sozinhos (vêm da chancela), só para ver.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, Ban, CalendarDays, CalendarPlus, ClipboardCheck, ExternalLink, Megaphone, PauseCircle, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  EVENT_GROUPS, EVENT_REASON_MIN, EVENT_VISIBILITY, canManageKind, eventActions, eventKind, kindsFor, saveNeedsReason,
  splitAgenda, validateEventInput,
} from '@/modules/federations/domain/agenda';
import { docDisplayTitle } from '@/modules/federations/domain/acervo';
import { convocationNotice, isMeetingConvened, isMeetingRecorded, meetingActions } from '@/modules/federations/domain/meeting';
import { normalizeFederationRules } from '@/modules/federations/domain/federation';
import { ConveneForm, RecordForm } from './FedMeetingDialogs';
import { MaisAcoes } from './FedAcervoForm';
import { haAlteracaoNaoSalva, useAvisoNaoSalvo } from './naoSalvo';
import { agendaPathFor, agendaVisibilityHint, callAgenda, eventPathFor, hasMeetings, isClubAgenda, useAgendaMutation, useScopedAcervo, useScopedAgenda } from '../agenda/agendaScope';
import { visibilityLabelFor } from '../acervo/acervoScope';
import { BR_UFS } from '@/core/domain/ufs';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t, tk } from '@/core/i18n';
import { DateBadge, StatusBadge, dataDoEvento, horarioDoEvento } from '../agenda/agendaUi';


/* ------------------------------------------------------------ formulário -- */

const vazio = (kind) => ({
  kind, title: '', description: '', date: '', end_date: '', all_day: false, start_time: '', end_time: '',
  place: { name: '', address: '', city: '', state: '' }, online_url: '', organ: '', visibility: EVENT_VISIBILITY.PUBLIC, related_docs: [],
});

function deEvento(ev) {
  return {
    kind: ev.kind, title: ev.title || '', description: ev.description || '', date: ev.date || '', end_date: ev.end_date && ev.end_date !== ev.date ? ev.end_date : '',
    all_day: Boolean(ev.all_day), start_time: ev.start_time || '', end_time: ev.end_time || '', place: { name: '', address: '', city: '', state: '', ...(ev.place || {}) },
    online_url: ev.online_url || '', organ: ev.organ || '', visibility: ev.visibility || EVENT_VISIBILITY.PUBLIC, related_docs: (ev.related_docs || []).map((d) => d.doc_id),
  };
}

function EventForm({ federation, perms, ev, onFechar }) {
  const tipos = kindsFor(perms);
  const [f, setF] = useState(() => (ev ? deEvento(ev) : vazio(tipos[0]?.id || '')));
  const [base] = useState(f);
  const [notify, setNotify] = useState(true);
  const [reason, setReason] = useState('');
  useAvisoNaoSalvo(Boolean(reason.trim()) || JSON.stringify(f) !== JSON.stringify(base));
  const [tentou, setTentou] = useState(false);
  const acervo = useScopedAcervo(federation);
  const docs = acervo.docs || [];
  const r = validateEventInput({ ...f, related_docs: f.related_docs });
  const precisaMotivo = Boolean(ev) && saveNeedsReason(ev, r.value);
  const divulgaAgora = r.value.visibility !== EVENT_VISIBILITY.STAFF && !ev?.ever_visible;
  const reuniao = hasMeetings(federation) && eventKind(f.kind)?.meeting;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setPlace = (k, v) => setF((x) => ({ ...x, place: { ...x.place, [k]: v } }));
  const m = useAgendaMutation(federation, () => callAgenda(federation, {
    action: 'save', eventId: ev?.id, event: r.value, notify: divulgaAgora && notify, reason: precisaMotivo ? reason : '',
  }));
  const erro = (k) => (tentou ? r.errors[k] : undefined);
  const enviar = (e) => {
    e.preventDefault();
    setTentou(true);
    if (!r.ok) { toast.error(Object.values(r.errors)[0]); return; }
    if (precisaMotivo && reason.trim().length < EVENT_REASON_MIN) { toast.error(t('Diga o motivo da mudança (mínimo {n} caracteres).', { n: EVENT_REASON_MIN })); return; }
    m.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(res?.notified ? (isClubAgenda(federation) ? t('Evento salvo. {n} associados avisados.', { n: res.notified }) : t('Evento salvo. {n} seguidores avisados.', { n: res.notified })) : t('Evento salvo.'));
        onFechar();
      },
      onError: (er) => toast.error(er.message),
    });
  };
  const escolhidos = f.related_docs.map((id) => {
    const d = docs.find((x) => x.id === id);
    if (d) return d;
    const salvo = (ev?.related_docs || []).find((x) => x.doc_id === id);
    return salvo ? { ...salvo, id } : { id, code: id };
  });
  const disponiveis = docs.filter((d) => !f.related_docs.includes(d.id));
  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      <V2Field label={t('Tipo')} htmlFor="ag-tipo" required error={erro('kind')}>
        <V2Select id="ag-tipo" value={f.kind} onChange={(e) => set('kind', e.target.value)} disabled={Boolean(ev) && !tipos.some((k) => k.id === f.kind)}>
          {EVENT_GROUPS.map((g) => {
            const doGrupo = tipos.filter((k) => k.group === g.id);
            return doGrupo.length ? <optgroup key={g.id} label={t(g.label)}>{doGrupo.map((k) => <option key={k.id} value={k.id}>{t(k.label)}</option>)}</optgroup> : null;
          })}
        </V2Select>
      </V2Field>
      <V2Field label={t('Título')} htmlFor="ag-titulo" required error={erro('title')}><V2Input id="ag-titulo" maxLength={160} value={f.title} onChange={(e) => set('title', e.target.value)} /></V2Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label={t('Data')} htmlFor="ag-data" required error={erro('date')}><V2Input id="ag-data" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></V2Field>
        <V2Field label={t('Termina em (se durar mais de um dia)')} htmlFor="ag-fim" error={erro('end_date')}><V2Input id="ag-fim" type="date" min={f.date || undefined} value={f.end_date} onChange={(e) => set('end_date', e.target.value)} /></V2Field>
      </div>
      <V2Toggle id="ag-dia-inteiro" checked={f.all_day} onChange={(v) => set('all_day', v)} label={t('Dia inteiro (sem horário)')} />
      {!f.all_day && (
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label={t('Início (horário de Brasília)')} htmlFor="ag-ini" required error={erro('start_time')}><V2Input id="ag-ini" type="time" value={f.start_time} onChange={(e) => set('start_time', e.target.value)} /></V2Field>
          <V2Field label={t('Término')} htmlFor="ag-ter" error={erro('end_time')}><V2Input id="ag-ter" type="time" value={f.end_time} onChange={(e) => set('end_time', e.target.value)} /></V2Field>
        </div>
      )}
      {reuniao && <V2Field label={t('Órgão que se reúne')} htmlFor="ag-orgao" hint={t('Ex.: Assembleia geral, Diretoria, Conselho fiscal, Comissão de arbitragem.')}><V2Input id="ag-orgao" maxLength={120} value={f.organ} onChange={(e) => set('organ', e.target.value)} /></V2Field>}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-ink">{t('Local')}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label={t('Nome do local')} htmlFor="ag-local"><V2Input id="ag-local" maxLength={120} value={f.place.name} onChange={(e) => setPlace('name', e.target.value)} /></V2Field>
          <V2Field label={t('Endereço')} htmlFor="ag-end"><V2Input id="ag-end" maxLength={200} value={f.place.address} onChange={(e) => setPlace('address', e.target.value)} /></V2Field>
          <V2Field label={t('Cidade')} htmlFor="ag-cidade"><V2Input id="ag-cidade" maxLength={80} value={f.place.city} onChange={(e) => setPlace('city', e.target.value)} /></V2Field>
          <V2Field label={t('UF')} htmlFor="ag-uf"><V2Select id="ag-uf" value={f.place.state} onChange={(e) => setPlace('state', e.target.value)}><option value="">—</option>{BR_UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</V2Select></V2Field>
        </div>
        <V2Field label={t('Link para acompanhar online')} htmlFor="ag-online" error={erro('online_url')} hint={t('Transmissão ou sala da reunião virtual. Começa com https://.')}><V2Input id="ag-online" type="url" maxLength={500} placeholder="https://" value={f.online_url} onChange={(e) => set('online_url', e.target.value)} /></V2Field>
      </fieldset>
      <V2Field label={t('Descrição')} htmlFor="ag-desc" hint={reuniao ? t('A pauta resumida, quem pode participar e como. O edital completo vai no acervo e se liga aqui.') : t('O que é, para quem, como participar.')}>
        <V2Textarea id="ag-desc" rows={4} maxLength={4000} value={f.description} onChange={(e) => set('description', e.target.value)} />
      </V2Field>
      {acervo.ligado && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">{t('Documentos do acervo ligados')}</p>
          {escolhidos.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {escolhidos.map((d) => (
                <li key={d.id}><V2Badge tone="neutral">{d.title ? docDisplayTitle(d) : d.code}<button type="button" className="ml-1" aria-label={t('Tirar {doc}', { doc: d.code || d.title })} onClick={() => set('related_docs', f.related_docs.filter((x) => x !== d.id))}><X className="h-3 w-3" /></button></V2Badge></li>
              ))}
            </ul>
          )}
          {acervo.isError && <V2ErrorState inline title={t('Não carregou o acervo')} onRetry={acervo.refetch} />}
          {disponiveis.length > 0 && f.related_docs.length < 10 && (
            <V2Select aria-label={t('Ligar um documento')} value="" onChange={(e) => { if (e.target.value) set('related_docs', [...f.related_docs, e.target.value]); }}>
              <option value="">{t('Ligar um documento publicado (edital, regulamento, ata)…')}</option>
              {disponiveis.map((d) => <option key={d.id} value={d.id}>{docDisplayTitle(d)}</option>)}
            </V2Select>
          )}
        </div>
      )}
      <V2Field label={t('Quem vê')} htmlFor="ag-vis" hint={t(agendaVisibilityHint(federation, f.visibility))}>
        <V2Select id="ag-vis" value={f.visibility} onChange={(e) => set('visibility', e.target.value)}>{Object.values(EVENT_VISIBILITY).map((v) => <option key={v} value={v}>{t(visibilityLabelFor(federation, v))}</option>)}</V2Select>
      </V2Field>
      {divulgaAgora && (isClubAgenda(federation)
        ? <V2Toggle id="ag-avisar" checked={notify} onChange={setNotify} label={t('Avisar os associados')} hint={t('Os associados em dia recebem um aviso com o evento.')} />
        : <V2Toggle id="ag-avisar" checked={notify} onChange={setNotify} label={t('Avisar quem segue a federação')} hint={t('Quem segue recebe um aviso com o evento.')} />)}
      {precisaMotivo && (
        <V2Field label={t('Motivo da mudança')} htmlFor="ag-motivo" required hint={t('O evento já foi divulgado: a mudança de data fica no histórico, com o motivo, e quem segue é avisado.')}>
          <V2Input id="ag-motivo" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </V2Field>
      )}
      <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={onFechar}>{t('Cancelar')}</V2Button><V2Button type="submit" disabled={m.isPending}>{m.isPending ? t('Salvando…') : t('Salvar')}</V2Button></div>
    </form>
  );
}

/* ---------------------------------------------------------------- ações -- */

function SituacaoDialog({ federation, ev, acao, onFechar }) {
  const [motivo, setMotivo] = useState('');
  const m = useAgendaMutation(federation, () => callAgenda(federation, { action: acao, eventId: ev.id, reason: motivo }));
  const ok = motivo.trim().length >= EVENT_REASON_MIN;
  const adiar = acao === 'postpone';
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{adiar
        ? t('O evento fica na agenda como "Adiado — nova data a definir". Quando houver data, edite o evento: ele volta a confirmado e o histórico guarda tudo.')
        : t('O evento fica na agenda, riscado, com o motivo. Para desfazer, edite e marque a data de novo.')}</p>
      <V2Field label={t('Motivo')} htmlFor="sd-motivo" required hint={t('Mínimo {n} caracteres. Aparece para quem vê o evento.', { n: EVENT_REASON_MIN })}><V2Textarea id="sd-motivo" rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></V2Field>
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Voltar')}</V2Button>
        <V2Button type="button" variant={adiar ? 'primary' : 'danger'} disabled={!ok || m.isPending} onClick={() => m.mutate(undefined, { onSuccess: () => { toast.success(adiar ? t('Evento adiado.') : t('Evento cancelado.')); onFechar(); }, onError: (e) => toast.error(e.message) })}>
          {adiar ? <PauseCircle className="h-4 w-4" /> : <Ban className="h-4 w-4" />}{adiar ? t('Adiar') : t('Cancelar o evento')}
        </V2Button>
      </div>
    </div>
  );
}

function ApagarDialog({ federation, ev, onFechar }) {
  const m = useAgendaMutation(federation, () => callAgenda(federation, { action: 'delete', eventId: ev.id }));
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink">{t('Apagar "{titulo}"? Só a equipe viu este evento: some de vez.', { titulo: ev.title })}</p>
      <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={onFechar}>{t('Voltar')}</V2Button><V2Button type="button" variant="danger" disabled={m.isPending} onClick={() => m.mutate(undefined, { onSuccess: () => { toast.success(t('Evento apagado.')); onFechar(); }, onError: (e) => toast.error(e.message) })}><Trash2 className="h-4 w-4" />{t('Apagar')}</V2Button></div>
    </div>
  );
}

/* ---------------------------------------------------------------- lista -- */

function EventRow({ federation, ev, perms, onAbrir }) {
  const kind = ev.derived ? { label: tk('Torneio chancelado') } : eventKind(ev.kind);
  const a = eventActions(ev, perms);
  const reuniao = hasMeetings(federation) && !ev.derived && Boolean(kind?.meeting);
  const r = meetingActions(ev, { canManage: canManageKind(perms, ev.kind), isMeeting: reuniao });
  const prazo = reuniao && ev.status === 'scheduled' ? convocationNotice(ev, normalizeFederationRules(federation.rules).convocation_min_days) : null;
  // À vista, o passo da reunião (resultado ou convocação) ou, fora dela, editar; o resto vai para o "⋯".
  const acoes = [
    r.record && { id: 'resultado', icon: ClipboardCheck, label: isMeetingRecorded(ev) ? t('Corrigir o resultado') : t('Registrar o resultado') },
    r.convene && { id: 'convocar', icon: Megaphone, label: isMeetingConvened(ev) ? t('Convocação') : t('Convocar') },
    a.edit && { id: 'editar', icon: Pencil, label: t('Editar') },
    a.postpone && { id: 'postpone', icon: PauseCircle, label: t('Adiar') },
    a.cancel && { id: 'cancel', icon: Ban, label: t('Cancelar o evento'), perigo: true },
    a.remove && { id: 'apagar', icon: Trash2, label: t('Apagar'), perigo: true },
  ].filter(Boolean);
  const principal = acoes[0] && !acoes[0].perigo ? acoes[0] : null;
  const resto = principal ? acoes.slice(1) : acoes;
  return (
    <V2Surface variant="compacto" className="flex flex-wrap items-center gap-3 p-3">
      <DateBadge ev={ev} adiado={ev.status === 'postponed'} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-xs">
          {kind && <span className="font-bold uppercase tracking-wider text-gray-500">{t(kind.label)}</span>}
          <StatusBadge ev={ev} />
          {ev.visibility && ev.visibility !== EVENT_VISIBILITY.PUBLIC && <V2Badge tone="ink">{t(visibilityLabelFor(federation, ev.visibility))}</V2Badge>}
        </p>
        <p className={`font-bold text-ink ${ev.status === 'cancelled' ? 'line-through' : ''}`}>{ev.title}</p>
        <p className="text-xs text-gray-500">{ev.status === 'postponed' ? t('Nova data a definir') : `${dataDoEvento(ev)} · ${horarioDoEvento(ev)}`}</p>
        {reuniao && (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {isMeetingRecorded(ev) ? <V2Badge tone="green">{t('Resultado publicado')}</V2Badge>
              : isMeetingConvened(ev) ? <V2Badge tone="neutral">{t('Convocada · pauta com {n} itens', { n: ev.meeting.items?.length || 0 })}</V2Badge>
                : ev.status === 'scheduled' && <V2Badge tone="neutral">{t('Ainda sem convocação')}</V2Badge>}
            {prazo?.late && !isMeetingRecorded(ev) && <span className="inline-flex items-center gap-1 font-semibold text-amber-700"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />{t('Convocada com {dias} dias; o estatuto pede {min}', { dias: Math.max(0, prazo.days), min: prazo.min })}</span>}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {ev.derived
          ? <V2Button asChild size="sm" variant="ghost"><Link to={`/torneios/${encodeURIComponent(ev.tournament_id)}`}><ExternalLink className="h-4 w-4" />{t('Abrir o torneio')}</Link></V2Button>
          : <V2Button asChild size="sm" variant="ghost"><Link to={eventPathFor(federation, ev)} aria-label={t('Ver {titulo}', { titulo: ev.title })}><ExternalLink className="h-4 w-4" /></Link></V2Button>}
        {principal && <V2Button type="button" size="sm" variant="secondary" onClick={() => onAbrir(principal.id, ev)}><principal.icon className="h-4 w-4" aria-hidden="true" />{principal.label}</V2Button>}
        <MaisAcoes nome={ev.title} itens={resto} onEscolher={(id) => onAbrir(id, ev)} />
      </div>
    </V2Surface>
  );
}

const TITULOS = { novo: tk('Marcar na agenda'), editar: tk('Editar evento'), postpone: tk('Adiar evento'), cancel: tk('Cancelar evento'), apagar: tk('Apagar evento'), convocar: tk('Convocação e pauta'), resultado: tk('Resultado da reunião') };

export default function FedAgendaPanel({ federation, perms = [] }) {
  const a = useScopedAgenda(federation);
  const club = isClubAgenda(federation);
  const [aberto, setAberto] = useState(null); // { modo, ev }
  const partes = useMemo(() => (a.items ? splitAgenda(a.items) : null), [a.items]);
  const fechar = () => setAberto(null);
  const abrir = (modo, ev) => setAberto({ modo, ev });
  const modo = aberto?.modo;
  const ev = aberto?.ev;
  const podeMarcar = kindsFor(perms).length > 0;
  return (
    <section className="space-y-4" aria-label={t('Calendário oficial')} data-dica="federacao-agenda">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{t('Calendário oficial')}</h2>
          <p className="text-sm text-gray-500">{club
            ? t('Competições, treinos e cursos, assembleias, reuniões de diretoria e conselhos, prazos e eventos. Público, só associados ou só a equipe. Evento divulgado não some nem muda de data calado: adiar, cancelar e remarcar pedem motivo, ficam no histórico e avisam os associados.')
            : t('Competições, cursos, assembleias, reuniões de diretoria e conselhos, prazos e eventos. Público, só filiados ou só a equipe. Evento divulgado não some nem muda de data calado: adiar, cancelar e remarcar pedem motivo, ficam no histórico e avisam quem segue a federação. Os torneios chancelados entram sozinhos.')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {podeMarcar && <V2Button type="button" onClick={() => abrir('novo', null)} data-dica="federacao-agenda-novo"><Plus className="h-4 w-4" />{t('Marcar na agenda')}</V2Button>}
          <V2Button asChild variant="secondary"><Link to={agendaPathFor(federation)}><CalendarDays className="h-4 w-4" />{t('Ver como o público vê')}</Link></V2Button>
        </div>
      </div>
      {a.isError && <V2ErrorState inline title={t('Não carregou a agenda')} onRetry={a.refetch} />}
      {a.isLoading && <V2Skeleton lines={4} />}
      {a.incompleto && <p className="text-sm text-amber-700">{t('Parte da agenda (só para filiados, só para a equipe ou os torneios) não carregou agora.')}</p>}
      {partes && partes.upcoming.length === 0 && partes.past.length === 0 && !a.incompleto && (
        <V2EmptyState icon={CalendarPlus} title={t('A agenda está vazia')} description={club ? t('Comece pela próxima competição e pela assembleia geral ordinária do ano: são as datas que os associados mais procuram.') : t('Comece pela próxima competição e pela assembleia geral ordinária do ano: são as datas que filiados e clubes mais procuram.')} />
      )}
      {partes && partes.upcoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Próximos')}</h3>
          <ul className="space-y-2">{partes.upcoming.map((x) => <li key={x.id}><EventRow federation={federation} ev={x} perms={perms} onAbrir={abrir} /></li>)}</ul>
        </div>
      )}
      {partes && partes.past.length > 0 && (
        <details className="space-y-2">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-gray-500">{t('Anteriores ({n})', { n: partes.past.length })}</summary>
          <ul className="mt-2 space-y-2">{partes.past.map((x) => <li key={x.id}><EventRow federation={federation} ev={x} perms={perms} onAbrir={abrir} /></li>)}</ul>
        </details>
      )}
      <Dialog open={aberto != null} onOpenChange={(o) => { if (!o) fechar(); }}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto" onInteractOutside={(e) => { if (haAlteracaoNaoSalva()) e.preventDefault(); }}>
          <DialogTitle>{modo ? t(TITULOS[modo]) : ''}</DialogTitle>
          <DialogDescription>{ev ? ev.title : (club ? t('Público, só associados ou só a equipe.') : t('Público, só filiados ou só a equipe.'))}</DialogDescription>
          {(modo === 'novo' || modo === 'editar') && <EventForm federation={federation} perms={perms} ev={modo === 'editar' ? ev : null} onFechar={fechar} />}
          {(modo === 'postpone' || modo === 'cancel') && <SituacaoDialog federation={federation} ev={ev} acao={modo} onFechar={fechar} />}
          {modo === 'apagar' && <ApagarDialog federation={federation} ev={ev} onFechar={fechar} />}
          {modo === 'convocar' && <ConveneForm federation={federation} ev={ev} onFechar={fechar} />}
          {modo === 'resultado' && <RecordForm federation={federation} ev={ev} onFechar={fechar} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
