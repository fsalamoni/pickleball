/**
 * CONTRATOS DE PATROCÍNIO (Central → Administração). O financeiro registra o
 * contrato (vigência, parcelas, contrapartidas), marca cada parcela recebida —
 * ela entra sozinha nas contas como receita de patrocínio — e a entrega de
 * cada contrapartida. A federação é avisada 30 dias antes do fim. O conselho
 * fiscal lê; só a administração cancela ou apaga.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, FileSignature, Pencil, Plus, Trash2, Undo2, XCircle } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { parseBrlCents } from '@/modules/federations/domain/charges';
import { isoDate } from '@/modules/federations/domain/membership';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { CONTRACT_STATE_LABELS, CONTRACT_TIERS, COUNTERPARTS_MAX, INSTALLMENTS_MAX, contractState, splitInstallments, validateContract } from '@/modules/federations/domain/management';
import { useManagementAction, useSponsorContracts } from '@/modules/federations/hooks/useManagement';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Textarea } from '@/v2/ui/primitives';
import { t, tk } from '@/core/i18n';
import { reais, reaisParaCampo } from '../accounts/accountsUi';

const ok = (msg, depois) => ({ onSuccess: () => { toast.success(msg); depois?.(); }, onError: (e) => toast.error(e.message) });
const br = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');
const TIER_LABELS = { main: tk('Patrocínio master'), support: tk('Patrocínio'), partner: tk('Apoio') };
const TOM = { upcoming: 'gray', active: 'green', expiring: 'amber', ended: 'gray', cancelled: 'red' };

/* ---------------------------------------------------------------- editor -- */

function ContractEditor({ federation, contract, onClose }) {
  const [f, setF] = useState(() => ({
    sponsor_name: contract?.sponsor_name || '', sponsor_doc: contract?.sponsor_doc || '', tier: contract?.tier || 'support',
    start: contract?.start || '', end: contract?.end || '', notes: contract?.notes || '',
    installments: (contract?.installments || []).map((x) => ({ id: x.id, due: x.due, valor: reaisParaCampo(x.amount_cents), received: Boolean(x.received_at) })),
    counterparts: (contract?.counterparts || []).map((x) => ({ id: x.id, text: x.text, due: x.due || '' })),
  }));
  const [divisao, setDivisao] = useState({ total: '', n: '12', first: '' });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const m = useManagementAction(federation.id);
  const payload = { ...f, installments: f.installments.map((x) => ({ id: x.id, due: x.due, amount_cents: parseBrlCents(x.valor) || 0 })) };
  const r = validateContract(payload);
  const dividir = () => {
    const novas = splitInstallments(parseBrlCents(divisao.total), Number(divisao.n), divisao.first || f.start);
    if (!novas.length) { toast.error(t('Informe o total, o número de parcelas e o primeiro vencimento.')); return; }
    set('installments', novas.map((x) => ({ id: x.id, due: x.due, valor: reaisParaCampo(x.amount_cents), received: false })));
  };
  const recebidas = f.installments.some((x) => x.received);
  const salvar = () => m.mutate({ action: 'contract_save', contractId: contract?.id, contract: payload }, ok(t('Contrato salvo.'), onClose));
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contract ? t('Editar contrato') : t('Novo contrato de patrocínio')}</DialogTitle>
          <DialogDescription>{t('O total é a soma das parcelas. Cada parcela marcada como recebida entra nas contas como receita de patrocínio, sem lançar de novo.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
            <V2Field label={t('Patrocinador')} htmlFor="ct-nome" error={r.errors.sponsor_name}><V2Input id="ct-nome" value={f.sponsor_name} maxLength={120} onChange={(e) => set('sponsor_name', e.target.value)} /></V2Field>
            <V2Field label={t('CNPJ (opcional)')} htmlFor="ct-doc"><V2Input id="ct-doc" value={f.sponsor_doc} maxLength={20} inputMode="numeric" onChange={(e) => set('sponsor_doc', e.target.value)} /></V2Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <V2Field label={t('Cota')} htmlFor="ct-cota"><V2Select id="ct-cota" value={f.tier} onChange={(e) => set('tier', e.target.value)} options={CONTRACT_TIERS.map((k) => ({ value: k, label: t(TIER_LABELS[k]) }))} /></V2Field>
            <V2Field label={t('Início da vigência')} htmlFor="ct-inicio" error={r.errors.start}><V2Input id="ct-inicio" type="date" value={f.start} onChange={(e) => set('start', e.target.value)} /></V2Field>
            <V2Field label={t('Fim da vigência')} htmlFor="ct-fim" error={r.errors.end}><V2Input id="ct-fim" type="date" value={f.end} onChange={(e) => set('end', e.target.value)} /></V2Field>
          </div>

          <fieldset className="space-y-2 rounded-2xl border border-gray-200 p-3">
            <legend className="px-1 text-sm font-semibold text-ink">{t('Parcelas')}</legend>
            {!recebidas && (
              <div className="grid items-end gap-2 rounded-xl bg-gray-50 p-2 sm:grid-cols-[1fr_6rem_10rem_auto]">
                <V2Field label={t('Valor total (R$)')} htmlFor="ct-total"><V2Input id="ct-total" inputMode="decimal" value={divisao.total} onChange={(e) => setDivisao((d) => ({ ...d, total: e.target.value }))} /></V2Field>
                <V2Field label={t('Parcelas')} htmlFor="ct-n"><V2Input id="ct-n" type="number" min={1} max={INSTALLMENTS_MAX} value={divisao.n} onChange={(e) => setDivisao((d) => ({ ...d, n: e.target.value }))} /></V2Field>
                <V2Field label={t('1º vencimento')} htmlFor="ct-primeiro"><V2Input id="ct-primeiro" type="date" value={divisao.first} onChange={(e) => setDivisao((d) => ({ ...d, first: e.target.value }))} /></V2Field>
                <V2Button type="button" size="sm" variant="secondary" onClick={dividir}>{t('Dividir')}</V2Button>
              </div>
            )}
            {f.installments.map((x, i) => (
              <div key={x.id || i} className="flex items-end gap-2">
                <V2Field label={t('Vencimento {n}', { n: i + 1 })} htmlFor={`ct-venc-${i}`} className="flex-1" error={r.errors[`installments.${i}`]}><V2Input id={`ct-venc-${i}`} type="date" value={x.due} disabled={x.received} onChange={(e) => set('installments', f.installments.map((y, j) => (j === i ? { ...y, due: e.target.value } : y)))} /></V2Field>
                <V2Field label={t('Valor (R$)')} htmlFor={`ct-valor-${i}`} className="w-32"><V2Input id={`ct-valor-${i}`} inputMode="decimal" value={x.valor} disabled={x.received} onChange={(e) => set('installments', f.installments.map((y, j) => (j === i ? { ...y, valor: e.target.value } : y)))} /></V2Field>
                <V2Button type="button" size="sm" variant="ghost" disabled={x.received} aria-label={t('Tirar parcela {n}', { n: i + 1 })} onClick={() => set('installments', f.installments.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></V2Button>
              </div>
            ))}
            {recebidas && <p className="text-xs text-gray-500">{t('Parcela já recebida não muda de data nem de valor: desfaça o recebimento antes.')}</p>}
            <div className="flex items-center justify-between gap-2">
              <V2Button type="button" size="sm" variant="ghost" disabled={f.installments.length >= INSTALLMENTS_MAX} onClick={() => set('installments', [...f.installments, { id: '', due: '', valor: '', received: false }])}><Plus className="h-4 w-4" />{t('Parcela')}</V2Button>
              <p className="text-sm font-semibold text-ink">{t('Total: {valor}', { valor: reais(r.value.total_cents) })}</p>
            </div>
          </fieldset>

          <fieldset className="space-y-2 rounded-2xl border border-gray-200 p-3">
            <legend className="px-1 text-sm font-semibold text-ink">{t('Contrapartidas')}</legend>
            {f.counterparts.map((x, i) => (
              <div key={x.id || i} className="flex items-end gap-2">
                <V2Field label={t('O que a federação entrega')} htmlFor={`ct-cp-${i}`} className="flex-1" error={r.errors[`counterparts.${i}`]}><V2Input id={`ct-cp-${i}`} value={x.text} maxLength={200} placeholder={t('Ex.: logo na camisa da seleção')} onChange={(e) => set('counterparts', f.counterparts.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)))} /></V2Field>
                <V2Field label={t('Prazo')} htmlFor={`ct-cp-prazo-${i}`} className="w-40"><V2Input id={`ct-cp-prazo-${i}`} type="date" value={x.due} onChange={(e) => set('counterparts', f.counterparts.map((y, j) => (j === i ? { ...y, due: e.target.value } : y)))} /></V2Field>
                <V2Button type="button" size="sm" variant="ghost" aria-label={t('Tirar contrapartida {n}', { n: i + 1 })} onClick={() => set('counterparts', f.counterparts.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></V2Button>
              </div>
            ))}
            <V2Button type="button" size="sm" variant="ghost" disabled={f.counterparts.length >= COUNTERPARTS_MAX} onClick={() => set('counterparts', [...f.counterparts, { id: '', text: '', due: '' }])}><Plus className="h-4 w-4" />{t('Contrapartida')}</V2Button>
          </fieldset>

          <V2Field label={t('Observações (opcional)')} htmlFor="ct-obs" hint={t('Cláusulas importantes, contato do patrocinador, onde está o contrato assinado.')}><V2Textarea id="ct-obs" rows={3} maxLength={2000} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></V2Field>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button type="button" disabled={!r.ok || m.isPending} onClick={salvar}>{t('Salvar')}</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- cartão -- */

function Parcela({ federation, contract, x, canEdit, vencida }) {
  const [data, setData] = useState(isoDate());
  const [acao, setAcao] = useState(null);
  const [motivo, setMotivo] = useState('');
  const m = useManagementAction(federation.id);
  const cancelado = contract.status === 'cancelled';
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 py-2 text-sm last:border-0">
      <span>
        <span className="font-semibold tabular-nums">{reais(x.amount_cents)}</span>
        <span className="text-gray-500"> · {t('vence {data}', { data: br(x.due) })}</span>
        {x.received_at && <span className="ml-2 text-green-700">{t('recebida em {data}', { data: br(x.received_at) })}</span>}
        {vencida && <V2Badge tone="red" className="ml-2">{t('Atrasada')}</V2Badge>}
      </span>
      {canEdit && !cancelado && (x.received_at
        ? <V2Button type="button" size="sm" variant="ghost" onClick={() => { setMotivo(''); setAcao('desfazer'); }}><Undo2 className="h-4 w-4" />{t('Desfazer')}</V2Button>
        : <V2Button type="button" size="sm" variant="secondary" onClick={() => { setData(isoDate()); setAcao('receber'); }}><CheckCircle2 className="h-4 w-4" />{t('Recebida')}</V2Button>)}
      {acao && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setAcao(null); }}
          loading={m.isPending}
          confirmDisabled={acao === 'desfazer' ? motivo.trim().length < 3 : !data}
          title={acao === 'receber' ? t('Marcar {valor} como recebido?', { valor: reais(x.amount_cents) }) : t('Desfazer o recebimento?')}
          description={acao === 'receber' ? t('Entra nas contas como receita de patrocínio na data do recebimento.') : t('Sai das contas. O motivo fica no histórico do contrato.')}
          confirmLabel={acao === 'receber' ? t('Marcar recebida') : t('Desfazer')}
          cancelLabel={t('Voltar')}
          onConfirm={() => m.mutate(acao === 'receber'
            ? { action: 'contract_receive', contractId: contract.id, installmentId: x.id, date: data }
            : { action: 'contract_unreceive', contractId: contract.id, installmentId: x.id, reason: motivo }, ok(acao === 'receber' ? t('Parcela recebida.') : t('Recebimento desfeito.'), () => setAcao(null)))}
        >
          {acao === 'receber'
            ? <V2Field label={t('Data do recebimento')} htmlFor={`ct-rec-${x.id}`}><V2Input id={`ct-rec-${x.id}`} type="date" max={isoDate()} value={data} onChange={(e) => setData(e.target.value)} /></V2Field>
            : <V2Field label={t('Motivo')} htmlFor={`ct-desf-${x.id}`}><V2Input id={`ct-desf-${x.id}`} value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} /></V2Field>}
        </ConfirmDialog>
      )}
    </li>
  );
}

function ContractCard({ federation, contract: c, canEdit, admin, onEdit }) {
  const hoje = isoDate();
  const st = contractState(c, hoje);
  const [acao, setAcao] = useState(null);
  const [motivo, setMotivo] = useState('');
  const m = useManagementAction(federation.id);
  const atrasadas = new Set(st.overdue.map((x) => x.id));
  const contrasAtrasadas = new Set(st.counterparts_late.map((x) => x.id));
  const cancelado = c.status === 'cancelled';
  return (
    <li className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-ink">{c.sponsor_name}</p>
          <p className="text-xs text-gray-500">{[t(TIER_LABELS[c.tier] || TIER_LABELS.support), t('{inicio} a {fim}', { inicio: br(c.start), fim: br(c.end) })].join(' · ')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <V2Badge tone={TOM[st.state]}>{t(CONTRACT_STATE_LABELS[st.state])}{st.state === 'expiring' ? ` · ${t('{n} dias', { n: st.daysLeft })}` : ''}</V2Badge>
          {canEdit && !cancelado && <V2Button type="button" size="sm" variant="ghost" onClick={onEdit}><Pencil className="h-4 w-4" />{t('Editar')}</V2Button>}
          {admin && !cancelado && <V2Button type="button" size="sm" variant="ghost" onClick={() => { setMotivo(''); setAcao('cancelar'); }}><XCircle className="h-4 w-4" />{t('Cancelar')}</V2Button>}
          {admin && st.received_cents === 0 && <V2Button type="button" size="sm" variant="ghost" aria-label={t('Apagar contrato')} onClick={() => setAcao('apagar')}><Trash2 className="h-4 w-4" /></V2Button>}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-gray-500">{t('Total')}</dt><dd className="font-semibold tabular-nums">{reais(st.total_cents)}</dd></div>
        <div><dt className="text-xs text-gray-500">{t('Recebido')}</dt><dd className="font-semibold tabular-nums text-green-700">{reais(st.received_cents)}</dd></div>
        <div><dt className="text-xs text-gray-500">{t('Em atraso')}</dt><dd className={`font-semibold tabular-nums ${st.overdue_cents ? 'text-red-700' : ''}`}>{reais(st.overdue_cents)}</dd></div>
        <div><dt className="text-xs text-gray-500">{t('Contrapartidas')}</dt><dd className="font-semibold tabular-nums">{t('{feitas} de {total}', { feitas: st.counterparts_done, total: st.counterparts_total })}</dd></div>
      </dl>
      {cancelado && c.cancelled_reason && <p className="text-xs text-red-700">{t('Cancelado: {motivo}', { motivo: c.cancelled_reason })}</p>}
      <details className="group">
        <summary className="cursor-pointer text-sm font-semibold text-ink">{t('Parcelas e contrapartidas')}</summary>
        <div className="mt-2 grid gap-4 md:grid-cols-2">
          <ul aria-label={t('Parcelas')}>{(c.installments || []).map((x) => <Parcela key={x.id} federation={federation} contract={c} x={x} canEdit={canEdit} vencida={atrasadas.has(x.id)} />)}</ul>
          <ul aria-label={t('Contrapartidas')}>
            {(c.counterparts || []).length === 0 && <li className="text-sm text-gray-500">{t('Nenhuma contrapartida registrada.')}</li>}
            {(c.counterparts || []).map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 py-2 text-sm last:border-0">
                <span>
                  {x.text}
                  {x.due && <span className="text-gray-500"> · {t('até {data}', { data: br(x.due) })}</span>}
                  {x.done_at && <span className="ml-2 text-green-700">{t('entregue em {data}', { data: br(x.done_at) })}</span>}
                  {contrasAtrasadas.has(x.id) && <V2Badge tone="red" className="ml-2">{t('Atrasada')}</V2Badge>}
                </span>
                {canEdit && !cancelado && <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => m.mutate({ action: 'contract_deliver', contractId: c.id, counterpartId: x.id, undo: Boolean(x.done_at), date: hoje }, ok(x.done_at ? t('Entrega desfeita.') : t('Contrapartida entregue.')))}>{x.done_at ? t('Desfazer') : t('Entregue')}</V2Button>}
              </li>
            ))}
          </ul>
        </div>
        {c.notes && <p className="mt-2 whitespace-pre-line text-xs text-gray-600">{c.notes}</p>}
      </details>
      {acao && (
        <ConfirmDialog
          open
          destructive
          onOpenChange={(o) => { if (!o) setAcao(null); }}
          loading={m.isPending}
          confirmDisabled={acao === 'cancelar' && motivo.trim().length < 3}
          title={acao === 'cancelar' ? t('Cancelar o contrato com {nome}?', { nome: c.sponsor_name }) : t('Apagar o contrato com {nome}?', { nome: c.sponsor_name })}
          description={acao === 'cancelar' ? t('As parcelas já recebidas continuam nas contas; as demais deixam de ser cobradas e avisadas.') : t('Sem parcela recebida, o contrato some da lista. Não dá para desfazer.')}
          confirmLabel={acao === 'cancelar' ? t('Cancelar contrato') : t('Apagar')}
          cancelLabel={t('Voltar')}
          onConfirm={() => m.mutate({ action: 'contract_cancel', contractId: c.id, remove: acao === 'apagar', reason: motivo }, ok(acao === 'cancelar' ? t('Contrato cancelado.') : t('Contrato apagado.'), () => setAcao(null)))}
        >
          {acao === 'cancelar' && <V2Field label={t('Motivo')} htmlFor={`ct-canc-${c.id}`}><V2Input id={`ct-canc-${c.id}`} value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} /></V2Field>}
        </ConfirmDialog>
      )}
    </li>
  );
}

export default function ContractsManager({ federation, canEdit, admin }) {
  const q = useSponsorContracts(federation.id);
  const [editando, setEditando] = useState(null);
  const hoje = isoDate();
  const resumo = useMemo(() => {
    const ativos = (q.data || []).filter((c) => c.status !== 'cancelled');
    const st = ativos.map((c) => contractState(c, hoje));
    return {
      vigentes: st.filter((s) => s.state === 'active' || s.state === 'expiring').length,
      vencendo: st.filter((s) => s.state === 'expiring').length,
      recebido: st.reduce((s, x) => s + x.received_cents, 0),
      atraso: st.reduce((s, x) => s + x.overdue_cents, 0),
    };
  }, [q.data, hoje]);
  return (
    <section className="space-y-4" aria-label={t('Contratos de patrocínio')} data-dica="federacao-contratos">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><FileSignature className="h-5 w-5" aria-hidden="true" />{t('Contratos de patrocínio')}</h2>
          <p className="text-sm text-gray-500">
            {fedModuleOn(federation, 'accounts')
              ? t('As parcelas recebidas entram sozinhas em Contas como receita de patrocínio. A federação é avisada 30 dias antes do fim de cada contrato.')
              : t('A federação é avisada 30 dias antes do fim de cada contrato. Com o módulo de contas ligado, as parcelas recebidas entram nele sozinhas.')}
          </p>
        </div>
        {canEdit && <V2Button type="button" onClick={() => setEditando('novo')} data-dica="federacao-contrato-novo"><Plus className="h-4 w-4" />{t('Novo contrato')}</V2Button>}
      </div>
      {q.isError ? <V2ErrorState inline title={t('Não carregou os contratos')} onRetry={q.refetch} />
        : q.isLoading ? <V2Skeleton lines={4} />
          : !q.data.length ? <V2EmptyState icon={FileSignature} title={t('Nenhum contrato registrado')} description={canEdit ? t('Registre o contrato com cada patrocinador para acompanhar parcelas e contrapartidas.') : t('A equipe financeira ainda não registrou contratos.')} />
            : (
              <>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[[t('Em vigor'), resumo.vigentes], [t('Vencem em 30 dias'), resumo.vencendo], [t('Recebido'), reais(resumo.recebido)], [t('Em atraso'), reais(resumo.atraso)]].map(([k, v]) => (
                    <div key={k} className="rounded-2xl border border-gray-200 bg-white p-3"><dt className="text-xs text-gray-500">{k}</dt><dd className="font-display text-lg font-bold tabular-nums text-ink">{v}</dd></div>
                  ))}
                </dl>
                <ul className="space-y-3">{q.data.map((c) => <ContractCard key={c.id} federation={federation} contract={c} canEdit={canEdit} admin={admin} onEdit={() => setEditando(c)} />)}</ul>
              </>
            )}
      {editando && <ContractEditor federation={federation} contract={editando === 'novo' ? null : editando} onClose={() => setEditando(null)} />}
    </section>
  );
}
