/**
 * CoachPackagesSection — pacotes, vendas e financeiro do professor (Fase C).
 *
 * Usada dentro de V2CoachAgenda (flag coach_lessons).
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Package, Plus, Trash2, Download, DollarSign, Check, Minus,
} from 'lucide-react';
import {
  creditsRemaining, isSaleActive, isSaleExpired, revenueSummary, formatRevenue, salesToCSV,
} from '../domain/package.js';
import { formatPrice } from '../../arenas/domain/pricing.js';
import { STUDENT_STATUS } from '../domain/student.js';
import {
  useCoachPackages, useCreatePackage, useDeletePackage,
  useCoachSales, useSellPackage, useSetSalePaid, useConsumeCredit,
} from '../hooks/usePackages.js';
import { useCoachStudents } from '../hooks/useStudents.js';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Select, V2Skeleton,
  V2StatCard, V2Surface, V2Textarea,
} from '@/v2/ui/primitives';

function downloadCSV(filename, content) {
  // BOM (U+FEFF) ajuda o Excel a reconhecer UTF-8.
  const blob = new Blob([String.fromCharCode(0xFEFF) + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function CreatePackageForm({ coachId, onClose }) {
  const create = useCreatePackage();
  const [form, setForm] = useState({ name: '', lessons_count: 10, price: 500, validity_days: 90, description: '' });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await create.mutateAsync({
        coachId,
        input: {
          ...form,
          lessons_count: Number(form.lessons_count),
          price: Number(form.price),
          validity_days: Number(form.validity_days),
        },
      });
      toast.success('Pacote criado!');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível criar.');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-gray-100 bg-paper p-4">
      <h3 className="font-display text-base font-bold text-ink">Novo pacote</h3>
      <V2Field label="Nome">
        <V2Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={80} placeholder="Ex.: Pacote 10 aulas" />
      </V2Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <V2Field label="Aulas">
          <V2Input type="number" min="1" max="200" value={form.lessons_count} onChange={(e) => setForm({ ...form, lessons_count: e.target.value })} required />
        </V2Field>
        <V2Field label="Preço (R$)">
          <V2Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
        </V2Field>
        <V2Field label="Validade (dias)">
          <V2Input type="number" min="1" max="730" value={form.validity_days} onChange={(e) => setForm({ ...form, validity_days: e.target.value })} required />
        </V2Field>
      </div>
      <V2Field label="Descrição (opcional)">
        <V2Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} maxLength={300} />
      </V2Field>
      <div className="flex justify-end gap-2 pt-1">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={create.isPending}>{create.isPending ? 'Criando…' : 'Criar pacote'}</V2Button>
      </div>
    </form>
  );
}

function SellForm({ coachId, packages, students, onClose }) {
  const sell = useSellPackage();
  const [packageId, setPackageId] = useState(packages[0]?.id || '');
  const [studentId, setStudentId] = useState('');
  const [paid, setPaid] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const pkg = packages.find((p) => p.id === packageId);
    const student = students.find((s) => s.student_id === studentId);
    if (!pkg) { toast.error('Escolha um pacote.'); return; }
    if (!student) { toast.error('Escolha um aluno.'); return; }
    try {
      await sell.mutateAsync({ coachId, pkg, studentId: student.student_id, studentName: student.student_name, paid });
      toast.success('Pacote vendido!');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível vender.');
    }
  };

  if (students.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3 text-sm text-amber-800">
        Adicione alunos ao seu roster antes de vender um pacote.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-gray-100 bg-paper p-4">
      <h3 className="font-display text-base font-bold text-ink">Vender pacote</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label="Pacote">
          <V2Select value={packageId} onChange={(e) => setPackageId(e.target.value)}>
            <option value="">Selecione…</option>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatPrice(p.price)}</option>)}
          </V2Select>
        </V2Field>
        <V2Field label="Aluno">
          <V2Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Selecione…</option>
            {students.map((s) => <option key={s.student_id} value={s.student_id}>{s.student_name || s.student_email || 'Aluno'}</option>)}
          </V2Select>
        </V2Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
        Já foi pago
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={sell.isPending}>{sell.isPending ? 'Vendendo…' : 'Registrar venda'}</V2Button>
      </div>
    </form>
  );
}

function SaleRow({ sale, onTogglePaid, onConsume, isPending }) {
  const remaining = creditsRemaining(sale);
  const expired = isSaleExpired(sale);
  const active = isSaleActive(sale);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-3">
      <div>
        <p className="font-bold text-ink">{sale.student_name || 'Aluno'} · {sale.package_name}</p>
        <p className="text-xs text-gray-500">
          {remaining}/{sale.credits_total} crédito(s) · {formatPrice(sale.price)}
          {sale.expires_at && <span className={expired ? 'text-red-500' : ''}> · expira {sale.expires_at}</span>}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {active ? <V2Badge tone="green">Ativo</V2Badge> : expired ? <V2Badge tone="red">Expirado</V2Badge> : remaining === 0 ? <V2Badge tone="neutral">Esgotado</V2Badge> : null}
        {sale.paid ? <V2Badge tone="green">Pago</V2Badge> : <V2Badge tone="amber">Pendente</V2Badge>}
        {remaining > 0 && !expired && (
          <button type="button" disabled={isPending} onClick={() => onConsume(sale)} className="rounded-full border border-gray-200 px-2.5 py-1 text-xs font-bold text-gray-600 hover:bg-white disabled:opacity-50" title="Usar 1 crédito">
            <Minus className="mr-1 inline h-3 w-3" /> Crédito
          </button>
        )}
        <button type="button" disabled={isPending} onClick={() => onTogglePaid(sale)} className="rounded-full border border-ink bg-ink px-2.5 py-1 text-xs font-bold text-white hover:bg-ink/90 disabled:opacity-50">
          {sale.paid ? 'Marcar pendente' : <><Check className="mr-1 inline h-3 w-3" /> Pago</>}
        </button>
      </div>
    </div>
  );
}

export default function CoachPackagesSection({ coachId }) {
  const { data: packages = [], isLoading: pkgLoading } = useCoachPackages(coachId);
  const { data: sales = [], isLoading: salesLoading } = useCoachSales(coachId);
  const { data: students = [] } = useCoachStudents(coachId);
  const del = useDeletePackage();
  const setPaid = useSetSalePaid();
  const consume = useConsumeCredit();
  const [showCreate, setShowCreate] = useState(false);
  const [showSell, setShowSell] = useState(false);

  const activeStudents = useMemo(() => students.filter((s) => s.status !== STUDENT_STATUS.PAUSED), [students]);
  const finance = useMemo(() => formatRevenue(revenueSummary(sales)), [sales]);

  const handleDelete = async (pkg) => {
    try { await del.mutateAsync({ pkg }); toast.success('Pacote excluído.'); }
    catch (err) { toast.error(err?.message || 'Não foi possível excluir.'); }
  };
  const handleTogglePaid = async (sale) => {
    try { await setPaid.mutateAsync({ sale, paid: !sale.paid }); }
    catch (err) { toast.error(err?.message || 'Não foi possível atualizar.'); }
  };
  const handleConsume = async (sale) => {
    try { await consume.mutateAsync({ saleId: sale.id, coachId, studentId: sale.student_id }); toast.success('Crédito debitado.'); }
    catch (err) { toast.error(err?.message || 'Não foi possível debitar.'); }
  };

  return (
    <V2Surface>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Pacotes e financeiro</h2>
        </div>
        <div className="flex gap-2">
          {!showCreate && <V2Button size="sm" variant="ghost" onClick={() => { setShowCreate(true); setShowSell(false); }}><Plus className="mr-1 h-4 w-4" /> Pacote</V2Button>}
          {packages.length > 0 && !showSell && <V2Button size="sm" onClick={() => { setShowSell(true); setShowCreate(false); }}><DollarSign className="mr-1 h-4 w-4" /> Vender</V2Button>}
        </div>
      </div>

      {/* Financeiro */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <V2StatCard icon={DollarSign} label="Receita recebida" value={finance.revenue_label} accent="ink" />
        <V2StatCard label="A receber" value={finance.pending_label} hint={`${finance.pending_count} venda(s) pendente(s)`} />
        <V2StatCard label="Vendas" value={String(finance.total_sales)} hint={`${finance.paid_count} paga(s)`} />
      </div>

      {showCreate && <div className="mb-4"><CreatePackageForm coachId={coachId} onClose={() => setShowCreate(false)} /></div>}
      {showSell && <div className="mb-4"><SellForm coachId={coachId} packages={packages.filter((p) => p.active !== false)} students={activeStudents} onClose={() => setShowSell(false)} /></div>}

      {/* Pacotes */}
      <div className="mb-4">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Pacotes ofertados</h3>
        {pkgLoading ? (
          <V2Skeleton lines={2} />
        ) : packages.length === 0 ? (
          <V2EmptyState icon={Package} title="Nenhum pacote" description="Crie um pacote (ex.: 10 aulas com validade) para vender aos alunos." />
        ) : (
          <div className="space-y-2">
            {packages.map((pkg) => (
              <div key={pkg.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-paper p-3">
                <div>
                  <p className="font-bold text-ink">{pkg.name}</p>
                  <p className="text-xs text-gray-500">{pkg.lessons_count} aulas · {formatPrice(pkg.price)} · {pkg.validity_days} dias</p>
                </div>
                <div className="flex items-center gap-2">
                  {pkg.active !== false ? <V2Badge tone="green">Ativo</V2Badge> : <V2Badge tone="neutral">Inativo</V2Badge>}
                  <ConfirmDialog
                    title="Excluir pacote?"
                    description={`"${pkg.name}" deixa de ser ofertado. Vendas já feitas não são afetadas.`}
                    confirmLabel="Excluir"
                    onConfirm={() => handleDelete(pkg)}
                    trigger={(
                      <button type="button" className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-100">
                        <Trash2 className="mr-1 inline h-3 w-3" /> Excluir
                      </button>
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vendas */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Vendas</h3>
          {sales.length > 0 && (
            <button type="button" onClick={() => downloadCSV(`vendas-pacotes-${coachId}.csv`, salesToCSV(sales))} className="inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline">
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </button>
          )}
        </div>
        {salesLoading ? (
          <V2Skeleton lines={2} />
        ) : sales.length === 0 ? (
          <V2EmptyState icon={DollarSign} title="Nenhuma venda ainda" description="Venda um pacote a um aluno para começar a controlar créditos e receita." />
        ) : (
          <div className="space-y-2">
            {sales.map((sale) => (
              <SaleRow key={sale.id} sale={sale} onTogglePaid={handleTogglePaid} onConsume={handleConsume} isPending={setPaid.isPending || consume.isPending} />
            ))}
          </div>
        )}
      </div>
    </V2Surface>
  );
}
