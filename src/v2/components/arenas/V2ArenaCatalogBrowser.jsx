/**
 * V2ArenaCatalogBrowser — Catálogo padrão de produtos (flag arena_product_catalog).
 *
 * A arena navega/busca a listagem geral da plataforma e "puxa" um produto para
 * o seu mercado, preenchendo apenas as variáveis do próprio negócio (preço de
 * compra/venda, quantidade inicial, estoque mínimo, validade). Também pode
 * CONTRIBUIR um produto novo ao catálogo — com verificação de duplicidade antes
 * de inserir.
 *
 * Sem Radix Dialog de propósito: usa painéis inline (evita sobreposição de
 * overlays e mantém o toque/clique 100% acessível no mobile).
 */

import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Package, Search, Plus, Check, ShoppingBasket, Sparkles, AlertTriangle,
  X, PackagePlus, Database,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  useCatalogProducts, useAdoptCatalogProduct, useAdoptManyCatalogProducts,
  useProposeCatalogProduct, useSeedCatalog, checkCatalogDuplicates,
} from '@/modules/arenas/hooks/useCatalog';
import { useInventoryProducts } from '@/modules/arenas/hooks/useArenas';
import {
  CATALOG_CATEGORIES_LIST, CATALOG_SUBCATEGORIES, CATALOG_PACKAGINGS,
  filterCatalog, catalogProductLabel, findDuplicates,
} from '@/modules/arenas/domain/productCatalog';
import { catalogSeedCount } from '@/modules/arenas/domain/catalogSeed';
import { cn } from '@/core/lib/utils';
import {
  V2Badge, V2Button, V2Field, V2Input, V2Select, V2Surface, V2Textarea,
  V2EmptyState, V2Skeleton,
} from '@/v2/ui/primitives';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function V2ArenaCatalogBrowser() {
  const { arenaId } = useParams();
  const { isPlatformAdmin } = useAuth();
  const { data: catalog = [], isLoading } = useCatalogProducts();
  const { data: myProducts = [] } = useInventoryProducts(arenaId);
  const seed = useSeedCatalog();
  const adoptMany = useAdoptManyCatalogProducts(arenaId);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [subcategory, setSubcategory] = useState('all');
  const [adopting, setAdopting] = useState(null); // produto do catálogo em adoção
  const [suggesting, setSuggesting] = useState(false);
  const [selected, setSelected] = useState(() => new Set()); // ids selecionados p/ lote

  const adoptedCatalogIds = useMemo(
    () => new Set(myProducts.map((p) => p.catalog_id).filter(Boolean)),
    [myProducts],
  );

  const subOptions = useMemo(() => {
    if (category === 'all') {
      return Array.from(new Set(catalog.map((p) => p.subcategory).filter(Boolean))).sort();
    }
    return CATALOG_SUBCATEGORIES[category] || [];
  }, [category, catalog]);

  const filtered = useMemo(
    () => filterCatalog(catalog, { query, category, subcategory }),
    [catalog, query, category, subcategory],
  );

  // Produtos filtrados que ainda NÃO estão no mercado (candidatos ao lote).
  const selectableFiltered = useMemo(
    () => filtered.filter((p) => !adoptedCatalogIds.has(p.id)),
    [filtered, adoptedCatalogIds],
  );
  const selectedCount = selected.size;
  const allFilteredSelected = selectableFiltered.length > 0 && selectableFiltered.every((p) => selected.has(p.id));

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      selectableFiltered.forEach((p) => next.add(p.id));
      return next;
    });
  }
  function clearSelection() { setSelected(new Set()); }

  async function handleBulkAdd() {
    const byId = new Map(catalog.map((p) => [p.id, p]));
    const products = Array.from(selected).map((id) => byId.get(id)).filter(Boolean);
    if (products.length === 0) return;
    try {
      const r = await adoptMany.mutateAsync(products);
      toast.success(`${r.created} produto(s) adicionado(s) ao seu mercado${r.skipped ? ` · ${r.skipped} já existiam` : ''}. Defina preço e quantidade na aba Mercado.`);
      clearSelection();
    } catch (err) {
      toast.error(err.message || 'Não foi possível adicionar em lote.');
    }
  }

  async function handleSeed() {
    try {
      const r = await seed.mutateAsync();
      toast.success(`Catálogo populado: ${r.created} novos, ${r.skipped} já existiam.`);
    } catch (err) {
      toast.error(err.message || 'Não foi possível popular o catálogo.');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShoppingBasket className="h-5 w-5 text-green-700" />
          <h2 className="font-display text-xl font-bold text-ink">Catálogo de produtos</h2>
        </div>
        <V2Button size="sm" variant="secondary" onClick={() => setSuggesting((s) => !s)}>
          <PackagePlus className="h-4 w-4" /> Sugerir produto novo
        </V2Button>
      </div>
      <p className="text-sm text-gray-500">
        Esta é a <strong>lista geral</strong> da plataforma (não é o seu estoque). Marque os produtos que a
        sua arena vende e clique em <strong>Adicionar ao meu mercado</strong> — pode selecionar vários (ou
        todos) de uma vez. Depois é só definir preço e quantidade na aba Mercado. Não achou? Sugira um
        produto novo (a plataforma verifica se ele já não existe com outro nome).
      </p>

      {suggesting && (
        <SuggestForm
          arenaId={arenaId}
          catalog={catalog}
          onClose={() => setSuggesting(false)}
        />
      )}

      {/* Filtros */}
      <V2Surface className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <V2Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, marca, sabor..." className="pl-9" />
          </div>
          <V2Select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setSubcategory('all'); }}
            aria-label="Categoria"
          >
            <option value="all">Todas categorias</option>
            {CATALOG_CATEGORIES_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
          </V2Select>
          <V2Select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} aria-label="Subcategoria">
            <option value="all">Todas subcategorias</option>
            {subOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </V2Select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-400">
            {filtered.length} no catálogo · {selectableFiltered.length} fora do seu mercado
          </p>
          {selectableFiltered.length > 0 && (
            <button
              type="button"
              onClick={allFilteredSelected ? clearSelection : selectAllFiltered}
              className="text-xs font-bold text-green-700 hover:underline"
            >
              {allFilteredSelected ? 'Limpar seleção' : `Selecionar todos (${selectableFiltered.length})`}
            </button>
          )}
        </div>
      </V2Surface>

      {/* Barra de ação em lote — adiciona vários de uma vez ao mercado. */}
      {selectedCount > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-green-300 bg-green-50 p-3 shadow-organic-sm">
          <span className="text-sm font-bold text-ink">
            {selectedCount} produto(s) selecionado(s)
          </span>
          <div className="flex items-center gap-2">
            <V2Button size="sm" variant="ghost" onClick={clearSelection}>Limpar</V2Button>
            <V2Button size="sm" onClick={handleBulkAdd} disabled={adoptMany.isPending}>
              <Plus className="h-4 w-4" />
              {adoptMany.isPending ? 'Adicionando…' : `Adicionar ${selectedCount} ao meu mercado`}
            </V2Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <V2Skeleton lines={4} />
      ) : catalog.length === 0 ? (
        <V2EmptyState
          icon={Database}
          title="Catálogo ainda vazio"
          description={isPlatformAdmin
            ? 'Popule o catálogo padrão com centenas de produtos prontos para as arenas usarem.'
            : 'O catálogo padrão ainda não foi carregado. Você já pode cadastrar produtos próprios na aba Mercado, ou sugerir um produto novo aqui.'}
          action={isPlatformAdmin ? (
            <V2Button onClick={handleSeed} disabled={seed.isPending}>
              <Sparkles className="h-4 w-4" />
              {seed.isPending ? 'Populando…' : `Popular catálogo padrão (${catalogSeedCount()} itens)`}
            </V2Button>
          ) : undefined}
        />
      ) : filtered.length === 0 ? (
        <V2EmptyState icon={Search} title="Nada encontrado" description="Ajuste a busca ou os filtros — ou sugira um produto novo." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.slice(0, 400).map((p) => {
            const adopted = adoptedCatalogIds.has(p.id);
            const isAdopting = adopting?.id === p.id;
            const isSelected = selected.has(p.id);
            return (
              <div key={p.id} className={cn('rounded-2xl border p-3 transition-colors', isAdopting || isSelected ? 'border-green-300 bg-green-50/40' : 'border-gray-100 bg-paper')}>
                <div className="flex items-start gap-2">
                  {adopted ? (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid">
                      <Package className="h-4 w-4" />
                    </div>
                  ) : (
                    <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-gray-200 bg-paper-pure" title="Selecionar para adicionar em lote">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(p.id)}
                        className="h-4 w-4 accent-ink"
                        aria-label={`Selecionar ${p.name}`}
                      />
                    </label>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-ink">{p.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-gray-500">
                      <V2Badge tone="blue">{p.category}</V2Badge>
                      {p.subcategory && <V2Badge tone="neutral">{p.subcategory}</V2Badge>}
                      {p.packaging && <span>{p.packaging}{p.size ? ` · ${p.size}` : ''}</span>}
                    </div>
                    {p.brand && <div className="mt-0.5 text-xs text-gray-400">Marca: {p.brand}</div>}
                  </div>
                  {adopted ? (
                    <V2Badge tone="green"><Check className="mr-1 h-3 w-3" /> No seu mercado</V2Badge>
                  ) : (
                    <V2Button size="sm" variant={isAdopting ? 'ghost' : 'secondary'} onClick={() => setAdopting(isAdopting ? null : p)}>
                      {isAdopting ? 'Fechar' : <><Plus className="h-4 w-4" /> Adicionar</>}
                    </V2Button>
                  )}
                </div>
                {isAdopting && (
                  <AdoptForm
                    arenaId={arenaId}
                    product={p}
                    onDone={() => setAdopting(null)}
                  />
                )}
              </div>
            );
          })}
          {filtered.length > 400 && (
            <p className="sm:col-span-2 py-2 text-center text-xs text-gray-400">
              Mostrando 400 de {filtered.length}. Refine os filtros para ver os demais — ou use
              &quot;Selecionar todos&quot; para adicioná-los em lote de uma vez.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Formulário inline para puxar um produto do catálogo ao mercado da arena. */
function AdoptForm({ arenaId, product, onDone }) {
  const adopt = useAdoptCatalogProduct(arenaId);
  const [form, setForm] = useState({
    purchase_price: '', sale_price: '', initial_quantity: '', min_stock: '', expiry_date: '', supplier: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    try {
      await adopt.mutateAsync({
        catalogProduct: product,
        arenaFields: {
          purchase_price: form.purchase_price === '' ? 0 : Number(form.purchase_price),
          sale_price: form.sale_price === '' ? undefined : Number(form.sale_price),
          initial_quantity: form.initial_quantity === '' ? 0 : Number(form.initial_quantity),
          min_stock: form.min_stock === '' ? undefined : Number(form.min_stock),
          expiry_date: form.expiry_date || undefined,
          supplier: form.supplier,
        },
      });
      toast.success(`"${product.name}" adicionado ao seu mercado!`);
      onDone?.();
    } catch (err) {
      toast.error(err.message || 'Não foi possível adicionar.');
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 border-t border-green-200 pt-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <V2Field label="Preço de venda (R$)">
          <input type="number" min="0" step="0.01" value={form.sale_price} onChange={set('sale_price')} className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" placeholder="Ex: 6,00" />
        </V2Field>
        <V2Field label="Preço de compra (R$)">
          <input type="number" min="0" step="0.01" value={form.purchase_price} onChange={set('purchase_price')} className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" placeholder="Ex: 3,50" />
        </V2Field>
        <V2Field label="Qtd. inicial">
          <input type="number" min="0" value={form.initial_quantity} onChange={set('initial_quantity')} className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" placeholder="Ex: 24" />
        </V2Field>
        <V2Field label="Estoque mínimo">
          <input type="number" min="0" value={form.min_stock} onChange={set('min_stock')} className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" placeholder="Ex: 6" />
        </V2Field>
        <V2Field label="Validade">
          <input type="date" value={form.expiry_date} onChange={set('expiry_date')} min={todayStr()} className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" />
        </V2Field>
        <V2Field label="Fornecedor">
          <V2Input value={form.supplier} onChange={set('supplier')} maxLength={120} placeholder="Opcional" />
        </V2Field>
      </div>
      <p className="text-[11px] text-gray-400">
        Só o preço de venda é recomendado para vender no PDV. A quantidade inicial registra uma entrada de estoque.
      </p>
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancelar</V2Button>
        <V2Button type="submit" size="sm" disabled={adopt.isPending}>
          <Plus className="h-4 w-4" /> {adopt.isPending ? 'Adicionando…' : 'Adicionar ao mercado'}
        </V2Button>
      </div>
    </form>
  );
}

/** Formulário inline para sugerir/contribuir um produto novo ao catálogo geral. */
function SuggestForm({ arenaId, catalog, onClose }) {
  const propose = useProposeCatalogProduct(arenaId);
  const [form, setForm] = useState({
    name: '', category: CATALOG_CATEGORIES_LIST[0], subcategory: '', brand: '', packaging: '', size: '', flavor: '', description: '',
  });
  const [dupes, setDupes] = useState(null); // null=não checou; []=sem dupes; [..]=possíveis
  const [checking, setChecking] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const localMatches = useMemo(() => {
    if (!form.name || !form.subcategory) return [];
    return findDuplicates(form, catalog, { threshold: 0.5 });
  }, [form, catalog]);

  async function runCheck() {
    setChecking(true);
    try {
      const { matches } = await checkCatalogDuplicates(form, catalog);
      setDupes(matches);
      if (matches.length === 0) toast.success('Nenhum parecido encontrado. Pode cadastrar!');
    } catch {
      setDupes(localMatches);
    } finally {
      setChecking(false);
    }
  }

  async function submit(force) {
    try {
      await propose.mutateAsync({ input: form, existing: catalog, force });
      toast.success('Produto adicionado ao catálogo geral. Obrigado por contribuir!');
      onClose?.();
    } catch (err) {
      if (err.code === 'duplicate') {
        setDupes(findDuplicates(form, catalog, { threshold: 0.5 }));
        toast.error('Esse produto parece já existir. Confira os parecidos abaixo.');
      } else {
        toast.error(err.message || 'Não foi possível cadastrar.');
      }
    }
  }

  const subList = CATALOG_SUBCATEGORIES[form.category] || [];
  const canSubmit = form.name.trim() && form.subcategory.trim();

  return (
    <V2Surface className="border-green-200 bg-green-50/30">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <PackagePlus className="h-4 w-4 text-green-700" /> Sugerir produto ao catálogo
        </h3>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-ink" aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <V2Field label="Nome do produto" required>
            <V2Input value={form.name} onChange={set('name')} maxLength={100} placeholder="Ex: Coca-Cola 350ml" />
          </V2Field>
          <V2Field label="Marca">
            <V2Input value={form.brand} onChange={set('brand')} maxLength={60} placeholder="Ex: Coca-Cola" />
          </V2Field>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <V2Field label="Categoria" required>
            <V2Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, subcategory: '' }))}>
              {CATALOG_CATEGORIES_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
            </V2Select>
          </V2Field>
          <V2Field label="Subcategoria" required>
            <V2Input list="catalog-sub-options" value={form.subcategory} onChange={set('subcategory')} maxLength={50} placeholder="Ex: Refrigerante" />
            <datalist id="catalog-sub-options">
              {subList.map((s) => <option key={s} value={s} />)}
            </datalist>
          </V2Field>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <V2Field label="Embalagem">
            <V2Input list="catalog-pack-options" value={form.packaging} onChange={set('packaging')} maxLength={40} placeholder="Ex: Lata" />
            <datalist id="catalog-pack-options">
              {CATALOG_PACKAGINGS.map((s) => <option key={s} value={s} />)}
            </datalist>
          </V2Field>
          <V2Field label="Tamanho/volume">
            <V2Input value={form.size} onChange={set('size')} maxLength={30} placeholder="Ex: 350ml, 100g" />
          </V2Field>
          <V2Field label="Sabor/variante">
            <V2Input value={form.flavor} onChange={set('flavor')} maxLength={40} placeholder="Ex: Zero, Uva" />
          </V2Field>
        </div>
        <V2Field label="Descrição">
          <V2Textarea value={form.description} onChange={set('description')} maxLength={500} rows={2} />
        </V2Field>

        {/* Aviso de possíveis duplicatas (verificação local em tempo real) */}
        {canSubmit && localMatches.length > 0 && dupes === null && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Talvez já exista:</div>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {localMatches.slice(0, 4).map((m) => <li key={m.product.id}>{catalogProductLabel(m.product)}</li>)}
            </ul>
          </div>
        )}

        {dupes !== null && (
          dupes.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Produtos parecidos no catálogo:</div>
              <ul className="mt-1 space-y-0.5 text-xs">
                {dupes.slice(0, 6).map((m) => (
                  <li key={m.product.id} className="flex items-center justify-between gap-2">
                    <span>{catalogProductLabel(m.product)}</span>
                    <span className="text-amber-600">{m.exact ? 'idêntico' : `${Math.round(m.score * 100)}%`}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs">
                Se algum for o mesmo produto, use-o direto no catálogo. Se o seu é realmente diferente, confirme abaixo.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              Nenhum produto parecido encontrado — pode cadastrar com segurança.
            </div>
          )
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <V2Button type="button" variant="secondary" size="sm" onClick={runCheck} disabled={!canSubmit || checking}>
            <Search className="h-4 w-4" /> {checking ? 'Verificando…' : 'Verificar duplicidade'}
          </V2Button>
          {dupes !== null && dupes.length > 0 ? (
            <V2Button type="button" size="sm" onClick={() => submit(true)} disabled={propose.isPending}>
              É diferente — cadastrar mesmo assim
            </V2Button>
          ) : (
            <V2Button type="button" size="sm" onClick={() => submit(false)} disabled={!canSubmit || propose.isPending}>
              <Plus className="h-4 w-4" /> {propose.isPending ? 'Cadastrando…' : 'Cadastrar no catálogo'}
            </V2Button>
          )}
        </div>
      </div>
    </V2Surface>
  );
}
