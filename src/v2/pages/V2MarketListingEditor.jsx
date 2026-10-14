/**
 * V2MarketListingEditor — criar e editar um anúncio do Mercado:
 * `/mercado/vender/anuncio/novo?como=<sellerKey>` e
 * `/mercado/vender/anuncio/:listingId`.
 *
 * Um formulário só, de cima para baixo na ordem em que se pensa: fotos, o que
 * é, características, descrição, preço, entrega. A validação é a do domínio
 * (`validateListingInput`), a mesma do serviço; "Salvar rascunho" aceita
 * incompleto, "Publicar" exige o mínimo para ir ao ar. Ao lado, a prévia do
 * cartão como o comprador vai ver.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ImagePlus, Star, Trash2, Video } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { BR_UFS } from '@/core/domain/ufs';
import { attributesFor, activeCategories } from '@/modules/marketplace/domain/taxonomy';
import { CONDITION_LABELS, FULFILLMENT_LABELS, LISTING_TYPE, MEDIA_LIMITS, TEXT_LIMITS } from '@/modules/marketplace/domain/constants';
import { listingCompleteness, validateListingInput } from '@/modules/marketplace/domain/listing';
import { formatBRL, parseBRL } from '@/modules/marketplace/domain/money';
import { saveListing } from '@/modules/marketplace/services/marketService';
import { linkArenaProduct } from '@/modules/marketplace/services/marketOrderService';
import { prepareMarketFile, uploadMarketFile } from '@/modules/marketplace/services/marketMediaService';
import {
  useIsMarketOperator, useListing, useMarketMutation, useMarketSettings, useSeller,
} from '@/modules/marketplace/hooks/useMarket';
import {
  V2BackLink, V2Button, V2ErrorState, V2Field, V2Input, V2PageIntro, V2Select, V2Skeleton, V2Surface, V2Textarea,
} from '@/v2/ui/primitives';
import { rolarAte } from '@/v2/ui/rolarAte';
import { ListingCard, MarketGate } from '@/v2/components/marketplace/marketUi';
import { t } from '@/core/i18n';

const centsText = (c) => (c == null || c === '' ? '' : formatBRL(c).replace(/^R\$\s?/, ''));

function fromListing(l) {
  return {
    title: l?.title || '',
    category_slug: l?.category_slug || '',
    type: [LISTING_TYPE.USED, 'used'].includes(l?.type) ? LISTING_TYPE.USED : LISTING_TYPE.NEW,
    condition: l?.condition && l.condition !== 'new' ? l.condition : '',
    attributes: l?.attributes || {},
    description: l?.description || '',
    price: centsText(l?.price_cents),
    compare_at: centsText(l?.compare_at_cents),
    quantity: String(l?.quantity ?? 1),
    accepts_offers: Boolean(l?.accepts_offers),
    fulfillment: l?.fulfillment || ['meetup'],
    shipping: l?.shipping_cents == null ? '' : centsText(l.shipping_cents),
    shipping_to_agree: Boolean(l?.shipping_to_agree),
    pickup_note: l?.pickup_note || '',
    video_link: l?.video_link || '',
    city: l?.city || '',
    state: l?.state || '',
    media: l?.media || [],
  };
}

function toInput(f) {
  return {
    ...f,
    price_cents: parseBRL(f.price),
    compare_at_cents: f.compare_at ? parseBRL(f.compare_at) : null,
    shipping_cents: f.shipping === '' ? null : parseBRL(f.shipping),
    quantity: f.quantity === '' ? 0 : Number(f.quantity),
  };
}

function Section({ id, title, hint, children }) {
  return (
    <V2Surface as="section" aria-labelledby={`${id}-t`} className="space-y-4">
      <div>
        <h2 id={`${id}-t`} className="font-display text-lg font-bold text-ink">{title}</h2>
        {hint && <p className="text-sm text-gray-500">{hint}</p>}
      </div>
      {children}
    </V2Surface>
  );
}

function MediaEditor({ media, onChange, error }) {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const [envios, setEnvios] = useState([]);
  const fotos = media.filter((m) => m.kind !== 'video');
  const video = media.find((m) => m.kind === 'video');

  const subir = async (files, { asVideo = false } = {}) => {
    const lista = [...files].slice(0, asVideo ? 1 : MEDIA_LIMITS.maxPhotos - fotos.length);
    for (const file of lista) {
      const id = `${file.name}-${Math.random()}`;
      setEnvios((xs) => [...xs, { id, nome: file.name, pct: 0 }]);
      try {
        const prep = await prepareMarketFile(file, { allowVideo: asVideo });
        if (!prep.ok) throw new Error(prep.error);
        if (asVideo !== (prep.type === 'video')) throw new Error(asVideo ? t('Escolha um arquivo de vídeo.') : t('Escolha uma foto.'));
        const up = uploadMarketFile(prep.file, { uid: user.uid, kind: prep.type, folder: 'anuncios', onProgress: (pct) => setEnvios((xs) => xs.map((e) => (e.id === id ? { ...e, pct } : e))) });
        const r = await up.done;
        onChange((atual) => (asVideo
          ? [...atual.filter((m) => m.kind !== 'video'), { url: r.url, path: r.path, kind: 'video', alt: '' }]
          : [...atual.filter((m) => m.kind !== 'video'), { url: r.url, path: r.path, kind: 'image', alt: '' }, ...atual.filter((m) => m.kind === 'video')]));
      } catch (e) {
        toast.error(`${file.name}: ${e.message}`);
      } finally {
        setEnvios((xs) => xs.filter((x) => x.id !== id));
      }
    }
  };

  const mover = (i, passo) => onChange((atual) => {
    const fs = atual.filter((m) => m.kind !== 'video');
    const j = i + passo;
    if (j < 0 || j >= fs.length) return atual;
    [fs[i], fs[j]] = [fs[j], fs[i]];
    return [...fs, ...atual.filter((m) => m.kind === 'video')];
  });
  const tirar = (m) => onChange((atual) => atual.filter((x) => x.url !== m.url));
  const legenda = (m, alt) => onChange((atual) => atual.map((x) => (x.url === m.url ? { ...x, alt } : x)));

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {fotos.map((m, i) => (
          <li key={m.url} className="space-y-1.5">
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-gray-100 bg-paper">
              <img src={m.url} alt={m.alt || t('Foto {n}', { n: i + 1 })} className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-2xs font-bold text-white"><Star className="h-3 w-3" /> {t('Capa')}</span>}
              <div className="absolute inset-x-1 bottom-1 flex justify-between">
                <span className="flex gap-1">
                  <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={t('Mover a foto {n} para a esquerda', { n: i + 1 })} className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-pure/90 text-ink disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                  <button type="button" onClick={() => mover(i, 1)} disabled={i === fotos.length - 1} aria-label={t('Mover a foto {n} para a direita', { n: i + 1 })} className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-pure/90 text-ink disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                </span>
                <button type="button" onClick={() => tirar(m)} aria-label={t('Tirar a foto {n}', { n: i + 1 })} className="flex h-8 w-8 items-center justify-center rounded-full bg-paper-pure/90 text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <label className="sr-only" htmlFor={`alt-${i}`}>{t('Descrição da foto {n}', { n: i + 1 })}</label>
            <input id={`alt-${i}`} value={m.alt || ''} maxLength={140} onChange={(e) => legenda(m, e.target.value)} placeholder={t('Descreva a foto (opcional)')} className="w-full rounded-xl border border-gray-200 bg-paper-pure px-2 py-1.5 text-xs text-ink" />
          </li>
        ))}
        {envios.map((e) => (
          <li key={e.id} className="flex aspect-square flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 text-xs text-gray-500">
            <span className="max-w-full truncate px-2">{e.nome}</span>
            <span>{e.pct}%</span>
          </li>
        ))}
        {fotos.length + envios.length < MEDIA_LIMITS.maxPhotos && (
          <li>
            <button type="button" onClick={() => inputRef.current?.click()} className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 text-sm font-bold text-gray-500 hover:border-ink hover:text-ink">
              <ImagePlus className="h-7 w-7" />
              {t('Adicionar fotos')}
            </button>
          </li>
        )}
      </ul>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { subir(e.target.files); e.target.value = ''; }} />
      <p className="text-xs text-gray-500">{t('Até {n} fotos. A primeira é a capa. Fotos com boa luz, de frente e mostrando os detalhes (ou marcas de uso) vendem mais.', { n: MEDIA_LIMITS.maxPhotos })}</p>
      <div className="flex flex-wrap items-center gap-3">
        {video ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-sm text-ink">
            <Video className="h-4 w-4" /> {t('Vídeo enviado')}
            <button type="button" onClick={() => tirar(video)} className="font-bold text-red-600 underline">{t('Tirar')}</button>
          </span>
        ) : (
          <V2Button type="button" size="sm" variant="ghost" onClick={() => videoRef.current?.click()}><Video className="h-4 w-4" /> {t('Enviar um vídeo (até {n} s)', { n: MEDIA_LIMITS.maxVideoSeconds })}</V2Button>
        )}
        <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { subir(e.target.files, { asVideo: true }); e.target.value = ''; }} />
      </div>
      {error && <p role="alert" className="text-sm font-medium text-red-500">{error}</p>}
    </div>
  );
}

function AttributeField({ attr, value, onChange, error }) {
  const id = `attr-${attr.key}`;
  const label = attr.unit ? `${t(attr.label)} (${attr.unit})` : t(attr.label);
  if (attr.type === 'select') {
    return (
      <V2Field label={label} htmlFor={id} error={error}>
        <V2Select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {attr.options.map((o) => <option key={o} value={o}>{attr.unit ? `${o} ${attr.unit}` : t(o)}</option>)}
        </V2Select>
      </V2Field>
    );
  }
  if (attr.type === 'boolean') {
    return (
      <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={value === true || value === 'true'} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-ink" />
        {t(attr.label)}
      </label>
    );
  }
  return (
    <V2Field label={label} htmlFor={id} error={error}>
      <V2Input id={id} inputMode={attr.type === 'number' ? 'decimal' : undefined} maxLength={60} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </V2Field>
  );
}

function EditorPage() {
  const { listingId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const editing = Boolean(listingId);
  const lq = useListing(listingId);
  const listing = lq.data;
  const sellerKey = listing?.seller_key || params.get('como') || (user ? `athlete_${user.uid}` : '');
  const sq = useSeller(sellerKey);
  const operador = useIsMarketOperator(sellerKey);
  const settings = useMarketSettings();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const m = useMarketMutation(saveListing);

  useEffect(() => {
    if (form) return;
    if (editing && !listing) return;
    const base = fromListing(listing);
    if (!editing) {
      // Vindo de um mercado interno (loja do professor, mercado da arena):
      // o rascunho preenche, quem vende revisa (`domain/internalProducts.js`).
      Object.assign(base, location.state?.rascunho || {});
      base.city = sq.data?.city || userProfile?.city || '';
      base.state = sq.data?.state || userProfile?.state || '';
    }
    setForm(base);
  }, [editing, listing, sq.data, userProfile, form, location.state]);

  const cats = useMemo(() => activeCategories(settings.data?.disabled_categories), [settings.data]);
  const attrs = useMemo(() => attributesFor(form?.category_slug), [form?.category_slug]);
  const set = (patch) => { setForm((f) => ({ ...f, ...(typeof patch === 'function' ? patch(f) : patch) })); };
  const preview = useMemo(() => {
    if (!form) return null;
    const v = validateListingInput(toInput(form)).value;
    return { ...v, id: listingId || 'previa', status: 'active', seller_type: sq.data?.seller_type };
  }, [form, listingId, sq.data]);

  const noAr = ['active', 'sold_out'].includes(listing?.status);
  const salvar = (publish) => {
    const input = toInput(form);
    const r = validateListingInput(input, { publish });
    if (!r.ok) {
      setErrors(r.errors);
      toast.error(t('Confira os campos destacados.'));
      requestAnimationFrame(() => { const el = document.querySelector('#editor-anuncio .text-red-500'); if (el) rolarAte(el, { reservaInferior: 96 }); });
      return;
    }
    setErrors({});
    m.mutate({ id: listingId, input, publish, seller: { ...sq.data, seller_key: sellerKey }, uid: user.uid, settings: settings.data, keepQuantity: Boolean(listing?.source?.tracked) }, {
      onSuccess: async (id) => {
        // Veio do estoque da arena: o anúncio passa a usar o MESMO estoque.
        const produto = !editing && sellerKey.startsWith('arena_') ? params.get('produto') : null;
        if (produto) {
          try {
            await linkArenaProduct({ listingId: id, productId: produto });
          } catch (e) {
            toast.warning(t('O anúncio foi salvo, mas não foi ligado ao estoque da arena: {erro}', { erro: e.message }));
          }
        }
        toast.success(publish ? t('Anúncio no ar.') : t('Rascunho salvo.'));
        navigate(`/mercado/vender?como=${encodeURIComponent(sellerKey)}&aba=anuncios`, { replace: true, state: { destaque: id } });
      },
      onError: (e) => { setErrors(e.fieldErrors || {}); toast.error(e.message); },
    });
  };

  const voltar = `/mercado/vender?como=${encodeURIComponent(sellerKey)}&aba=anuncios`;
  if (lq.isError || sq.isError) return <V2ErrorState onRetry={() => { lq.refetch(); sq.refetch(); }} />;
  if ((editing && lq.isLoading) || sq.isLoading || !form) return <div className="mx-auto max-w-5xl space-y-4"><V2Skeleton className="h-12" /><V2Skeleton className="h-96" /></div>;
  if (!operador || !sq.data || (editing && !listing)) {
    return (
      <V2Surface className="mx-auto max-w-xl text-center">
        <h1 className="font-display text-2xl font-bold text-ink">{t('Não dá para editar este anúncio')}</h1>
        <p className="mt-2 text-gray-500">{!sq.data ? t('Comece a vender pelo painel antes de criar o primeiro anúncio.') : t('Este anúncio não é de uma conta que você opera.')}</p>
        <Link to="/mercado/vender" className="mt-4 inline-flex font-bold text-ink underline">{t('Ir para o painel de vendas')}</Link>
      </V2Surface>
    );
  }
  if (listing?.status === 'removed') {
    return (
      <V2Surface className="mx-auto max-w-xl text-center">
        <h1 className="font-display text-2xl font-bold text-ink">{t('Anúncio tirado do ar pela moderação')}</h1>
        <p className="mt-2 text-gray-500">{listing.moderation?.reason || t('Ele não pode ser editado.')}</p>
        <Link to={voltar} className="mt-4 inline-flex font-bold text-ink underline">{t('Voltar aos anúncios')}</Link>
      </V2Surface>
    );
  }

  const completo = Math.round(listingCompleteness(preview) * 100);
  const ship = form.fulfillment.includes('shipping');
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-28">
      <V2BackLink to={voltar}>{t('Meus anúncios')}</V2BackLink>
      <V2PageIntro title={editing ? t('Editar anúncio') : t('Novo anúncio')} subtitle={t('Vendendo como {nome}', { nome: sq.data.display_name })} />
      <div className="grid gap-6 lg:grid-cols-12">
        <form id="editor-anuncio" className="space-y-6 lg:col-span-8" onSubmit={(e) => { e.preventDefault(); salvar(true); }} noValidate>
          <Section id="fotos" title={t('Fotos e vídeo')}>
            <MediaEditor media={form.media} onChange={(fn) => set((f) => ({ media: fn(f.media) }))} error={errors.media} />
            <V2Field label={t('Ou um link do YouTube/Vimeo')} htmlFor="video-link" error={errors.video_link}>
              <V2Input id="video-link" type="url" placeholder={t('https://youtube.com/…')} value={form.video_link} onChange={(e) => set({ video_link: e.target.value })} />
            </V2Field>
          </Section>

          <Section id="oque" title={t('O que você está vendendo')}>
            <V2Field label={t('Título')} htmlFor="titulo" error={errors.title} hint={`${form.title.length}/${TEXT_LIMITS.title} · ${t('marca, modelo e o principal detalhe. Ex.: "Raquete Selkirk Vanguard Power Air 16 mm"')}`}>
              <V2Input id="titulo" maxLength={TEXT_LIMITS.title} value={form.title} onChange={(e) => set({ title: e.target.value })} />
            </V2Field>
            <V2Field label={t('Categoria')} htmlFor="categoria" error={errors.category_slug}>
              <V2Select id="categoria" value={form.category_slug} onChange={(e) => set({ category_slug: e.target.value })}>
                <option value="">{t('Escolha…')}</option>
                {cats.map((c) => (
                  c.children.length ? (
                    <optgroup key={c.slug} label={t(c.label)}>
                      <option value={c.slug}>{t('{categoria} (geral)', { categoria: t(c.label) })}</option>
                      {c.children.map((k) => <option key={k.slug} value={k.slug}>{t(k.label)}</option>)}
                    </optgroup>
                  ) : <option key={c.slug} value={c.slug}>{t(c.label)}</option>
                ))}
              </V2Select>
            </V2Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-bold text-ink">{t('Estado')}</legend>
              <div className="flex flex-wrap gap-2">
                {[[LISTING_TYPE.NEW, t('Novo')], [LISTING_TYPE.USED, t('Usado')]].map(([v, l]) => (
                  <label key={v} className={cn('flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-bold', form.type === v ? 'border-ink bg-ink text-white' : 'border-gray-200 text-ink')}>
                    <input type="radio" name="tipo" value={v} checked={form.type === v} onChange={() => set({ type: v })} className="sr-only" />{l}
                  </label>
                ))}
              </div>
              {form.type === LISTING_TYPE.USED && (
                <V2Field label={t('Como está')} htmlFor="condicao" error={errors.condition}>
                  <V2Select id="condicao" value={form.condition} onChange={(e) => set({ condition: e.target.value })}>
                    <option value="">{t('Escolha…')}</option>
                    {['like_new', 'good', 'fair'].map((c) => <option key={c} value={c}>{t(CONDITION_LABELS[c])}</option>)}
                  </V2Select>
                </V2Field>
              )}
            </fieldset>
          </Section>

          {attrs.length > 0 && (
            <Section id="caract" title={t('Características')} hint={t('Opcional, mas é por elas que os compradores filtram a busca.')}>
              <div className="grid gap-4 sm:grid-cols-2">
                {attrs.map((a) => (
                  <AttributeField key={a.key} attr={a} value={form.attributes[a.key]} error={errors[`attr_${a.key}`]} onChange={(v) => set((f) => ({ attributes: { ...f.attributes, [a.key]: v } }))} />
                ))}
              </div>
            </Section>
          )}

          <Section id="desc" title={t('Descrição')}>
            <V2Field label={t('Conte os detalhes')} htmlFor="descricao" hint={`${form.description.length}/${TEXT_LIMITS.description} · ${t('tempo de uso, o que acompanha, motivo da venda. Não coloque telefone: as conversas são pelo PickleRush.')}`}>
              <V2Textarea id="descricao" rows={6} maxLength={TEXT_LIMITS.description} value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </V2Field>
          </Section>

          <Section id="preco" title={t('Preço e estoque')}>
            <div className="grid gap-4 sm:grid-cols-3">
              <V2Field label={t('Preço (R$)')} htmlFor="preco-v" error={errors.price_cents}>
                <V2Input id="preco-v" inputMode="decimal" placeholder={t('0,00')} value={form.price} onChange={(e) => set({ price: e.target.value })} />
              </V2Field>
              <V2Field label={t('Preço “de” (opcional)')} htmlFor="preco-de" error={errors.compare_at_cents} hint={t('Mostra o desconto riscado.')}>
                <V2Input id="preco-de" inputMode="decimal" placeholder={t('0,00')} value={form.compare_at} onChange={(e) => set({ compare_at: e.target.value })} />
              </V2Field>
              <V2Field
                label={t('Quantidade')}
                htmlFor="qtd"
                error={errors.quantity}
                hint={listing?.source?.tracked ? t('Acompanha o estoque da arena.') : undefined}
              >
                <V2Input id="qtd" type="number" min={0} max={9999} value={form.quantity} disabled={Boolean(listing?.source?.tracked)} onChange={(e) => set({ quantity: e.target.value })} />
              </V2Field>
            </div>
            {(listing?.source?.kind === 'arena_product' || (!editing && params.get('produto'))) && (
              <p className="rounded-2xl bg-paper px-4 py-3 text-sm text-gray-600">
                {t('Este anúncio usa o estoque da arena: o que sair no balcão, na loja do app ou aqui é descontado do mesmo lugar.')}
                {' '}{t('A venda entra no estoque como saída quando você confirma o pagamento, e volta se o pedido for cancelado.')}
              </p>
            )}
            {settings.data?.offers_enabled !== false && (
              <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={form.accepts_offers} onChange={(e) => set({ accepts_offers: e.target.checked })} className="h-5 w-5 accent-ink" />
                {t('Aceito ofertas (o comprador propõe um valor e você aceita, recusa ou contrapropõe)')}
              </label>
            )}
          </Section>

          <Section id="entrega" title={t('Entrega')} hint={t('O pagamento é por Pix direto para você, depois que você aceitar o pedido.')}>
            <fieldset className="space-y-2">
              <legend className="sr-only">{t('Formas de entrega')}</legend>
              {Object.entries(FULFILLMENT_LABELS).map(([v, l]) => (
                <label key={v} className="flex min-h-11 items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={form.fulfillment.includes(v)}
                    onChange={(e) => set((f) => ({ fulfillment: e.target.checked ? [...f.fulfillment, v] : f.fulfillment.filter((x) => x !== v) }))}
                    className="h-5 w-5 accent-ink"
                  />
                  {t(l)}
                </label>
              ))}
              {errors.fulfillment && <p role="alert" className="text-sm font-medium text-red-500">{errors.fulfillment}</p>}
            </fieldset>
            {ship && (
              <div className="grid gap-4 sm:grid-cols-2">
                <V2Field label={t('Valor do envio (R$)')} htmlFor="frete" error={errors.shipping_cents} hint={t('0 para frete grátis. Vale para o pedido inteiro deste vendedor.')}>
                  <V2Input id="frete" inputMode="decimal" placeholder={t('0,00')} disabled={form.shipping_to_agree} value={form.shipping} onChange={(e) => set({ shipping: e.target.value })} />
                </V2Field>
                <label className="flex min-h-11 items-center gap-2 self-end text-sm text-ink">
                  <input type="checkbox" checked={form.shipping_to_agree} onChange={(e) => set({ shipping_to_agree: e.target.checked })} className="h-5 w-5 accent-ink" />
                  {t('Frete a combinar')}
                </label>
              </div>
            )}
            {(form.fulfillment.includes('pickup') || form.fulfillment.includes('meetup')) && (
              <V2Field label={t('Onde retirar ou encontrar (opcional)')} htmlFor="retirada" hint={t('Bairro ou referência. Nada de endereço completo: isso se combina na conversa.')}>
                <V2Input id="retirada" maxLength={140} value={form.pickup_note} onChange={(e) => set({ pickup_note: e.target.value })} />
              </V2Field>
            )}
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <V2Field label={t('Cidade')} htmlFor="cidade" error={errors.city}>
                <V2Input id="cidade" maxLength={60} value={form.city} onChange={(e) => set({ city: e.target.value })} />
              </V2Field>
              <V2Field label={t('UF')} htmlFor="uf">
                <V2Select id="uf" value={form.state} onChange={(e) => set({ state: e.target.value })}>
                  <option value="">—</option>
                  {BR_UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                </V2Select>
              </V2Field>
            </div>
          </Section>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-paper-pure/95 px-4 py-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
            <div className="mx-auto flex max-w-6xl justify-end gap-2">
              {/* No ar, "rascunho" tiraria o anúncio do ar sem querer: pausar é no painel. */}
              {!noAr && <V2Button type="button" variant="ghost" disabled={m.isPending} onClick={() => salvar(false)}>{t('Salvar rascunho')}</V2Button>}
              <V2Button type="submit" disabled={m.isPending}>{m.isPending ? t('Salvando…') : noAr ? t('Salvar e manter no ar') : t('Publicar')}</V2Button>
            </div>
          </div>
        </form>

        <aside className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-24 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{t('Como o comprador vê')}</p>
            <div className="pointer-events-none" aria-hidden="true"><ListingCard listing={preview} showFavorite={false} /></div>
            <V2Surface variant="plano" className="space-y-2 p-4">
              <p className="text-sm font-bold text-ink">{t('Anúncio {pct}% completo', { pct: completo })}</p>
              <span className="block h-2 overflow-hidden rounded-full bg-gray-100"><span className="block h-full rounded-full bg-acid" style={{ width: `${completo}%` }} /></span>
              <p className="text-xs text-gray-500">{t('Mais fotos, uma boa descrição e as características ajudam o anúncio a aparecer e a vender.')}</p>
            </V2Surface>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function V2MarketListingEditor() {
  return <MarketGate><EditorPage /></MarketGate>;
}
