/**
 * V2MarketSell — o painel de quem vende no Mercado (`/mercado/vender`).
 *
 * Uma pessoa pode vender de mais de um jeito: como ela mesma, como professor
 * ou por uma arena que administra (`sellingIdentities`). O jeito escolhido
 * mora na URL (`?como=<sellerKey>`), e a aba também (`?aba=`): recarregar não
 * perde o lugar, e o aviso do servidor pode levar direto a uma venda.
 *
 * O Resumo responde "o que precisa de mim agora"; as outras abas são o
 * trabalho: anúncios, vendas, ofertas, perguntas, Pix e a vitrine.
 */
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, BarChart3, CheckCircle2, Copy, ExternalLink, HandCoins, ImagePlus, LayoutDashboard, MessageCircleQuestion, MoreHorizontal, Package, Palmtree, Pencil, Plus, Receipt, Share2, Star, Store, TicketPercent, Trash2, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { BR_UFS } from '@/core/domain/ufs';
import { useMyArenaSummary } from '@/modules/arenas/hooks/useMyArenaSummary';
import { useCoach } from '@/modules/coaches/hooks/useCoaches';
import { coverOf, listingCompleteness, vacationState } from '@/modules/marketplace/domain/listing';
import { PIX_KEY_TYPES, sellerKeyFor, sellingIdentities } from '@/modules/marketplace/domain/seller';
import {
  LISTING_STATUS_LABELS, OFFER_STATUS_LABELS, ORDER_FINAL_STATUSES, ORDER_STATUS_LABELS,
} from '@/modules/marketplace/domain/constants';
import { orderWaitingOn } from '@/modules/marketplace/domain/orderStatus';
import { offerDisplayStatus } from '@/modules/marketplace/domain/offers';
import { validateAnswer } from '@/modules/marketplace/domain/settings';
import { formatBRL, parseBRL } from '@/modules/marketplace/domain/money';
import {
  answerQuestion, deleteListing, duplicateListing, ensureSeller, quickEditListing, republishListing, savePayment, saveSellerPolicies, setListingStatus, updateSellerProfile,
} from '@/modules/marketplace/services/marketService';
import { prepareMarketFile, uploadMarketFile } from '@/modules/marketplace/services/marketMediaService';
import {
  useMarketMutation, useMarketSettings, useSeller, useSellerListings, useSellerOffers, useSellerOrders, useSellerPrivate, useSellerQuestions,
} from '@/modules/marketplace/hooks/useMarket';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ShareImageDialog, { MarketShareCard } from '@/v2/components/marketplace/promo/ShareImageDialog';
import SellerReviews from '@/v2/components/marketplace/SellerReviews';
import {
  V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Input, V2Page, V2PageIntro, V2Select,
  V2Skeleton, V2Surface, V2Textarea, V2Toggle,
} from '@/v2/ui/primitives';
import { V2SectionNav, V2SubTabs } from '@/v2/ui/V2SectionNav';
import { MarketGate, statusTone } from '@/v2/components/marketplace/marketUi';
import SellerPromoTab from '@/v2/components/marketplace/promo/SellerPromoTab';
import SellerInsightsTab from '@/v2/components/marketplace/SellerInsightsTab';
import { t, tk, tn } from '@/core/i18n';
import MarketPhoto from '@/v2/components/marketplace/MarketPhoto';

/**
 * As nove abas em cinco seções, pelo que a pessoa vem fazer: ver o que
 * precisa dela (Resumo), cuidar dos anúncios, NEGOCIAR (vendas, ofertas e
 * perguntas são a mesma conversa com quem compra), divulgar e ajustar a loja.
 * O valor de cada aba (`?aba=`) não mudou: os avisos antigos seguem abrindo
 * no lugar certo.
 */
const SECOES = [
  { id: 'resumo', label: tk('Resumo'), icon: LayoutDashboard, abas: [{ value: 'resumo', label: tk('Resumo') }] },
  { id: 'anuncios', label: tk('Anúncios'), icon: Package, dica: 'mercado-vender-anuncios', abas: [{ value: 'anuncios', label: tk('Anúncios') }] },
  {
    id: 'negociar', label: tk('Negociações'), icon: Receipt, dica: 'mercado-vender-vendas',
    abas: [
      { value: 'vendas', label: tk('Vendas'), icon: Receipt },
      { value: 'ofertas', label: tk('Ofertas'), icon: HandCoins },
      { value: 'perguntas', label: tk('Perguntas'), icon: MessageCircleQuestion },
      { value: 'avaliacoes', label: tk('Avaliações'), icon: Star },
    ],
  },
  {
    id: 'divulgar', label: tk('Divulgação'), icon: TicketPercent,
    abas: [
      { value: 'divulgar', label: tk('Cupons e vales'), icon: TicketPercent },
      { value: 'desempenho', label: tk('Desempenho'), icon: BarChart3 },
    ],
  },
  {
    id: 'loja', label: tk('Minha loja'), icon: Store, dica: 'mercado-vender-pix',
    abas: [
      { value: 'pix', label: tk('Recebimento'), icon: Wallet },
      { value: 'vitrine', label: tk('Vitrine'), icon: Store },
    ],
  },
];
const ABAS = SECOES.flatMap((sec) => sec.abas.map((a) => ({ ...a, secao: sec.id })));

const ACTIVE_ORDER = (o) => !ORDER_FINAL_STATUSES.includes(o.status);
const MY_TURN_ORDER = (o) => ['placed', 'payment_review', 'paid'].includes(o.status) || (o.status === 'ready');
const novoAnuncio = (key) => `/mercado/vender/anuncio/novo?como=${encodeURIComponent(key)}`;

/* -------------------------------------------------------------- começar -- */

function StartSelling({ identity, defaults }) {
  const [nome, setNome] = useState(defaults.name || '');
  const m = useMarketMutation(ensureSeller);
  const { user } = useAuth();
  return (
    <V2Surface className="mx-auto max-w-xl space-y-4 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-acid/30"><Store className="h-7 w-7 text-ink" /></span>
      <h2 className="font-display text-2xl font-bold text-ink">{identity.type === 'arena' ? t('Comece a vender pela arena') : identity.type === 'coach' ? t('Comece a vender como professor') : t('Comece a vender no Mercado')}</h2>
      <p className="text-sm text-gray-500">{t('Sem comissão. O comprador paga por Pix direto para você, depois que você aceitar o pedido.')}</p>
      <form
        className="space-y-3 text-left"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate({ type: identity.type, entityId: identity.entity_id, uid: user.uid, displayName: nome, city: defaults.city, state: defaults.state, photoUrl: defaults.photo }, {
            onSuccess: () => toast.success(t('Pronto! Agora crie o seu primeiro anúncio.')),
            onError: (er) => toast.error(er.message),
          });
        }}
      >
        <V2Field label={t('Nome que aparece para os compradores')} htmlFor="nome-vend">
          <V2Input id="nome-vend" maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} />
        </V2Field>
        <p className="text-xs text-gray-500">{t('Ao continuar, você concorda com os')} <Link to="/legal/termos-de-uso" className="font-bold text-ink underline">{t('Termos de Uso')}</Link>, {t('os')} <Link to="/legal/termos-mercado" className="font-bold text-ink underline">{t('Termos Gerais do Mercado')}</Link>, {t('os')} <Link to="/legal/termos-vendedor-mercado" className="font-bold text-ink underline">{t('Termos do Vendedor')}</Link> {t('e a')} <Link to="/legal/mercado-imagens-e-ia" className="font-bold text-ink underline">{t('Política de Imagens e IA')}</Link>. {t('Você responde, de forma exclusiva, pelo produto, pela venda, pelo transporte e pelos documentos.')}</p>
        <V2Button type="submit" className="w-full" disabled={m.isPending || nome.trim().length < 2}>{m.isPending ? t('Abrindo…') : t('Começar a vender')}</V2Button>
      </form>
    </V2Surface>
  );
}

/* --------------------------------------------------------------- resumo -- */

function Summary({ sellerKey, seller, go }) {
  const orders = useSellerOrders(sellerKey);
  const offers = useSellerOffers(sellerKey);
  const qs = useSellerQuestions(sellerKey);
  const listings = useSellerListings(sellerKey);
  const priv = useSellerPrivate(sellerKey);
  const conta = (q, fn) => (q.isError ? null : q.isLoading ? undefined : (q.data || []).filter(fn).length);
  const cards = [
    { id: 'vendas', label: t('Vendas esperando você'), n: conta(orders, MY_TURN_ORDER), icon: Receipt },
    { id: 'perguntas', label: t('Perguntas sem resposta'), n: conta(qs, (q) => q.status === 'open'), icon: MessageCircleQuestion },
    { id: 'ofertas', label: t('Ofertas para responder'), n: conta(offers, (o) => o.status === 'pending' && !(Date.now() > Number(o.expires_at_ms))), icon: HandCoins },
    { id: 'anuncios', label: t('Anúncios no ar'), n: conta(listings, (l) => l.status === 'active'), icon: Package },
  ];
  const passos = [
    { ok: Boolean(priv.data?.pix_key), carregando: priv.isLoading || priv.isError, label: t('Cadastrar a chave Pix para receber'), aba: 'pix' },
    { ok: Boolean(seller.logo_url && seller.bio), carregando: false, label: t('Colocar foto e descrição na vitrine'), aba: 'vitrine' },
    { ok: (listings.data || []).some((l) => l.status === 'active' || l.status === 'sold_out'), carregando: listings.isLoading || listings.isError, label: t('Publicar o primeiro anúncio'), aba: 'anuncios' },
  ];
  const faltam = passos.filter((p) => !p.ok && !p.carregando);
  const recebido = (orders.data || []).filter((o) => o.status === 'completed').reduce((n, o) => n + (o.total_cents || 0), 0);
  const ferias = !listings.isLoading && !listings.isError && vacationState(listings.data || []).todosPausados;
  return (
    <div className="space-y-6">
      {ferias && (
        <V2Surface variant="compacto" className="flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm text-ink"><Palmtree className="h-5 w-5 text-amber-600" /> {t('Modo férias: todos os seus anúncios estão pausados e ninguém os vê.')}</p>
          <V2Button type="button" size="sm" variant="secondary" onClick={() => go('vitrine')}>{t('Retomar as vendas')}</V2Button>
        </V2Surface>
      )}
      {faltam.length > 0 && (
        <V2Surface variant="compacto" className="space-y-3 border-acid/60 p-5">
          <h2 className="font-display text-lg font-bold text-ink">{t('Para começar a vender')}</h2>
          <ul className="space-y-2">
            {passos.map((p) => (
              <li key={p.label} className="flex items-center gap-2 text-sm">
                {p.ok ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <span className="h-5 w-5 rounded-full border-2 border-gray-300" />}
                {p.ok ? <span className="text-gray-500 line-through">{p.label}</span> : <button type="button" onClick={() => go(p.aba)} className="font-bold text-ink underline">{p.label}</button>}
              </li>
            ))}
          </ul>
          {!priv.data?.pix_key && !priv.isLoading && !priv.isError && <p className="text-xs text-gray-500">{t('Sem a chave Pix você não consegue aceitar pedidos.')}</p>}
        </V2Surface>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <button key={c.id} type="button" onClick={() => go(c.id)} className="rounded-3xl border border-gray-100 bg-paper-pure p-4 text-left hover:border-ink/40">
            <c.icon className="h-5 w-5 text-gray-500" />
            <p className="mt-2 font-display text-3xl font-bold text-ink">{c.n === undefined ? '…' : c.n === null ? '—' : c.n}</p>
            <p className="text-sm text-gray-600">{c.label}</p>
          </button>
        ))}
      </div>
      {(orders.isError || offers.isError || qs.isError || listings.isError) && <p className="text-xs text-gray-500">{t('Parte do resumo não carregou (—). Abra a aba para tentar de novo.')}</p>}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
        <span>{t('Vendas concluídas:')} <strong className="text-ink">{seller.sales_count || 0}</strong></span>
        {!orders.isError && !orders.isLoading && <span>{t('Recebido em vendas concluídas:')} <strong className="text-ink">{formatBRL(recebido)}</strong></span>}
        <Link to={`/mercado/vendedor/${sellerKey}`} className="font-bold text-ink underline">{t('Ver minha vitrine')}</Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- anúncios -- */

function QuickEdit({ listing, onClose }) {
  const [preco, setPreco] = useState(formatBRL(listing.price_cents).replace(/^R\$\s?/, ''));
  const [qtd, setQtd] = useState(String(listing.quantity ?? 0));
  const [de, setDe] = useState(listing.compare_at_cents ? formatBRL(listing.compare_at_cents).replace(/^R\$\s?/, '') : '');
  const m = useMarketMutation(({ l, p, q, c }) => quickEditListing(l, { price_cents: p, quantity: q, compare_at_cents: c }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-sm">
        <DialogTitle>{t('Preço e estoque')}</DialogTitle>
        <DialogDescription className="line-clamp-2">{listing.title}</DialogDescription>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate({ l: listing, p: parseBRL(preco), q: listing.source?.tracked ? null : Number(qtd), c: de ? parseBRL(de) : null }, { onSuccess: () => { toast.success(t('Atualizado.')); onClose(); }, onError: (er) => toast.error(er.message) });
          }}
        >
          <V2Field label={t('Preço (R$)')} htmlFor="qe-preco"><V2Input id="qe-preco" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} autoFocus /></V2Field>
          <V2Field label={t('Preço “de” (R$, opcional)')} htmlFor="qe-de" hint={t('Aparece riscado ao lado do preço. Precisa ser maior que ele.')}><V2Input id="qe-de" inputMode="decimal" placeholder={t('0,00')} value={de} onChange={(e) => setDe(e.target.value)} /></V2Field>
          {listing.source?.tracked ? (
            <p className="text-sm text-gray-600">{t('Quantidade: {n}. Ela acompanha o estoque da arena; para mudar, registre a compra no estoque.', { n: listing.quantity ?? 0 })}</p>
          ) : (
            <V2Field label={t('Quantidade')} htmlFor="qe-qtd" hint={t('Com 0, o anúncio aparece como esgotado.')}><V2Input id="qe-qtd" type="number" min={0} max={9999} value={qtd} onChange={(e) => setQtd(e.target.value)} /></V2Field>
          )}
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onClose}>{t('Voltar')}</V2Button>
            <V2Button type="submit" disabled={m.isPending}>{t('Salvar')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const FILTROS = [
  { id: 'ativos', label: tk('No ar'), test: (l) => l.status === 'active' || l.status === 'sold_out' },
  { id: 'rascunhos', label: tk('Rascunhos'), test: (l) => l.status === 'draft' },
  { id: 'pausados', label: tk('Pausados'), test: (l) => l.status === 'paused' },
  { id: 'encerrados', label: tk('Encerrados'), test: (l) => l.status === 'closed' || l.status === 'removed' },
];

const NO_AR = (l) => ['active', 'sold_out'].includes(l.status);

function ListingShare({ listing, onClose }) {
  const url = typeof window !== 'undefined' ? `${window.location.origin}/mercado/anuncio/${listing.id}` : '';
  return (
    <ShareImageDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t('Compartilhar o anúncio')}
      url={url}
      fileName={`mercado-${listing.id}.png`}
      shareText={t('{titulo} por {valor} no Mercado PickleRush', { titulo: listing.title, valor: formatBRL(listing.price_cents) })}
      renderCard={({ ref, qr, showImage }) => (
        <MarketShareCard ref={ref} image={coverOf(listing)?.url} showImage={showImage} qr={qr} title={listing.title}
          subtitle={listing.seller_name} priceCents={listing.price_cents} compareAtCents={listing.compare_at_cents} />
      )}
    />
  );
}

/**
 * UMA ação principal por estado (no ar → Editar; rascunho → Publicar; pausado →
 * Retomar; encerrado → Republicar) e o resto num menu "⋯". Antes eram até seis
 * botões por linha, e no celular a lista virava uma parede de botões.
 */
function ListingRow({ listing: l, selecionavel, marcado, onMarcar, acoes }) {
  const capa = coverOf(l);
  const pct = Math.round(listingCompleteness(l) * 100);
  const editor = `/mercado/vender/anuncio/${l.id}`;
  const podeApagar = !(l.quantity_sold > 0) && ['draft', 'paused', 'closed'].includes(l.status);
  let principal = null;
  if (l.status === 'draft') principal = <V2Button type="button" size="sm" onClick={() => acoes.republicar(l)}>{t('Publicar')}</V2Button>;
  else if (l.status === 'paused') principal = <V2Button type="button" size="sm" variant="secondary" onClick={() => acoes.status(l, 'active', t('Anúncio de volta ao ar.'))}>{t('Retomar')}</V2Button>;
  else if (l.status === 'closed') principal = <V2Button type="button" size="sm" variant="secondary" onClick={() => acoes.republicar(l)}>{t('Republicar')}</V2Button>;
  else if (NO_AR(l)) principal = <V2Button asChild size="sm" variant="secondary"><Link to={editor}><Pencil className="h-4 w-4" /> {t('Editar')}</Link></V2Button>;
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      {selecionavel && (
        <input type="checkbox" aria-label={t('Selecionar {titulo}', { titulo: l.title || t('anúncio') })} className="h-5 w-5 shrink-0 accent-ink" checked={marcado} onChange={(e) => onMarcar(e.target.checked)} />
      )}
      <Link to={editor} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-paper">{capa ? <MarketPhoto src={capa.thumb_url || capa.url} aspect={capa.aspect} frame={capa.frame} loading="lazy" /> : <Package className="m-5 h-6 w-6 text-gray-300" />}</span>
        <span className="min-w-0">
          <span className="block truncate font-bold text-ink">{l.title || t('Sem título')}</span>
          <span className="block text-sm text-gray-600">{l.compare_at_cents > l.price_cents && <span className="mr-1 text-gray-500 line-through">{formatBRL(l.compare_at_cents)}</span>}{formatBRL(l.price_cents)} · {t('{n} em estoque', { n: l.quantity ?? 0 })}{l.quantity_sold ? ` · ${tn(l.quantity_sold, '{n} vendido', '{n} vendidos')}` : ''}</span>
          <span className="block text-xs text-gray-500">{l.favorite_count ? `${t('{n} favoritos', { n: l.favorite_count })} · ` : ''}{t('{pct}% completo', { pct })}</span>
        </span>
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <V2Badge tone={l.status === 'active' ? 'green' : l.status === 'removed' ? 'red' : 'neutral'}>{LISTING_STATUS_LABELS[l.status] ? t(LISTING_STATUS_LABELS[l.status]) : l.status}</V2Badge>
        {(l.status === 'removed' || l.moderation?.auto) && l.moderation?.reason && <span className="text-xs text-red-600">{l.moderation.auto ? `${t('Pausado pela moderação:')} ` : ''}{l.moderation.reason}</span>}
        {l.status !== 'removed' && (
          <>
            {principal}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label={t('Mais ações para {titulo}', { titulo: l.title || t('o anúncio') })} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-paper hover:text-ink">
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!NO_AR(l) && <DropdownMenuItem asChild><Link to={editor}><Pencil className="mr-2 h-4 w-4" /> {t('Editar')}</Link></DropdownMenuItem>}
                {NO_AR(l) && <DropdownMenuItem asChild><Link to={`/mercado/anuncio/${l.id}`}><ExternalLink className="mr-2 h-4 w-4" /> {t('Ver anúncio')}</Link></DropdownMenuItem>}
                {['active', 'sold_out', 'paused'].includes(l.status) && <DropdownMenuItem onClick={() => acoes.precoEstoque(l)}>{t('Preço e estoque')}</DropdownMenuItem>}
                {NO_AR(l) && <DropdownMenuItem onClick={() => acoes.status(l, 'paused', t('Anúncio pausado.'))}>{t('Pausar')}</DropdownMenuItem>}
                {l.status === 'paused' && <DropdownMenuItem onClick={() => acoes.status(l, 'active', t('Anúncio de volta ao ar.'))}>{t('Retomar')}</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => acoes.duplicar(l)}><Copy className="mr-2 h-4 w-4" /> {t('Duplicar')}</DropdownMenuItem>
                {NO_AR(l) && <DropdownMenuItem onClick={() => acoes.compartilhar(l)}><Share2 className="mr-2 h-4 w-4" /> {t('Compartilhar')}</DropdownMenuItem>}
                {(['active', 'sold_out', 'paused'].includes(l.status) || podeApagar) && <DropdownMenuSeparator />}
                {['active', 'sold_out', 'paused'].includes(l.status) && <DropdownMenuItem onClick={() => acoes.confirmar({ tipo: 'encerrar', listing: l })}>{t('Encerrar')}</DropdownMenuItem>}
                {podeApagar && <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => acoes.confirmar({ tipo: 'apagar', listing: l })}><Trash2 className="mr-2 h-4 w-4" /> {t('Apagar')}</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </li>
  );
}

function ListingsTab({ sellerKey, seller }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const q = useSellerListings(sellerKey);
  const settings = useMarketSettings();
  const [filtro, setFiltro] = useState('ativos');
  const [editar, setEditar] = useState(null);
  const [compartilhar, setCompartilhar] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [marcados, setMarcados] = useState([]);
  const status = useMarketMutation(({ l, s }) => setListingStatus(l, s));
  const emLote = useMarketMutation(async ({ ls, s }) => {
    const r = await Promise.allSettled(ls.map((l) => setListingStatus(l, s)));
    return r.filter((x) => x.status === 'rejected').length;
  });
  const apagar = useMarketMutation(deleteListing);
  const republicar = useMarketMutation((l) => republishListing(l, { settings: settings.data }));
  const duplicar = useMarketMutation((l) => duplicateListing(l, { uid: user.uid, seller: { ...seller, seller_key: sellerKey }, settings: settings.data }));
  if (q.isError) return <V2ErrorState onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={5} />;
  const todos = q.data || [];
  if (!todos.length) {
    return <V2EmptyState icon={Package} title={t('Nenhum anúncio ainda')} description={t('Fotos boas, um título com marca e modelo e o preço certo: em poucos minutos o seu produto está no ar.')} action={<V2Button asChild><Link to={novoAnuncio(sellerKey)}><Plus className="h-4 w-4" /> {t('Criar o primeiro anúncio')}</Link></V2Button>} />;
  }
  const f = FILTROS.find((x) => x.id === filtro);
  const lista = todos.filter(f.test);
  const sel = lista.filter((l) => marcados.includes(l.id) && l.status !== 'removed');
  const lote = (s, msg) => emLote.mutate({ ls: sel, s }, {
    onSuccess: (falhas) => { setMarcados([]); setConfirmar(null); if (falhas) toast.error(t('{n} não mudaram. Tente de novo.', { n: falhas })); else toast.success(msg); },
  });
  const ocupado = status.isPending || apagar.isPending || republicar.isPending || duplicar.isPending || emLote.isPending;
  const acoes = {
    status: (l, s, msg) => status.mutate({ l, s }, { onSuccess: () => toast.success(msg), onError: (e) => toast.error(e.message) }),
    precoEstoque: setEditar,
    compartilhar: setCompartilhar,
    confirmar: setConfirmar,
    republicar: (l) => republicar.mutate(l, {
      onSuccess: () => toast.success(t('Anúncio no ar.')),
      onError: (e) => {
        // Falta algo para publicar: o editor mostra o que, campo a campo.
        if (e.fieldErrors && Object.keys(e.fieldErrors).length) { toast.error(t('Falta completar o anúncio: {o}', { o: Object.values(e.fieldErrors).join(' ') })); navigate(`/mercado/vender/anuncio/${l.id}`); } else toast.error(e.message);
      },
    }),
    duplicar: (l) => duplicar.mutate(l, {
      onSuccess: (id) => { toast.success(t('Cópia criada como rascunho.')); navigate(`/mercado/vender/anuncio/${id}`); },
      onError: (e) => toast.error(e.message),
    }),
  };
  const executarConfirmado = () => {
    if (!confirmar) return;
    if (confirmar.tipo === 'encerrar-lote') { lote('closed', t('Anúncios encerrados.')); return; }
    if (confirmar.tipo === 'encerrar') { status.mutate({ l: confirmar.listing, s: 'closed' }, { onSuccess: () => { toast.success(t('Anúncio encerrado.')); setConfirmar(null); }, onError: (e) => toast.error(e.message) }); return; }
    apagar.mutate(confirmar.listing, { onSuccess: () => { toast.success(t('Anúncio apagado.')); setConfirmar(null); }, onError: (e) => toast.error(e.message) });
  };
  const textos = {
    'encerrar-lote': { title: t('Encerrar {n} anúncios?', { n: sel.length }), description: t('Eles saem do ar. Dá para republicar depois, um a um.'), label: t('Encerrar') },
    encerrar: { title: t('Encerrar este anúncio?'), description: t('Ele sai do ar e deixa de aparecer nas buscas. Dá para republicar depois.'), label: t('Encerrar') },
    apagar: { title: t('Apagar este anúncio?'), description: t('As fotos e o texto somem do Mercado. Não dá para desfazer.'), label: t('Apagar') },
  }[confirmar?.tipo] || {};
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((x) => <V2FilterChip key={x.id} active={filtro === x.id} onClick={() => { setFiltro(x.id); setMarcados([]); }}>{t(x.label)} ({todos.filter(x.test).length})</V2FilterChip>)}
        </div>
      </div>
      {sel.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-paper p-3 text-sm" role="region" aria-label={t('Ações nos selecionados')}>
          <span className="font-bold text-ink">{tn(sel.length, '{n} selecionado', '{n} selecionados')}</span>
          {filtro === 'ativos' && <V2Button type="button" size="sm" variant="ghost" disabled={emLote.isPending} onClick={() => lote('paused', t('Anúncios pausados.'))}>{t('Pausar')}</V2Button>}
          {filtro === 'pausados' && <V2Button type="button" size="sm" variant="secondary" disabled={emLote.isPending} onClick={() => lote('active', t('Anúncios de volta ao ar.'))}>{t('Retomar')}</V2Button>}
          {['ativos', 'pausados'].includes(filtro) && <V2Button type="button" size="sm" variant="ghost" disabled={emLote.isPending} onClick={() => setConfirmar({ tipo: 'encerrar-lote' })}>{t('Encerrar')}</V2Button>}
          <V2Button type="button" size="sm" variant="ghost" onClick={() => setMarcados([])}>{t('Limpar')}</V2Button>
        </div>
      )}
      {!lista.length ? <p className="py-10 text-center text-sm text-gray-500">{t('Nada aqui.')}</p> : (
        <ul className="divide-y divide-gray-100 rounded-[1.5rem] border border-gray-100 bg-paper-pure">
          {lista.map((l) => (
            <ListingRow
              key={l.id}
              listing={l}
              selecionavel={['ativos', 'pausados'].includes(filtro)}
              marcado={marcados.includes(l.id)}
              onMarcar={(on) => setMarcados((m) => (on ? [...m, l.id] : m.filter((x) => x !== l.id)))}
              acoes={acoes}
            />
          ))}
        </ul>
      )}
      {editar && <QuickEdit listing={editar} onClose={() => setEditar(null)} />}
      {compartilhar && <ListingShare listing={compartilhar} onClose={() => setCompartilhar(null)} />}
      <ConfirmDialog
        open={Boolean(confirmar)}
        onOpenChange={(o) => !o && setConfirmar(null)}
        title={textos.title}
        description={textos.description}
        confirmLabel={textos.label}
        destructive={confirmar?.tipo === 'apagar'}
        loading={ocupado}
        onConfirm={executarConfirmado}
      />
    </div>
  );
}

/* --------------------------------------------------------------- vendas -- */

function SalesTab({ sellerKey }) {
  const q = useSellerOrders(sellerKey);
  const [fim, setFim] = useState(false);
  if (q.isError) return <V2ErrorState onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={4} />;
  const todos = q.data || [];
  if (!todos.length) return <V2EmptyState icon={Receipt} title={t('Nenhuma venda ainda')} description={t('Quando alguém comprar, o pedido aparece aqui e você recebe um aviso.')} />;
  const lista = todos.filter((o) => (fim ? !ACTIVE_ORDER(o) : ACTIVE_ORDER(o)))
    .sort((a, b) => (MY_TURN_ORDER(b) - MY_TURN_ORDER(a)) || (b.placed_at_ms || 0) - (a.placed_at_ms || 0));
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <V2FilterChip active={!fim} onClick={() => setFim(false)}>{t('Em andamento ({n})', { n: todos.filter(ACTIVE_ORDER).length })}</V2FilterChip>
        <V2FilterChip active={fim} onClick={() => setFim(true)}>{t('Encerradas')}</V2FilterChip>
      </div>
      {!lista.length ? <p className="py-10 text-center text-sm text-gray-500">{t('Nada aqui.')}</p> : (
        <ul className="divide-y divide-gray-100 rounded-[1.5rem] border border-gray-100 bg-paper-pure">
          {lista.map((o) => (
            <li key={o.id}>
              <Link to={`/mercado/vendas/${o.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-paper">
                <span className="min-w-0">
                  <span className="block truncate font-bold text-ink">{(o.items || [])[0]?.title}{(o.items || []).length > 1 ? ` ${t('e mais {n}', { n: o.items.length - 1 })}` : ''}</span>
                  <span className="block text-xs text-gray-500">{o.buyer_name} · {o.code}</span>
                  {ACTIVE_ORDER(o) && <span className={cn('mt-1 block text-sm', MY_TURN_ORDER(o) ? 'font-bold text-ink' : 'text-gray-600')}>{orderWaitingOn(o, 'seller')}</span>}
                </span>
                <span className="shrink-0 space-y-1 text-right">
                  <V2Badge tone={statusTone(o.status)}>{ORDER_STATUS_LABELS[o.status] ? t(ORDER_STATUS_LABELS[o.status]) : o.status}</V2Badge>
                  <span className="block font-bold text-ink">{formatBRL(o.total_cents)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- ofertas -- */

function OffersTab({ sellerKey }) {
  const q = useSellerOffers(sellerKey);
  if (q.isError) return <V2ErrorState onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={4} />;
  const agora = Date.now();
  const lista = [...(q.data || [])].map((o) => ({ ...o, mostrado: offerDisplayStatus(o, agora) })).sort((a, b) => (b.mostrado === 'pending') - (a.mostrado === 'pending'));
  if (!lista.length) return <V2EmptyState icon={HandCoins} title={t('Nenhuma oferta')} description={t('Nos anúncios que aceitam oferta, o comprador propõe um valor e você responde aqui.')} />;
  return (
    <ul className="divide-y divide-gray-100 rounded-[1.5rem] border border-gray-100 bg-paper-pure">
      {lista.map((o) => (
        <li key={o.id}>
          <Link to={`/mercado/ofertas/${o.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-paper">
            <span className="min-w-0">
              <span className="block truncate font-bold text-ink">{o.listing_title}</span>
              <span className="block text-xs text-gray-500">{o.buyer_name || t('Comprador')} · {t('anunciado por {valor}', { valor: formatBRL(o.list_price_cents) })}</span>
            </span>
            <span className="shrink-0 space-y-1 text-right">
              <V2Badge tone={o.mostrado === 'pending' ? 'amber' : o.mostrado === 'ordered' ? 'green' : 'neutral'}>{o.mostrado === 'pending' ? t('Responder') : OFFER_STATUS_LABELS[o.mostrado] ? t(OFFER_STATUS_LABELS[o.mostrado]) : o.mostrado}</V2Badge>
              <span className="block font-bold text-ink">{formatBRL(o.amount_cents)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------ perguntas -- */

function AnswerForm({ question }) {
  const { user } = useAuth();
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const m = useMarketMutation(({ q, t: resposta }) => answerQuestion(q, { uid: user.uid, text: resposta }));
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const r = validateAnswer(texto);
        if (r.error) { setErro(r.error); return; }
        m.mutate({ q: question, t: texto }, { onSuccess: () => toast.success(t('Resposta publicada.')), onError: (er) => setErro(er.message) });
      }}
    >
      <label htmlFor={`resp-${question.id}`} className="sr-only">{t('Sua resposta')}</label>
      <V2Textarea id={`resp-${question.id}`} rows={2} maxLength={1000} value={texto} onChange={(e) => { setTexto(e.target.value); setErro(''); }} placeholder={t('Responda para todos verem no anúncio')} />
      {erro && <p role="alert" className="text-sm font-medium text-red-500">{erro}</p>}
      <V2Button type="submit" size="sm" disabled={m.isPending || !texto.trim()}>{t('Responder')}</V2Button>
    </form>
  );
}

function QuestionCard({ x }) {
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-2 p-4">
        <Link to={`/mercado/anuncio/${x.listing_id}?ancora=perguntas`} className="text-xs font-bold text-gray-500 hover:underline">{x.listing_title}</Link>
        <p className="text-sm text-ink"><strong>{x.asker_name}:</strong> {x.text}</p>
        {x.status === 'answered' ? <p className="rounded-2xl bg-paper p-3 text-sm text-gray-700">{x.answer}</p> : <AnswerForm question={x} />}
      </V2Surface>
    </li>
  );
}

function QuestionsTab({ sellerKey }) {
  const q = useSellerQuestions(sellerKey);
  const [soAbertas, setSoAbertas] = useState(false);
  if (q.isError) return <V2ErrorState onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={4} />;
  const lista = q.data || [];
  if (!lista.length) return <V2EmptyState icon={MessageCircleQuestion} title={t('Nenhuma pergunta')} description={t('As perguntas dos compradores sobre os seus anúncios aparecem aqui. Responder rápido ajuda a vender.')} />;
  const abertas = lista.filter((x) => x.status === 'open');
  const respondidas = lista.filter((x) => x.status !== 'open');
  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <V2FilterChip active={soAbertas} onClick={() => setSoAbertas(true)}>{t('Sem resposta ({n})', { n: abertas.length })}</V2FilterChip>
        <V2FilterChip active={!soAbertas} onClick={() => setSoAbertas(false)}>{t('Todas ({n})', { n: lista.length })}</V2FilterChip>
      </div>
      <section aria-labelledby="perg-abertas" className="space-y-3">
        <h2 id="perg-abertas" className="text-sm font-bold uppercase tracking-wide text-gray-500">{t('Sem resposta')} ({abertas.length})</h2>
        {abertas.length ? <ul className="space-y-3">{abertas.map((x) => <QuestionCard key={x.id} x={x} />)}</ul> : <p className="text-sm text-gray-500">{t('Tudo respondido.')}</p>}
      </section>
      {!soAbertas && respondidas.length > 0 && (
        <section aria-labelledby="perg-resp" className="space-y-3">
          <h2 id="perg-resp" className="text-sm font-bold uppercase tracking-wide text-gray-500">{t('Respondidas')} ({respondidas.length})</h2>
          <ul className="space-y-3">{respondidas.map((x) => <QuestionCard key={x.id} x={x} />)}</ul>
        </section>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- avaliações -- */

function ReviewsTab({ sellerKey }) {
  return (
    <V2Surface>
      <SellerReviews sellerKey={sellerKey} title={t('O que os compradores disseram')} emptyText={t('Ainda sem avaliações visíveis.')} />
    </V2Surface>
  );
}

/* ------------------------------------------------------------------ pix -- */

function PixTab({ sellerKey }) {
  const q = useSellerPrivate(sellerKey);
  const [form, setForm] = useState(null);
  const [erros, setErros] = useState({});
  const m = useMarketMutation(({ k, v }) => savePayment(k, v));
  if (q.isError) return <V2ErrorState onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={4} />;
  const f = form || { pix_key_type: q.data?.pix_key_type || 'cpf', pix_key: q.data?.pix_key || '', receiver_name: q.data?.receiver_name || '', instructions: q.data?.instructions || '' };
  const set = (patch) => { setForm({ ...f, ...patch }); setErros({}); };
  return (
    <V2Surface className="max-w-xl space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">{t('Como você recebe')}</h2>
        <p className="text-sm text-gray-500">{t('O comprador só vê a chave depois que você aceita o pedido, e o Pix cai direto na sua conta. O PickleRush não cobra comissão.')}</p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate({ k: sellerKey, v: f }, { onSuccess: () => { toast.success(t('Chave Pix salva.')); setForm(null); }, onError: (er) => setErros(er.fieldErrors || {}) });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <V2Field label={t('Tipo da chave')} htmlFor="pix-tipo">
            <V2Select id="pix-tipo" value={f.pix_key_type} onChange={(e) => set({ pix_key_type: e.target.value })}>
              {Object.entries(PIX_KEY_TYPES).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
            </V2Select>
          </V2Field>
          <V2Field label={t('Chave Pix')} htmlFor="pix-chave" error={erros.pix_key}><V2Input id="pix-chave" value={f.pix_key} onChange={(e) => set({ pix_key: e.target.value })} /></V2Field>
        </div>
        <V2Field label={t('Nome de quem recebe')} htmlFor="pix-nome" error={erros.receiver_name} hint={t('Como aparece no app do banco. O comprador confere antes de pagar.')}>
          <V2Input id="pix-nome" maxLength={80} value={f.receiver_name} onChange={(e) => set({ receiver_name: e.target.value })} />
        </V2Field>
        <V2Field label={t('Instruções (opcional)')} htmlFor="pix-inst" hint={t('Ex.: mande o comprovante pela conversa.')}>
          <V2Textarea id="pix-inst" rows={2} maxLength={300} value={f.instructions} onChange={(e) => set({ instructions: e.target.value })} />
        </V2Field>
        <V2Button type="submit" disabled={m.isPending}>{m.isPending ? t('Salvando…') : t('Salvar')}</V2Button>
      </form>
    </V2Surface>
  );
}

/* -------------------------------------------------------------- vitrine -- */

function ImagePick({ label, url, onPick, wide }) {
  const { user } = useAuth();
  const [pct, setPct] = useState(0);
  const id = `img-${label}`;
  const escolher = async (file) => {
    if (!file) return;
    const prep = await prepareMarketFile(file, { allowVideo: false });
    if (!prep.ok || prep.type !== 'image') { toast.error(prep.error || t('Escolha uma foto.')); return; }
    try {
      const r = await uploadMarketFile(prep.file, { uid: user.uid, kind: 'image', folder: 'vitrine', onProgress: setPct }).done;
      onPick(r.url);
    } catch (e) { toast.error(e.message); } finally { setPct(0); }
  };
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <label htmlFor={id} className={cn('relative flex cursor-pointer items-center justify-center overflow-hidden border-2 border-dashed border-gray-200 bg-paper text-gray-500 hover:border-ink', wide ? 'h-28 rounded-2xl' : 'h-24 w-24 rounded-full')}>
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6" />}
        {pct > 0 && <span className="absolute inset-0 flex items-center justify-center bg-paper-pure/80 text-xs font-bold text-ink">{pct}%</span>}
      </label>
      <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { escolher(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}

/** "Modo férias" = pausar TODOS os anúncios no ar de uma vez, e retomar depois. Nenhum campo novo. */
function VacationMode({ sellerKey }) {
  const q = useSellerListings(sellerKey);
  const [confirmar, setConfirmar] = useState(false);
  const m = useMarketMutation(async ({ ls, s }) => {
    const r = await Promise.allSettled(ls.map((l) => setListingStatus(l, s)));
    return r.filter((x) => x.status === 'rejected').length;
  });
  if (q.isError) return <V2ErrorState inline onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={2} />;
  const { noAr, pausados, todosPausados } = vacationState(q.data || []);
  const ligado = todosPausados;
  const nada = !noAr.length && !pausados.length;
  const aplicar = () => m.mutate({ ls: ligado ? pausados : noAr, s: ligado ? 'active' : 'paused' }, {
    onSuccess: (falhas) => { setConfirmar(false); if (falhas) toast.error(t('{n} não mudaram. Tente de novo.', { n: falhas })); else toast.success(ligado ? t('Anúncios de volta ao ar.') : t('Anúncios pausados.')); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <V2Surface className="max-w-2xl space-y-3">
      <div className="flex items-center gap-2">
        <Palmtree className="h-5 w-5 text-amber-600" />
        <h2 className="font-display text-lg font-bold text-ink">{t('Modo férias')}</h2>
      </div>
      <V2Toggle
        id="modo-ferias"
        checked={ligado}
        onChange={() => { if (!nada) setConfirmar(true); }}
        label={ligado ? t('Retomar') : t('Pausar todos os anúncios enquanto estou fora')}
        hint={nada ? t('Sem anúncios no ar nem pausados.') : ligado ? t('{n} anúncios pausados voltam ao ar.', { n: pausados.length }) : t('{n} anúncios saem do ar até você retomar. Ninguém consegue comprar nem perguntar.', { n: noAr.length })}
      />
      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title={ligado ? t('Retomar as vendas?') : t('Pausar todos os anúncios?')}
        description={ligado ? t('{n} anúncios pausados voltam ao ar agora.', { n: pausados.length }) : t('{n} anúncios saem do ar até você retomar aqui. Os pedidos em andamento continuam.', { n: noAr.length })}
        confirmLabel={ligado ? t('Retomar') : t('Pausar todos')}
        loading={m.isPending}
        onConfirm={aplicar}
      />
    </V2Surface>
  );
}

function PoliciesForm({ sellerKey, seller }) {
  const [f, setF] = useState({ ship_within_hours: String(seller.policies?.ship_within_hours || 48), return_days: String(seller.policies?.return_days ?? (seller.seller_type === 'store' ? 7 : 0)) });
  const [erros, setErros] = useState({});
  const m = useMarketMutation(({ k, v }) => saveSellerPolicies(k, v, { sellerType: seller.seller_type }));
  return (
    <V2Surface className="max-w-2xl space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">{t('Políticas')}</h2>
        <p className="text-sm text-gray-500">{t('Aparecem na sua vitrine e no anúncio. Prometa só o que consegue cumprir.')}</p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setErros({});
          m.mutate({ k: sellerKey, v: f }, { onSuccess: () => toast.success(t('Políticas salvas.')), onError: (er) => { setErros(er.fieldErrors || {}); if (!er.fieldErrors) toast.error(er.message); } });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <V2Field label={t('Envio em até (horas)')} htmlFor="pol-envio" error={erros.ship_within_hours} hint={t('Depois de confirmar o pagamento. Entre 1 e 240.')}>
            <V2Input id="pol-envio" type="number" min={1} max={240} value={f.ship_within_hours} onChange={(e) => setF((x) => ({ ...x, ship_within_hours: e.target.value }))} />
          </V2Field>
          <V2Field label={t('Devolução em até (dias)')} htmlFor="pol-dev" error={erros.return_days} hint={seller.seller_type === 'store' ? t('Loja: ao menos 7 dias (Código de Defesa do Consumidor).') : t('0 = sem devolução, exceto por defeito.')}>
            <V2Input id="pol-dev" type="number" min={0} max={90} value={f.return_days} onChange={(e) => setF((x) => ({ ...x, return_days: e.target.value }))} />
          </V2Field>
        </div>
        <V2Button type="submit" disabled={m.isPending}>{m.isPending ? t('Salvando…') : t('Salvar políticas')}</V2Button>
      </form>
    </V2Surface>
  );
}

function StorefrontTab({ sellerKey, seller }) {
  const [f, setF] = useState({ display_name: seller.display_name || '', bio: seller.bio || '', city: seller.city || '', state: seller.state || '', website: seller.website || '', logo_url: seller.logo_url || '', banner_url: seller.banner_url || '' });
  const m = useMarketMutation(({ k, v }) => updateSellerProfile(k, v));
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  return (
    <V2Surface className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <V2Avatar name={f.display_name} photoUrl={f.logo_url} size="lg" />
        <div>
          <h2 className="font-display text-lg font-bold text-ink">{t('A sua vitrine')}</h2>
          <Link to={`/mercado/vendedor/${sellerKey}`} className="text-sm font-bold text-ink underline">{t('Ver como o comprador vê')}</Link>
        </div>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (f.website && !/^https:\/\//.test(f.website.trim())) { toast.error(t('O site precisa começar com https://')); return; }
          m.mutate({ k: sellerKey, v: f }, { onSuccess: () => toast.success(t('Vitrine atualizada.')), onError: (er) => toast.error(er.message) });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
          <ImagePick label={t('Logo')} url={f.logo_url} onPick={(u) => set({ logo_url: u })} />
          <ImagePick label={t('Capa')} url={f.banner_url} wide onPick={(u) => set({ banner_url: u })} />
        </div>
        <V2Field label={t('Nome')} htmlFor="v-nome"><V2Input id="v-nome" maxLength={60} value={f.display_name} onChange={(e) => set({ display_name: e.target.value })} /></V2Field>
        <V2Field label={t('Sobre')} htmlFor="v-bio" hint={t('Quem você é, o que vende, como entrega. Até 600 caracteres.')}>
          <V2Textarea id="v-bio" rows={4} maxLength={600} value={f.bio} onChange={(e) => set({ bio: e.target.value })} />
        </V2Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <V2Field label={t('Cidade')} htmlFor="v-cidade"><V2Input id="v-cidade" maxLength={60} value={f.city} onChange={(e) => set({ city: e.target.value })} /></V2Field>
          <V2Field label={t('UF')} htmlFor="v-uf">
            <V2Select id="v-uf" value={f.state} onChange={(e) => set({ state: e.target.value })}>
              <option value="">—</option>
              {BR_UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </V2Select>
          </V2Field>
        </div>
        <V2Field label={t('Site (opcional)')} htmlFor="v-site"><V2Input id="v-site" type="url" placeholder={t('https://')} value={f.website} onChange={(e) => set({ website: e.target.value })} /></V2Field>
        <V2Button type="submit" disabled={m.isPending}>{m.isPending ? t('Salvando…') : t('Salvar vitrine')}</V2Button>
      </form>
    </V2Surface>
  );
}

function StoreSettingsTab({ sellerKey, seller }) {
  return (
    <div className="space-y-5">
      <StorefrontTab key={sellerKey} sellerKey={sellerKey} seller={seller} />
      <PoliciesForm key={`pol-${sellerKey}`} sellerKey={sellerKey} seller={seller} />
      <VacationMode sellerKey={sellerKey} />
    </div>
  );
}

/* --------------------------------------------------------------- página -- */

function SellPage() {
  const { user, userProfile } = useAuth();
  const [params, setParams] = useSearchParams();
  const coach = useCoach(user?.uid);
  const { arenas = [] } = useMyArenaSummary();
  const storeKey = user ? sellerKeyFor('store', user.uid) : '';
  const store = useSeller(storeKey);
  const nome = userProfile?.platform_name || userProfile?.full_name || user?.displayName || '';
  const ids = useMemo(() => sellingIdentities({ uid: user?.uid, name: nome, isCoach: Boolean(coach.data), arenas, store: store.data }), [user?.uid, nome, coach.data, arenas, store.data]);
  const como = ids.find((i) => i.key === params.get('como')) || ids[0];
  const aba = ABAS.some((a) => a.value === params.get('aba')) ? params.get('aba') : 'resumo';
  const secao = SECOES.find((sec) => sec.abas.some((a) => a.value === aba));
  const sq = useSeller(como?.key);
  const ir = (patch) => setParams((p) => { const n = new URLSearchParams(p); Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); return n; }, { replace: true });

  const arenaDe = como?.type === 'arena' ? arenas.find((a) => a.id === como.entity_id) : null;
  const defaults = { name: arenaDe?.name || nome, city: arenaDe?.city || userProfile?.city || '', state: arenaDe?.state || userProfile?.state || '', photo: arenaDe?.logo_url || userProfile?.photo_url || '' };
  let corpo;
  if (!como) corpo = <V2Skeleton className="h-64" />;
  else if (sq.isError) corpo = <V2ErrorState onRetry={() => sq.refetch()} />;
  else if (sq.isLoading) corpo = <V2Skeleton className="h-64" />;
  else if (!sq.data) corpo = <StartSelling identity={como} defaults={defaults} />;
  else if (sq.data.status !== 'active') {
    corpo = (
      <V2Surface className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-bold text-ink">{sq.data.status === 'pending' ? t('Cadastro em análise') : t('Vendas suspensas')}</p>
          <p className="text-sm text-gray-600">{sq.data.reject_reason || (sq.data.status === 'pending' ? t('A equipe do PickleRush avisa assim que analisar.') : t('Fale com o suporte para entender o motivo.'))}</p>
        </div>
      </V2Surface>
    );
  } else {
    const props = { sellerKey: como.key, seller: sq.data };
    corpo = (
      <div className="space-y-5">
        <div className="space-y-2">
          <V2SectionNav
            ariaLabel={t('Painel de vendas')}
            sections={SECOES.map((sec) => ({ ...sec, label: t(sec.label) }))}
            activeId={secao.id}
            onSelect={(sec) => ir({ aba: sec.abas[0].value === 'resumo' ? '' : sec.abas[0].value })}
          />
          {secao.abas.length > 1 && (
            <V2SubTabs ariaLabel={t(secao.label)} tabs={secao.abas.map((a) => ({ ...a, label: t(a.label) }))} activeValue={aba} onSelect={(tab) => ir({ aba: tab.value })} />
          )}
        </div>
        {aba === 'resumo' && <Summary {...props} go={(a) => ir({ aba: a })} />}
        {aba === 'anuncios' && <ListingsTab {...props} />}
        {aba === 'vendas' && <SalesTab {...props} />}
        {aba === 'ofertas' && <OffersTab {...props} />}
        {aba === 'perguntas' && <QuestionsTab {...props} />}
        {aba === 'avaliacoes' && <ReviewsTab {...props} />}
        {aba === 'pix' && <PixTab {...props} />}
        {aba === 'vitrine' && <StoreSettingsTab {...props} />}
        {aba === 'divulgar' && <SellerPromoTab key={como.key} {...props} />}
        {aba === 'desempenho' && <SellerInsightsTab {...props} />}
      </div>
    );
  }

  return (
    <V2Page className="space-y-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <V2PageIntro
          title={t('Vender no Mercado')}
          subtitle={t('Anúncios, negociações e o Pix, num lugar só.')}
          action={sq.data?.status === 'active' ? (
            <span className="flex flex-wrap gap-2">
              <V2Button asChild variant="secondary"><Link to={`/mercado/vendedor/${como.key}`}>{t('Ver minha vitrine')}</Link></V2Button>
              <V2Button asChild><Link to={novoAnuncio(como.key)}><Plus className="h-4 w-4" /> {t('Novo anúncio')}</Link></V2Button>
            </span>
          ) : null}
        />
        {ids.length > 1 && (
          <V2Field label={t('Vendendo como')} htmlFor="vendendo-como" className="w-full sm:w-72">
            <V2Select id="vendendo-como" value={como?.key || ''} onChange={(e) => ir({ como: e.target.value, aba: '' })}>
              {ids.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
            </V2Select>
          </V2Field>
        )}
      </div>
      {corpo}
      {!store.isLoading && !store.isError && store.data?.status !== 'active' && (
        <p className="text-sm text-gray-500">
          {store.data?.status === 'pending'
            ? <>{t('A sua loja está em análise.')} <Link to="/mercado/loja/abrir" className="font-bold text-ink underline">{t('Ver o cadastro')}</Link></>
            : <>{t('Vende como empresa, com CNPJ?')} <Link to="/mercado/loja/abrir" className="font-bold text-ink underline">{t('Abrir uma loja')}</Link></>}
        </p>
      )}
    </V2Page>
  );
}

export default function V2MarketSell() {
  return <MarketGate><SellPage /></MarketGate>;
}
