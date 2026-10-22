/**
 * "Minhas escalas" (Minha área → Federações): o que o ÁRBITRO vê — as
 * convocações para responder em destaque (confirmar, recusar, declarar
 * conflito de interesse), as próximas, o histórico com avaliação e diária,
 * a súmula depois do evento e, por federação, o calendário de datas em que
 * não pode (toque no dia) e se aparece no quadro público.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarX2, Check, FileText, Save, Users, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { refereesAction } from '@/modules/federations/services/refereesService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import {
  EVAL_CRITERIA, EVAL_CRITERIA_LABELS, REFEREE_LIMITS, addDaysISO, amountOf, assignmentState, isoDateBR, normalizeUnavailable, splitMyAssignments, toggleUnavailable, validateReport,
} from '@/modules/federations/domain/referees';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { V2Badge, V2Button, V2Field, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { fmtData, t, tk, tn } from '@/core/i18n';
import { AssignmentBadge, dataCurta, funcao, periodo } from './refUi';

const sigla = (a) => a.federation_acronym || a.federation_name || t('Federação');

/* -------------------------------------------------------------- responder -- */

function Responder({ a, aceitar, onFechar }) {
  const [reason, setReason] = useState('');
  const [conflito, setConflito] = useState(false);
  const [motivoConflito, setMotivoConflito] = useState('');
  const m = useFederationMutation(() => refereesAction({
    federationId: a.federation_id, action: 'respond', assignmentId: a.id, accept: aceitar, reason,
    ...(conflito ? { conflict: { declared: true, reason: motivoConflito } } : {}),
  }));
  const enviar = (e) => {
    e.preventDefault();
    if (conflito && motivoConflito.trim().length < 5) { toast.error(t('Diga qual é o conflito de interesse.')); return; }
    m.mutate(undefined, { onSuccess: () => { toast.success(aceitar ? t('Escala confirmada.') : t('Resposta enviada: a equipe foi avisada.')); onFechar(); }, onError: (er) => toast.error(er.message) });
  };
  return (
    <form onSubmit={enviar} noValidate className="space-y-3">
      {aceitar
        ? <p className="text-sm text-ink">{t('Confirmar que você vai atuar como {funcao} em {evento} ({data})? Se surgir um conflito de interesse, recuse e declare.', { funcao: funcao(a.function), evento: a.event?.name, data: periodo(a.event) })}</p>
        : (
          <>
            <V2Field label={t('Motivo (a equipe vê)')} htmlFor="mr-motivo"><V2Textarea id="mr-motivo" rows={2} maxLength={REFEREE_LIMITS.REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} /></V2Field>
            <V2Toggle id="mr-conflito" checked={conflito} onChange={setConflito} label={t('Tenho conflito de interesse neste evento')} hint={t('Parente ou aluno jogando, vínculo com um clube participante, etc. Fica registrado só para a equipe.')} />
            {conflito && <V2Field label={t('Qual é o conflito')} htmlFor="mr-conflito-motivo" required><V2Textarea id="mr-conflito-motivo" rows={2} maxLength={REFEREE_LIMITS.CONFLICT_MAX} value={motivoConflito} onChange={(e) => setMotivoConflito(e.target.value)} /></V2Field>}
          </>
        )}
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Voltar')}</V2Button>
        <V2Button type="submit" variant={aceitar ? 'primary' : 'danger'} disabled={m.isPending}>{aceitar ? <><Check className="h-4 w-4" />{t('Confirmar')}</> : <><X className="h-4 w-4" />{t('Recusar')}</>}</V2Button>
      </div>
    </form>
  );
}

function Sumula({ a, onFechar }) {
  const [texto, setTexto] = useState(a.report?.text || '');
  const r = validateReport(texto);
  const m = useFederationMutation(() => refereesAction({ federationId: a.federation_id, action: 'report', assignmentId: a.id, text: texto }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!r.ok) { toast.error(r.error); return; } m.mutate(undefined, { onSuccess: () => { toast.success(t('Súmula enviada à equipe.')); onFechar(); }, onError: (er) => toast.error(er.message) }); }} noValidate className="space-y-3">
      <V2Field label={t('Súmula ou relatório')} htmlFor="mr-sumula" hint={t('Ocorrências, advertências, W.O., atrasos e o que a equipe precisa saber.')}>
        <V2Textarea id="mr-sumula" rows={8} maxLength={REFEREE_LIMITS.REPORT_MAX} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </V2Field>
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Voltar')}</V2Button>
        <V2Button type="submit" disabled={m.isPending}><FileText className="h-4 w-4" />{a.report ? t('Corrigir a súmula') : t('Enviar a súmula')}</V2Button>
      </div>
    </form>
  );
}

function Equipe({ a }) {
  const m = useFederationMutation(() => refereesAction({ federationId: a.federation_id, action: 'crew', assignmentId: a.id }));
  if (m.isError) return <p className="text-sm text-gray-500">{m.error.message}</p>;
  if (!m.data) return <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => m.mutate()}><Users className="h-4 w-4" />{t('Ver a escala do evento')}</V2Button>;
  return <ul className="space-y-1 text-sm text-ink">{(m.data.crew || []).map((p) => <li key={`${p.name}${p.function}`}>{p.name} · {funcao(p.function)}{p.status === 'invited' ? ` (${t('aguardando resposta')})` : ''}</li>)}</ul>;
}

/* ----------------------------------------------------------------- linhas -- */

function Escala({ a, hoje, onAbrir }) {
  const st = assignmentState(a, hoje);
  return (
    <li className={`space-y-2 rounded-2xl border p-3 ${a.status === 'invited' && !st.ended ? 'border-acid bg-acid/10' : 'border-gray-100'}`}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{a.event?.name}<AssignmentBadge status={a.status} /></p>
          <p className="text-xs text-gray-500">{sigla(a)} · {funcao(a.function)} · {periodo(a.event)}{a.event?.city ? ` · ${a.event.city}` : ''}</p>
          {a.status === 'invited' && !st.ended && a.respond_by && <p className={`text-xs font-semibold ${st.overdue ? 'text-red-700' : 'text-amber-700'}`}>{st.overdue ? t('O prazo para responder venceu em {data}', { data: dataCurta(a.respond_by) }) : t('Responda até {data}', { data: dataCurta(a.respond_by) })}</p>}
          {amountOf(a) > 0 && <p className="text-xs text-gray-500">{t('Diária: {v}', { v: formatBrlCents(amountOf(a)) })}{a.paid_at_ms ? ` · ${t('paga em {data}', { data: dataCurta(isoDateBR(a.paid_at_ms)) })}` : a.status === 'done' ? ` · ${t('a receber')}` : ''}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {st.canRespond && a.status === 'invited' && <V2Button type="button" size="sm" onClick={() => onAbrir('aceitar', a)}><Check className="h-4 w-4" />{t('Confirmar')}</V2Button>}
          {st.canRespond && <V2Button type="button" size="sm" variant="ghost" onClick={() => onAbrir('recusar', a)}>{a.status === 'confirmed' ? t('Não vou poder') : t('Recusar')}</V2Button>}
          {st.canReport && <V2Button type="button" size="sm" variant="secondary" onClick={() => onAbrir('sumula', a)}><FileText className="h-4 w-4" />{a.report ? t('Súmula enviada') : t('Enviar a súmula')}</V2Button>}
        </div>
      </div>
      {a.status === 'confirmed' && !st.ended && <Equipe a={a} />}
      {a.evaluation && (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-ink">{t('Avaliação da equipe: média {m}', { m: a.evaluation.avg })}</summary>
          <ul className="grid gap-1 text-sm text-ink sm:grid-cols-2">{EVAL_CRITERIA.map((c) => <li key={c}>{t(EVAL_CRITERIA_LABELS[c])}: <strong>{a.evaluation.scores?.[c] ?? '—'}</strong></li>)}</ul>
          {a.evaluation.comment && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-500">{a.evaluation.comment}</p>}
        </details>
      )}
    </li>
  );
}

/* -------------------------------------------- calendário de indisponibilidade -- */

const SEMANAS = 9;

function Disponibilidade({ roster }) {
  const hoje = isoDateBR();
  const [dias, setDias] = useState(() => normalizeUnavailable(roster.unavailable, hoje));
  const [publico, setPublico] = useState(roster.public_listing === true);
  const mudou = JSON.stringify(dias) !== JSON.stringify(normalizeUnavailable(roster.unavailable, hoje)) || publico !== (roster.public_listing === true);
  const m = useFederationMutation(() => refereesAction({ federationId: roster.federation_id, action: 'self', unavailable: dias, publicListing: publico }));
  // A grade começa na segunda-feira desta semana (dia 0 = domingo em getUTCDay).
  const inicio = useMemo(() => { const dow = new Date(`${hoje}T12:00:00Z`).getUTCDay(); return addDaysISO(hoje, -((dow + 6) % 7)); }, [hoje]);
  const grade = Array.from({ length: SEMANAS * 7 }, (_, i) => addDaysISO(inicio, i));
  const semana = [0, 1, 2, 3, 4, 5, 6].map((i) => fmtData(`${addDaysISO(inicio, i)}T12:00:00`, { weekday: 'narrow' }));
  return (
    <div className="space-y-3 rounded-2xl border border-gray-100 p-3">
      <p className="font-bold text-ink">{roster.federation_acronym || roster.federation_name || t('Federação')}</p>
      <p className="flex items-center gap-2 text-sm text-gray-500"><CalendarX2 className="h-4 w-4" aria-hidden="true" />{t('Toque nos dias em que você NÃO pode apitar. A equipe vê um alerta ao convocar.')}</p>
      <div className="grid grid-cols-7 gap-1 text-center" role="group" aria-label={t('Dias em que não posso')}>
        {semana.map((d, i) => <span key={`h${i}`} className="text-xs font-bold text-gray-500" aria-hidden="true">{d}</span>)}
        {grade.map((d) => {
          const passado = d < hoje;
          const marcado = dias.includes(d);
          return (
            <button type="button"
              key={d}
              disabled={passado}
              aria-pressed={marcado}
              aria-label={fmtData(`${d}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long' })}
              onClick={() => setDias((l) => toggleUnavailable(l, d, hoje))}
              className={`min-h-11 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30 ${passado ? 'text-gray-500 opacity-40' : marcado ? 'bg-red-100 text-red-700' : 'bg-gray-50 text-ink hover:bg-gray-100'}`}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
      {dias.length > 0 && <p className="text-xs text-gray-500">{tn(dias.length, '{n} dia marcado', '{n} dias marcados')}</p>}
      <V2Toggle id={`mr-publico-${roster.federation_id}`} checked={publico} onChange={setPublico} label={t('Aparecer no quadro público de arbitragem')} hint={t('Nome, nível e cidade na página da federação. Nunca valores nem avaliações.')} />
      <div className="flex justify-end">
        <V2Button type="button" size="sm" disabled={!mudou || m.isPending} onClick={() => m.mutate(undefined, { onSuccess: () => toast.success(t('Disponibilidade salva.')), onError: (e) => toast.error(e.message) })}><Save className="h-4 w-4" />{t('Salvar')}</V2Button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- bloco -- */

const TITULOS = { aceitar: tk('Confirmar a escala'), recusar: tk('Recusar a escala'), sumula: tk('Súmula do evento') };

export default function MyRefereeAssignments({ rosters = [], assignments = [] }) {
  const hoje = isoDateBR();
  const [aberto, setAberto] = useState(null); // { modo, a }
  const partes = useMemo(() => splitMyAssignments(assignments, hoje), [assignments, hoje]);
  const fechar = () => setAberto(null);
  return (
    <div className="space-y-4" data-dica="federacao-minhas-escalas">
      {partes.responder.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t('Para responder')}<V2Badge tone="acid">{partes.responder.length}</V2Badge></h3>
          <ul className="space-y-2">{partes.responder.map((a) => <Escala key={a.id} a={a} hoje={hoje} onAbrir={(modo, x) => setAberto({ modo, a: x })} />)}</ul>
        </div>
      )}
      {partes.proximas.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Próximas')}</h3>
          <ul className="space-y-2">{partes.proximas.map((a) => <Escala key={a.id} a={a} hoje={hoje} onAbrir={(modo, x) => setAberto({ modo, a: x })} />)}</ul>
        </div>
      )}
      {partes.responder.length === 0 && partes.proximas.length === 0 && <p className="text-sm text-gray-500">{t('Nenhuma convocação em aberto. Quando a federação escalar você, ela aparece aqui e no sino.')}</p>}
      {partes.historico.length > 0 && (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center text-xs font-bold uppercase tracking-wider text-gray-500">{t('Histórico ({n})', { n: partes.historico.length })}</summary>
          <ul className="mt-2 space-y-2">{partes.historico.map((a) => <Escala key={a.id} a={a} hoje={hoje} onAbrir={(modo, x) => setAberto({ modo, a: x })} />)}</ul>
        </details>
      )}
      {rosters.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Disponibilidade')}</h3>
          {rosters.map((r) => <Disponibilidade key={r.id} roster={r} />)}
        </div>
      )}
      <Dialog open={aberto != null} onOpenChange={(o) => { if (!o) fechar(); }}>
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
          <DialogTitle>{aberto ? t(TITULOS[aberto.modo]) : ''}</DialogTitle>
          <DialogDescription>{aberto ? `${aberto.a.event?.name} · ${periodo(aberto.a.event)}` : ''}</DialogDescription>
          {aberto && aberto.modo !== 'sumula' && <Responder a={aberto.a} aceitar={aberto.modo === 'aceitar'} onFechar={fechar} />}
          {aberto?.modo === 'sumula' && <Sumula a={aberto.a} onFechar={fechar} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
