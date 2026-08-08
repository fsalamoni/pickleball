/**
 * AdminCatalogTab — Gestão do CATÁLOGO PADRÃO de produtos (platform_admin).
 *
 * Fica no painel administrativo da plataforma (seção Arenas). Mostra a LISTA
 * COMPLETA (semente sempre disponível + contribuições/edições do Firestore) e
 * permite ao admin adicionar, editar e excluir itens. Não é preciso "popular"
 * nada — a lista padrão está sempre presente para todas as arenas.
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Package, Search, Plus, Pencil, Trash2, Save, X, ShoppingBasket, CheckCircle2,
} from 'lucide-react';
import {
  useCatalogProducts, useCreateCatalogProduct, useUpdateCatalogProduct, useDeleteCatalogProduct,
} from '@/modules/arenas/hooks/useCatalog';
import {
  CATALOG_CATEGORIES_LIST, CATALOG_SUBCATEGORIES, CATALOG_PACKAGINGS,
  filterCatalog, CATALOG_PRODUCT_SOURCE,
} from '@/modules/arenas/domain/productCatalog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { cn } from '@/core/lib/utils';
import {
  V2Badge, V2Button, V2Field, V2Input, V2Select, V2Surface, V2Textarea, V2Skeleton,
} from '@/v2/ui/primitives';

const EMPTY = {
  name: '', category: CATALOG_CATEGORIES_LIST[0], subcategory: '', brand: '',
  packaging: '', size: '', flavor: '', unit: 'un', description: '',
};

export default function AdminCatalogTab() {
  const { data: catalog = [], isLoading } = useCatalogProducts();
  const create = useCreateCatalogProduct();
  const update = useUpdateCatalogProduct();
  const remove = useDeleteCatalogProduct();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [subcategory, setSubcategory] = useState('all');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const subOptions = useMemo(() => {
    if (category === 'all') return Array.from(new Set(catalog.map((p) => p.subcategory).filter(Boolean))).sort();
    return CATALOG_SUBCATEGORIES[category] || [];
  }, [category, catalog]);

  const filtered = useMemo(
    () => filterCatalog(catalog, { query, category, subcategory }),
    [catalog, query, category, subcategory],
  );

  const stats = useMemo(() => {
    const platform = catalog.filter((p) => p.source !== CATALOG_PRODUCT_SOURCE.ARENA).length;
    const arena = catalog.length - platform;
    return { total: catalog.length, platform, arena };
  }, [catalog]);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await create.mutateAsync(form);
      toast.success('Produto adicionado ao catálogo!');
      setForm(EMPTY);
      setCreating(false);
    } catch (err) { toast.error(err.message); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShoppingBasket className="h-5 w-5 text-green-700" />
          <h2 className="font-display text-xl font-bold text-ink">Catálogo de produtos</h2>
        </div>
        <V2Button size="sm" onClick={() => { setForm(EMPTY); setCreating((v) => !v); }}>
          <Plus className="h-4 w-4" /> Novo produto
        </V2Button>
      </div>
      <p className="text-sm text-gray-500">
        Lista geral disponível para todas as arenas montarem o estoque. Está sempre presente — você
        pode adicionar, editar e excluir itens aqui. {stats.total} itens ({stats.platform} padrão · {stats.arena} de arenas).
      </p>

      {creating && (
        <V2Surface className="border-green-200 bg-green-50/30">
          <form onSubmit={handleCreate} className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <V2Field label="Nome" required>
                <V2Input value={form.name} onChange={set('name')} required maxLength={100} placeholder="Ex: Coca-Cola 350ml" />
              </V2Field>
              <V2Field label="Marca">
                <V2Input value={form.brand} onChange={set('brand')} maxLength={60} />
              </V2Field>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <V2Field label="Categoria" required>
                <V2Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, subcategory: '' }))}>
                  {CATALOG_CATEGORIES_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
                </V2Select>
              </V2Field>
              <V2Field label="Subcategoria" required>
                <V2Input list="admin-cat-sub" value={form.subcategory} onChange={set('subcategory')} maxLength={50} />
                <datalist id="admin-cat-sub">
                  {(CATALOG_SUBCATEGORIES[form.category] || []).map((s) => <option key={s} value={s} />)}
                </datalist>
              </V2Field>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <V2Field label="Embalagem">
                <V2Input list="admin-cat-pack" value={form.packaging} onChange={set('packaging')} maxLength={40} />
                <datalist id="admin-cat-pack">
                  {CATALOG_PACKAGINGS.map((s) => <option key={s} value={s} />)}
                </datalist>
              </V2Field>
              <V2Field label="Tamanho/volume">
                <V2Input value={form.size} onChange={set('size')} maxLength={30} placeholder="Ex: 350ml" />
              </V2Field>
              <V2Field label="Sabor/variante">
                <V2Input value={form.flavor} onChange={set('flavor')} maxLength={40} />
              </V2Field>
            </div>
            <V2Field label="Descrição">
              <V2Textarea value={form.description} onChange={set('description')} maxLength={500} rows={2} />
            </V2Field>
            <div className="flex justify-end gap-2">
              <V2Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancelar</V2Button>
              <V2Button type="submit" size="sm" disabled={create.isPending}>
                <Save className="h-4 w-4" /> {create.isPending ? 'Salvando…' : 'Adicionar'}
              </V2Button>
            </div>
          </form>
        </V2Surface>
      )}

      <V2Surface className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <V2Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar..." className="pl-9" />
          </div>
          <V2Select value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory('all'); }}>
            <option value="all">Todas categorias</option>
            {CATALOG_CATEGORIES_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
          </V2Select>
          <V2Select value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
            <option value="all">Todas subcategorias</option>
            {subOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </V2Select>
        </div>
        <p className="text-xs text-gray-400">{filtered.length} produto(s)</p>
      </V2Surface>

      {isLoading ? (
        <V2Skeleton lines={6} />
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, 500).map((p) => (
            <CatalogRow
              key={p.id}
              product={p}
              editing={editingId === p.id}
              onToggleEdit={() => setEditingId(editingId === p.id ? null : p.id)}
              onSave={async (updates) => {
                try {
                  await update.mutateAsync({ product: p, updates });
                  toast.success('Produto atualizado!');
                  setEditingId(null);
                } catch (err) { toast.error(err.message); }
              }}
              onDelete={async () => {
                try {
                  await remove.mutateAsync(p);
                  toast.success('Produto removido do catálogo.');
                } catch (err) { toast.error(err.message); }
              }}
              saving={update.isPending}
            />
          ))}
          {filtered.length > 500 && (
            <p className="py-2 text-center text-xs text-gray-400">Mostrando 500 de {filtered.length}. Refine a busca para ver os demais.</p>
          )}
        </div>
      )}
    </div>
  );
}

function CatalogRow({ product: p, editing, onToggleEdit, onSave, onDelete, saving }) {
  const [edit, setEdit] = useState({
    name: p.name || '', brand: p.brand || '', subcategory: p.subcategory || '',
    packaging: p.packaging || '', size: p.size || '', flavor: p.flavor || '', description: p.description || '',
  });
  const isArena = p.source === CATALOG_PRODUCT_SOURCE.ARENA;
  const packInfo = [p.packaging, p.size].filter(Boolean).join(' ');

  return (
    <div className={cn('rounded-2xl border p-3', editing ? 'border-green-300 bg-green-50/40' : 'border-gray-100 bg-paper')}>
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid">
          <Package className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-bold text-ink">{p.name}</span>
            {isArena ? <V2Badge tone="amber">de arena</V2Badge> : <V2Badge tone="neutral"><CheckCircle2 className="mr-1 h-3 w-3" />padrão</V2Badge>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-gray-500">
            {p.brand && <span>{p.brand}</span>}
            <V2Badge tone="blue">{p.category}</V2Badge>
            {p.subcategory && <span>· {p.subcategory}</span>}
            {packInfo && <span>· {packInfo}</span>}
          </div>
        </div>
        <button type="button" onClick={onToggleEdit} className="shrink-0 text-gray-500 hover:text-ink" aria-label={`Editar ${p.name}`}>
          {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
        </button>
        <ConfirmDialog
          title="Excluir do catálogo?"
          description={`"${p.name}" deixará de aparecer para as arenas. Produtos já adicionados aos mercados não são afetados.`}
          confirmLabel="Excluir"
          onConfirm={onDelete}
          trigger={(
            <button type="button" className="shrink-0 text-red-500 hover:text-red-700" aria-label={`Excluir ${p.name}`}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        />
      </div>

      {editing && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <V2Field label="Nome"><V2Input value={edit.name} onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))} maxLength={100} /></V2Field>
            <V2Field label="Marca"><V2Input value={edit.brand} onChange={(e) => setEdit((s) => ({ ...s, brand: e.target.value }))} maxLength={60} /></V2Field>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <V2Field label="Subcategoria"><V2Input value={edit.subcategory} onChange={(e) => setEdit((s) => ({ ...s, subcategory: e.target.value }))} maxLength={50} /></V2Field>
            <V2Field label="Embalagem"><V2Input value={edit.packaging} onChange={(e) => setEdit((s) => ({ ...s, packaging: e.target.value }))} maxLength={40} /></V2Field>
            <V2Field label="Tamanho"><V2Input value={edit.size} onChange={(e) => setEdit((s) => ({ ...s, size: e.target.value }))} maxLength={30} /></V2Field>
            <V2Field label="Sabor"><V2Input value={edit.flavor} onChange={(e) => setEdit((s) => ({ ...s, flavor: e.target.value }))} maxLength={40} /></V2Field>
          </div>
          <div className="flex justify-end">
            <V2Button size="sm" disabled={saving} onClick={() => onSave(edit)}>
              <Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar'}
            </V2Button>
          </div>
        </div>
      )}
    </div>
  );
}
