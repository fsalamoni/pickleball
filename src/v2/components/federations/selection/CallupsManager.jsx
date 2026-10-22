/**
 * CONVOCAÇÕES na Central (Bloco 3): a equipe de competições monta a
 * convocação (pelo ranking oficial do ano ou a dedo), publica — os melhores de
 * cada categoria recebem o convite —, confere os documentos de viagem e fecha
 * a delegação. Quem recusa, não responde no prazo ou é cancelado dá a vaga ao
 * próximo do ranking, pelo servidor. Os custos da viagem viram despesa nas
 * contas quando o financeiro marca como pagos.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plane, Plus, Send, Trash2, UserPlus, XCircle } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EXPENSE_CATEGORIES } from '@/modules/federations/domain/accounts';
import { parseBrlCents } from '@/modules/federations/domain/charges';
import { FINAL_INVITE_STATUS_LABELS } from '@/modules/federations/domain/competitions';
import {
  CALLUP_COSTS_MAX, CALLUP_COST_CATEGORIES, CALLUP_CRITERIA, CALLUP_CRITERIA_LABELS, CALLUP_MEMBER_STATUS, CALLUP_STATUS, CALLUP_STATUS_LABELS,
  TRAVEL_DOCS, TRAVEL_DOC_LABELS, callupCostsTotal, callupDocsState, normalizeCallupCosts, validateCallup,
} from '@/modules/federations/domain/selection';
import { useFederationRanking } from '@/modules/federations/hooks/useFederations';
import { useCallupMembers, useCallups, useSelectionAction } from '@/modules/federations/hooks/useSelection';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { classeLabel } from '../FedPublicBlocks';
import { quando } from '../federationUi';
import { reais, reaisParaCampo } from '../accounts/accountsUi';
import FedPersonPicker from '../manage/FedPersonPicker';
import { TOM_CONVITE, TOM_CONVOCACAO, categoriaDoConvite, periodoDoEvento } from './selectionUi';

const ok = (msg, depois) => ({ onSuccess: (r) => { toast.success(typeof msg === 'function' ? msg(r) : msg); depois?.(r); }, onError: (e) => toast.error(e.message) });
const nomeDaPessoa = (a) => a?.platform_name || a?.full_name || a?.display_name || '';

/* ---------------------------------------------------------------- editor -- */

function CallupEditor({ federation, callup, onClose }) {
  const ano = new Date().getFullYear();
  const publicada = Boolean(callup) && callup.status !== CALLUP_STATUS.DRAFT;
  const [f, setF] = useState(() => ({
    title: callup?.title || '', event_name: callup?.event_name || '', place: callup?.place || '', starts_at: callup?.starts_at || '', ends_at: callup?.ends_at || '',
    criterion: callup?.criterion || CALLUP_CRITERIA.RANKING, season: String(callup?.season || ano), categories: callup?.categories || null,
    per_category: String(callup?.per_category || 4), accept_days: String(callup?.accept_days || 7), travel_docs: callup?.travel_docs || ['id_doc'],
    collect_uniform: callup?.collect_uniform === true, notes: callup?.notes || '',
  }));
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const pelaRanking = f.criterion === CALLUP_CRITERIA.RANKING;
  const ranking = useFederationRanking(federation.id, Number(f.season), { enabled: pelaRanking });
  const categorias = ranking.data?.categories || [];
  const m = useSelectionAction(federation.id);
  const payload = { ...f, season: Number(f.season), per_category: Number(f.per_category), accept_days: Number(f.accept_days) };
  const r = validateCallup(payload);
  const marcada = (k) => !f.categories || f.categories.includes(k);
  const alternarCategoria = (k) => {
    const atuais = f.categories || categorias.map((c) => c.key);
    const prox = atuais.includes(k) ? atuais.filter((x) => x !== k) : [...atuais, k];
    set('categories', prox.length === categorias.length ? null : prox);
  };
  const alternarDoc = (k) => set('travel_docs', f.travel_docs.includes(k) ? f.travel_docs.filter((x) => x !== k) : [...f.travel_docs, k]);
  const salvar = () => m.mutate({ action: 'callup_save', callupId: callup?.id, ...payload }, ok(t('Convocação salva.'), onClose));

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{callup ? t('Editar convocação') : t('Nova convocação')}</DialogTitle>
          <DialogDescription>{t('A convocação nasce como rascunho. Publicada, os melhores de cada categoria recebem o convite e respondem no prazo.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <V2Field label={t('Título')} htmlFor="cu-titulo" hint={t('Ex.: Seleção gaúcha para o Brasileiro 2027')}><V2Input id="cu-titulo" value={f.title} maxLength={120} onChange={(e) => set('title', e.target.value)} /></V2Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <V2Field label={t('Campeonato')} htmlFor="cu-evento"><V2Input id="cu-evento" value={f.event_name} maxLength={120} onChange={(e) => set('event_name', e.target.value)} /></V2Field>
            <V2Field label={t('Local')} htmlFor="cu-local"><V2Input id="cu-local" value={f.place} maxLength={120} onChange={(e) => set('place', e.target.value)} /></V2Field>
            <V2Field label={t('Começa em')} htmlFor="cu-inicio"><V2Input id="cu-inicio" type="date" value={f.starts_at} onChange={(e) => set('starts_at', e.target.value)} /></V2Field>
            <V2Field label={t('Termina em')} htmlFor="cu-fim" error={r.errors.ends_at ? t('O fim vem depois do começo.') : undefined}><V2Input id="cu-fim" type="date" value={f.ends_at} onChange={(e) => set('ends_at', e.target.value)} /></V2Field>
          </div>
          <fieldset className="space-y-3 rounded-2xl border border-gray-100 p-3" disabled={publicada}>
            <legend className="px-1 text-sm font-semibold text-ink">{t('Quem é convocado')}</legend>
            {publicada && <p className="text-xs text-gray-500">{t('Publicada, a regra da convocação fica como foi anunciada.')}</p>}
            <V2Field label={t('Critério')} htmlFor="cu-criterio">
              <V2Select id="cu-criterio" value={f.criterion} onChange={(e) => set('criterion', e.target.value)} options={Object.values(CALLUP_CRITERIA).map((c) => ({ value: c, label: t(CALLUP_CRITERIA_LABELS[c]) }))} />
            </V2Field>
            {pelaRanking ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <V2Field label={t('Ranking do ano')} htmlFor="cu-ano"><V2Select id="cu-ano" value={f.season} onChange={(e) => { set('season', e.target.value); set('categories', null); }} options={[ano, ano - 1].map((a) => ({ value: String(a), label: String(a) }))} /></V2Field>
                  <V2Field label={t('Vagas por categoria')} htmlFor="cu-vagas"><V2Input id="cu-vagas" type="number" min={1} max={32} value={f.per_category} onChange={(e) => set('per_category', e.target.value)} /></V2Field>
                </div>
                {ranking.isError && <V2ErrorState inline title={t('Não carregou o ranking')} onRetry={() => ranking.refetch()} />}
                {ranking.isSuccess && !categorias.length && <p className="text-sm text-gray-500">{t('O ranking de {ano} ainda não tem atletas.', { ano: f.season })}</p>}
                {categorias.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-ink">{t('Categorias')}</p>
                    <div className="mt-1 grid gap-1 sm:grid-cols-2">
                      {categorias.map((c) => (
                        <label key={c.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={marcada(c.key)} onChange={() => alternarCategoria(c.key)} />{classeLabel(c)}</label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : <p className="text-sm text-gray-500">{t('Depois de publicar, convoque cada pessoa pela lista de usuários.')}</p>}
          </fieldset>
          <V2Field label={t('Dias para responder')} htmlFor="cu-dias" hint={t('Sem resposta no prazo, a vaga vai para o próximo do ranking.')}><V2Input id="cu-dias" type="number" min={1} max={30} value={f.accept_days} onChange={(e) => set('accept_days', e.target.value)} /></V2Field>
          <div>
            <p className="text-sm font-semibold text-ink">{t('Documentos de viagem')}</p>
            <div className="mt-1 grid gap-1 sm:grid-cols-2">
              {TRAVEL_DOCS.map((k) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.travel_docs.includes(k)} onChange={() => alternarDoc(k)} />{t(TRAVEL_DOC_LABELS[k])}</label>)}
            </div>
          </div>
          <V2Toggle id="cu-uniforme" checked={f.collect_uniform} onChange={(v) => set('collect_uniform', v)} label={t('Pedir o tamanho do uniforme')} hint={t('Quem aceita escolhe o tamanho na Minha área.')} />
          <V2Field label={t('Orientações aos convocados')} htmlFor="cu-notas" hint={t('Viagem, hospedagem, horários. Só os convocados leem.')}><V2Textarea id="cu-notas" rows={3} maxLength={2000} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
            <V2Button type="button" disabled={!r.ok || m.isPending} onClick={salvar}>{t('Salvar')}</V2Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------------------------------------- custos -- */

function CostsEditor({ federation, callup, papel }) {
  const [linhas, setLinhas] = useState(() => normalizeCallupCosts(callup.costs).map((c) => ({ ...c, valor: reaisParaCampo(c.amount_cents) })));
  const m = useSelectionAction(federation.id);
  const set = (i, k, v) => setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const custos = linhas.map(({ valor, ...c }) => ({ ...c, amount_cents: parseBrlCents(valor) || 0 }));
  const total = callupCostsTotal(custos);
  const categorias = CALLUP_COST_CATEGORIES.map((id) => ({ value: id, label: t(EXPENSE_CATEGORIES.find((c) => c.id === id)?.label || id) }));
  return (
    <section className="space-y-2">
      <p className="text-sm font-semibold text-ink">{t('Custos da delegação')}</p>
      <p className="text-xs text-gray-500">{papel.financeiro ? t('Marque a data do pagamento: o custo pago entra nas contas como despesa, sem lançar de novo.') : t('Só o financeiro marca o pagamento; o custo pago entra nas contas como despesa.')}</p>
      {linhas.map((l, i) => (
        <div key={l.id} className="grid items-end gap-2 sm:grid-cols-[1fr_9rem_7rem_9rem_auto]">
          <V2Field label={t('Item')} htmlFor={`cu-custo-${l.id}`}><V2Input id={`cu-custo-${l.id}`} value={l.label} maxLength={80} onChange={(e) => set(i, 'label', e.target.value)} /></V2Field>
          <V2Field label={t('Categoria')} htmlFor={`cu-cat-${l.id}`}><V2Select id={`cu-cat-${l.id}`} value={l.category} onChange={(e) => set(i, 'category', e.target.value)} options={categorias} /></V2Field>
          <V2Field label={t('Valor (R$)')} htmlFor={`cu-valor-${l.id}`}><V2Input id={`cu-valor-${l.id}`} inputMode="decimal" value={l.valor} onChange={(e) => set(i, 'valor', e.target.value)} /></V2Field>
          <V2Field label={t('Pago em')} htmlFor={`cu-pago-${l.id}`}><V2Input id={`cu-pago-${l.id}`} type="date" disabled={!papel.financeiro} value={l.paid_at} onChange={(e) => set(i, 'paid_at', e.target.value)} /></V2Field>
          <V2Button type="button" size="sm" variant="ghost" aria-label={t('Tirar {item}', { item: l.label || t('item') })} disabled={Boolean(l.paid_at) && !papel.financeiro} onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></V2Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <V2Button type="button" size="sm" variant="ghost" disabled={linhas.length >= CALLUP_COSTS_MAX} onClick={() => setLinhas((ls) => [...ls, { id: `c${Date.now().toString(36)}`, label: '', category: 'travel', valor: '', paid_at: '' }])}><Plus className="h-4 w-4" />{t('Adicionar custo')}</V2Button>
        <span className="text-sm text-gray-600">{t('Previsto {previsto} · pago {pago}', { previsto: reais(total.planned), pago: reais(total.paid) })}</span>
      </div>
      <div className="flex justify-end">
        <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => m.mutate({ action: 'callup_costs', callupId: callup.id, costs: custos.filter((c) => c.label.trim()) }, ok(t('Custos salvos.')))}>{t('Salvar custos')}</V2Button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- convocados -- */

function Convocado({ federation, callup, inv, onCancelar }) {
  const docs = callupDocsState(callup, inv);
  const [nota, setNota] = useState(inv.staff_note || '');
  const m = useSelectionAction(federation.id);
  const ativo = [CALLUP_MEMBER_STATUS.INVITED, CALLUP_MEMBER_STATUS.ACCEPTED].includes(inv.status);
  const marcarDoc = (k, v) => m.mutate({ action: 'callup_member_update', memberId: inv.id, docs_ok: { ...(inv.docs_ok || {}), [k]: v } }, { onError: (e) => toast.error(e.message) });
  return (
    <li className="space-y-1.5 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink">{`${inv.position ? `${inv.position}º · ` : ''}${inv.user_name}`}{inv.substitute ? <span className="font-normal text-gray-500"> · {t('suplente')}</span> : null}</span>
        <span className="flex items-center gap-2">
          <V2Badge tone={TOM_CONVITE[inv.status] || 'neutral'}>{t(FINAL_INVITE_STATUS_LABELS[inv.status] || inv.status)}</V2Badge>
          {inv.status === CALLUP_MEMBER_STATUS.INVITED && <span className="text-xs text-gray-500">{t('até {data}', { data: quando(inv.expires_at_ms) })}</span>}
          {ativo && callup.status !== CALLUP_STATUS.CANCELLED && <V2Button type="button" size="sm" variant="ghost" aria-label={t('Cancelar a convocação de {nome}', { nome: inv.user_name })} onClick={() => onCancelar(inv)}><XCircle className="h-4 w-4" /></V2Button>}
        </span>
      </div>
      {inv.status === CALLUP_MEMBER_STATUS.ACCEPTED && (
        <>
          {callup.collect_uniform && <p className="text-xs text-gray-600">{t('Uniforme: {tamanho}', { tamanho: inv.uniform_size || t('não informado') })}</p>}
          {docs.required.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {docs.required.map((k) => (
                <label key={k} className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={docs.ok.includes(k)} disabled={m.isPending} onChange={(e) => marcarDoc(k, e.target.checked)} />{t(TRAVEL_DOC_LABELS[k])}</label>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <V2Field label={t('Anotação da comissão')} htmlFor={`cu-nota-${inv.id}`} className="flex-1"><V2Input id={`cu-nota-${inv.id}`} value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} /></V2Field>
            {nota !== (inv.staff_note || '') && <V2Button type="button" size="sm" variant="secondary" disabled={m.isPending} onClick={() => m.mutate({ action: 'callup_member_update', memberId: inv.id, staff_note: nota }, ok(t('Anotação salva.')))}>{t('Salvar')}</V2Button>}
          </div>
        </>
      )}
      {inv.status === CALLUP_MEMBER_STATUS.CANCELLED && inv.cancel_reason && <p className="text-xs text-gray-500">{t('Motivo: {motivo}', { motivo: inv.cancel_reason })}</p>}
    </li>
  );
}

function ConvocarAMao({ federation, callup }) {
  const [pessoa, setPessoa] = useState([]);
  const [rotulo, setRotulo] = useState('');
  const m = useSelectionAction(federation.id);
  return (
    <section className="space-y-2 rounded-2xl border border-gray-100 p-3">
      <p className="text-sm font-semibold text-ink">{t('Convocar uma pessoa')}</p>
      <FedPersonPicker id={`cu-pessoa-${callup.id}`} selecionados={pessoa} onChange={setPessoa} />
      <V2Field label={t('Categoria ou função')} htmlFor={`cu-rotulo-${callup.id}`} hint={t('Ex.: Dupla mista 50+, técnico, chefe de delegação.')}><V2Input id={`cu-rotulo-${callup.id}`} value={rotulo} maxLength={60} onChange={(e) => setRotulo(e.target.value)} /></V2Field>
      <div className="flex justify-end">
        <V2Button type="button" size="sm" disabled={!pessoa[0] || m.isPending} onClick={() => m.mutate({ action: 'callup_add', callupId: callup.id, userId: pessoa[0].id, label: rotulo }, ok(t('{nome} foi convocado.', { nome: nomeDaPessoa(pessoa[0]) }), () => { setPessoa([]); setRotulo(''); }))}>
          <UserPlus className="h-4 w-4" />{t('Convocar')}
        </V2Button>
      </div>
    </section>
  );
}

function CallupMembers({ federation, callup }) {
  const q = useCallupMembers(federation.id, callup.id);
  const [cancelando, setCancelando] = useState(null);
  const [motivo, setMotivo] = useState('');
  const m = useSelectionAction(federation.id);
  const grupos = useMemo(() => {
    const mapa = new Map();
    (q.data || []).forEach((i) => { if (!mapa.has(i.category_key)) mapa.set(i.category_key, []); mapa.get(i.category_key).push(i); });
    mapa.forEach((l) => l.sort((a, b) => (a.position || 999) - (b.position || 999) || String(a.user_name).localeCompare(String(b.user_name), 'pt-BR')));
    return [...mapa.values()];
  }, [q.data]);
  if (q.isError) return <V2ErrorState inline title={t('Não carregaram os convocados')} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={3} />;
  return (
    <section className="space-y-2">
      <p className="text-sm font-semibold text-ink">{t('Convocados')}</p>
      {!grupos.length && <p className="text-sm text-gray-500">{callup.criterion === CALLUP_CRITERIA.RANKING ? t('Ninguém no ranking para as categorias escolhidas.') : t('Ninguém convocado ainda.')}</p>}
      {grupos.map((lista) => (
        <div key={lista[0].category_key} className="rounded-2xl border border-gray-100 px-3">
          <p className="pt-2 text-xs font-bold uppercase tracking-wider text-gray-500">{categoriaDoConvite(lista[0])}</p>
          <ul className="divide-y divide-gray-100">{lista.map((inv) => <Convocado key={inv.id} federation={federation} callup={callup} inv={inv} onCancelar={(x) => { setMotivo(''); setCancelando(x); }} />)}</ul>
        </div>
      ))}
      {cancelando && (
        <ConfirmDialog
          open
          destructive
          onOpenChange={(o) => { if (!o) setCancelando(null); }}
          loading={m.isPending}
          confirmDisabled={motivo.trim().length < 3}
          title={t('Cancelar a convocação de {nome}?', { nome: cancelando.user_name })}
          description={cancelando.category_key === 'manual' ? t('A pessoa recebe um aviso com o motivo.') : t('A pessoa recebe um aviso com o motivo, e a vaga vai para o próximo do ranking.')}
          confirmLabel={t('Cancelar convocação')}
          cancelLabel={t('Voltar')}
          onConfirm={() => m.mutate({ action: 'callup_cancel_member', memberId: cancelando.id, reason: motivo }, ok(t('Convocação cancelada.'), () => setCancelando(null)))}
        >
          <V2Field label={t('Motivo')} htmlFor="cu-cancel-motivo" hint={t('A pessoa lê este texto. Mínimo 3 caracteres.')}><V2Input id="cu-cancel-motivo" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} /></V2Field>
        </ConfirmDialog>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- detalhe -- */

function CallupDetail({ federation, callup, papel, onEdit, onClose }) {
  const [acao, setAcao] = useState(null);
  const [motivo, setMotivo] = useState('');
  const m = useSelectionAction(federation.id);
  const c = callup.counts || {};
  const rascunho = callup.status === CALLUP_STATUS.DRAFT;
  const executar = () => {
    if (acao === 'publicar') m.mutate({ action: 'callup_publish', callupId: callup.id }, ok((r) => tn(r?.invited || 0, 'Publicada: {n} convite enviado.', 'Publicada: {n} convites enviados.'), () => setAcao(null)));
    if (acao === 'fechar') m.mutate({ action: 'callup_close', callupId: callup.id }, ok(t('Delegação fechada.'), () => setAcao(null)));
    if (acao === 'cancelar') m.mutate({ action: 'callup_cancel', callupId: callup.id, reason: motivo }, ok(rascunho ? t('Rascunho apagado.') : t('Convocação cancelada.'), () => { setAcao(null); onClose(); }));
  };
  const textos = {
    publicar: { title: t('Publicar a convocação?'), description: callup.criterion === CALLUP_CRITERIA.RANKING ? t('Os melhores do ranking de cada categoria recebem o convite agora. A regra da convocação não muda mais.') : t('A convocação aparece na página da federação e você passa a convocar pela lista de usuários.'), label: t('Publicar') },
    fechar: { title: t('Fechar a delegação?'), description: t('Quem ainda não respondeu perde o convite, e ninguém mais é chamado. Quem aceitou recebe um aviso.'), label: t('Fechar delegação') },
    cancelar: { title: rascunho ? t('Apagar o rascunho?') : t('Cancelar a convocação?'), description: rascunho ? t('Ninguém foi convidado: o rascunho some.') : t('Todos os convocados recebem um aviso com o motivo.'), label: rascunho ? t('Apagar') : t('Cancelar convocação') },
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{callup.title}</DialogTitle>
          <DialogDescription>{[callup.event_name, periodoDoEvento(callup)].filter(Boolean).join(' · ')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <V2Badge tone={TOM_CONVOCACAO[callup.status] || 'neutral'}>{t(CALLUP_STATUS_LABELS[callup.status] || callup.status)}</V2Badge>
            <span className="text-sm text-gray-600">{t(CALLUP_CRITERIA_LABELS[callup.criterion] || '')}{callup.season ? ` · ${callup.season}` : ''}</span>
            {!rascunho && <span className="text-sm text-gray-600">{t('{ok} confirmados · {esperando} esperando', { ok: c.accepted || 0, esperando: c.invited || 0 })}</span>}
          </div>
          {callup.cancel_reason && <p className="text-sm text-gray-600">{t('Motivo do cancelamento: {motivo}', { motivo: callup.cancel_reason })}</p>}
          {papel.equipe && (
            <div className="flex flex-wrap gap-2">
              {callup.status !== CALLUP_STATUS.CANCELLED && <V2Button type="button" size="sm" variant="secondary" onClick={onEdit}><Pencil className="h-4 w-4" />{t('Editar')}</V2Button>}
              {rascunho && <V2Button type="button" size="sm" onClick={() => setAcao('publicar')}><Send className="h-4 w-4" />{t('Publicar')}</V2Button>}
              {callup.status === CALLUP_STATUS.OPEN && <V2Button type="button" size="sm" variant="secondary" onClick={() => setAcao('fechar')}>{t('Fechar delegação')}</V2Button>}
              {[CALLUP_STATUS.DRAFT, CALLUP_STATUS.OPEN, CALLUP_STATUS.CLOSED].includes(callup.status) && <V2Button type="button" size="sm" variant="ghost" onClick={() => { setMotivo(''); setAcao('cancelar'); }}>{rascunho ? t('Apagar rascunho') : t('Cancelar convocação')}</V2Button>}
            </div>
          )}
          {papel.equipe && !rascunho && <CallupMembers federation={federation} callup={callup} />}
          {papel.equipe && callup.status === CALLUP_STATUS.OPEN && <ConvocarAMao federation={federation} callup={callup} />}
          {callup.status !== CALLUP_STATUS.CANCELLED && <CostsEditor key={callup.updated_at_ms} federation={federation} callup={callup} papel={papel} />}
        </div>
        {acao && (
          <ConfirmDialog
            open
            destructive={acao === 'cancelar'}
            onOpenChange={(o) => { if (!o) setAcao(null); }}
            loading={m.isPending}
            confirmDisabled={acao === 'cancelar' && !rascunho && motivo.trim().length < 3}
            title={textos[acao].title}
            description={textos[acao].description}
            confirmLabel={textos[acao].label}
            cancelLabel={t('Voltar')}
            onConfirm={executar}
          >
            {acao === 'cancelar' && !rascunho && <V2Field label={t('Motivo')} htmlFor="cu-motivo" hint={t('Os convocados leem este texto. Mínimo 3 caracteres.')}><V2Input id="cu-motivo" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} /></V2Field>}
          </ConfirmDialog>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ lista -- */

export default function CallupsManager({ federation, papel }) {
  const q = useCallups(federation.id);
  const [editando, setEditando] = useState(null);
  const [abertaId, setAbertaId] = useState(null);
  const lista = useMemo(() => [...(q.data || [])].sort((a, b) => String(b.starts_at || '').localeCompare(String(a.starts_at || ''))), [q.data]);
  const aberta = lista.find((c) => c.id === abertaId) || null;
  if (q.isError) return <V2ErrorState title={t('Não carregaram as convocações')} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={5} />;
  return (
    <div className="space-y-3" data-dica="federacao-aba-convocacoes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">{t('A delegação da federação para os campeonatos nacionais: pelo ranking oficial do ano ou escolhida pela comissão.')}</p>
        {papel.equipe && <V2Button type="button" size="sm" onClick={() => setEditando({})} data-dica="federacao-nova-convocacao"><Plus className="h-4 w-4" />{t('Nova convocação')}</V2Button>}
      </div>
      {!lista.length && <V2EmptyState icon={Plane} title={t('Nenhuma convocação ainda')} description={papel.equipe ? t('Crie a primeira para chamar a seleção de um campeonato.') : t('Quando a equipe de competições criar uma, os custos aparecem aqui.')} />}
      <ul className="space-y-2">
        {lista.map((c) => {
          const total = callupCostsTotal(c.costs);
          return (
            <li key={c.id}>
              <button type="button" onClick={() => setAbertaId(c.id)} className="w-full rounded-2xl border border-gray-100 bg-white p-3 text-left hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
                <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">{c.title}<V2Badge tone={TOM_CONVOCACAO[c.status] || 'neutral'}>{t(CALLUP_STATUS_LABELS[c.status] || c.status)}</V2Badge></span>
                <span className="mt-0.5 block text-xs text-gray-500">{[c.event_name, periodoDoEvento(c), c.status !== CALLUP_STATUS.DRAFT ? t('{n} confirmados', { n: c.counts?.accepted || 0 }) : '', total.planned ? t('custos {valor}', { valor: reais(total.planned) }) : ''].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {editando && <CallupEditor federation={federation} callup={editando.id ? editando : null} onClose={() => setEditando(null)} />}
      {aberta && !editando && <CallupDetail federation={federation} callup={aberta} papel={papel} onEdit={() => setEditando(aberta)} onClose={() => setAbertaId(null)} />}
    </div>
  );
}
