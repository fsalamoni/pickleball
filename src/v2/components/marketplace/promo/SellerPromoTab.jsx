/**
 * Painel de quem vende → "Divulgar": cupons da loja, vale-presente (vender e
 * emitir) e o cartão para compartilhar a vitrine. O cupom é gravado pelo
 * navegador de quem vende (a regra confere o formato e o dono); o uso, o vale
 * e o saldo só o servidor escreve.
 */
import React, { useState } from 'react';
import { Gift, Pencil, Plus, Share2, TicketPercent, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  COUPON_KIND, COUPON_KIND_LABELS, GIFT_CARD_LIMITS, GIFT_CARD_STATUS, GIFT_CARD_VALIDITY_OPTIONS,
  couponBenefitLabel, couponConditionsLabel, couponLive, giftCardConfig, maskGiftCardCode,
} from '@/modules/marketplace/domain/promotions';
import { formatBRL, parseBRL } from '@/modules/marketplace/domain/money';
import { deleteCoupon, saveCoupon, saveGiftCardSettings, setCouponActive } from '@/modules/marketplace/services/marketService';
import { couponShareUrl } from '@/modules/marketplace/services/pendingCoupon';
import { giftCardAction } from '@/modules/marketplace/services/marketOrderService';
import {
  useMarketMutation, useSellerCoupons, useSellerGiftCards, useSellerListings, useSellerPrivate,
} from '@/modules/marketplace/hooks/useMarket';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CopyCodeButton from '@/v2/ui/CopyCodeButton';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle,
} from '@/v2/ui/primitives';
import ShareImageDialog, { MarketShareCard } from './ShareImageDialog';

// Data do campo (AAAA-MM-DD) ↔ instante em Brasília: começo e fim do dia.
const diaParaMs = (d, fim) => (d ? Date.parse(`${d}T${fim ? '23:59:59' : '00:00:00'}-03:00`) : null);
const msParaDia = (ms) => (ms ? new Date(Number(ms) - 3 * 3600000).toISOString().slice(0, 10) : '');
const centsText = (c) => (c ? formatBRL(c).replace(/^R\$\s?/, '') : '');

function vazio() {
  return { code: '', kind: COUPON_KIND.PERCENT, value: '10', min: '', start: '', end: '', max_uses: '', once_per_buyer: true, first_purchase_only: false, public: true, active: true, description: '', listing_ids: [] };
}
function doCupom(c) {
  return {
    code: c.code, kind: c.kind, value: c.kind === COUPON_KIND.AMOUNT ? centsText(c.value) : String(c.value || ''),
    min: centsText(c.min_subtotal_cents), start: msParaDia(c.starts_at_ms), end: msParaDia(c.ends_at_ms),
    max_uses: c.max_uses ? String(c.max_uses) : '', once_per_buyer: c.once_per_buyer, first_purchase_only: c.first_purchase_only,
    public: c.public, active: c.active !== false, description: c.description || '', listing_ids: c.listing_ids || [],
  };
}

function CouponDialog({ sellerKey, coupon, onClose }) {
  const { user, userProfile } = useAuth();
  const [f, setF] = useState(() => (coupon ? doCupom(coupon) : vazio()));
  const [errors, setErrors] = useState({});
  const listings = useSellerListings(sellerKey);
  const ativos = (listings.data || []).filter((l) => ['active', 'sold_out'].includes(l.status));
  const m = useMarketMutation(saveCoupon);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const salvar = (e) => {
    e.preventDefault();
    const input = {
      ...f,
      value: f.kind === COUPON_KIND.AMOUNT ? parseBRL(f.value) : Number(f.value),
      min_subtotal_cents: f.min ? parseBRL(f.min) : 0,
      starts_at_ms: diaParaMs(f.start, false), ends_at_ms: diaParaMs(f.end, true),
      max_uses: f.max_uses ? Number(f.max_uses) : null,
    };
    m.mutate({ id: coupon?.id, input, sellerKey, uid: user?.uid, actor: { uid: user?.uid, name: userProfile?.platform_name || userProfile?.full_name } }, {
      onSuccess: () => { toast.success(coupon ? 'Cupom salvo.' : 'Cupom criado.'); onClose(); },
      onError: (er) => { setErrors(er.errors || {}); toast.error(er.message); },
    });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" sheet>
        <DialogHeader>
          <DialogTitle>{coupon ? 'Editar cupom' : 'Novo cupom'}</DialogTitle>
          <DialogDescription>O comprador digita o código no carrinho. O desconto sai do preço da sua loja.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={salvar}>
          <V2Field label="Código" htmlFor="cp-code" hint={coupon ? 'O código não muda depois de criado.' : 'De 3 a 20 letras e números. Ex.: BEMVINDO10'} error={errors.code}>
            <V2Input id="cp-code" value={f.code} disabled={!!coupon} onChange={(e) => set({ code: e.target.value.toUpperCase() })} maxLength={20} className="uppercase" />
          </V2Field>
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-ink">O que ele dá</legend>
            <div className="flex flex-wrap gap-2">
              {Object.values(COUPON_KIND).map((k) => <V2FilterChip key={k} active={f.kind === k} onClick={() => set({ kind: k, value: k === COUPON_KIND.AMOUNT ? '20,00' : k === COUPON_KIND.PERCENT ? '10' : '' })}>{COUPON_KIND_LABELS[k]}</V2FilterChip>)}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            {f.kind !== COUPON_KIND.FREE_SHIPPING && (
              <V2Field label={f.kind === COUPON_KIND.PERCENT ? 'Desconto (%)' : 'Desconto (R$)'} htmlFor="cp-value" error={errors.value}>
                <V2Input id="cp-value" inputMode="decimal" value={f.value} onChange={(e) => set({ value: e.target.value })} />
              </V2Field>
            )}
            <V2Field label="Pedido mínimo (R$, opcional)" htmlFor="cp-min" error={errors.min_subtotal_cents}>
              <V2Input id="cp-min" inputMode="decimal" placeholder="0,00" value={f.min} onChange={(e) => set({ min: e.target.value })} />
            </V2Field>
            <V2Field label="Começa (opcional)" htmlFor="cp-start"><V2Input id="cp-start" type="date" value={f.start} onChange={(e) => set({ start: e.target.value })} /></V2Field>
            <V2Field label="Termina (opcional)" htmlFor="cp-end" error={errors.ends_at_ms}><V2Input id="cp-end" type="date" value={f.end} onChange={(e) => set({ end: e.target.value })} /></V2Field>
            <V2Field label="Limite de usos (opcional)" htmlFor="cp-max" error={errors.max_uses}><V2Input id="cp-max" type="number" min={1} value={f.max_uses} onChange={(e) => set({ max_uses: e.target.value })} /></V2Field>
          </div>
          <V2Toggle id="cp-once" label="Uma vez por pessoa" checked={f.once_per_buyer} onChange={(v) => set({ once_per_buyer: v })} />
          <V2Toggle id="cp-first" label="Só na primeira compra na loja" hint="Bom para trazer clientes novos." checked={f.first_purchase_only} onChange={(v) => set({ first_purchase_only: v })} />
          <V2Toggle id="cp-public" label="Divulgar na vitrine e nos anúncios" hint="Desligado, só quem receber o código usa." checked={f.public} onChange={(v) => set({ public: v })} />
          {ativos.length > 0 && (
            <details className="rounded-2xl bg-paper p-3">
              <summary className="cursor-pointer text-sm font-bold text-ink">Só em alguns anúncios {f.listing_ids.length ? `(${f.listing_ids.length})` : '(todos)'}</summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {ativos.map((l) => (
                  <li key={l.id}>
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <input type="checkbox" className="h-5 w-5 accent-ink" checked={f.listing_ids.includes(l.id)}
                        onChange={(e) => set({ listing_ids: e.target.checked ? [...f.listing_ids, l.id] : f.listing_ids.filter((x) => x !== l.id) })} />
                      <span className="truncate">{l.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {errors.listing_ids && <p className="text-xs text-red-600">{errors.listing_ids}</p>}
            </details>
          )}
          <V2Field label="Frase para o comprador (opcional)" htmlFor="cp-desc"><V2Textarea id="cp-desc" rows={2} maxLength={140} value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ex.: 10% para quem está começando" className="min-h-0" /></V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onClose}>Voltar</V2Button>
            <V2Button type="submit" disabled={m.isPending}>{m.isPending ? 'Salvando…' : 'Salvar cupom'}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CouponsSection({ sellerKey, seller }) {
  const q = useSellerCoupons(sellerKey);
  const [editar, setEditar] = useState(null);
  const [divulgar, setDivulgar] = useState(null);
  const ativo = useMarketMutation(({ id, on }) => setCouponActive(id, on));
  const apagar = useMarketMutation(deleteCoupon);
  const novo = <V2Button type="button" onClick={() => setEditar('novo')}><Plus className="h-4 w-4" /> Novo cupom</V2Button>;
  let corpo;
  if (q.isError) corpo = <V2ErrorState inline onRetry={() => q.refetch()} />;
  else if (q.isLoading) corpo = <V2Skeleton lines={3} />;
  else if (!(q.data || []).length) corpo = <V2EmptyState icon={TicketPercent} title="Nenhum cupom ainda" description="Um cupom de boas-vindas ou de frete grátis ajuda a fechar a primeira venda." action={novo} />;
  else {
    corpo = (
      <ul className="divide-y divide-gray-100 rounded-[1.5rem] border border-gray-100 bg-paper-pure">
        {q.data.map((c) => {
          const vivo = couponLive(c);
          return (
            <li key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CopyCodeButton code={c.code} size="sm" />
                  <span className="font-bold text-ink">{couponBenefitLabel(c)}</span>
                  <V2Badge tone={vivo ? 'green' : 'neutral'}>{c.active === false ? 'Desligado' : vivo ? 'Valendo' : 'Fora do prazo'}</V2Badge>
                  {c.public && <V2Badge tone="neutral">Divulgado</V2Badge>}
                </div>
                <p className="text-xs text-gray-500">{couponConditionsLabel(c) || 'Sem condições'} · {c.uses_count || 0} uso{c.uses_count === 1 ? '' : 's'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {vivo && <V2Button type="button" size="sm" variant="ghost" onClick={() => setDivulgar(c)}><Share2 className="h-4 w-4" /> Cartão</V2Button>}
                <V2Button type="button" size="sm" variant="ghost" onClick={() => setEditar(c)}><Pencil className="h-4 w-4" /> Editar</V2Button>
                <V2Button type="button" size="sm" variant="ghost" onClick={() => ativo.mutate({ id: c.id, on: c.active === false }, { onError: (e) => toast.error(e.message) })}>{c.active === false ? 'Ligar' : 'Desligar'}</V2Button>
                {!(c.uses_count > 0) && (
                  <V2Button type="button" size="sm" variant="ghost" aria-label={`Apagar o cupom ${c.code}`} onClick={() => { if (window.confirm(`Apagar o cupom ${c.code}?`)) apagar.mutate(c.id, { onError: (e) => toast.error(e.message) }); }}><Trash2 className="h-4 w-4" /></V2Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <section aria-labelledby="cupons-titulo" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="cupons-titulo" className="font-display text-xl font-bold text-ink">Cupons</h2>
          <p className="text-sm text-gray-500">Cupom usado não se apaga (some a conta de quanto rendeu): desligue.</p>
        </div>
        {(q.data || []).length > 0 && novo}
      </div>
      {corpo}
      {editar && <CouponDialog sellerKey={sellerKey} coupon={editar === 'novo' ? null : editar} onClose={() => setEditar(null)} />}
      {divulgar && (
        <ShareImageDialog
          open
          onOpenChange={(v) => { if (!v) setDivulgar(null); }}
          title={`Cartão do cupom ${divulgar.code}`}
          description="Quem abre o link chega à sua loja com o cupom já aplicado no carrinho."
          url={typeof window !== 'undefined' ? couponShareUrl(window.location.origin, sellerKey, divulgar.code) : ''}
          fileName={`cupom-${divulgar.code}.png`}
          shareText={`${couponBenefitLabel(divulgar)} em ${seller?.display_name || 'minha loja'} no Mercado PickleRush. Cupom ${divulgar.code}`}
          renderCard={({ ref, qr, showImage }) => (
            <MarketShareCard ref={ref} kind="coupon" image={seller?.banner_url || seller?.logo_url} showImage={showImage} qr={qr}
              title={couponBenefitLabel(divulgar)} subtitle={[seller?.display_name, couponConditionsLabel(divulgar)].filter(Boolean).join(' · ')} code={divulgar.code} />
          )}
        />
      )}
    </section>
  );
}

function GiftSettings({ sellerKey, seller }) {
  const priv = useSellerPrivate(sellerKey);
  const atual = giftCardConfig(seller);
  const [f, setF] = useState(() => ({ ...atual, amounts: atual.amounts_cents.map(centsText).join('; ') }));
  const m = useMarketMutation(({ input }) => saveGiftCardSettings(sellerKey, input));
  const semPix = priv.isSuccess && !priv.data?.pix_key;
  const salvar = () => {
    const amounts = f.amounts.split(/[;\n]/).map((x) => parseBRL(x.trim())).filter((x) => x);
    if (f.enabled && semPix) { toast.error('Cadastre a chave Pix em Recebimento antes de vender vale-presente.'); return; }
    m.mutate({ input: { enabled: f.enabled, amounts_cents: amounts, allow_custom: f.allow_custom, validity_months: Number(f.validity_months), note: f.note } }, {
      onSuccess: () => toast.success(f.enabled ? 'Vale-presente à venda na sua vitrine.' : 'Vale-presente desligado.'),
      onError: (e) => toast.error(e.message),
    });
  };
  return (
    <V2Surface variant="compacto" className="space-y-4 p-5">
      <V2Toggle id="vale-on" label="Vender vale-presente na vitrine" hint="Quem compra paga pelo seu Pix; o vale nasce quando você confirma o pagamento." checked={f.enabled} onChange={(v) => setF((x) => ({ ...x, enabled: v }))} />
      {semPix && <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">Falta a chave Pix (aba Recebimento) para vender vale-presente.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label="Valores (R$)" htmlFor="vale-valores" hint={`Separe com ponto e vírgula. Até ${GIFT_CARD_LIMITS.maxAmounts}.`}>
          <V2Input id="vale-valores" value={f.amounts} onChange={(e) => setF((x) => ({ ...x, amounts: e.target.value }))} placeholder="50,00; 100,00; 200,00" />
        </V2Field>
        <V2Field label="Validade" htmlFor="vale-validade">
          <V2Select id="vale-validade" value={f.validity_months} onChange={(e) => setF((x) => ({ ...x, validity_months: e.target.value }))}>
            {GIFT_CARD_VALIDITY_OPTIONS.map((v) => <option key={v} value={v}>{v} meses</option>)}
          </V2Select>
        </V2Field>
      </div>
      <V2Toggle id="vale-livre" label="Deixar escolher outro valor" checked={f.allow_custom} onChange={(v) => setF((x) => ({ ...x, allow_custom: v }))} />
      <V2Field label="Recado no vale (opcional)" htmlFor="vale-nota"><V2Input id="vale-nota" maxLength={140} value={f.note} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} placeholder="Ex.: vale em toda a loja, inclusive aulas" /></V2Field>
      <div className="flex justify-end"><V2Button type="button" onClick={salvar} disabled={m.isPending}>{m.isPending ? 'Salvando…' : 'Salvar'}</V2Button></div>
    </V2Surface>
  );
}

function IssueDialog({ sellerKey, onClose }) {
  const [valor, setValor] = useState('50,00');
  const [para, setPara] = useState('');
  const [msg, setMsg] = useState('');
  const [nota, setNota] = useState('');
  const [feito, setFeito] = useState(null);
  const m = useMarketMutation(giftCardAction);
  const emitir = (e) => {
    e.preventDefault();
    m.mutate({ action: 'issue', seller_key: sellerKey, amount_cents: parseBRL(valor), recipient_name: para, message: msg, note: nota }, {
      onSuccess: (r) => setFeito(r), onError: (er) => toast.error(er.message),
    });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" sheet>
        <DialogHeader>
          <DialogTitle>Emitir um vale</DialogTitle>
          <DialogDescription>Prêmio de torneio, cortesia, troca de produto: um vale da sua loja, sem pagamento.</DialogDescription>
        </DialogHeader>
        {feito ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-gray-600">Vale emitido. Mande o código a quem vai usar: ele resgata em Mercado → Vales-presente.</p>
            <CopyCodeButton code={feito.code} successMessage="Código copiado. Mande a quem ganhou." />
            <V2Button type="button" className="w-full" onClick={onClose}>Pronto</V2Button>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={emitir}>
            <V2Field label="Valor (R$)" htmlFor="em-valor"><V2Input id="em-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></V2Field>
            <V2Field label="Para (opcional)" htmlFor="em-para"><V2Input id="em-para" maxLength={60} value={para} onChange={(e) => setPara(e.target.value)} /></V2Field>
            <V2Field label="Mensagem (opcional)" htmlFor="em-msg"><V2Input id="em-msg" maxLength={200} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Parabéns pelo título!" /></V2Field>
            <V2Field label="Anotação interna (opcional)" htmlFor="em-nota" hint="Só a sua loja vê."><V2Input id="em-nota" maxLength={140} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: 1º lugar do torneio de outubro" /></V2Field>
            <V2Button type="submit" className="w-full" disabled={m.isPending}>{m.isPending ? 'Emitindo…' : 'Emitir vale'}</V2Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GiftCardsSection({ sellerKey, seller }) {
  const q = useSellerGiftCards(sellerKey);
  const [emitir, setEmitir] = useState(false);
  const cancelar = useMarketMutation(giftCardAction);
  const lista = q.data || [];
  const saldo = lista.filter((c) => c.status === GIFT_CARD_STATUS.ACTIVE).reduce((n, c) => n + (Number(c.balance_cents) || 0), 0);
  return (
    <section aria-labelledby="vales-titulo" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="vales-titulo" className="font-display text-xl font-bold text-ink">Vale-presente</h2>
          <p className="text-sm text-gray-500">{q.isSuccess && lista.length ? `${lista.length} vales · ${formatBRL(saldo)} em saldo a usar na sua loja` : 'Um presente que traz um cliente novo para a sua loja.'}</p>
        </div>
        <V2Button type="button" variant="ghost" onClick={() => setEmitir(true)}><Gift className="h-4 w-4" /> Emitir vale</V2Button>
      </div>
      <GiftSettings sellerKey={sellerKey} seller={seller} />
      {q.isError ? <V2ErrorState inline onRetry={() => q.refetch()} /> : q.isLoading ? <V2Skeleton lines={2} /> : lista.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-[1.5rem] border border-gray-100 bg-paper-pure">
          {lista.slice(0, 50).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <span className="min-w-0">
                <span className="block font-bold text-ink">{maskGiftCardCode(c.code)} · {formatBRL(c.balance_cents)} de {formatBRL(c.initial_cents)}</span>
                <span className="block text-xs text-gray-500">
                  {c.source === 'order' ? 'Vendido' : 'Emitido'}{c.recipient_name ? ` para ${c.recipient_name}` : ''}{c.note ? ` · ${c.note}` : ''}
                  {c.expires_at_ms ? ` · vence ${new Date(c.expires_at_ms).toLocaleDateString('pt-BR')}` : ''}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <V2Badge tone={c.status === GIFT_CARD_STATUS.ACTIVE ? 'green' : 'neutral'}>{c.status === GIFT_CARD_STATUS.CANCELLED ? 'Cancelado' : c.status === GIFT_CARD_STATUS.USED ? 'Usado' : c.claimed_at_ms ? 'Resgatado' : 'A resgatar'}</V2Badge>
                {c.source !== 'order' && c.status !== GIFT_CARD_STATUS.CANCELLED && (
                  <V2Button type="button" size="sm" variant="ghost" onClick={() => {
                    const motivo = window.prompt('Por que cancelar este vale? (quem tem o vale é avisado)');
                    if (motivo) cancelar.mutate({ action: 'cancel', id: c.id, reason: motivo }, { onSuccess: () => toast.success('Vale cancelado.'), onError: (e) => toast.error(e.message) });
                  }}
                  >Cancelar</V2Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {emitir && <IssueDialog sellerKey={sellerKey} onClose={() => setEmitir(false)} />}
    </section>
  );
}

function ShareSection({ sellerKey, seller }) {
  const [open, setOpen] = useState(false);
  const listings = useSellerListings(sellerKey, { publicOnly: true });
  const n = (listings.data || []).filter((l) => l.status === 'active').length;
  const url = typeof window !== 'undefined' ? `${window.location.origin}/mercado/vendedor/${sellerKey}` : '';
  return (
    <V2Surface variant="plano" className="flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Divulgue a sua vitrine</h2>
        <p className="text-sm text-gray-500">Uma imagem com QR para os stories, o grupo do clube e o balcão.</p>
      </div>
      <V2Button type="button" onClick={() => setOpen(true)}><Share2 className="h-4 w-4" /> Cartão da loja</V2Button>
      <ShareImageDialog
        open={open}
        onOpenChange={setOpen}
        title="Cartão da sua loja"
        url={url}
        fileName={`loja-${sellerKey}.png`}
        shareText={`Conheça ${seller.display_name} no Mercado PickleRush`}
        renderCard={({ ref, qr, showImage }) => (
          <MarketShareCard ref={ref} kind="store" image={seller.banner_url || seller.logo_url} showImage={showImage} qr={qr} title={seller.display_name}
            subtitle={[seller.city, seller.state].filter(Boolean).join(' · ')} highlight={n ? `${n} produtos à venda` : ''} />
        )}
      />
    </V2Surface>
  );
}

export default function SellerPromoTab({ sellerKey, seller }) {
  return (
    <div className="space-y-8">
      <ShareSection sellerKey={sellerKey} seller={seller} />
      <CouponsSection sellerKey={sellerKey} seller={seller} />
      <GiftCardsSection sellerKey={sellerKey} seller={seller} />
    </div>
  );
}
