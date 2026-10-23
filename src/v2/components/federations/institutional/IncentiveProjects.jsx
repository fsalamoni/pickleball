/**
 * LEI DE INCENTIVO AO ESPORTE (Central → Certidões e incentivo → Lei de Incentivo,
 * módulo `incentive_projects`). O financeiro registra o projeto aprovado
 * (valor, prazo de captação, conta vinculada), cada aporte de patrocinador ou
 * doador — que entra sozinho nas contas como receita de convênios e repasses —
 * e a prestação de contas com o resultado. A federação é avisada 30 dias antes
 * do fim da captação. O conselho fiscal lê; só a administração apaga.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, CornerUpLeft, Handshake, Pencil, Plus, Trash2, Undo2, XCircle } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { parseBrlCents } from '@/modules/federations/domain/charges';
import { isoDate } from '@/modules/federations/domain/membership';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import {
  ACCOUNTABILITY_RESULTS, ACCOUNTABILITY_RESULT_LABELS, INCENTIVE_FLOW, INCENTIVE_NOTES_MAX, INCENTIVE_STATUS, INCENTIVE_STATUS_LABELS, RECEIPT_KINDS, RECEIPT_KIND_LABELS,
  incentiveProjectState, validateIncentiveProject, validateIncentiveReceipt,
} from '@/modules/federations/domain/institutional';
import { useIncentiveProjects, useInstitutionalAction } from '@/modules/federations/hooks/useInstitutional';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { reais, reaisParaCampo } from '../accounts/accountsUi';

const ok = (msg, depois) => ({ onSuccess: () => { toast.success(msg); depois?.(); }, onError: (e) => toast.error(e.message) });
const br = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');
const TOM = { capturing: 'blue', executing: 'green', reporting: 'amber', closed: 'gray', cancelled: 'red' };

function ProjectEditor({ federation, project, onClose }) {
  const [f, setF] = useState(() => ({
    title: project?.title || '', process_number: project?.process_number || '', manifestation: project?.manifestation || '', bank_account: project?.bank_account || '',
    valor: project ? reaisParaCampo(project.approved_cents) : '', capture_until: project?.capture_until || '', exec_start: project?.exec_start || '', exec_end: project?.exec_end || '', notes: project?.notes || '',
  }));
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const m = useInstitutionalAction(federation.id);
  const { valor, ...resto } = f;
  const payload = { ...resto, approved_cents: parseBrlCents(valor) || 0 };
  const r = validateIncentiveProject(payload);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? t('Editar projeto') : t('Novo projeto incentivado')}</DialogTitle>
          <DialogDescription>{t('O projeto aprovado pelo Ministério do Esporte na Lei de Incentivo (Lei 11.438/2006). Os aportes recebidos entram nas contas sozinhos.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <V2Field label={t('Nome do projeto')} htmlFor="li-nome" error={r.errors.title}><V2Input id="li-nome" value={f.title} maxLength={160} onChange={(e) => set('title', e.target.value)} /></V2Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <V2Field label={t('Nº do processo (opcional)')} htmlFor="li-proc"><V2Input id="li-proc" value={f.process_number} maxLength={40} onChange={(e) => set('process_number', e.target.value)} /></V2Field>
            <V2Field label={t('Manifestação (opcional)')} htmlFor="li-manif" hint={t('Ex.: educacional, participação, rendimento.')}><V2Input id="li-manif" value={f.manifestation} maxLength={60} onChange={(e) => set('manifestation', e.target.value)} /></V2Field>
            <V2Field label={t('Valor aprovado (R$)')} htmlFor="li-valor" error={r.errors.approved_cents}><V2Input id="li-valor" inputMode="decimal" value={f.valor} onChange={(e) => set('valor', e.target.value)} /></V2Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <V2Field label={t('Captação até')} htmlFor="li-capt" error={r.errors.capture_until}><V2Input id="li-capt" type="date" value={f.capture_until} onChange={(e) => set('capture_until', e.target.value)} /></V2Field>
            <V2Field label={t('Execução: início (opcional)')} htmlFor="li-ini"><V2Input id="li-ini" type="date" value={f.exec_start} onChange={(e) => set('exec_start', e.target.value)} /></V2Field>
            <V2Field label={t('Execução: fim (opcional)')} htmlFor="li-fim" error={r.errors.exec_end}><V2Input id="li-fim" type="date" value={f.exec_end} onChange={(e) => set('exec_end', e.target.value)} /></V2Field>
          </div>
          <V2Field label={t('Conta vinculada (opcional)')} htmlFor="li-conta" hint={t('Banco, agência e conta exclusivos do projeto, como a lei exige.')}><V2Input id="li-conta" value={f.bank_account} maxLength={80} onChange={(e) => set('bank_account', e.target.value)} /></V2Field>
          <V2Field label={t('Observações (opcional)')} htmlFor="li-obs"><V2Textarea id="li-obs" rows={3} maxLength={INCENTIVE_NOTES_MAX} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></V2Field>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button type="button" disabled={!r.ok || m.isPending} onClick={() => m.mutate({ action: 'project_save', projectId: project?.id, project: payload }, ok(t('Projeto salvo.'), onClose))}>{t('Salvar')}</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptDialog({ federation, project, onClose }) {
  const hoje = isoDate();
  const [f, setF] = useState({ donor_name: '', donor_doc: '', kind: 'sponsorship', valor: '', date: hoje });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const m = useInstitutionalAction(federation.id);
  const { valor, ...resto } = f;
  const receipt = { ...resto, amount_cents: parseBrlCents(valor) || 0 };
  const r = validateIncentiveReceipt(receipt, hoje);
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      loading={m.isPending}
      confirmDisabled={!r.ok}
      title={t('Registrar aporte em {projeto}', { projeto: project.title })}
      description={t('O depósito na conta vinculada. Entra nas contas como receita de convênios e repasses na data do depósito.')}
      confirmLabel={t('Registrar')}
      cancelLabel={t('Voltar')}
      onConfirm={() => m.mutate({ action: 'project_receive', projectId: project.id, receipt }, ok(t('Aporte registrado.'), onClose))}
    >
      <div className="space-y-3">
        <V2Field label={t('Patrocinador ou doador')} htmlFor="li-doador" error={f.donor_name && r.errors.donor_name}><V2Input id="li-doador" value={f.donor_name} maxLength={120} onChange={(e) => set('donor_name', e.target.value)} /></V2Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label={t('CPF ou CNPJ (opcional)')} htmlFor="li-doc"><V2Input id="li-doc" value={f.donor_doc} maxLength={20} inputMode="numeric" onChange={(e) => set('donor_doc', e.target.value)} /></V2Field>
          <V2Field label={t('Tipo')} htmlFor="li-tipo"><V2Select id="li-tipo" value={f.kind} onChange={(e) => set('kind', e.target.value)} options={RECEIPT_KINDS.map((k) => ({ value: k, label: t(RECEIPT_KIND_LABELS[k]) }))} /></V2Field>
          <V2Field label={t('Valor (R$)')} htmlFor="li-aporte" error={f.valor && r.errors.amount_cents}><V2Input id="li-aporte" inputMode="decimal" value={f.valor} onChange={(e) => set('valor', e.target.value)} /></V2Field>
          <V2Field label={t('Data do depósito')} htmlFor="li-data" error={r.errors.date}><V2Input id="li-data" type="date" max={hoje} value={f.date} onChange={(e) => set('date', e.target.value)} /></V2Field>
        </div>
      </div>
    </ConfirmDialog>
  );
}

/** Avançar, voltar ou cancelar: cada passo pede o que a etapa precisa. */
function StatusDialog({ federation, project: p, to, onClose }) {
  const hoje = isoDate();
  const voltando = INCENTIVE_FLOW.indexOf(to) < INCENTIVE_FLOW.indexOf(p.status);
  const [f, setF] = useState({ reason: '', sentAt: hoje, protocol: '', result: 'approved', resultAt: hoje, note: '' });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const m = useInstitutionalAction(federation.id);
  const pedeMotivo = voltando || to === INCENTIVE_STATUS.CANCELLED;
  const pronto = pedeMotivo ? f.reason.trim().length >= 3 : to === INCENTIVE_STATUS.REPORTING ? Boolean(f.sentAt) : to === INCENTIVE_STATUS.CLOSED ? Boolean(f.resultAt) : true;
  return (
    <ConfirmDialog
      open
      destructive={to === INCENTIVE_STATUS.CANCELLED}
      onOpenChange={(o) => { if (!o) onClose(); }}
      loading={m.isPending}
      confirmDisabled={!pronto}
      title={to === INCENTIVE_STATUS.CANCELLED ? t('Cancelar o projeto?') : t('Passar para "{etapa}"?', { etapa: t(INCENTIVE_STATUS_LABELS[to]) })}
      description={to === INCENTIVE_STATUS.REPORTING && !voltando ? t('Informe quando a prestação de contas foi enviada ao Ministério e o protocolo.')
        : to === INCENTIVE_STATUS.CLOSED ? t('Registre o resultado da análise da prestação de contas.')
          : pedeMotivo ? t('O motivo fica no histórico do projeto.') : t('A captação acabou e o projeto começa a ser executado.')}
      confirmLabel={t('Confirmar')}
      cancelLabel={t('Voltar')}
      onConfirm={() => m.mutate({ action: 'project_status', projectId: p.id, to, ...f }, ok(t('Situação atualizada.'), onClose))}
    >
      {pedeMotivo && <V2Field label={t('Motivo')} htmlFor="li-motivo"><V2Input id="li-motivo" value={f.reason} maxLength={300} onChange={(e) => set('reason', e.target.value)} /></V2Field>}
      {!pedeMotivo && to === INCENTIVE_STATUS.REPORTING && (
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label={t('Enviada em')} htmlFor="li-envio"><V2Input id="li-envio" type="date" max={hoje} value={f.sentAt} onChange={(e) => set('sentAt', e.target.value)} /></V2Field>
          <V2Field label={t('Protocolo (opcional)')} htmlFor="li-protocolo"><V2Input id="li-protocolo" value={f.protocol} maxLength={60} onChange={(e) => set('protocol', e.target.value)} /></V2Field>
        </div>
      )}
      {!pedeMotivo && to === INCENTIVE_STATUS.CLOSED && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <V2Field label={t('Resultado')} htmlFor="li-resultado"><V2Select id="li-resultado" value={f.result} onChange={(e) => set('result', e.target.value)} options={ACCOUNTABILITY_RESULTS.map((k) => ({ value: k, label: t(ACCOUNTABILITY_RESULT_LABELS[k]) }))} /></V2Field>
            <V2Field label={t('Data do resultado')} htmlFor="li-res-data"><V2Input id="li-res-data" type="date" max={hoje} value={f.resultAt} onChange={(e) => set('resultAt', e.target.value)} /></V2Field>
          </div>
          <V2Field label={t('Observação (opcional)')} htmlFor="li-res-obs"><V2Input id="li-res-obs" value={f.note} maxLength={500} onChange={(e) => set('note', e.target.value)} /></V2Field>
        </div>
      )}
    </ConfirmDialog>
  );
}

function ProjectCard({ federation, project: p, canEdit, admin, onEdit }) {
  const hoje = isoDate();
  const st = incentiveProjectState(p, hoje);
  const [dialogo, setDialogo] = useState(null);
  const [estorno, setEstorno] = useState(null);
  const [motivo, setMotivo] = useState('');
  const m = useInstitutionalAction(federation.id);
  const i = INCENTIVE_FLOW.indexOf(p.status);
  const proxima = i >= 0 && i < INCENTIVE_FLOW.length - 1 ? INCENTIVE_FLOW[i + 1] : null;
  const anterior = i > 0 ? INCENTIVE_FLOW[i - 1] : null;
  const cancelado = p.status === INCENTIVE_STATUS.CANCELLED;
  const recebe = [INCENTIVE_STATUS.CAPTURING, INCENTIVE_STATUS.EXECUTING].includes(p.status);
  const aportes = (p.receipts || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const acc = p.accountability;
  return (
    <li className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-ink">{p.title}</p>
          <p className="text-xs text-gray-500">{[p.process_number && t('Processo {n}', { n: p.process_number }), p.manifestation, t('captação até {data}', { data: br(p.capture_until) })].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <V2Badge tone={TOM[p.status]}>{t(INCENTIVE_STATUS_LABELS[p.status] || p.status)}</V2Badge>
          {st.captureEnding && <V2Badge tone="amber">{t('Captação acaba em {n} dias', { n: st.captureDaysLeft })}</V2Badge>}
          {canEdit && !cancelado && <V2Button type="button" size="sm" variant="ghost" onClick={onEdit}><Pencil className="h-4 w-4" />{t('Editar')}</V2Button>}
          {admin && !(p.receipts || []).length && <V2Button type="button" size="sm" variant="ghost" aria-label={t('Apagar projeto')} onClick={() => setDialogo('apagar')}><Trash2 className="h-4 w-4" /></V2Button>}
        </div>
      </div>
      <div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={st.pct} aria-label={t('Captado')}>
          <div className="h-full rounded-full bg-green-600" style={{ width: `${st.pct}%` }} />
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-gray-500">{t('Aprovado')}</dt><dd className="font-semibold tabular-nums">{reais(st.approved_cents)}</dd></div>
          <div><dt className="text-xs text-gray-500">{t('Captado')}</dt><dd className="font-semibold tabular-nums text-green-700">{reais(st.captured_cents)} · {st.pct}%</dd></div>
          <div><dt className="text-xs text-gray-500">{t('Falta captar')}</dt><dd className="font-semibold tabular-nums">{reais(st.remaining_cents)}</dd></div>
          <div><dt className="text-xs text-gray-500">{t('Apoiadores')}</dt><dd className="font-semibold tabular-nums">{st.donors}</dd></div>
        </dl>
      </div>
      {acc && (
        <p className="text-sm text-gray-700">
          {t('Prestação de contas enviada em {data}', { data: br(acc.sent_at) })}{acc.protocol ? ` · ${t('protocolo {n}', { n: acc.protocol })}` : ''}
          {acc.result && <> · <span className="font-semibold">{t(ACCOUNTABILITY_RESULT_LABELS[acc.result])}</span> {t('em {data}', { data: br(acc.result_at) })}</>}
        </p>
      )}
      {canEdit && !cancelado && (
        <div className="flex flex-wrap gap-2">
          {recebe && <V2Button type="button" size="sm" onClick={() => setDialogo('aporte')}><Plus className="h-4 w-4" />{t('Registrar aporte')}</V2Button>}
          {proxima && <V2Button type="button" size="sm" variant="secondary" onClick={() => setDialogo(proxima)}><ArrowRight className="h-4 w-4" />{t(INCENTIVE_STATUS_LABELS[proxima])}</V2Button>}
          {anterior && <V2Button type="button" size="sm" variant="ghost" onClick={() => setDialogo(anterior)}><CornerUpLeft className="h-4 w-4" />{t('Voltar para "{etapa}"', { etapa: t(INCENTIVE_STATUS_LABELS[anterior]) })}</V2Button>}
          {!st.captured_cents && <V2Button type="button" size="sm" variant="ghost" onClick={() => setDialogo(INCENTIVE_STATUS.CANCELLED)}><XCircle className="h-4 w-4" />{t('Cancelar')}</V2Button>}
        </div>
      )}
      {aportes.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-ink">{t('Aportes ({n})', { n: aportes.length })}</summary>
          <ul className="mt-2">
            {aportes.map((r) => (
              <li key={r.id} className={`flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 py-2 text-sm last:border-0 ${r.voided_at ? 'text-gray-500 line-through' : ''}`}>
                <span><span className="font-semibold tabular-nums">{reais(r.amount_cents)}</span> · {r.donor_name} · {t(RECEIPT_KIND_LABELS[r.kind] || r.kind)} · {br(r.date)}</span>
                {r.voided_at ? <span className="text-xs no-underline">{t('estornado: {motivo}', { motivo: r.voided_reason })}</span>
                  : canEdit && <V2Button type="button" size="sm" variant="ghost" onClick={() => { setMotivo(''); setEstorno(r); }}><Undo2 className="h-4 w-4" />{t('Estornar')}</V2Button>}
              </li>
            ))}
          </ul>
        </details>
      )}
      {p.notes && <p className="whitespace-pre-line text-xs text-gray-600">{p.notes}</p>}
      {dialogo === 'aporte' && <ReceiptDialog federation={federation} project={p} onClose={() => setDialogo(null)} />}
      {dialogo && dialogo !== 'aporte' && dialogo !== 'apagar' && <StatusDialog federation={federation} project={p} to={dialogo} onClose={() => setDialogo(null)} />}
      {dialogo === 'apagar' && (
        <ConfirmDialog open destructive onOpenChange={(o) => { if (!o) setDialogo(null); }} loading={m.isPending} title={t('Apagar o projeto {nome}?', { nome: p.title })} description={t('Sem aporte registrado, o projeto some da lista. Não dá para desfazer.')} confirmLabel={t('Apagar')} cancelLabel={t('Voltar')}
          onConfirm={() => m.mutate({ action: 'project_delete', projectId: p.id }, ok(t('Projeto apagado.'), () => setDialogo(null)))} />
      )}
      {estorno && (
        <ConfirmDialog open destructive onOpenChange={(o) => { if (!o) setEstorno(null); }} loading={m.isPending} confirmDisabled={motivo.trim().length < 3}
          title={t('Estornar o aporte de {valor}?', { valor: reais(estorno.amount_cents) })} description={t('Sai das contas. O aporte fica riscado na lista, com o motivo.')} confirmLabel={t('Estornar')} cancelLabel={t('Voltar')}
          onConfirm={() => m.mutate({ action: 'project_void', projectId: p.id, receiptId: estorno.id, reason: motivo }, ok(t('Aporte estornado.'), () => setEstorno(null)))}>
          <V2Field label={t('Motivo')} htmlFor={`li-estorno-${estorno.id}`}><V2Input id={`li-estorno-${estorno.id}`} value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} /></V2Field>
        </ConfirmDialog>
      )}
    </li>
  );
}

export default function IncentiveProjects({ federation, canEdit, admin }) {
  const q = useIncentiveProjects(federation.id);
  const [editando, setEditando] = useState(null);
  return (
    <section className="space-y-4" aria-label={t('Lei de Incentivo ao Esporte')} data-dica="federacao-lei-incentivo">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Handshake className="h-5 w-5" aria-hidden="true" />{t('Lei de Incentivo ao Esporte')}</h2>
          <p className="text-sm text-gray-500">
            {fedModuleOn(federation, 'accounts')
              ? t('Cada aporte registrado entra sozinho em Contas como receita de convênios e repasses. A federação é avisada 30 dias antes do fim da captação.')
              : t('A federação é avisada 30 dias antes do fim da captação. Com o módulo de contas ligado, os aportes entram nele sozinhos.')}
          </p>
        </div>
        {canEdit && <V2Button type="button" onClick={() => setEditando('novo')} data-dica="federacao-projeto-novo"><Plus className="h-4 w-4" />{t('Novo projeto')}</V2Button>}
      </div>
      {q.isError ? <V2ErrorState inline title={t('Não carregaram os projetos')} onRetry={q.refetch} />
        : q.isLoading ? <V2Skeleton lines={4} />
          : !q.data.length ? <V2EmptyState icon={Handshake} title={t('Nenhum projeto incentivado')} description={canEdit ? t('Registre o projeto aprovado para acompanhar a captação, os aportes e a prestação de contas.') : t('A equipe financeira ainda não registrou projetos.')} />
            : <ul className="space-y-3">{q.data.map((p) => <ProjectCard key={p.id} federation={federation} project={p} canEdit={canEdit} admin={admin} onEdit={() => setEditando(p)} />)}</ul>}
      {editando && <ProjectEditor federation={federation} project={editando === 'novo' ? null : editando} onClose={() => setEditando(null)} />}
    </section>
  );
}
