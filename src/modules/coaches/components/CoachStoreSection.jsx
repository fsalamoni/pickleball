/**
 * CoachStoreSection — loja do professor (admin). Produtos que o professor
 * vende, com visibilidade pública opcional. Usada no hub do professor.
 */

import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  Store, Plus, Trash2, Pencil, Eye, EyeOff,
} from 'lucide-react';
import {
  COACH_PRODUCT_CATEGORY_LABELS, coachProductCategoryLabel, formatCoachProductPrice,
} from '../domain/coachProduct.js';
import {
  useCoachProducts, useCreateCoachProduct, useUpdateCoachProduct, useDeleteCoachProduct,
} from '../hooks/useCoachProducts.js';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Select, V2Skeleton,
  V2Surface, V2Textarea,
} from '@/v2/ui/primitives';

function ProductForm({ coachId, product, onClose }) {
  const create = useCreateCoachProduct();
  const update = useUpdateCoachProduct();
  const editing = !!product;
  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price ?? 0,
    category: product?.category || 'outros',
    visible_public: product?.visible_public ?? false,
  });
  const pending = create.isPending || update.isPending;

  const submit = async (e) => {
    e.preventDefault();
    try {
      const input = { ...form, price: Number(form.price) };
      if (editing) await update.mutateAsync({ product, input });
      else await create.mutateAsync({ coachId, input });
      toast.success(editing ? 'Produto atualizado.' : 'Produto criado.');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-gray-100 bg-paper p-4">
      <h3 className="font-display text-base font-bold text-ink">{editing ? 'Editar produto' : 'Novo produto'}</h3>
      <V2Field label="Nome">
        <V2Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={80} placeholder="Ex.: Overgrip, camiseta, apostila…" />
      </V2Field>
      <V2Field label="Descrição (opcional)">
        <V2Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} maxLength={400} />
      </V2Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label="Preço (R$)">
          <V2Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
        </V2Field>
        <V2Field label="Categoria">
          <V2Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {Object.entries(COACH_PRODUCT_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </V2Select>
        </V2Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={form.visible_public} onChange={(e) => setForm({ ...form, visible_public: e.target.checked })} className="h-4 w-4 rounded border-gray-300" />
        Exibir no meu perfil público
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={pending}>{pending ? 'Salvando…' : editing ? 'Salvar' : 'Criar'}</V2Button>
      </div>
    </form>
  );
}

export default function CoachStoreSection({ coachId }) {
  const { data: products = [], isLoading } = useCoachProducts(coachId, { full: true });
  const del = useDeleteCoachProduct();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const openNew = () => { setEditing(null); setShowForm(true); };
  const openEdit = (p) => { setEditing(p); setShowForm(true); };
  const close = () => { setShowForm(false); setEditing(null); };

  const handleDelete = async (product) => {
    try { await del.mutateAsync({ product }); toast.success('Produto excluído.'); }
    catch (err) { toast.error(err?.message || 'Não foi possível excluir.'); }
  };

  return (
    <V2Surface>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Minha loja</h2>
        </div>
        {!showForm && <V2Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Novo produto</V2Button>}
      </div>
      <p className="-mt-2 mb-3 text-sm text-gray-500">
        Cadastre itens que você vende. Marque como público para exibir no seu perfil profissional.
      </p>

      {showForm && <div className="mb-4"><ProductForm coachId={coachId} product={editing} onClose={close} /></div>}

      {isLoading ? (
        <V2Skeleton lines={3} />
      ) : products.length === 0 ? (
        <V2EmptyState icon={Store} title="Loja vazia" description="Cadastre o primeiro produto. Você decide se ele aparece no seu perfil público." />
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-ink">{p.name}</p>
                  <V2Badge tone="neutral">{coachProductCategoryLabel(p.category)}</V2Badge>
                  {p.visible_public
                    ? <V2Badge tone="green"><Eye className="mr-1 inline h-3 w-3" />Público</V2Badge>
                    : <V2Badge tone="amber"><EyeOff className="mr-1 inline h-3 w-3" />Oculto</V2Badge>}
                </div>
                <p className="text-xs text-gray-500">{formatCoachProductPrice(p.price)}{p.description ? ` · ${p.description}` : ''}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => openEdit(p)} className="rounded-full border border-gray-200 p-1.5 text-gray-500 hover:bg-white" aria-label="Editar">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <ConfirmDialog
                  title="Excluir produto?"
                  description={`"${p.name}" será removido da sua loja.`}
                  confirmLabel="Excluir"
                  onConfirm={() => handleDelete(p)}
                  trigger={(
                    <button type="button" className="rounded-full border border-red-200 p-1.5 text-red-500 hover:bg-red-50" aria-label="Excluir">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </V2Surface>
  );
}
