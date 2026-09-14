/**
 * V2ArenaPDV — a loja da arena.
 *
 * Rotas: `/arenas/:arenaId/loja` (atleta) · `/arenas/:arenaId/gerir/pdv` (arena)
 * Módulos: `pdv` (+ `pdv_catalog`, `pdv_pix_native`, `pdv_split`).
 *
 * ## 🐞 Três defeitos que impediam a loja de existir
 *
 * **1. O atleta não conseguia comprar.** A compra dava baixa no estoque
 * escrevendo em `arena_products`, e a regra só deixa o GESTOR escrever ali. A
 * venda era gravada e a escrita seguinte era recusada: sobrava uma venda
 * fantasma e um erro na tela. Agora a baixa acontece na **entrega pela
 * arena** — a mesma decisão das horas de pacote da Onda AI.
 *
 * **2. Dividir a conta não funcionava.** O comprador criava um pagamento para
 * cada participante, com `payer_id` de outra pessoa; a regra exige
 * `payer_id == uid`, e como era um lote atômico a recusa derrubava até o
 * pagamento do próprio comprador. Agora cada um grava o seu, e quem entra na
 * divisão **é avisado** — sem o aviso, "dividir a conta" seria o comprador
 * cobrando os amigos por fora, que é o que a funcionalidade promete resolver.
 *
 * **3. A lista de vendas não ordenava.** Ordenava por `created_at_ms`, campo
 * que nunca era gravado: o caixa saía em ordem arbitrária.
 *
 * ## A tela
 *
 * Para o **atleta**, uma vitrine e um carrinho — e as compras dele, com a
 * chave Pix da arena quando há uma. Para a **arena**, o balcão: o que está
 * pendente de entrega em cima, o catálogo embaixo.
 */

import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, Check, Copy, Minus, Package, Pencil, Plus,
  QrCode, ShoppingBag, Trash2, Users, X,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import {
  useArenaProducts, useCreateProduct, useUpdateProduct, useDeleteProduct,
  useCreateSale, useArenaSales, useMySales, useConfirmSale, useCancelSale,
  usePayMyShare,
} from '@/modules/arenas/hooks/useArenaV3';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import {
  PRODUCT_CATEGORIES, SALE_STATUS, calculateCartTotal, hasStock, splitAmount,
} from '@/modules/arenas/domain/pdv';
import { myShareOf } from '@/modules/arenas/services/pdvService';
import { isPixConfigured, PIX_KEY_TYPE_LABELS } from '@/modules/arenas/domain/pix_payment';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Avatar, V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton,
  V2Surface, V2Textarea,
} from '@/v2/ui/primitives';

const CATEGORIA_LABEL = {
  [PRODUCT_CATEGORIES.BEBIDAS]: 'Bebidas',
  [PRODUCT_CATEGORIES.ALIMENTOS]: 'Alimentos',
  [PRODUCT_CATEGORIES.EQUIPAMENTOS]: 'Equipamentos',
  [PRODUCT_CATEGORIES.VESTUARIO]: 'Vestuário',
  [PRODUCT_CATEGORIES.ACESSORIOS]: 'Acessórios',
  [PRODUCT_CATEGORIES.OUTROS]: 'Outros',
};

/** `Timestamp | number` → 'YYYY-MM-DD'. */
function isoDe(v) {
  const ms = Number(v?.created_at_ms)
    || (v?.created_at?.toMillis ? v.created_at.toMillis() : null)
    || (v?.created_at?.seconds ? v.created_at.seconds * 1000 : null);
  if (!ms) return null;
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ======================================================= 1. VITRINE ===== */

function CartaoDoProduto({ product, quantidade, onAdd, onRemove }) {
  const temEstoque = hasStock(product, 1);
  return (
    <div className={`rounded-2xl border p-3 ${temEstoque ? 'border-gray-100 bg-paper' : 'border-gray-100 bg-gray-50 opacity-70'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-ink">{product.name}</p>
          {product.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{product.description}</p>
          )}
          <p className="mt-1 flex flex-wrap gap-1.5 text-xs text-gray-500">
            <V2Badge tone="neutral">{CATEGORIA_LABEL[product.category] || 'Outros'}</V2Badge>
            {product.stock != null && (
              <V2Badge tone={temEstoque ? 'neutral' : 'red'}>
                {temEstoque ? `${product.stock} em estoque` : 'Esgotado'}
              </V2Badge>
            )}
          </p>
        </div>
        <p className="shrink-0 font-display text-lg font-bold text-ink">{formatPrice(product.price)}</p>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1.5">
        {quantidade > 0 && (
          <>
            <button type="button" onClick={() => onRemove(product)} aria-label={`Tirar um ${product.name}`}
              className="rounded-full border border-gray-200 bg-paper-pure p-1.5 text-ink hover:border-ink">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-6 text-center font-bold text-ink">{quantidade}</span>
          </>
        )}
        <button type="button" disabled={!temEstoque} onClick={() => onAdd(product)}
          aria-label={`Colocar um ${product.name} no carrinho`}
          className="rounded-full border border-gray-200 bg-paper-pure p-1.5 text-ink hover:border-ink disabled:opacity-40">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Carrinho({ arena, itens, onLimpar, onQuitar, temSplit }) {
  const { data: atletas = [] } = useAthletes();
  const { user } = useAuth();
  const comprar = useCreateSale();
  const [dividirCom, setDividirCom] = useState([]);
  const [busca, setBusca] = useState('');

  const lista = useMemo(
    () => Object.values(itens).filter((i) => i.quantity > 0),
    [itens],
  );
  const total = calculateCartTotal(lista);

  // O comprador SEMPRE entra na divisão: dividir uma conta em que quem comprou
  // não paga nada é o começo de uma discussão no vestiário.
  const participantes = useMemo(
    () => [user?.uid, ...dividirCom].filter(Boolean),
    [user?.uid, dividirCom],
  );
  const partes = participantes.length > 1 ? splitAmount(total, participantes) : null;
  const minhaParte = partes ? partes.find((p) => p.user_id === user?.uid)?.amount : total;

  const resultados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return [];
    return atletas
      .filter((a) => a.id !== user?.uid && !dividirCom.includes(a.id))
      .filter((a) => `${a.platform_name || ''} ${a.full_name || ''}`.toLowerCase().includes(termo))
      .slice(0, 5);
  }, [atletas, busca, dividirCom, user?.uid]);

  const finalizar = async () => {
    try {
      await comprar.mutateAsync({
        arenaId: arena.id,
        items: lista.map((i) => ({
          product_id: i.product_id, name: i.name, price: i.price, quantity: i.quantity,
        })),
        paymentMethod: 'pix',
        splitWith: participantes.length > 1 ? participantes : [],
      });
      toast.success(participantes.length > 1
        ? 'Compra registrada e a turma foi avisada da parte dela.'
        : 'Compra registrada! Retire no balcão.');
      onQuitar();
      setDividirCom([]);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível registrar a compra.');
    }
  };

  if (lista.length === 0) return null;

  return (
    <V2Surface className="sticky bottom-4 border-ink/20 shadow-organic">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <ShoppingBag className="h-4 w-4" /> Seu carrinho
        </h2>
        <V2Button size="sm" variant="ghost" onClick={onLimpar}>Limpar</V2Button>
      </div>

      <ul className="space-y-1">
        {lista.map((i) => (
          <li key={i.product_id} className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{i.quantity}× {i.name}</span>
            <span className="font-bold text-ink">{formatPrice(i.price * i.quantity)}</span>
          </li>
        ))}
      </ul>

      {temSplit && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">
            <Users className="h-3.5 w-3.5" /> Dividir com
          </p>
          {dividirCom.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {dividirCom.map((uid) => {
                const a = atletas.find((x) => x.id === uid);
                return (
                  <span key={uid} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-paper py-0.5 pl-0.5 pr-1 text-xs text-ink">
                    <V2Avatar photoUrl={a?.photo_url} name={a?.platform_name || a?.full_name} size="xs" />
                    {a?.platform_name || a?.full_name || 'Atleta'}
                    <button type="button" aria-label="Tirar da divisão"
                      onClick={() => setDividirCom((d) => d.filter((x) => x !== uid))}
                      className="rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <V2Input value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar quem divide a conta…" />
          {resultados.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {resultados.map((a) => (
                <button key={a.id} type="button"
                  onClick={() => { setDividirCom((d) => [...d, a.id]); setBusca(''); }}
                  className="flex w-full items-center gap-2 rounded-xl border border-gray-100 bg-paper p-2 text-left text-sm hover:border-gray-300">
                  <V2Avatar photoUrl={a.photo_url} name={a.platform_name || a.full_name} size="xs" />
                  {a.platform_name || a.full_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-gray-100 pt-3">
        <div>
          <p className="text-xs text-gray-500">
            {partes ? `Total ${formatPrice(total)} entre ${partes.length} pessoas` : 'Total'}
          </p>
          <p className="font-display text-2xl font-bold text-ink">
            {formatPrice(minhaParte)}
            {partes && <span className="ml-1 text-sm font-medium text-gray-500">a sua parte</span>}
          </p>
        </div>
        <V2Button disabled={comprar.isPending} onClick={finalizar}>
          {comprar.isPending ? 'Registrando…' : 'Fechar a compra'}
        </V2Button>
      </div>

      <p className="mt-2 text-xs text-gray-500">
        A arena entrega no balcão e confirma. O estoque só baixa na entrega.
      </p>
    </V2Surface>
  );
}

/* ======================================================= 2. MINHAS ====== */

function ChavePix({ arena }) {
  const payment = arena?.payment;
  if (!isPixConfigured(payment) || payment.active === false) return null;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(payment.pix_key);
      toast.success('Chave Pix copiada.');
    } catch {
      toast.error(`Não foi possível copiar. A chave é: ${payment.pix_key}`);
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-gray-100 bg-paper p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">
        <QrCode className="h-3.5 w-3.5" /> Pague por Pix
      </p>
      {payment.pix_key && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="rounded-xl bg-paper-pure px-3 py-1.5 text-sm text-ink">{payment.pix_key}</code>
          <V2Badge tone="neutral">
            {PIX_KEY_TYPE_LABELS[payment.pix_key_type] || payment.pix_key_type}
          </V2Badge>
          <V2Button size="sm" variant="ghost" onClick={copiar}>
            <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
          </V2Button>
        </div>
      )}
      {payment.receiver_name && (
        <p className="mt-1 text-xs text-gray-500">Recebedor: <strong className="text-ink">{payment.receiver_name}</strong></p>
      )}
      {payment.qr_code_url && (
        <img src={payment.qr_code_url} alt="QR Code Pix da arena"
          className="mt-2 h-40 w-40 rounded-xl border border-gray-100 object-contain" />
      )}
    </div>
  );
}

function MinhasCompras({ arena, temPix }) {
  const { user } = useAuth();
  const { data: compras = [], isLoading } = useMySales(arena.id);
  const pagarParte = usePayMyShare();

  if (isLoading) return <V2Skeleton className="h-24 rounded-4xl" />;
  if (compras.length === 0) return null;

  return (
    <V2Surface className="mb-6">
      <h2 className="mb-3 font-display text-base font-bold text-ink">Suas compras aqui</h2>
      <div className="space-y-2">
        {compras.slice(0, 8).map((v) => {
          const minha = myShareOf(v, user?.uid);
          const dividida = Array.isArray(v.split_details) && v.split_details.length > 1;
          return (
            <div key={v.id} className="rounded-2xl border border-gray-100 bg-paper p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-600">
                    {(v.items || []).map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {isoDe(v) ? formatDateShortBR(isoDe(v)) : ''}
                    {dividida ? ` · dividida entre ${v.split_details.length}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-base font-bold text-ink">{formatPrice(minha ?? v.total)}</p>
                  <V2Badge tone={v.status === SALE_STATUS.PAID ? 'green' : v.status === SALE_STATUS.CANCELLED ? 'neutral' : 'amber'}>
                    {v.status === SALE_STATUS.PAID ? 'Paga' : v.status === SALE_STATUS.CANCELLED ? 'Cancelada' : 'Em aberto'}
                  </V2Badge>
                </div>
              </div>
              {/* Quem entrou na divisão sem ser o comprador registra a parte dele. */}
              {dividida && v.buyer_id !== user?.uid && v.status !== SALE_STATUS.CANCELLED && (
                <V2Button size="sm" variant="ghost" className="mt-2" disabled={pagarParte.isPending}
                  onClick={() => pagarParte.mutateAsync({ arenaId: arena.id, saleId: v.id })
                    .then(() => toast.success('Sua parte foi registrada. Acerte com a arena.'))
                    .catch((e) => toast.error(e?.message || 'Não foi possível registrar.'))}>
                  Registrar a minha parte
                </V2Button>
              )}
            </div>
          );
        })}
      </div>
      {temPix && <ChavePix arena={arena} />}
    </V2Surface>
  );
}

/* ========================================================= 3. BALCÃO === */

function ProdutoForm({ arenaId, product, onClose }) {
  const [form, setForm] = useState(() => ({
    name: product?.name || '',
    description: product?.description || '',
    category: product?.category || PRODUCT_CATEGORIES.BEBIDAS,
    price: product?.price ?? 8,
    stock: product?.stock ?? '',
    active: product?.active !== false,
  }));
  const criar = useCreateProduct();
  const editar = useUpdateProduct();
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    const input = {
      ...form,
      price: Number(form.price),
      stock: form.stock === '' ? null : Number(form.stock),
    };
    try {
      if (product) await editar.mutateAsync({ arenaId, prodId: product.id, updates: input });
      else await criar.mutateAsync({ arenaId, input });
      toast.success(product ? 'Produto atualizado.' : 'Produto publicado.');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    }
  };

  return (
    <form onSubmit={submit} className="mb-4 rounded-2xl border border-gray-100 bg-paper p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink">
          {product ? `Editar ${product.name}` : 'Novo produto'}
        </h3>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <V2Field label="Nome" htmlFor="pd-nome" className="lg:col-span-2">
          <V2Input id="pd-nome" required maxLength={80} placeholder="Ex.: Água 500ml"
            value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </V2Field>
        <V2Field label="Categoria" htmlFor="pd-cat">
          <select id="pd-cat" value={form.category} onChange={(e) => set({ category: e.target.value })}
            className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm">
            {Object.entries(CATEGORIA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </V2Field>
        <V2Field label="Preço (R$)" htmlFor="pd-preco">
          <V2Input id="pd-preco" type="number" min="0" step="0.01" required
            value={form.price} onChange={(e) => set({ price: e.target.value })} />
        </V2Field>
        <V2Field label="Estoque" htmlFor="pd-estoque" hint="Vazio = sem controle." className="lg:col-span-2">
          <V2Input id="pd-estoque" type="number" min="0" placeholder="Sem controle"
            value={form.stock} onChange={(e) => set({ stock: e.target.value })} />
        </V2Field>
      </div>
      <V2Field label="Descrição" htmlFor="pd-desc" className="mt-3">
        <V2Textarea id="pd-desc" rows={2} maxLength={300}
          value={form.description} onChange={(e) => set({ description: e.target.value })} />
      </V2Field>
      <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={form.active} className="h-4 w-4 rounded border-gray-300"
          onChange={(e) => set({ active: e.target.checked })} />
        À venda
      </label>
      <div className="mt-3 flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={criar.isPending || editar.isPending}>
          {product ? 'Salvar' : 'Publicar'}
        </V2Button>
      </div>
    </form>
  );
}

function Balcao({ arena }) {
  const { data: vendas = [], isLoading } = useArenaSales(arena.id);
  const entregar = useConfirmSale();
  const cancelar = useCancelSale();
  const [verTudo, setVerTudo] = useState(false);

  const hoje = (() => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();

  const pendentes = vendas.filter((v) => !v.stock_applied && v.status !== SALE_STATUS.CANCELLED);
  const doDia = vendas.filter((v) => isoDe(v) === hoje && v.status !== SALE_STATUS.CANCELLED);
  const caixaDoDia = doDia.reduce((a, v) => a + (Number(v.total) || 0), 0);
  const lista = verTudo ? vendas : pendentes;

  return (
    <V2Surface className="mb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Balcão</h2>
          <p className="text-xs text-gray-500">
            {doDia.length} {doDia.length === 1 ? 'venda hoje' : 'vendas hoje'} · {formatPrice(caixaDoDia)}
          </p>
        </div>
        <V2Button size="sm" variant="ghost" onClick={() => setVerTudo((v) => !v)}>
          {verTudo ? `A entregar (${pendentes.length})` : `Todas (${vendas.length})`}
        </V2Button>
      </div>

      {isLoading && <V2Skeleton className="h-20 rounded-2xl" />}

      {!isLoading && lista.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-green-700">
          <Check className="h-4 w-4" />
          {verTudo ? 'Nenhuma venda registrada ainda.' : 'Nada a entregar. Balcão em dia.'}
        </p>
      )}

      <div className="space-y-2">
        {lista.slice(0, 30).map((v) => {
          const dividida = Array.isArray(v.split_details) && v.split_details.length > 1;
          return (
            <div key={v.id} className="rounded-2xl border border-gray-100 bg-paper p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-ink">{v.buyer_name || 'Atleta'}</p>
                  <p className="text-xs text-gray-500">
                    {(v.items || []).map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {isoDe(v) ? formatDateShortBR(isoDe(v)) : ''}
                    {dividida ? ` · dividida entre ${v.split_details.length}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-base font-bold text-ink">{formatPrice(v.total)}</p>
                  <V2Badge tone={v.status === SALE_STATUS.CANCELLED ? 'neutral' : v.stock_applied ? 'green' : 'amber'}>
                    {v.status === SALE_STATUS.CANCELLED ? 'Cancelada' : v.stock_applied ? 'Entregue' : 'A entregar'}
                  </V2Badge>
                </div>
              </div>

              {v.status !== SALE_STATUS.CANCELLED && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {!v.stock_applied && (
                    <V2Button size="sm" disabled={entregar.isPending}
                      onClick={() => entregar.mutateAsync({ arenaId: arena.id, saleId: v.id })
                        .then(() => toast.success('Entregue — o estoque baixou.'))
                        .catch((e) => toast.error(e?.message || 'Não foi possível entregar.'))}>
                      <Check className="mr-1 h-3.5 w-3.5" /> Entreguei
                    </V2Button>
                  )}
                  <ConfirmDialog
                    title="Cancelar esta venda?"
                    description={v.stock_applied
                      ? 'O estoque volta para a prateleira.'
                      : 'A venda fica registrada como cancelada.'}
                    confirmLabel="Cancelar a venda"
                    destructive
                    onConfirm={() => cancelar.mutateAsync({ arenaId: arena.id, saleId: v.id, motivo: '' })
                      .then(() => toast.success('Venda cancelada.'))
                      .catch((e) => toast.error(e?.message || 'Não foi possível cancelar.'))}
                    trigger={<V2Button size="sm" variant="ghost" className="text-red-600">Cancelar</V2Button>}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </V2Surface>
  );
}

/* ========================================================= A PÁGINA ==== */

export default function V2ArenaPDV() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin, isAuthenticated } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const { isOn, isLoading: modulosCarregando } = useArenaModules(arenaId);
  const { data: produtos = [], isLoading: pCarregando } = useArenaProducts(arenaId);
  const apagar = useDeleteProduct();

  const [carrinho, setCarrinho] = useState({});
  const [form, setForm] = useState(null);

  const podeGerir = arena?.owner_id === user?.uid
    || managed.some((m) => m.id === arena?.id)
    || isPlatformAdmin;

  const add = (p) => setCarrinho((c) => ({
    ...c,
    [p.id]: {
      product_id: p.id, name: p.name, price: p.price,
      quantity: Math.min((c[p.id]?.quantity || 0) + 1, p.stock == null ? 99 : p.stock),
    },
  }));
  const remove = (p) => setCarrinho((c) => {
    const atual = c[p.id]?.quantity || 0;
    if (atual <= 1) { const { [p.id]: _fora, ...resto } = c; return resto; }
    return { ...c, [p.id]: { ...c[p.id], quantity: atual - 1 } };
  });

  if (isLoading || modulosCarregando) {
    return <V2Skeleton className="mx-auto h-96 max-w-[900px] rounded-4xl" />;
  }
  if (!arena) return <Navigate to="/arenas" replace />;
  if (!isOn(ARENA_MODULE_ID.PDV)) return <Navigate to={`/arenas/${arenaId}`} replace />;

  const temCatalogo = isOn(ARENA_MODULE_ID.PDV_CATALOG);
  const temPix = isOn(ARENA_MODULE_ID.PDV_PIX_NATIVE);
  const temSplit = isOn(ARENA_MODULE_ID.PDV_SPLIT);
  const aVenda = produtos.filter((p) => p.active !== false);

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-6">
        <Link
          to={podeGerir ? `/arenas/${arena.id}/gerir` : `/arenas/${arena.id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {podeGerir ? 'Voltar para a gestão' : arena.name}
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          {podeGerir ? 'Loja da arena' : `Loja da ${arena.name}`}
        </h1>
        <p className="mt-2 font-medium text-gray-500">
          {podeGerir
            ? 'O que está a entregar, o caixa do dia e o catálogo.'
            : 'Peça pelo aplicativo e retire no balcão, sem fila.'}
        </p>
      </div>

      {podeGerir && <Balcao arena={arena} />}

      {!podeGerir && isAuthenticated && <MinhasCompras arena={arena} temPix={temPix} />}

      {(temCatalogo || podeGerir) && (
        <V2Surface className="mb-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-ink" />
              <h2 className="font-display text-lg font-bold text-ink">
                {podeGerir ? 'Catálogo' : 'O que a arena vende'}
              </h2>
            </div>
            {podeGerir && !form && (
              <V2Button size="sm" onClick={() => setForm('novo')}>
                <Plus className="mr-1.5 h-4 w-4" /> Novo produto
              </V2Button>
            )}
          </div>

          {form && podeGerir && (
            <ProdutoForm arenaId={arena.id} product={form === 'novo' ? null : form}
              onClose={() => setForm(null)} />
          )}

          {pCarregando && <V2Skeleton className="h-24 rounded-2xl" />}

          {!pCarregando && (podeGerir ? produtos : aVenda).length === 0 && !form && (
            <V2EmptyState
              icon={ShoppingBag}
              title={podeGerir ? 'Nenhum produto no catálogo' : 'A arena ainda não publicou produtos'}
              description={podeGerir
                ? 'Água, grip e aluguel de raquete entram no caixa junto com a reserva. Cadastre uma vez, venda sempre.'
                : 'Quando ela publicar, o que estiver à venda aparece aqui.'}
              action={podeGerir ? <V2Button size="sm" onClick={() => setForm('novo')}>Cadastrar o primeiro</V2Button> : null}
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {(podeGerir ? produtos : aVenda).map((p) => (
              podeGerir ? (
                <div key={p.id} className="rounded-2xl border border-gray-100 bg-paper p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-ink">{p.name}</p>
                      <p className="mt-0.5 flex flex-wrap gap-1.5 text-xs">
                        <V2Badge tone="neutral">{CATEGORIA_LABEL[p.category] || 'Outros'}</V2Badge>
                        {p.stock != null && (
                          <V2Badge tone={hasStock(p, 1) ? 'neutral' : 'red'}>
                            {hasStock(p, 1) ? `${p.stock} em estoque` : 'Esgotado'}
                          </V2Badge>
                        )}
                        {p.active === false && <V2Badge tone="neutral">Fora de venda</V2Badge>}
                      </p>
                    </div>
                    <p className="shrink-0 font-display text-lg font-bold text-ink">{formatPrice(p.price)}</p>
                  </div>
                  <div className="mt-2 flex justify-end gap-1.5">
                    <V2Button size="sm" variant="ghost" onClick={() => setForm(p)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                    </V2Button>
                    <ConfirmDialog
                      title={`Apagar ${p.name}?`}
                      description="O produto some do catálogo. As vendas já feitas continuam registradas. Se for só tirar de venda, edite e desmarque “À venda”."
                      confirmLabel="Apagar"
                      destructive
                      onConfirm={() => apagar.mutateAsync({ arenaId: arena.id, prodId: p.id })
                        .then(() => toast.success('Produto apagado.'))
                        .catch((e) => toast.error(e?.message || 'Não foi possível apagar.'))}
                      trigger={(
                        <V2Button size="sm" variant="ghost" className="text-red-600">
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Apagar
                        </V2Button>
                      )}
                    />
                  </div>
                </div>
              ) : (
                <CartaoDoProduto key={p.id} product={p}
                  quantidade={carrinho[p.id]?.quantity || 0} onAdd={add} onRemove={remove} />
              )
            ))}
          </div>
        </V2Surface>
      )}

      {!podeGerir && isAuthenticated && (
        <Carrinho arena={arena} itens={carrinho} temSplit={temSplit}
          onLimpar={() => setCarrinho({})} onQuitar={() => setCarrinho({})} />
      )}

      {!isAuthenticated && (
        <p className="text-sm text-gray-500">
          <Link to="/entrar" className="font-bold text-ink underline">Entre</Link> para comprar.
        </p>
      )}

      {podeGerir && (
        <p className="mt-6 flex items-start gap-2 rounded-2xl bg-paper p-4 text-xs leading-5 text-gray-500">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          O estoque baixa quando você clica em <strong className="text-ink">Entreguei</strong>, não
          na hora do pedido — assim uma compra que não for retirada não some com produto da
          prateleira. Cancelar uma venda já entregue devolve o estoque.
        </p>
      )}
    </div>
  );
}
