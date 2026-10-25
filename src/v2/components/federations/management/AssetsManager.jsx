/**
 * PATRIMÔNIO (Central → Administração): o inventário dos bens da federação e
 * o empréstimo a clube, arena ou evento, com a devolução registrada (data e
 * estado em que voltou). Quem emprestou é avisado quando a devolução atrasa.
 * Financeiro, administração e competições gerem; o conselho fiscal lê.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download, Package, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { parseBrlCents } from '@/modules/federations/domain/charges';
import { assetsCsv } from '@/modules/federations/domain/exports';
import { isoDate } from '@/modules/federations/domain/membership';
import {
  ASSET_CATEGORIES, ASSET_CATEGORY_LABELS, ASSET_CONDITIONS, ASSET_CONDITION_LABELS, ASSET_QTY_MAX, BORROWER_KINDS, BORROWER_KIND_LABELS,
  assetState, validateAsset, validateLoan,
} from '@/modules/federations/domain/management';
import { pick, useScopedAssets, useScopedManagementAction } from './managementScope';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { reais, reaisParaCampo } from '../accounts/accountsUi';
import { baixarCsv } from '../manage/naoSalvo';

const ok = (msg, depois) => ({ onSuccess: () => { toast.success(msg); depois?.(); }, onError: (e) => toast.error(e.message) });
const br = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');

function AssetEditor({ federation, asset, onClose }) {
  const [f, setF] = useState(() => ({
    name: asset?.name || '', category: asset?.category || 'nets', code: asset?.code || '', quantity: String(asset?.quantity || 1),
    condition: asset?.condition || 'good', location: asset?.location || '', acquired_at: asset?.acquired_at || '', valor: reaisParaCampo(asset?.value_cents), notes: asset?.notes || '',
  }));
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const m = useScopedManagementAction(federation);
  const payload = { ...f, value_cents: parseBrlCents(f.valor) || 0 };
  const r = validateAsset(payload);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{asset ? t('Editar bem') : t('Cadastrar bem')}</DialogTitle>
          <DialogDescription>{t('Bens iguais podem ser um cadastro só, com a quantidade (ex.: 10 redes oficiais).')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <V2Field label={t('Nome')} htmlFor="bm-nome" error={r.errors.name}><V2Input id="bm-nome" value={f.name} maxLength={120} placeholder={t('Ex.: Rede oficial portátil')} onChange={(e) => set('name', e.target.value)} /></V2Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <V2Field label={t('Categoria')} htmlFor="bm-cat"><V2Select id="bm-cat" value={f.category} onChange={(e) => set('category', e.target.value)} options={ASSET_CATEGORIES.map((k) => ({ value: k, label: t(ASSET_CATEGORY_LABELS[k]) }))} /></V2Field>
            <V2Field label={t('Quantidade')} htmlFor="bm-qtd" error={r.errors.quantity}><V2Input id="bm-qtd" type="number" min={1} max={ASSET_QTY_MAX} value={f.quantity} onChange={(e) => set('quantity', e.target.value)} /></V2Field>
            <V2Field label={t('Estado')} htmlFor="bm-estado"><V2Select id="bm-estado" value={f.condition} onChange={(e) => set('condition', e.target.value)} options={ASSET_CONDITIONS.map((k) => ({ value: k, label: t(ASSET_CONDITION_LABELS[k]) }))} /></V2Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <V2Field label={t('Código de patrimônio (opcional)')} htmlFor="bm-cod"><V2Input id="bm-cod" value={f.code} maxLength={30} onChange={(e) => set('code', e.target.value)} /></V2Field>
            <V2Field label={t('Onde fica')} htmlFor="bm-local"><V2Input id="bm-local" value={f.location} maxLength={120} placeholder={t('Ex.: depósito da sede')} onChange={(e) => set('location', e.target.value)} /></V2Field>
            <V2Field label={t('Data de aquisição (opcional)')} htmlFor="bm-aq"><V2Input id="bm-aq" type="date" value={f.acquired_at} onChange={(e) => set('acquired_at', e.target.value)} /></V2Field>
            <V2Field label={t('Valor total (R$, opcional)')} htmlFor="bm-valor"><V2Input id="bm-valor" inputMode="decimal" value={f.valor} onChange={(e) => set('valor', e.target.value)} /></V2Field>
          </div>
          <V2Field label={t('Observações (opcional)')} htmlFor="bm-obs"><V2Textarea id="bm-obs" rows={2} maxLength={1000} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></V2Field>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button type="button" disabled={!r.ok || m.isPending} onClick={() => m.mutate({ action: 'asset_save', assetId: asset?.id, asset: payload }, ok(t('Bem salvo.'), onClose))}>{t('Salvar')}</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LoanDialog({ federation, asset, onClose }) {
  const hoje = isoDate();
  const [f, setF] = useState({ borrower_kind: 'club', borrower_name: '', quantity: '1', out_at: hoje, due_at: '', note: '' });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const m = useScopedManagementAction(federation);
  const r = validateLoan(asset, f, hoje);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Emprestar {bem}', { bem: asset.name })}</DialogTitle>
          <DialogDescription>{t('{n} disponível(is). Quem empresta é avisado se a devolução atrasar.', { n: assetState(asset, hoje).available })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <V2Field label={t('Para')} htmlFor="em-tipo"><V2Select id="em-tipo" value={f.borrower_kind} onChange={(e) => set('borrower_kind', e.target.value)} options={BORROWER_KINDS.map((k) => ({ value: k, label: t(BORROWER_KIND_LABELS[k]) }))} /></V2Field>
            <V2Field label={t('Nome do clube, arena ou evento')} htmlFor="em-nome" error={r.errors.borrower_name}><V2Input id="em-nome" value={f.borrower_name} maxLength={120} onChange={(e) => set('borrower_name', e.target.value)} /></V2Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <V2Field label={t('Quantidade')} htmlFor="em-qtd" error={r.errors.quantity}><V2Input id="em-qtd" type="number" min={1} value={f.quantity} onChange={(e) => set('quantity', e.target.value)} /></V2Field>
            <V2Field label={t('Saída')} htmlFor="em-saida"><V2Input id="em-saida" type="date" max={hoje} value={f.out_at} onChange={(e) => set('out_at', e.target.value)} /></V2Field>
            <V2Field label={t('Devolução combinada')} htmlFor="em-volta" error={r.errors.due_at}><V2Input id="em-volta" type="date" min={f.out_at} value={f.due_at} onChange={(e) => set('due_at', e.target.value)} /></V2Field>
          </div>
          <V2Field label={t('Observação (opcional)')} htmlFor="em-obs" hint={t('Ex.: responsável pela retirada, estado na saída.')}><V2Input id="em-obs" value={f.note} maxLength={300} onChange={(e) => set('note', e.target.value)} /></V2Field>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button type="button" disabled={!r.ok || m.isPending} onClick={() => m.mutate({ action: 'asset_loan', assetId: asset.id, loan: f }, ok(t('Empréstimo registrado.'), onClose))}>{t('Emprestar')}</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Devolucao({ federation, asset, loan, atrasado, canEdit }) {
  const [aberto, setAberto] = useState(false);
  const [f, setF] = useState({ date: isoDate(), condition: 'good', note: '' });
  const m = useScopedManagementAction(federation);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 py-2 text-sm last:border-0">
      <span>
        <span className="font-semibold">{loan.quantity} × {loan.borrower_name}</span>
        <span className="text-gray-500"> · {t(BORROWER_KIND_LABELS[loan.borrower_kind] || '')} · {t('saiu {saida}, volta {volta}', { saida: br(loan.out_at), volta: br(loan.due_at) })}</span>
        {atrasado && <V2Badge tone="red" className="ml-2">{t('Atrasado')}</V2Badge>}
      </span>
      {canEdit && <V2Button type="button" size="sm" variant="secondary" onClick={() => setAberto(true)}><Undo2 className="h-4 w-4" />{t('Devolvido')}</V2Button>}
      <ConfirmDialog
        open={aberto}
        onOpenChange={setAberto}
        loading={m.isPending}
        confirmDisabled={!f.date}
        title={t('Registrar a devolução de {bem}?', { bem: asset.name })}
        description={t('{n} volta(m) ao inventário. Se voltou danificado, o estado do bem passa a dizer isso.', { n: loan.quantity })}
        confirmLabel={t('Registrar devolução')}
        cancelLabel={t('Voltar')}
        onConfirm={() => m.mutate({ action: 'asset_return', assetId: asset.id, loanId: loan.id, ...f }, ok(t('Devolução registrada.'), () => setAberto(false)))}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label={t('Data da devolução')} htmlFor={`dv-data-${loan.id}`}><V2Input id={`dv-data-${loan.id}`} type="date" min={loan.out_at} max={isoDate()} value={f.date} onChange={(e) => setF((x) => ({ ...x, date: e.target.value }))} /></V2Field>
          <V2Field label={t('Estado em que voltou')} htmlFor={`dv-estado-${loan.id}`}><V2Select id={`dv-estado-${loan.id}`} value={f.condition} onChange={(e) => setF((x) => ({ ...x, condition: e.target.value }))} options={ASSET_CONDITIONS.map((k) => ({ value: k, label: t(ASSET_CONDITION_LABELS[k]) }))} /></V2Field>
        </div>
        <V2Field label={t('Observação (opcional)')} htmlFor={`dv-obs-${loan.id}`}><V2Input id={`dv-obs-${loan.id}`} value={f.note} maxLength={300} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} /></V2Field>
      </ConfirmDialog>
    </li>
  );
}

function AssetCard({ federation, asset: a, canEdit, admin, onEdit, onLoan }) {
  const hoje = isoDate();
  const st = assetState(a, hoje);
  const atrasados = new Set(st.overdue.map((l) => l.id));
  const devolvidos = (a.loans || []).filter((l) => l.returned_at);
  const [acao, setAcao] = useState(null);
  const [motivo, setMotivo] = useState('');
  const m = useScopedManagementAction(federation);
  return (
    <li className={`space-y-2 rounded-2xl border border-gray-200 bg-white p-4 ${st.retired ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-ink">{a.name}{a.code ? <span className="ml-2 text-xs font-normal text-gray-500">#{a.code}</span> : null}</p>
          <p className="text-xs text-gray-500">{[t(ASSET_CATEGORY_LABELS[a.category] || ASSET_CATEGORY_LABELS.other), a.location, a.value_cents ? reais(a.value_cents) : ''].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {st.retired ? <V2Badge tone="gray">{t('Baixado')}</V2Badge> : <V2Badge tone={a.condition === 'damaged' ? 'red' : 'gray'}>{t(ASSET_CONDITION_LABELS[a.condition] || '')}</V2Badge>}
          {st.overdue.length > 0 && <V2Badge tone="red">{t('Devolução atrasada')}</V2Badge>}
          {canEdit && !st.retired && <V2Button type="button" size="sm" variant="secondary" disabled={st.available < 1} onClick={onLoan}>{t('Emprestar')}</V2Button>}
          {canEdit && <V2Button type="button" size="sm" variant="ghost" onClick={onEdit} aria-label={t('Editar {bem}', { bem: a.name })}><Pencil className="h-4 w-4" /></V2Button>}
          {canEdit && (st.retired
            ? <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => m.mutate({ action: 'asset_retire', assetId: a.id, undo: true }, ok(t('Bem reativado.')))}>{t('Reativar')}</V2Button>
            : <V2Button type="button" size="sm" variant="ghost" disabled={st.lent > 0} onClick={() => { setMotivo(''); setAcao('baixa'); }}>{t('Dar baixa')}</V2Button>)}
          {admin && !(a.loans || []).length && <V2Button type="button" size="sm" variant="ghost" aria-label={t('Apagar {bem}', { bem: a.name })} onClick={() => setAcao('apagar')}><Trash2 className="h-4 w-4" /></V2Button>}
        </div>
      </div>
      <p className="text-sm text-gray-700">{t('{total} no total · {fora} emprestado(s) · {livre} disponível(is)', { total: a.quantity, fora: st.lent, livre: st.available })}</p>
      {st.retired && a.retired_reason && <p className="text-xs text-gray-500">{t('Baixa em {data}: {motivo}', { data: br(a.retired_at), motivo: a.retired_reason })}</p>}
      {st.openLoans.length > 0 && <ul aria-label={t('Empréstimos em aberto')}>{st.openLoans.map((l) => <Devolucao key={l.id} federation={federation} asset={a} loan={l} atrasado={atrasados.has(l.id)} canEdit={canEdit} />)}</ul>}
      {devolvidos.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-gray-600">{t('Histórico de empréstimos ({n})', { n: devolvidos.length })}</summary>
          <ul className="mt-1 space-y-1 text-xs text-gray-600">
            {devolvidos.map((l) => <li key={l.id}>{t('{qtd} × {quem}: {saida} a {volta}, voltou {estado}', { qtd: l.quantity, quem: l.borrower_name, saida: br(l.out_at), volta: br(l.returned_at), estado: t(ASSET_CONDITION_LABELS[l.return_condition] || '').toLowerCase() })}{l.return_note ? ` · ${l.return_note}` : ''}</li>)}
          </ul>
        </details>
      )}
      {acao && (
        <ConfirmDialog
          open
          destructive
          onOpenChange={(o) => { if (!o) setAcao(null); }}
          loading={m.isPending}
          confirmDisabled={acao === 'baixa' && motivo.trim().length < 3}
          title={acao === 'baixa' ? t('Dar baixa em {bem}?', { bem: a.name }) : t('Apagar {bem} do inventário?', { bem: a.name })}
          description={acao === 'baixa' ? t('O bem sai do uso (perdido, danificado, doado, vendido) e não se empresta mais. O histórico fica.') : t('Sem empréstimo registrado, o cadastro some. Não dá para desfazer.')}
          confirmLabel={acao === 'baixa' ? t('Dar baixa') : t('Apagar')}
          cancelLabel={t('Voltar')}
          onConfirm={() => m.mutate({ action: 'asset_retire', assetId: a.id, remove: acao === 'apagar', reason: motivo }, ok(acao === 'baixa' ? t('Baixa registrada.') : t('Bem apagado.'), () => setAcao(null)))}
        >
          {acao === 'baixa' && <V2Field label={t('Motivo')} htmlFor={`bx-${a.id}`}><V2Input id={`bx-${a.id}`} value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} /></V2Field>}
        </ConfirmDialog>
      )}
    </li>
  );
}

export default function AssetsManager({ federation, canEdit, admin }) {
  const q = useScopedAssets(federation);
  const [editando, setEditando] = useState(null);
  const [emprestando, setEmprestando] = useState(null);
  const [verBaixados, setVerBaixados] = useState(false);
  const hoje = isoDate();
  const lista = useMemo(() => (q.data || []).filter((a) => verBaixados || a.status !== 'retired'), [q.data, verBaixados]);
  const baixados = (q.data || []).filter((a) => a.status === 'retired').length;
  const resumo = useMemo(() => {
    const ativos = (q.data || []).filter((a) => a.status !== 'retired');
    const st = ativos.map((a) => assetState(a, hoje));
    return { itens: ativos.reduce((s, a) => s + (Number(a.quantity) || 0), 0), fora: st.reduce((s, x) => s + x.lent, 0), atrasados: st.reduce((s, x) => s + x.overdue.length, 0), valor: ativos.reduce((s, a) => s + (Number(a.value_cents) || 0), 0) };
  }, [q.data, hoje]);
  return (
    <section className="space-y-4" aria-label={t('Patrimônio')} data-dica="federacao-patrimonio">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Package className="h-5 w-5" aria-hidden="true" />{t('Patrimônio')}</h2>
          <p className="text-sm text-gray-500">{pick(federation, t('O que a federação tem e com quem está. Empréstimo é para clube, arena ou evento, com a devolução registrada.'), t('O que o clube tem e com quem está. Empréstimo é para outro clube, arena ou evento, com a devolução registrada.'))}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {q.isSuccess && q.data.length > 0 && <V2Button type="button" variant="ghost" onClick={() => baixarCsv(assetsCsv(q.data, hoje), `patrimonio-${federation.acronym || federation.id}-${hoje}.csv`)}><Download className="h-4 w-4" />{t('Baixar planilha (CSV)')}</V2Button>}
          {canEdit && <V2Button type="button" onClick={() => setEditando('novo')} data-dica="federacao-patrimonio-novo"><Plus className="h-4 w-4" />{t('Cadastrar bem')}</V2Button>}
        </div>
      </div>
      {q.isError ? <V2ErrorState inline title={t('Não carregou o patrimônio')} onRetry={q.refetch} />
        : q.isLoading ? <V2Skeleton lines={4} />
          : !q.data.length ? <V2EmptyState icon={Package} title={t('Nenhum bem cadastrado')} description={canEdit ? pick(federation, t('Cadastre redes, placares, bolas e o que mais a federação empresta aos eventos.'), t('Cadastre redes, placares, bolas e o que mais o clube tem para os treinos e eventos.')) : t('A equipe ainda não cadastrou bens.')} />
            : (
              <>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[[t('Itens'), resumo.itens], [t('Emprestados'), resumo.fora], [t('Devoluções atrasadas'), resumo.atrasados], [t('Valor registrado'), reais(resumo.valor)]].map(([k, v]) => (
                    <div key={k} className="rounded-2xl border border-gray-200 bg-white p-3"><dt className="text-xs text-gray-500">{k}</dt><dd className="font-display text-lg font-bold tabular-nums text-ink">{v}</dd></div>
                  ))}
                </dl>
                {baixados > 0 && <V2Button type="button" size="sm" variant="ghost" onClick={() => setVerBaixados((v) => !v)}>{verBaixados ? t('Esconder os baixados') : t('Mostrar os baixados ({n})', { n: baixados })}</V2Button>}
                <ul className="space-y-3">{lista.map((a) => <AssetCard key={a.id} federation={federation} asset={a} canEdit={canEdit} admin={admin} onEdit={() => setEditando(a)} onLoan={() => setEmprestando(a)} />)}</ul>
              </>
            )}
      {editando && <AssetEditor federation={federation} asset={editando === 'novo' ? null : editando} onClose={() => setEditando(null)} />}
      {emprestando && <LoanDialog federation={federation} asset={emprestando} onClose={() => setEmprestando(null)} />}
    </section>
  );
}
