/**
 * V2ArenaMercadoTab — Aba admin de Mercado / Estoque (Sprint 5).
 *
 * 3 sub-seções:
 *  - Produtos (cadastro mestre: nome, marca, categoria)
 *  - Entradas (compra/reposição: data, quantidade, custo, fornecedor)
 *  - Saídas (venda/consumo/perda: data, quantidade, preço, tipo)
 *
 * Cada entrada/saída mostra: estoque atual, total investido,
 * total receita, margem. Filtros por categoria e busca.
 */

import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Package, Plus, Search, TrendingUp, TrendingDown, Trash2,
  Save, Pencil, CalendarClock, ShoppingBasket, Tag,
} from 'lucide-react';
import {
  useInventoryProducts, useCreateInventoryProduct, useUpdateInventoryProduct, useDeleteInventoryProduct,
  useInventoryEntries, useAddInventoryEntry,
  useInventoryExits, useAddInventoryExit,
} from '@/modules/arenas/hooks/useArenas';
import {
  INVENTORY_CATEGORIES, INVENTORY_CATEGORIES_LIST,
  calculateStock, calculateMargin, filterProductsByCategory, searchProducts,
  stockStatus, expiryStatus, daysToExpiry,
} from '@/modules/arenas/domain/inventory';
import { CATALOG_SUBCATEGORIES, CATALOG_PACKAGINGS } from '@/modules/arenas/domain/productCatalog';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import ConfirmDialog from '@/components/ConfirmDialog';
import { cn } from '@/core/lib/utils';
import {
  V2Badge, V2Button, V2Field, V2Input, V2Select, V2Surface, V2Textarea, V2EmptyState, V2Skeleton,
} from '@/v2/ui/primitives';

const TABS = [
  { value: 'produtos', label: 'Produtos' },
  { value: 'entradas', label: 'Entradas (compra)' },
  { value: 'saidas', label: 'Saídas (venda)' },
];

const EXIT_TYPE_LABELS = {
  sale: 'Venda', consumption: 'Consumo interno', loss: 'Perda', gift: 'Brinde', return: 'Devolução',
};

export default function V2ArenaMercadoTab({ onGoToCatalog }) {
  const { arenaId } = useParams();
  const [sub, setSub] = useState('produtos');
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-green-700" />
          <h2 className="font-display text-xl font-bold text-ink">Mercado / Estoque</h2>
        </div>
        {onGoToCatalog && (
          <V2Button size="sm" variant="secondary" onClick={onGoToCatalog}>
            <ShoppingBasket className="h-4 w-4" /> Puxar do catálogo
          </V2Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setSub(t.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
              sub === t.value ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-paper-pure',
            )}
          >{t.label}</button>
        ))}
      </div>
      {sub === 'produtos' && <ProductsSection arenaId={arenaId} />}
      {sub === 'entradas' && <EntriesSection arenaId={arenaId} />}
      {sub === 'saidas' && <ExitsSection arenaId={arenaId} />}
    </div>
  );
}

const EMPTY_PRODUCT = {
  name: '', brand: '', category: INVENTORY_CATEGORIES.OUTROS, subcategory: '',
  packaging: '', size: '', flavor: '', unit: 'un', description: '',
  sale_price: '', min_stock: '', expiry_date: '',
};

function ProductsSection({ arenaId }) {
  const { data: products = [], isLoading } = useInventoryProducts(arenaId);
  const { data: entries = [] } = useInventoryEntries(arenaId);
  const { data: exits = [] } = useInventoryExits(arenaId);
  const create = useCreateInventoryProduct(arenaId);
  const update = useUpdateInventoryProduct(arenaId);
  const remove = useDeleteInventoryProduct(arenaId);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const stockById = useMemo(() => {
    const map = new Map();
    for (const p of products) map.set(p.id, calculateStock(p.id, entries, exits).quantity);
    return map;
  }, [products, entries, exits]);

  const filtered = useMemo(() => {
    let list = filterProductsByCategory(products, filter);
    list = searchProducts(list, search);
    return list;
  }, [products, filter, search]);

  const subOptions = CATALOG_SUBCATEGORIES[form.category] || [];

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await create.mutateAsync({
        ...form,
        sale_price: form.sale_price === '' ? undefined : Number(form.sale_price),
        min_stock: form.min_stock === '' ? undefined : Number(form.min_stock),
        expiry_date: form.expiry_date || undefined,
      });
      toast.success('Produto cadastrado!');
      setForm(EMPTY_PRODUCT);
      setCreating(false);
    } catch (err) { toast.error(err.message); }
  }

  async function handleToggleActive(p) {
    try {
      await update.mutateAsync({ productId: p.id, updates: { active: !p.active } });
    } catch (err) { toast.error(err.message); }
  }

  async function handleDelete(p) {
    try {
      await remove.mutateAsync(p.id);
      toast.success('Produto removido.');
    } catch (err) { toast.error(err.message); }
  }

  return (
    <V2Surface>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <V2Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto..." className="pl-9" />
          </div>
        </div>
        <V2Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Todas categorias</option>
          {INVENTORY_CATEGORIES_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
        </V2Select>
        <V2Button size="sm" onClick={() => { setForm(EMPTY_PRODUCT); setCreating((v) => !v); }}>
          <Plus className="h-4 w-4" /> Produto próprio
        </V2Button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="mt-3 space-y-2 rounded-2xl border border-green-200 bg-green-50/40 p-3">
          <p className="text-xs text-gray-500">
            Cadastre um produto próprio com todos os detalhes. Dica: itens comuns (bebidas, salgadinhos…)
            já estão prontos no <strong>Catálogo</strong> — é mais rápido puxar de lá.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <V2Field label="Nome do produto" required>
              <V2Input value={form.name} onChange={set('name')} required maxLength={80} placeholder="Ex: Coxinha de frango" />
            </V2Field>
            <V2Field label="Categoria" required>
              <V2Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, subcategory: '' }))}>
                {INVENTORY_CATEGORIES_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
              </V2Select>
            </V2Field>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <V2Field label="Marca">
              <V2Input value={form.brand} onChange={set('brand')} maxLength={60} />
            </V2Field>
            <V2Field label="Subcategoria">
              <V2Input list="merc-sub-options" value={form.subcategory} onChange={set('subcategory')} maxLength={50} placeholder="Ex: Salgado" />
              <datalist id="merc-sub-options">
                {subOptions.map((s) => <option key={s} value={s} />)}
              </datalist>
            </V2Field>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <V2Field label="Embalagem">
              <V2Input list="merc-pack-options" value={form.packaging} onChange={set('packaging')} maxLength={40} placeholder="Ex: Unidade" />
              <datalist id="merc-pack-options">
                {CATALOG_PACKAGINGS.map((s) => <option key={s} value={s} />)}
              </datalist>
            </V2Field>
            <V2Field label="Tamanho/volume">
              <V2Input value={form.size} onChange={set('size')} maxLength={30} placeholder="Ex: 350ml, 100g" />
            </V2Field>
            <V2Field label="Unidade">
              <V2Input value={form.unit} onChange={set('unit')} maxLength={20} placeholder="un, kg, L" />
            </V2Field>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <V2Field label="Preço de venda (R$)">
              <input type="number" min="0" step="0.01" value={form.sale_price} onChange={set('sale_price')} className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" placeholder="Ex: 8,00" />
            </V2Field>
            <V2Field label="Estoque mínimo">
              <input type="number" min="0" value={form.min_stock} onChange={set('min_stock')} className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" placeholder="Ex: 6" />
            </V2Field>
            <V2Field label="Validade">
              <input type="date" value={form.expiry_date} onChange={set('expiry_date')} className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" />
            </V2Field>
          </div>
          <V2Field label="Descrição">
            <V2Textarea value={form.description} onChange={set('description')} maxLength={500} rows={2} />
          </V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancelar</V2Button>
            <V2Button type="submit" size="sm" disabled={create.isPending}>
              <Save className="h-4 w-4" /> {create.isPending ? 'Salvando…' : 'Cadastrar'}
            </V2Button>
          </div>
        </form>
      )}

      <div className="mt-3 space-y-2">
        {isLoading ? <V2Skeleton lines={3} /> : filtered.length === 0 ? (
          <V2EmptyState icon={Package} title="Nenhum produto" description="Puxe do catálogo ou cadastre um produto próprio." />
        ) : (
          filtered.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              quantity={stockById.get(p.id) ?? 0}
              editing={editingId === p.id}
              onToggleEdit={() => setEditingId(editingId === p.id ? null : p.id)}
              onToggleActive={() => handleToggleActive(p)}
              onDelete={() => handleDelete(p)}
              onSave={async (updates) => {
                try {
                  await update.mutateAsync({ productId: p.id, updates });
                  toast.success('Produto atualizado!');
                  setEditingId(null);
                } catch (err) { toast.error(err.message); }
              }}
              saving={update.isPending}
            />
          ))
        )}
      </div>
    </V2Surface>
  );
}

/** Linha de produto do mercado: detalhes, preço de venda, estoque e validade. */
function ProductRow({ product: p, quantity, editing, onToggleEdit, onToggleActive, onDelete, onSave, saving }) {
  const [edit, setEdit] = useState({
    sale_price: p.sale_price ?? '', min_stock: p.min_stock ?? '', expiry_date: p.expiry_date ?? '',
  });
  const stStatus = stockStatus(quantity, p.min_stock);
  const exStatus = expiryStatus(p.expiry_date);
  const exDays = daysToExpiry(p.expiry_date);
  const packInfo = [p.packaging, p.size].filter(Boolean).join(' ');

  return (
    <div className="rounded-2xl border border-gray-100 bg-paper p-3">
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid">
          <Package className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4 className="truncate text-sm font-bold text-ink">{p.name}</h4>
            {p.catalog_id && <V2Badge tone="neutral">catálogo</V2Badge>}
            {!p.active && <V2Badge tone="red">Inativo</V2Badge>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-gray-500">
            {p.brand && <span>{p.brand}</span>}
            <V2Badge tone="blue">{p.category}</V2Badge>
            {p.subcategory && <span>· {p.subcategory}</span>}
            {packInfo && <span>· {packInfo}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {Number(p.sale_price) > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700">
                <Tag className="h-3 w-3" /> {formatPrice(p.sale_price)}
              </span>
            )}
            <V2Badge tone={stStatus === 'out' ? 'red' : stStatus === 'low' ? 'amber' : 'green'}>
              Estoque: {quantity}{p.min_stock ? ` / mín ${p.min_stock}` : ''}
            </V2Badge>
            {exStatus && (
              <V2Badge tone={exStatus === 'expired' ? 'red' : exStatus === 'soon' ? 'amber' : 'neutral'}>
                <CalendarClock className="mr-1 h-3 w-3" />
                {exStatus === 'expired' ? `Vencido ${Math.abs(exDays)}d` : exStatus === 'soon' ? `Vence ${exDays}d` : p.expiry_date}
              </V2Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onToggleEdit} className="text-gray-500 hover:text-ink" aria-label={`Editar ${p.name}`}>
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" onClick={onToggleActive} className="text-xs text-gray-500 hover:text-ink">
            {p.active ? 'Desativar' : 'Ativar'}
          </button>
          <ConfirmDialog
            title="Remover produto?"
            description={`"${p.name}" será removido do mercado. As entradas e saídas já registradas são preservadas.`}
            confirmLabel="Remover"
            onConfirm={onDelete}
            trigger={(
              <button type="button" className="text-red-500 hover:text-red-700" aria-label={`Remover ${p.name}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          />
        </div>
      </div>

      {editing && (
        <div className="mt-3 grid grid-cols-1 gap-2 border-t border-gray-100 pt-3 sm:grid-cols-4">
          <V2Field label="Preço de venda (R$)">
            <input type="number" min="0" step="0.01" value={edit.sale_price} onChange={(e) => setEdit((s) => ({ ...s, sale_price: e.target.value }))} className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" />
          </V2Field>
          <V2Field label="Estoque mínimo">
            <input type="number" min="0" value={edit.min_stock} onChange={(e) => setEdit((s) => ({ ...s, min_stock: e.target.value }))} className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" />
          </V2Field>
          <V2Field label="Validade">
            <input type="date" value={edit.expiry_date} onChange={(e) => setEdit((s) => ({ ...s, expiry_date: e.target.value }))} className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" />
          </V2Field>
          <div className="flex items-end">
            <V2Button
              size="sm"
              className="w-full"
              disabled={saving}
              onClick={() => onSave({
                sale_price: edit.sale_price === '' ? 0 : Number(edit.sale_price),
                min_stock: edit.min_stock === '' ? 0 : Number(edit.min_stock),
                expiry_date: edit.expiry_date || '',
              })}
            >
              <Save className="h-4 w-4" /> Salvar
            </V2Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EntriesSection({ arenaId }) {
  const { data: products = [] } = useInventoryProducts(arenaId);
  const { data: entries = [], isLoading } = useInventoryEntries(arenaId);
  const { data: exits = [] } = useInventoryExits(arenaId);
  const add = useAddInventoryEntry(arenaId);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    product_id: '', date: new Date().toISOString().slice(0, 10), quantity: 1, unit_cost: 0,
    supplier: '', buyer_name: '', notes: '',
  });
  const setField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await add.mutateAsync(form);
      toast.success('Entrada registrada!');
      setCreating(false);
      setForm({ ...form, quantity: 1, unit_cost: 0, notes: '', supplier: '' });
    } catch (err) { toast.error(err.message); }
  }

  return (
    <V2Surface>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-700" /> Entradas (compras)
        </h3>
        <V2Button size="sm" onClick={() => setCreating(true)} disabled={products.length === 0}>
          <Plus className="h-4 w-4" /> Nova entrada
        </V2Button>
      </div>
      {products.length === 0 && (
        <p className="mt-2 text-xs text-amber-700">Cadastre produtos antes de registrar entradas.</p>
      )}

      {creating && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2 rounded-2xl border border-green-200 bg-green-50/40 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <V2Field label="Produto" required>
              <V2Select value={form.product_id} onChange={setField('product_id')} required>
                <option value="">— Selecione —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.brand || 'sem marca'})</option>)}
              </V2Select>
            </V2Field>
            <V2Field label="Data" required>
              <input type="date" value={form.date} onChange={setField('date')} required className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" />
            </V2Field>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <V2Field label="Quantidade" required>
              <input type="number" min="1" value={form.quantity} onChange={setField('quantity')} required className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" />
            </V2Field>
            <V2Field label="Custo unitário (R$)" required>
              <input type="number" min="0" step="0.01" value={form.unit_cost} onChange={setField('unit_cost')} required className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" />
            </V2Field>
            <V2Field label="Fornecedor">
              <V2Input value={form.supplier} onChange={setField('supplier')} maxLength={120} />
            </V2Field>
          </div>
          <V2Field label="Responsável pela compra">
            <V2Input value={form.buyer_name} onChange={setField('buyer_name')} maxLength={80} placeholder="Ex: João" />
          </V2Field>
          <V2Field label="Observação">
            <V2Textarea value={form.notes} onChange={setField('notes')} maxLength={500} rows={2} />
          </V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancelar</V2Button>
            <V2Button type="submit" size="sm" disabled={add.isPending}>
              {add.isPending ? 'Salvando…' : 'Registrar entrada'}
            </V2Button>
          </div>
        </form>
      )}

      <div className="mt-3 space-y-2">
        {isLoading ? <V2Skeleton lines={3} /> : entries.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma entrada registrada.</p>
        ) : (
          entries.map((e) => {
            const product = products.find((p) => p.id === e.product_id);
            return (
              <div key={e.id} className="rounded-2xl border border-green-200 bg-green-50/40 p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-bold text-ink">{product?.name || 'Produto removido'}</div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {e.date} · {e.quantity} {product?.unit || 'un'} × {formatPrice(e.unit_cost)} = <span className="font-bold">{formatPrice(e.total_cost)}</span>
                    </div>
                    {e.supplier && <div className="text-xs text-gray-400">Fornecedor: {e.supplier}</div>}
                    {e.buyer_name && <div className="text-xs text-gray-400">Responsável: {e.buyer_name}</div>}
                    {e.notes && <div className="mt-1 text-xs text-gray-600 italic">&quot;{e.notes}&quot;</div>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </V2Surface>
  );
}

function ExitsSection({ arenaId }) {
  const { data: products = [] } = useInventoryProducts(arenaId);
  const { data: entries = [] } = useInventoryEntries(arenaId);
  const { data: exits = [], isLoading } = useInventoryExits(arenaId);
  const add = useAddInventoryExit(arenaId);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    product_id: '', date: new Date().toISOString().slice(0, 10), quantity: 1, unit_price: 0,
    exit_type: 'sale', buyer_name: '', reason: '',
  });
  const setField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await add.mutateAsync(form);
      toast.success('Saída registrada!');
      setCreating(false);
      setForm({ ...form, quantity: 1, unit_price: 0, reason: '' });
    } catch (err) { toast.error(err.message); }
  }

  // Calcular resumo por produto
  const summary = useMemo(() => {
    const map = new Map();
    for (const p of products) {
      const stock = calculateStock(p.id, entries, exits);
      map.set(p.id, { product: p, ...stock, margin: calculateMargin(stock) });
    }
    return map;
  }, [products, entries, exits]);

  return (
    <V2Surface>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-orange-700" /> Saídas (vendas / consumo / perdas)
        </h3>
        <V2Button size="sm" onClick={() => setCreating(true)} disabled={products.length === 0}>
          <Plus className="h-4 w-4" /> Nova saída
        </V2Button>
      </div>

      {/* Resumo por produto */}
      {products.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from(summary.values()).filter((s) => s.product.active).map((s) => (
            <div key={s.product.id} className={cn('rounded-2xl border p-3',
              s.quantity <= 0 ? 'border-red-200 bg-red-50' :
              s.quantity < 5 ? 'border-amber-200 bg-amber-50/40' :
              'border-green-200 bg-green-50/40',
            )}>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-ink truncate">{s.product.name}</div>
                  <div className="text-[10px] uppercase text-gray-400">{s.product.category}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-xl font-bold text-ink">{s.quantity}</div>
                  <div className="text-[10px] text-gray-400">{s.product.unit}</div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-gray-500">
                <div>Investido: <span className="font-bold text-ink">{formatPrice(s.total_invested)}</span></div>
                <div>Receita: <span className="font-bold text-green-700">{formatPrice(s.total_revenue)}</span></div>
              </div>
              {s.total_invested > 0 && (
                <div className={cn('mt-1 text-xs font-bold', s.margin >= 0 ? 'text-green-700' : 'text-red-600')}>
                  Margem: {s.margin >= 0 ? '+' : ''}{s.margin.toFixed(1)}%
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {creating && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2 rounded-2xl border border-orange-200 bg-orange-50/40 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <V2Field label="Produto" required>
              <V2Select value={form.product_id} onChange={setField('product_id')} required>
                <option value="">— Selecione —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </V2Select>
            </V2Field>
            <V2Field label="Data" required>
              <input type="date" value={form.date} onChange={setField('date')} required className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" />
            </V2Field>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <V2Field label="Quantidade" required>
              <input type="number" min="1" value={form.quantity} onChange={setField('quantity')} required className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" />
            </V2Field>
            <V2Field label="Preço unitário (R$)" required>
              <input type="number" min="0" step="0.01" value={form.unit_price} onChange={setField('unit_price')} required className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" />
            </V2Field>
            <V2Field label="Tipo" required>
              <V2Select value={form.exit_type} onChange={setField('exit_type')}>
                {Object.entries(EXIT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </V2Select>
            </V2Field>
          </div>
          <V2Field label="Comprador / responsável">
            <V2Input value={form.buyer_name} onChange={setField('buyer_name')} maxLength={80} />
          </V2Field>
          <V2Field label="Motivo / observação">
            <V2Input value={form.reason} onChange={setField('reason')} maxLength={200} />
          </V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancelar</V2Button>
            <V2Button type="submit" size="sm" disabled={add.isPending}>
              {add.isPending ? 'Salvando…' : 'Registrar saída'}
            </V2Button>
          </div>
        </form>
      )}

      <div className="mt-3 space-y-2">
        {isLoading ? <V2Skeleton lines={3} /> : exits.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma saída registrada.</p>
        ) : (
          exits.map((x) => {
            const product = products.find((p) => p.id === x.product_id);
            return (
              <div key={x.id} className="rounded-2xl border border-orange-200 bg-orange-50/40 p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-bold text-ink">{product?.name || 'Produto removido'}</div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {x.date} · {x.quantity} × {formatPrice(x.unit_price)} = <span className="font-bold">{formatPrice(x.total_price)}</span>
                    </div>
                    <div className="mt-0.5 text-xs">
                      <V2Badge tone="amber">{EXIT_TYPE_LABELS[x.exit_type] || x.exit_type}</V2Badge>
                      {x.buyer_name && <span className="ml-2 text-gray-400">{x.buyer_name}</span>}
                    </div>
                    {x.reason && <div className="mt-1 text-xs text-gray-600 italic">&quot;{x.reason}&quot;</div>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </V2Surface>
  );
}
