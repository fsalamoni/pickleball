/**
 * Arbitragem → ESCALAS (Central): os eventos escaláveis (torneios
 * chancelados e eventos esportivos da agenda) com a cobertura por função,
 * o montador da escala (sugestões por nível e disponibilidade, com os
 * alertas), substituir, cancelar e fechar o evento depois que ele acontece.
 * Tudo passa pelo servidor (`federationReferees`).
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarCheck, CheckCircle2, ClipboardCheck, Repeat, Send, UserPlus, Users, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { refereesAction } from '@/modules/federations/services/refereesService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import {
  REFEREE_FUNCTIONS, REFEREE_LIMITS, addDaysISO, assignmentState, defaultRespondBy, eventCoverage, eventKey, isoDateBR, levelLabel, suggestReferees,
} from '@/modules/federations/domain/referees';
import { formatBrlCents, parseBrlCents } from '@/modules/federations/domain/charges';
import { useFiltroNaUrl } from '../manage/listTools';
import { useAvisoNaoSalvo } from '../manage/naoSalvo';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t, tk, tn } from '@/core/i18n';
import { AssignmentBadge, WarningsList, funcao, periodo } from './refUi';

const FILTROS = [
  { id: 'proximos', label: tk('Próximos') },
  { id: 'sem-cobertura', label: tk('Sem cobertura em 7 dias') },
  { id: 'sem-resposta', label: tk('Sem resposta') },
  { id: 'anteriores', label: tk('Anteriores') },
];
const VISIVEIS = ['invited', 'confirmed', 'declined', 'done', 'no_show'];

/** Os eventos da lista: os escaláveis + os que já têm escala (um evento antigo ou cancelado não some das escalas). */
function montarEventos(events = [], assignments = []) {
  const porChave = new Map();
  events.forEach((e) => porChave.set(eventKey(e), { event: e, lista: [] }));
  assignments.forEach((a) => {
    const k = a.event_key || eventKey(a.event);
    if (!porChave.has(k)) porChave.set(k, { event: a.event, lista: [] });
    porChave.get(k).lista.push(a);
  });
  return [...porChave.values()].filter((x) => x.event?.date);
}

/* ------------------------------------------------------------- convocar -- */

function Convocar({ federation, event, rules, referees, assignments, onFeito }) {
  const hoje = isoDateBR();
  const [fn, setFn] = useState(REFEREE_FUNCTIONS[0]);
  const [escolhidos, setEscolhidos] = useState([]);
  const [fee, setFee] = useState('');
  const [travel, setTravel] = useState('');
  const [respondBy, setRespondBy] = useState(() => defaultRespondBy(event, rules, hoje));
  useAvisoNaoSalvo(escolhidos.length > 0);
  const sugestoes = useMemo(() => suggestReferees({ referees, assignments, event, fn, rules }), [referees, assignments, event, fn, rules]);
  const padrao = rules.fee_default_cents[fn] || 0;
  const feeCents = fee.trim() ? parseBrlCents(fee) : padrao;
  const travelCents = travel.trim() ? parseBrlCents(travel) : 0;
  const m = useFederationMutation(() => refereesAction({
    federationId: federation.id, action: 'assign', event: { kind: event.kind, id: event.id }, function: fn, userIds: escolhidos, feeCents, travelCents, respondBy,
  }));
  const alternar = (uid) => setEscolhidos((l) => (l.includes(uid) ? l.filter((x) => x !== uid) : l.length < REFEREE_LIMITS.ASSIGN_BATCH_MAX ? [...l, uid] : l));
  const enviar = (e) => {
    e.preventDefault();
    if (!escolhidos.length) { toast.error(t('Escolha quem convocar.')); return; }
    if (!Number.isFinite(feeCents) || !Number.isFinite(travelCents)) { toast.error(t('Valor inválido: use reais com até dois decimais.')); return; }
    m.mutate(undefined, {
      onSuccess: (res) => {
        const n = res?.created?.length || 0;
        toast.success(tn(n, '{n} pessoa convocada.', '{n} pessoas convocadas.'));
        (res?.skipped || []).forEach((s) => toast.warning(s.reason));
        setEscolhidos([]);
        onFeito?.();
      },
      onError: (er) => toast.error(er.message),
    });
  };
  return (
    <form onSubmit={enviar} noValidate className="space-y-3 rounded-2xl border border-gray-100 p-3" data-dica="federacao-arbitragem-convocar">
      <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><UserPlus className="h-4 w-4" aria-hidden="true" />{t('Convocar')}</h3>
      <V2Field label={t('Função')} htmlFor="ref-fn">
        <V2Select id="ref-fn" value={fn} onChange={(e) => { setFn(e.target.value); setEscolhidos([]); }}>
          {REFEREE_FUNCTIONS.map((f) => <option key={f} value={f}>{funcao(f)}</option>)}
        </V2Select>
      </V2Field>
      {sugestoes.length === 0
        ? <p className="text-sm text-gray-500">{t('Ninguém do quadro atua nesta função e está livre neste evento. Cadastre ou edite árbitros na aba Quadro.')}</p>
        : (
          <fieldset>
            <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">{t('Sugestões: sem alerta primeiro, depois o nível e quem atuou menos')}</legend>
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {sugestoes.map(({ referee: r, warnings }) => (
                <li key={r.user_id}>
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-2 py-2 hover:bg-gray-50">
                    <input type="checkbox" className="mt-1 h-4 w-4" checked={escolhidos.includes(r.user_id)} onChange={() => alternar(r.user_id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{r.name}</span>
                      <span className="block text-xs text-gray-500">{levelLabel(rules, r.level)} · {tn(r.stats?.acts || 0, '{n} atuação', '{n} atuações')}{r.city ? ` · ${r.city}` : ''}</span>
                      <WarningsList warnings={warnings} rules={rules} className="mt-1" />
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
      <div className="grid gap-3 sm:grid-cols-3">
        <V2Field label={t('Diária (R$)')} htmlFor="ref-fee" hint={t('Em branco: {valor}', { valor: formatBrlCents(padrao) })}><V2Input id="ref-fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder={formatBrlCents(padrao)} /></V2Field>
        <V2Field label={t('Deslocamento (R$)')} htmlFor="ref-travel"><V2Input id="ref-travel" inputMode="decimal" value={travel} onChange={(e) => setTravel(e.target.value)} placeholder="0,00" /></V2Field>
        <V2Field label={t('Responder até')} htmlFor="ref-prazo"><V2Input id="ref-prazo" type="date" min={hoje} value={respondBy} onChange={(e) => setRespondBy(e.target.value)} /></V2Field>
      </div>
      <div className="flex justify-end">
        <V2Button type="submit" disabled={m.isPending || !escolhidos.length}><Send className="h-4 w-4" />{escolhidos.length ? tn(escolhidos.length, 'Convocar {n} pessoa', 'Convocar {n} pessoas') : t('Convocar')}</V2Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------- substituir e cancelar -- */

function Substituir({ federation, a, event, rules, referees, assignments, onFechar }) {
  const sugestoes = useMemo(() => suggestReferees({ referees, assignments, event, fn: a.function, rules }), [referees, assignments, event, a.function, rules]);
  const [uid, setUid] = useState('');
  const m = useFederationMutation(() => refereesAction({ federationId: federation.id, action: 'reassign', assignmentId: a.id, userId: uid }));
  return (
    <div className="space-y-3">
      {sugestoes.length === 0 ? <p className="text-sm text-gray-500">{t('Ninguém livre no quadro para esta função.')}</p> : (
        <V2Field label={t('Quem entra no lugar')} htmlFor="ref-subst">
          <V2Select id="ref-subst" value={uid} onChange={(e) => setUid(e.target.value)}>
            <option value="">{t('Escolha')}</option>
            {sugestoes.map(({ referee: r, warnings }) => <option key={r.user_id} value={r.user_id}>{r.name} · {levelLabel(rules, r.level)}{warnings.length ? ` · ${tn(warnings.length, '{n} alerta', '{n} alertas')}` : ''}</option>)}
          </V2Select>
        </V2Field>
      )}
      {uid && <WarningsList warnings={sugestoes.find((s) => s.referee.user_id === uid)?.warnings} rules={rules} />}
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Voltar')}</V2Button>
        <V2Button type="button" disabled={!uid || m.isPending} onClick={() => m.mutate(undefined, { onSuccess: () => { toast.success(t('Substituição feita: a nova pessoa foi convocada.')); onFechar(); }, onError: (e) => toast.error(e.message) })}><Repeat className="h-4 w-4" />{t('Substituir')}</V2Button>
      </div>
    </div>
  );
}

function CancelarEscala({ federation, a, onFechar }) {
  const [reason, setReason] = useState('');
  const m = useFederationMutation(() => refereesAction({ federationId: federation.id, action: 'cancel', assignmentId: a.id, reason }));
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => { if (!o) onFechar(); }}
      destructive
      loading={m.isPending}
      title={t('Cancelar a escala de {nome}?', { nome: a.referee_name })}
      description={t('A pessoa é avisada com o motivo. A escala fica no histórico como cancelada.')}
      confirmLabel={t('Cancelar a escala')}
      cancelLabel={t('Voltar')}
      confirmDisabled={reason.trim().length < 3}
      onConfirm={() => m.mutate(undefined, { onSuccess: () => { toast.success(t('Escala cancelada.')); onFechar(); }, onError: (e) => toast.error(e.message) })}
    >
      <V2Field label={t('Motivo')} htmlFor="ref-cancel-motivo" required><V2Textarea id="ref-cancel-motivo" rows={2} maxLength={REFEREE_LIMITS.REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} /></V2Field>
    </ConfirmDialog>
  );
}

/* ------------------------------------------------------- a escala do evento -- */

function EscalaDoEvento({ federation, item, rules, referees, assignments }) {
  const { event, lista } = item;
  const [acao, setAcao] = useState(null); // { modo, a }
  const cob = eventCoverage(lista, rules);
  const terminou = assignmentState({ event }, isoDateBR()).ended;
  const porFuncao = REFEREE_FUNCTIONS.filter((f) => cob.rows.some((r) => r.function === f));
  return (
    <div className="space-y-4">
      {porFuncao.length === 0 && <p className="text-sm text-gray-500">{t('Ninguém escalado ainda.')}</p>}
      {porFuncao.map((f) => {
        const row = cob.rows.find((r) => r.function === f);
        const dela = lista.filter((a) => a.function === f && VISIVEIS.includes(a.status));
        return (
          <section key={f} className="space-y-1">
            <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
              {funcao(f)}
              <V2Badge tone={row.need && row.confirmed >= row.need ? 'green' : 'amber'}>{row.need ? t('{c} de {n} confirmados', { c: row.confirmed, n: row.need }) : tn(row.confirmed, '{n} confirmado', '{n} confirmados')}</V2Badge>
              {row.invited > 0 && <span className="text-xs text-gray-500">{tn(row.invited, '{n} aguardando resposta', '{n} aguardando resposta')}</span>}
            </h3>
            <ul className="space-y-1">
              {dela.map((a) => {
                const st = assignmentState(a, isoDateBR());
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">{a.referee_name}<AssignmentBadge status={a.status} />{st.overdue && <V2Badge tone="red">{t('Prazo vencido')}</V2Badge>}</p>
                      <p className="text-xs text-gray-500">{formatBrlCents((a.fee_cents || 0) + (a.travel_cents || 0))}{a.status === 'invited' && a.respond_by ? ` · ${t('responder até {data}', { data: periodo({ date: a.respond_by }) })}` : ''}</p>
                      {a.conflict?.declared && <p className="text-xs font-semibold text-red-700">{t('Conflito declarado: {motivo}', { motivo: a.conflict.reason })}</p>}
                      {a.decline_reason && <p className="text-xs text-gray-500">{t('Motivo da recusa: {motivo}', { motivo: a.decline_reason })}</p>}
                      <WarningsList warnings={a.warnings} rules={rules} />
                    </div>
                    {!terminou && ['invited', 'confirmed', 'declined'].includes(a.status) && (
                      <div className="flex flex-wrap gap-1">
                        <V2Button type="button" size="sm" variant="secondary" onClick={() => setAcao({ modo: 'substituir', a })}><Repeat className="h-4 w-4" />{t('Substituir')}</V2Button>
                        {a.status !== 'declined' && <V2Button type="button" size="sm" variant="ghost" onClick={() => setAcao({ modo: 'cancelar', a })} aria-label={t('Cancelar a escala de {nome}', { nome: a.referee_name })}><XCircle className="h-4 w-4" /></V2Button>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {acao?.modo === 'substituir' && (
        <div className="rounded-2xl border border-gray-100 p-3">
          <p className="mb-2 text-sm font-bold text-ink">{t('Substituir {nome} ({funcao})', { nome: acao.a.referee_name, funcao: funcao(acao.a.function) })}</p>
          <Substituir federation={federation} a={acao.a} event={event} rules={rules} referees={referees} assignments={assignments} onFechar={() => setAcao(null)} />
        </div>
      )}
      {acao?.modo === 'cancelar' && <CancelarEscala federation={federation} a={acao.a} onFechar={() => setAcao(null)} />}
      {!terminou && <Convocar federation={federation} event={event} rules={rules} referees={referees} assignments={assignments} />}
    </div>
  );
}

/* --------------------------------------------------------- fechar evento -- */

function FecharEvento({ federation, item, onFechar }) {
  const confirmados = item.lista.filter((a) => a.status === 'confirmed');
  const semResposta = item.lista.filter((a) => a.status === 'invited').length;
  const [faltou, setFaltou] = useState([]);
  const m = useFederationMutation(() => refereesAction({
    federationId: federation.id, action: 'close_event', event: { kind: item.event.kind, id: item.event.id },
    results: Object.fromEntries(faltou.map((id) => [id, 'no_show'])),
  }));
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{t('Marque quem NÃO compareceu; os demais confirmados ficam como "Atuou" e entram na avaliação e nas diárias.')}</p>
      {semResposta > 0 && <p className="text-sm text-amber-700">{tn(semResposta, '{n} convocação sem resposta será cancelada.', '{n} convocações sem resposta serão canceladas.')}</p>}
      <ul className="space-y-1">
        {confirmados.map((a) => (
          <li key={a.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-gray-50">
              <input type="checkbox" className="h-4 w-4" checked={faltou.includes(a.id)} onChange={() => setFaltou((l) => (l.includes(a.id) ? l.filter((x) => x !== a.id) : [...l, a.id]))} />
              <span className="text-sm text-ink">{a.referee_name} · {funcao(a.function)}</span>
              {faltou.includes(a.id) && <V2Badge tone="red">{t('Não compareceu')}</V2Badge>}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Voltar')}</V2Button>
        <V2Button type="button" disabled={m.isPending} onClick={() => m.mutate(undefined, { onSuccess: () => { toast.success(t('Evento fechado.')); onFechar(); }, onError: (e) => toast.error(e.message) })}><ClipboardCheck className="h-4 w-4" />{t('Fechar o evento')}</V2Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ lista -- */

function EventoCard({ item, rules, hoje, onAbrir }) {
  const { event, lista } = item;
  const cob = eventCoverage(lista, rules);
  const st = assignmentState({ event }, hoje);
  const atrasadas = lista.filter((a) => assignmentState(a, hoje).overdue).length;
  const fechavel = st.started && lista.some((a) => ['confirmed', 'invited'].includes(a.status));
  return (
    <V2Surface variant="compacto" className="flex flex-wrap items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold uppercase tracking-wider text-gray-500">{event.kind === 'tournament' ? t('Torneio chancelado') : t('Agenda')}</span>
          {cob.need > 0 && <V2Badge tone={cob.complete ? 'green' : 'amber'}>{cob.complete ? t('Escala completa') : t('{c} de {n} confirmados', { c: cob.confirmed, n: cob.need })}</V2Badge>}
          {atrasadas > 0 && <V2Badge tone="red">{tn(atrasadas, '{n} sem resposta', '{n} sem resposta')}</V2Badge>}
        </p>
        <p className="font-bold text-ink">{event.name}</p>
        <p className="text-xs text-gray-500">{periodo(event)}{event.city ? ` · ${event.city}` : ''}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {fechavel && <V2Button type="button" size="sm" variant="secondary" onClick={() => onAbrir('fechar', item)}><CheckCircle2 className="h-4 w-4" />{t('Fechar o evento')}</V2Button>}
        <V2Button type="button" size="sm" variant={st.ended ? 'ghost' : 'primary'} onClick={() => onAbrir('escala', item)}><Users className="h-4 w-4" />{st.ended ? t('Ver a escala') : t('Escalar')}</V2Button>
      </div>
    </V2Surface>
  );
}

export default function RefScalesTab({ federation, rules, rosterQ, assignmentsQ, eventsQ }) {
  const hoje = isoDateBR();
  const [filtro, setFiltro] = useFiltroNaUrl('filtro', 'proximos', FILTROS.map((f) => f.id));
  const [aberto, setAberto] = useState(null); // { modo, item }
  const assignments = assignmentsQ.data;
  const referees = rosterQ.data;
  const itens = useMemo(() => (assignments && eventsQ.events ? montarEventos(eventsQ.events, assignments) : null), [assignments, eventsQ.events]);
  const filtrados = useMemo(() => {
    if (!itens) return null;
    const limite = addDaysISO(hoje, 7);
    const ended = (x) => assignmentState({ event: x.event }, hoje).ended;
    const lista = itens.filter((x) => {
      if (filtro === 'anteriores') return ended(x);
      if (filtro === 'sem-resposta') return x.lista.some((a) => assignmentState(a, hoje).overdue);
      if (filtro === 'sem-cobertura') return x.event.date >= hoje && x.event.date <= limite && !eventCoverage(x.lista, rules).complete;
      return !ended(x);
    });
    return lista.sort((a, b) => (filtro === 'anteriores' ? b.event.date.localeCompare(a.event.date) : a.event.date.localeCompare(b.event.date)));
  }, [itens, filtro, hoje, rules]);
  const atual = aberto && itens ? itens.find((x) => eventKey(x.event) === eventKey(aberto.item.event)) || aberto.item : null;
  const erro = assignmentsQ.isError || rosterQ.isError || eventsQ.isError;
  return (
    <section className="space-y-4" aria-label={t('Escalas')} data-dica="federacao-arbitragem-escalas">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('Filtrar eventos')}>
        {FILTROS.map((f) => <V2FilterChip key={f.id} active={filtro === f.id} onClick={() => setFiltro(f.id)}>{t(f.label)}</V2FilterChip>)}
      </div>
      {erro && <V2ErrorState inline title={t('Não carregou as escalas')} onRetry={() => { assignmentsQ.refetch(); rosterQ.refetch(); eventsQ.refetch(); }} />}
      {!erro && (assignmentsQ.isLoading || rosterQ.isLoading || eventsQ.isLoading) && <V2Skeleton lines={4} />}
      {eventsQ.incompleto && <p className="text-sm text-amber-700">{t('Parte dos eventos (torneios ou agenda) não carregou agora: a lista pode estar incompleta.')}</p>}
      {filtrados && filtrados.length === 0 && (
        <V2EmptyState
          icon={CalendarCheck}
          title={filtro === 'proximos' ? t('Nenhum evento para escalar') : t('Nada neste filtro')}
          description={filtro === 'proximos' ? t('Torneios chancelados por esta federação e competições, seletivas e eventos esportivos da agenda aparecem aqui para escalar.') : t('Troque o filtro para ver os outros eventos.')}
        />
      )}
      {filtrados && filtrados.length > 0 && (
        <ul className="space-y-2">{filtrados.map((x) => <li key={eventKey(x.event)}><EventoCard item={x} rules={rules} hoje={hoje} onAbrir={(modo, item) => setAberto({ modo, item })} /></li>)}</ul>
      )}
      <Dialog open={aberto != null} onOpenChange={(o) => { if (!o) setAberto(null); }}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogTitle>{aberto?.modo === 'fechar' ? t('Fechar o evento') : t('Escala de arbitragem')}</DialogTitle>
          <DialogDescription>{atual ? `${atual.event.name} · ${periodo(atual.event)}` : ''}</DialogDescription>
          {atual && aberto.modo === 'escala' && <EscalaDoEvento federation={federation} item={atual} rules={rules} referees={referees || []} assignments={assignments || []} />}
          {atual && aberto.modo === 'fechar' && <FecharEvento federation={federation} item={atual} onFechar={() => setAberto(null)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
