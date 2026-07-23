/**
 * V2ArenaPDV — Loja / PDV da arena.
 *
 * Rota pública: /arenas/:arenaId/loja (atleta compra)
 * Rota admin:   /arenas/:arenaId/gerir/pdv (gestor gerencia)
 *
 * Aditivo.
 */

import React, { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ShoppingBag, Plus, Trash2, Package } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import {
  useCanArenaUseModule, useArenaProducts, useCreateProduct, useDeleteProduct, useCreateSale,
} from '@/modules/arenas/hooks/useArenaV3';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import ConfirmDialog from '@/components/ConfirmDialog';
import { V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';

function ProductCard({ product, onBuy, isBuying }) {
  const inStock = product.stock == null || product.stock > 0;
  return (
    <div className="rounded-2xl border border-gray-100 bg-paper-pure p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h3 className="font-display text-base font-bold text-ink">{product.name}</h3>
          {product.description && <p className="mt-1 text-xs text-gray-500 line-clamp-2">{product.description}</p>}
        </div>
        {product.category && <V2Badge tone="neutral">{product.category}</V2Badge>}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="font-display text-xl font-bold text-ink">{formatPrice(product.price)}</span>
        {product.stock != null && (
          <span className="text-xs text-gray-500">· {product.stock} em estoque</span>
        )}
      </div>
      <V2Button
        size="sm" className="mt-3 w-full"
        onClick={() => onBuy(product)}
        disabled={!inStock || isBuying}
      >
        <ShoppingBag className="mr-1.5 h-4 w-4" /> {inStock ? 'Comprar' : 'Esgotado'}
      </V2Button>
    </div>
  );
}

function CreateProductForm({ arenaId, onClose }) {
  const [form, setForm] = useState({
    name: '', description: '', price: 0, stock: '', category: 'outros',
  });
  const create = useCreateProduct();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, price: Number(form.price) || 0 };
      if (form.stock === '') payload.stock = null;
      else payload.stock = Number(form.stock);
      await create.mutateAsync({ arenaId, input: payload });
      toast.success('Produto criado!');
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-gray-100 bg-paper p-4">
      <h3 className="font-display text-base font-bold text-ink">Novo produto</h3>
      <V2Field label="Nome">
        <V2Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={80} />
      </V2Field>
      <V2Field label="Descrição">
        <V2Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} maxLength={500} />
      </V2Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <V2Field label="Preço (R$)">
          <V2Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
        </V2Field>
        <V2Field label="Estoque">
          <V2Input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="Vazio = sem controle" />
        </V2Field>
        <V2Field label="Categoria">
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm text-ink">
            <option value="bebidas">Bebidas</option>
            <option value="equipamentos">Equipamentos</option>
            <option value="vestuario">Vestuário</option>
            <option value="acessorios">Acessórios</option>
            <option value="alimentos">Alimentos</option>
            <option value="outros">Outros</option>
          </select>
        </V2Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={create.isPending}>{create.isPending ? 'Criando...' : 'Criar'}</V2Button>
      </div>
    </form>
  );
}

export default function V2ArenaPDV() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading: arenaLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const canCatalog = useCanArenaUseModule(arenaId, 'pdv_catalog');
  const { data: products = [], isLoading: productsLoading } = useArenaProducts(arenaId);
  const del = useDeleteProduct();
  const buy = useCreateSale();
  const [showForm, setShowForm] = useState(false);

  if (arenaLoading) return <V2Skeleton className="mx-auto h-96 max-w-[1100px] rounded-4xl" />;
  if (!arena) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface>
          <V2EmptyState title="Arena não encontrada" action={<Link to="/arenas" className="text-sm font-bold text-ink underline">← Voltar</Link>} />
        </V2Surface>
      </div>
    );
  }

  const canManage = arena.owner_id === user?.uid || managed.some((m) => m.id === arena.id) || isPlatformAdmin;
  if (!canCatalog) {
    return (
      <div className="mx-auto max-w-[700px]">
        <div className="mb-4">
          <Link to={`/arenas/${arena.id}`} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Link>
        </div>
        <V2Surface>
          <V2EmptyState icon={ShoppingBag} title="Loja indisponível" description="Esta arena não ativou o módulo de loja." />
        </V2Surface>
      </div>
    );
  }

  const handleBuy = async (product) => {
    if (!user) {
      toast.error('Faça login para comprar.');
      return;
    }
    try {
      await buy.mutateAsync({
        arenaId: arena.id,
        items: [{ product_id: product.id, name: product.name, price: product.price, quantity: 1 }],
        paymentMethod: 'pix',
        splitWith: null,
      });
      toast.success('Compra registrada! Pague na arena.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (product) => {
    try {
      await del.mutateAsync({ prodId: product.id });
      toast.success('Produto excluído');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-6">
        <Link to={canManage ? `/arenas/${arena.id}/gerir` : `/arenas/${arena.id}`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
              Loja · {arena.name}
            </h1>
            <p className="mt-2 font-medium text-gray-500">
              Compre produtos e equipamentos direto pelo app.
            </p>
          </div>
          {canManage && !showForm && (
            <V2Button onClick={() => setShowForm(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Novo produto
            </V2Button>
          )}
        </div>
      </div>

      {showForm && canManage && (
        <div className="mb-6">
          <CreateProductForm arenaId={arena.id} onClose={() => setShowForm(false)} />
        </div>
      )}

      {productsLoading ? (
        <V2Skeleton className="h-40 rounded-2xl" />
      ) : products.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Package}
            title="Loja vazia"
            description={canManage ? 'Cadastre o primeiro produto para começar a vender.' : 'A arena ainda não cadastrou produtos.'}
          />
        </V2Surface>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <div key={product.id}>
              <ProductCard product={product} onBuy={handleBuy} isBuying={buy.isPending} />
              {canManage && (
                <div className="mt-2 flex justify-end">
                  <ConfirmDialog
                    title="Excluir produto?"
                    description={`"${product.name}" será removido do catálogo do PDV.`}
                    confirmLabel="Excluir"
                    onConfirm={() => handleDelete(product)}
                    trigger={(
                      <button
                        type="button"
                        className="text-xs font-bold text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="mr-1 inline h-3 w-3" /> Excluir
                      </button>
                    )}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
