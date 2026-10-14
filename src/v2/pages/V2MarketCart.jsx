/**
 * V2MarketCart — o carrinho e o fechamento (`/mercado/carrinho`).
 *
 * Três passos na mesma tela:
 *  1. CARRINHO — itens agrupados por vendedor (cada vendedor vira um pedido,
 *     com o Pix e a entrega dele), conferidos contra o anúncio de AGORA
 *     (`checkLine`: esgotou, pausou, mudou de preço);
 *  2. FECHAR — como receber, o endereço (só se houver envio) e a conferência;
 *  3. PRONTO — os pedidos criados e o que falhou, vendedor a vendedor.
 *
 * `?fechar=1` (o "Comprar agora") abre direto no passo 2. Nada é cobrado
 * aqui: o Pix aparece no pedido depois que o vendedor aceita.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, Bookmark, ChevronLeft, CheckCircle2, Minus, PackageCheck, Plus, ShieldCheck, ShoppingCart, Trash2, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { BR_UFS } from '@/core/domain/ufs';
import { groupCartBySeller, groupShippingCost } from '@/modules/marketplace/domain/cart';
import { formatBRL } from '@/modules/marketplace/domain/money';
import { placeOrders } from '@/modules/marketplace/services/marketOrderService';
import { useListingsByIds, useMarketCart, useMarketMutation, useMarketSettings } from '@/modules/marketplace/hooks/useMarket';
import {
  V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2PageIntro, V2Select, V2Skeleton, V2Surface, V2Textarea,
} from '@/v2/ui/primitives';
import MarketHeader from '@/v2/components/marketplace/MarketHeader';
import { MarketGate, SellerTypeTag, fulfillmentLabel } from '@/v2/components/marketplace/marketUi';

const ADDRESS_FIELDS = ['name', 'cep', 'street', 'number', 'complement', 'district', 'city', 'state', 'phone'];

function addressError(a) {
  if (String(a.name || '').trim().length < 3) return 'Diga o nome de quem recebe.';
  if (String(a.cep || '').replace(/\D/g, '').length !== 8) return 'O CEP tem 8 números.';
  if (!String(a.street || '').trim() || !String(a.number || '').trim()) return 'Preencha a rua e o número.';
  if (!String(a.city || '').trim() || !BR_UFS.includes(a.state)) return 'Preencha a cidade e o estado.';
  return '';
}

function Qty({ value, max, onChange, disabled }) {
  return (
    <div className="inline-flex items-center rounded-full border border-gray-200">
      <button type="button" aria-label="Menos um" disabled={disabled || value <= 1} onClick={() => onChange(value - 1)} className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40">
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-8 text-center text-sm font-bold" aria-live="polite">{value}</span>
      <button type="button" aria-label="Mais um" disabled={disabled || value >= max} onClick={() => onChange(value + 1)} className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function Line({ line, cart, editable }) {
  const { check } = line;
  const run = (p) => p.catch(() => toast.error('Não foi possível atualizar o carrinho. Tente de novo.'));
  return (
    <li className="flex gap-3 py-4">
      <Link to={`/mercado/anuncio/${line.listing_id}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-paper">
        {line.cover_url && <img src={line.cover_url} alt="" loading="lazy" className={cn('h-full w-full object-cover', !check.ok && 'opacity-50')} />}
      </Link>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <Link to={`/mercado/anuncio/${line.listing_id}`} className="line-clamp-2 text-sm font-medium text-ink hover:underline">{line.title}</Link>
          <span className="shrink-0 text-right font-bold text-ink">{formatBRL(check.unit_price_cents * line.quantity)}</span>
        </div>
        {check.problem && (
          <p className={cn('flex items-center gap-1 text-xs font-medium', check.ok ? 'text-amber-700' : 'text-red-600')}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {check.problem}
          </p>
        )}
        {line.quantity > 1 && check.ok && <p className="text-xs text-gray-500">{formatBRL(check.unit_price_cents)} cada</p>}
        {editable && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            {check.max > 0 && <Qty value={Math.min(line.quantity, check.max)} max={Math.min(check.max, 99)} disabled={cart.saving} onChange={(q) => run(cart.setQuantity(line.listing_id, q))} />}
            {check.ok && line.quantity > check.max && check.max > 0 && (
              <button type="button" onClick={() => run(cart.setQuantity(line.listing_id, check.max))} className="text-xs font-bold text-ink underline">Ajustar para {check.max}</button>
            )}
            <button type="button" onClick={() => run(cart.later(line.listing_id))} className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-ink">
              <Bookmark className="h-3.5 w-3.5" /> Salvar para depois
            </button>
            <button type="button" onClick={() => run(cart.remove(line.listing_id))} className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function shipText(cost) {
  if (cost.shipping_to_agree) return 'Frete a combinar';
  return cost.shipping_cents ? `Frete ${formatBRL(cost.shipping_cents)}` : 'Frete grátis';
}

function SellerGroup({ g, cart, choice, setChoice, editable }) {
  const opcoes = g.fulfillment || [];
  const listings = g.lines.filter((l) => l.check.ok).map((l) => l.listing);
  const cost = groupShippingCost(listings, choice.fulfillment);
  return (
    <V2Surface variant="compacto" as="section" aria-label={`Pedido de ${g.seller_name}`} className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-3">
          {editable && (
            <input
              type="checkbox"
              checked={choice.on}
              disabled={!g.buyable}
              onChange={(e) => setChoice({ ...choice, on: e.target.checked })}
              className="h-5 w-5 accent-ink"
            />
          )}
          <span>
            <span className="block text-xs text-gray-500">Vendido por</span>
            <Link to={`/mercado/vendedor/${g.seller_key}`} className="font-bold text-ink hover:underline">{g.seller_name || 'Vendedor'}</Link>
          </span>
        </label>
        <SellerTypeTag type={g.seller_type} />
      </div>
      <ul className="divide-y divide-gray-100">{g.lines.map((l) => <Line key={l.listing_id} line={l} cart={cart} editable={editable} />)}</ul>
      {g.buyable > 0 && (
        <div className="space-y-3 border-t border-gray-100 pt-4">
          {opcoes.length === 0 ? (
            <p className="text-sm text-amber-800">Estes itens não têm uma forma de entrega em comum. Compre um de cada vez (salve o outro para depois).</p>
          ) : (
            <fieldset>
              <legend className="mb-2 text-sm font-bold text-ink">Como você quer receber</legend>
              <div className="flex flex-wrap gap-2">
                {opcoes.map((f) => (
                  <label key={f} className={cn('flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm', choice.fulfillment === f ? 'border-ink bg-ink text-white' : 'border-gray-200 text-ink')}>
                    <input type="radio" className="sr-only" name={`entrega-${g.seller_key}`} checked={choice.fulfillment === f} onChange={() => setChoice({ ...choice, fulfillment: f })} />
                    {fulfillmentLabel(f)}
                  </label>
                ))}
              </div>
              {choice.fulfillment === 'shipping' && <p className="mt-2 text-xs text-gray-500">{shipText(cost)}</p>}
              {choice.fulfillment === 'meetup' && <p className="mt-2 text-xs text-gray-500">Vocês combinam o local pelo pedido, depois do pagamento.</p>}
              {choice.fulfillment === 'pickup' && <p className="mt-2 text-xs text-gray-500">O endereço de retirada aparece no pedido.</p>}
            </fieldset>
          )}
          {editable && (
            <V2Field label="Recado para o vendedor (opcional)" htmlFor={`nota-${g.seller_key}`}>
              <V2Textarea id={`nota-${g.seller_key}`} rows={2} maxLength={300} value={choice.note} onChange={(e) => setChoice({ ...choice, note: e.target.value })} placeholder="Ex.: prefiro retirar à noite" className="min-h-0" />
            </V2Field>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal deste vendedor</span>
            <span className="font-bold text-ink">{formatBRL(g.subtotal_cents + cost.shipping_cents)}</span>
          </div>
        </div>
      )}
    </V2Surface>
  );
}

function AddressForm({ value, onChange, error }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <V2Surface variant="compacto" as="section" aria-labelledby="endereco-titulo" className="space-y-4 p-5">
      <div>
        <h2 id="endereco-titulo" className="font-display text-lg font-bold text-ink">Endereço de entrega</h2>
        <p className="text-xs text-gray-500">Só o vendedor que aceitar o pedido vê o endereço.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-6">
        <V2Field label="Quem recebe" htmlFor="end-name" className="sm:col-span-4"><V2Input id="end-name" autoComplete="name" value={value.name} onChange={set('name')} /></V2Field>
        <V2Field label="CEP" htmlFor="end-cep" className="sm:col-span-2"><V2Input id="end-cep" inputMode="numeric" autoComplete="postal-code" maxLength={9} value={value.cep} onChange={set('cep')} /></V2Field>
        <V2Field label="Rua" htmlFor="end-street" className="sm:col-span-4"><V2Input id="end-street" autoComplete="address-line1" value={value.street} onChange={set('street')} /></V2Field>
        <V2Field label="Número" htmlFor="end-number" className="sm:col-span-2"><V2Input id="end-number" value={value.number} onChange={set('number')} /></V2Field>
        <V2Field label="Complemento" htmlFor="end-complement" className="sm:col-span-3"><V2Input id="end-complement" autoComplete="address-line2" value={value.complement} onChange={set('complement')} /></V2Field>
        <V2Field label="Bairro" htmlFor="end-district" className="sm:col-span-3"><V2Input id="end-district" value={value.district} onChange={set('district')} /></V2Field>
        <V2Field label="Cidade" htmlFor="end-city" className="sm:col-span-3"><V2Input id="end-city" autoComplete="address-level2" value={value.city} onChange={set('city')} /></V2Field>
        <V2Field label="Estado" htmlFor="end-state" className="sm:col-span-1">
          <V2Select id="end-state" value={value.state} onChange={set('state')}>
            <option value="">UF</option>
            {BR_UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </V2Select>
        </V2Field>
        <V2Field label="Telefone (opcional)" htmlFor="end-phone" hint="Para a transportadora." className="sm:col-span-2"><V2Input id="end-phone" type="tel" autoComplete="tel" value={value.phone} onChange={set('phone')} /></V2Field>
      </div>
      {error && <p role="alert" className="text-sm font-medium text-red-500">{error}</p>}
    </V2Surface>
  );
}

function Done({ result }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {result.orders.length > 0 && (
        <V2Surface className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
          <h1 className="font-display text-2xl font-bold text-ink">
            {result.orders.length > 1 ? `${result.orders.length} pedidos feitos` : 'Pedido feito'}
          </h1>
          <p className="text-gray-600">Agora o vendedor aceita o pedido. Aí aparece a chave Pix para você pagar — você recebe um aviso.</p>
          <ul className="space-y-2 text-left">
            {result.orders.map((o) => (
              <li key={o.id}>
                <Link to={`/mercado/pedidos/${o.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 p-4 hover:border-ink">
                  <span><span className="block font-bold text-ink">{o.seller_name}</span><span className="text-xs text-gray-500">Pedido {o.code}</span></span>
                  <span className="font-bold text-ink">{formatBRL(o.total_cents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </V2Surface>
      )}
      {result.failures.length > 0 && (
        <V2Surface variant="compacto" className="space-y-2 p-5">
          <h2 className="flex items-center gap-2 font-bold text-red-600"><XCircle className="h-5 w-5" /> {result.failures.length > 1 ? 'Alguns pedidos não foram feitos' : 'Um pedido não foi feito'}</h2>
          <ul className="space-y-1 text-sm text-gray-700">
            {result.failures.map((f) => <li key={f.seller_key}>{f.seller_name || 'Vendedor'}: {f.error}</li>)}
          </ul>
          <p className="text-xs text-gray-500">Esses itens continuam no carrinho.</p>
        </V2Surface>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <V2Button asChild><Link to="/mercado/pedidos">Ver minhas compras</Link></V2Button>
        <V2Button asChild variant="ghost"><Link to="/mercado">Continuar comprando</Link></V2Button>
      </div>
    </div>
  );
}

function CartPage() {
  const { user, userProfile } = useAuth();
  const [params, setParams] = useSearchParams();
  const cart = useMarketCart(user?.uid);
  const settings = useMarketSettings();
  const ids = [...cart.cart.items, ...cart.cart.saved].map((i) => i.listing_id);
  const ls = useListingsByIds(ids);
  const [choices, setChoices] = useState({});
  const [address, setAddress] = useState(() => ({
    name: userProfile?.full_name || userProfile?.platform_name || '', cep: '', street: '', number: '', complement: '', district: '',
    city: userProfile?.city || '', state: userProfile?.state || '', phone: '',
  }));
  const [addrErr, setAddrErr] = useState('');
  const [result, setResult] = useState(null);
  const place = useMarketMutation(placeOrders);
  const step = params.get('fechar') ? 'fechar' : 'carrinho';

  // Mapa id → anúncio (`undefined` enquanto lê; `null` quando não existe mais).
  const mapa = useMemo(() => {
    if (!ls.isSuccess) return {};
    return Object.fromEntries(ids.map((id) => [id, ls.data[id] || (ls.isPlaceholderData ? undefined : null)]));
  }, [ls.isSuccess, ls.isPlaceholderData, ls.data, ids.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const grupos = useMemo(() => groupCartBySeller(cart.cart, mapa), [cart.cart, mapa]);

  useEffect(() => {
    setChoices((atual) => {
      const next = { ...atual };
      grupos.groups.forEach((g) => {
        const prev = next[g.seller_key];
        const opts = g.fulfillment || [];
        if (!prev) next[g.seller_key] = { on: g.buyable > 0, fulfillment: opts[0] || '', note: '' };
        else if (!opts.includes(prev.fulfillment)) next[g.seller_key] = { ...prev, fulfillment: opts[0] || '' };
        if (!g.buyable) next[g.seller_key] = { ...next[g.seller_key], on: false };
      });
      return next;
    });
  }, [grupos]);

  const escolhidos = grupos.groups.filter((g) => choices[g.seller_key]?.on && g.buyable && choices[g.seller_key]?.fulfillment);
  const custo = (g) => groupShippingCost(g.lines.filter((l) => l.check.ok).map((l) => l.listing), choices[g.seller_key]?.fulfillment);
  const subtotal = escolhidos.reduce((n, g) => n + g.subtotal_cents, 0);
  const frete = escolhidos.reduce((n, g) => n + custo(g).shipping_cents, 0);
  const freteCombinar = escolhidos.some((g) => custo(g).shipping_to_agree);
  const precisaEndereco = escolhidos.some((g) => choices[g.seller_key].fulfillment === 'shipping');
  const unidades = escolhidos.reduce((n, g) => n + g.lines.filter((l) => l.check.ok).reduce((m, l) => m + l.quantity, 0), 0);
  const comprasAbertas = settings.data?.orders_enabled !== false;

  const confirmar = () => {
    if (precisaEndereco) {
      const e = addressError(address);
      setAddrErr(e);
      if (e) return;
    }
    const payload = {
      groups: escolhidos.map((g) => ({
        seller_key: g.seller_key,
        fulfillment: choices[g.seller_key].fulfillment,
        buyer_note: choices[g.seller_key].note || '',
        items: g.lines.filter((l) => l.check.ok).map((l) => ({ listing_id: l.listing_id, quantity: l.quantity, expected_price_cents: l.check.unit_price_cents })),
      })),
      ...(precisaEndereco ? { shipping: Object.fromEntries(ADDRESS_FIELDS.map((k) => [k, address[k] || ''])) } : {}),
    };
    place.mutate(payload, {
      onSuccess: (r) => {
        const nomes = Object.fromEntries(grupos.groups.map((g) => [g.seller_key, g.seller_name]));
        setResult({ orders: r.orders || [], failures: (r.failures || []).map((f) => ({ ...f, seller_name: nomes[f.seller_key] })) });
        window.scrollTo?.({ top: 0 });
      },
      onError: (e) => toast.error(e.message),
    });
  };

  let corpo;
  if (result) corpo = <Done result={result} />;
  else if (cart.isError || ls.isError) corpo = <V2ErrorState onRetry={() => { cart.refetch(); ls.refetch(); }} />;
  else if (cart.isLoading || (ids.length && ls.isLoading)) corpo = <div className="space-y-4"><V2Skeleton className="h-48" /><V2Skeleton className="h-48" /></div>;
  else if (!cart.cart.items.length && !cart.cart.saved.length) {
    corpo = (
      <V2EmptyState
        icon={ShoppingCart}
        title="Seu carrinho está vazio"
        description="Encontre raquetes, bolas e tudo de pickleball de quem joga com você."
        action={<V2Button asChild><Link to="/mercado">Ir às compras</Link></V2Button>}
      />
    );
  } else {
    const fechar = step === 'fechar' && escolhidos.length > 0;
    corpo = (
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          {fechar && (
            <button type="button" onClick={() => setParams({})} className="inline-flex items-center gap-1 text-sm font-bold text-ink hover:underline">
              <ChevronLeft className="h-4 w-4" /> Voltar ao carrinho
            </button>
          )}
          {grupos.groups.length === 0 && <p className="text-sm text-gray-500">Nada no carrinho agora — só itens salvos para depois.</p>}
          {(fechar ? escolhidos : grupos.groups).map((g) => (
            <SellerGroup
              key={g.seller_key}
              g={g}
              cart={cart}
              editable={!fechar}
              choice={choices[g.seller_key] || { on: false, fulfillment: '', note: '' }}
              setChoice={(c) => setChoices((x) => ({ ...x, [g.seller_key]: c }))}
            />
          ))}
          {fechar && precisaEndereco && <AddressForm value={address} onChange={(a) => { setAddress(a); setAddrErr(''); }} error={addrErr} />}
          {!fechar && cart.cart.saved.length > 0 && (
            <V2Surface variant="plano" as="section" aria-labelledby="salvos-titulo" className="p-5">
              <h2 id="salvos-titulo" className="font-display text-lg font-bold text-ink">Salvos para depois ({cart.cart.saved.length})</h2>
              <ul className="divide-y divide-gray-100">
                {cart.cart.saved.map((s) => {
                  const l = mapa[s.listing_id];
                  const ok = l && l.status === 'active';
                  return (
                    <li key={s.listing_id} className="flex items-center gap-3 py-3">
                      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-paper-pure">{s.cover_url && <img src={s.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />}</span>
                      <Link to={`/mercado/anuncio/${s.listing_id}`} className="min-w-0 flex-1 truncate text-sm text-ink hover:underline">{s.title}</Link>
                      {ok ? (
                        <V2Button type="button" size="sm" variant="ghost" onClick={() => cart.back(s.listing_id).catch(() => toast.error('Não foi possível mover. Tente de novo.'))}>Mover para o carrinho</V2Button>
                      ) : <span className="text-xs text-gray-500">Indisponível</span>}
                    </li>
                  );
                })}
              </ul>
            </V2Surface>
          )}
        </div>
        <aside className="lg:col-span-4">
          <V2Surface variant="compacto" className="space-y-4 p-5 lg:sticky lg:top-4">
            <h2 className="font-display text-lg font-bold text-ink">Resumo</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Produtos ({unidades})</dt><dd className="font-medium text-ink">{formatBRL(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Frete</dt><dd className="font-medium text-ink">{freteCombinar ? `${formatBRL(frete)} + a combinar` : frete ? formatBRL(frete) : 'Grátis'}</dd></div>
              <div className="flex justify-between border-t border-gray-100 pt-2 text-base"><dt className="font-bold text-ink">Total</dt><dd className="font-display text-xl font-bold text-ink">{formatBRL(subtotal + frete)}</dd></div>
            </dl>
            {escolhidos.length > 1 && <p className="text-xs text-gray-500">{escolhidos.length} vendedores: vira um pedido para cada um, e você paga cada um pelo Pix dele.</p>}
            {!comprasAbertas ? (
              <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">As compras no Mercado estão pausadas no momento.</p>
            ) : step === 'fechar' && escolhidos.length > 0 ? (
              <>
                <V2Button type="button" size="lg" className="w-full" disabled={place.isPending} onClick={confirmar}>
                  {place.isPending ? 'Fazendo o pedido…' : escolhidos.length > 1 ? `Confirmar ${escolhidos.length} pedidos` : 'Confirmar pedido'}
                </V2Button>
                <p className="text-xs text-gray-500">Ao confirmar, você concorda com os <Link to="/legal/termos-mercado" className="font-bold text-ink underline">Termos do Mercado</Link>.</p>
              </>
            ) : (
              <V2Button type="button" size="lg" className="w-full" disabled={!escolhidos.length} onClick={() => setParams({ fechar: '1' })}>
                <PackageCheck className="h-4 w-4" /> Fechar pedido
              </V2Button>
            )}
            {!escolhidos.length && grupos.groups.length > 0 && <p className="text-xs text-gray-500">Marque ao menos um vendedor com itens disponíveis.</p>}
            <p className="flex items-start gap-2 text-xs text-gray-500"><ShieldCheck className="h-4 w-4 shrink-0 text-ink" /> Nada é cobrado agora. Você paga pelo Pix direto ao vendedor depois que ele aceitar.</p>
          </V2Surface>
        </aside>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <MarketHeader />
      {!result && <V2PageIntro title={step === 'fechar' ? 'Fechar pedido' : 'Carrinho'} />}
      {corpo}
    </div>
  );
}

export default function V2MarketCart() {
  return <MarketGate><CartPage /></MarketGate>;
}
