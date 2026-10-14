/**
 * V2MarketOrder — um pedido do Mercado, para os DOIS lados:
 * `/mercado/pedidos/:orderId` (quem compra) e `/mercado/vendas/:orderId`
 * (quem vende). O papel sai do pedido (`orderRoleOf`), não da rota.
 *
 * A tela responde primeiro "o que falta, e de quem" (`orderWaitingOn`) e
 * mostra só os botões que a pessoa PODE apertar (`nextActionsFor`, a mesma
 * tabela do servidor). O Pix aparece ao comprador depois do aceite; o
 * endereço, a quem vende depois do aceite.
 */
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CheckCircle2, Clock, FileText, Gift, MapPin, MessageSquareWarning, Package, Star, TicketPercent, Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  ORDER_ACTIONS, nextActionsFor, orderRoleOf, orderTimeline, orderWaitingOn,
} from '@/modules/marketplace/domain/orderStatus';
import {
  DISPUTE_REASON_LABELS, ORDER_FINAL_STATUSES, ORDER_STATUS_LABELS,
} from '@/modules/marketplace/domain/constants';
import { formatBRL } from '@/modules/marketplace/domain/money';
import { PIX_KEY_TYPES } from '@/modules/marketplace/domain/seller';
import { validateReview } from '@/modules/marketplace/domain/reputation';
import { orderAction, submitReview } from '@/modules/marketplace/services/marketOrderService';
import { getMarketFileUrl, prepareMarketFile, uploadMarketFile } from '@/modules/marketplace/services/marketMediaService';
import {
  useBuyerReviews, useDispute, useIsMarketOperator, useMarketMutation, useMarketSettings, useOrder, useOrderEvents, useOrderReviews, useOrderShipping,
} from '@/modules/marketplace/hooks/useMarket';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2BackLink, V2Select, V2Skeleton, V2Surface, V2Textarea,
} from '@/v2/ui/primitives';
import CopyCodeButton from '@/v2/ui/CopyCodeButton';
import V2ChatLauncherButton from '@/v2/components/chat/V2ChatLauncherButton';
import MarketHeader from '@/v2/components/marketplace/MarketHeader';
import { MarketGate, Stars, fulfillmentLabel, statusTone } from '@/v2/components/marketplace/marketUi';
import { t, tk, tn, fmtData, fmtNumero } from '@/core/i18n';
import MarketPhoto from '@/v2/components/marketplace/MarketPhoto';

const dataHora = (ms) => (ms ? fmtData(ms, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');


const EVENT_LABELS = { placed: tk('Pedido feito'), gift_card_bought: tk('Vale-presente comprado'), offer_accepted: tk('Oferta aceita · pedido criado'), expire: tk('Expirou por prazo'), auto_complete: tk('Concluído automaticamente') };

function Timeline({ order }) {
  if (ORDER_FINAL_STATUSES.includes(order.status) && order.status !== 'completed') return null;
  const steps = orderTimeline(order);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label={t('Andamento do pedido')}>
      {steps.map((s) => (
        <li key={s.id} className="space-y-2 text-center" aria-current={s.current ? 'step' : undefined}>
          <span className={cn('block h-1.5 rounded-full', s.done ? 'bg-ink' : 'bg-gray-200')} />
          <span className={cn('block text-2xs font-bold sm:text-xs', s.current ? 'text-ink' : s.done ? 'text-gray-600' : 'text-gray-500')}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function ActionDialog({ action, order, onClose }) {
  const { user } = useAuth();
  const meta = ORDER_ACTIONS[action.id];
  const [reason, setReason] = useState('');
  const [motivo, setMotivo] = useState('not_received');
  const [tracking, setTracking] = useState('');
  const [carrier, setCarrier] = useState('');
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [erro, setErro] = useState('');
  const m = useMarketMutation(orderAction);
  const [busy, setBusy] = useState(false);
  const isDispute = action.id === 'open_dispute';

  const enviar = async (e) => {
    e.preventDefault();
    const motivoTexto = isDispute ? `${DISPUTE_REASON_LABELS[motivo]}: ${reason.trim()}` : reason.trim();
    if (meta.needsReason && reason.trim().length < 3) { setErro(t('Conte o motivo em poucas palavras.')); return; }
    setBusy(true);
    try {
      let proofPath = '';
      if (file) {
        const prep = await prepareMarketFile(file, { allowVideo: false, allowPdf: true });
        if (!prep.ok) { setErro(prep.error); return; }
        const up = uploadMarketFile(prep.file, { uid: user.uid, kind: prep.type, folder: 'comprovante', onProgress: setProgress });
        proofPath = (await up.done).path;
      }
      await m.mutateAsync({
        orderId: order.id,
        action: action.id,
        reason: meta.needsReason ? motivoTexto : '',
        ...(proofPath ? { proof_path: proofPath } : {}),
        ...(action.id === 'ship' ? { tracking_code: tracking.trim(), carrier: carrier.trim() } : {}),
      });
      toast.success(t('Feito. O outro lado foi avisado.'));
      onClose();
    } catch (err) {
      setErro(err.message || t('Não foi possível concluir.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-md">
        <DialogTitle>{action.label}</DialogTitle>
        <DialogDescription>
          {action.id === 'send_proof' && t('Avise que pagou. Se puder, anexe o comprovante do Pix: o vendedor confere mais rápido.')}
          {action.id === 'confirm_payment' && t('Confirme só depois de ver o Pix na sua conta.')}
          {action.id === 'confirm_received' && t('Confirme quando o produto estiver com você. O pedido é concluído e vocês podem se avaliar.')}
          {action.id === 'ship' && t('Informe o rastreio, se houver. O comprador recebe o aviso.')}
          {action.id === 'open_dispute' && t('A moderação do Mercado vai analisar o pedido e falar com os dois lados.')}
          {action.id === 'accept' && t('Ao aceitar, o comprador vê a sua chave Pix e, no envio, você vê o endereço.')}
          {['decline', 'cancel', 'seller_cancel'].includes(action.id) && t('O estoque volta ao anúncio e o outro lado é avisado.')}
          {action.id === 'reject_payment' && t('O comprador volta a ter o prazo para pagar.')}
          {['ready', 'delivered'].includes(action.id) && t('O comprador recebe o aviso.')}
        </DialogDescription>
        <form onSubmit={enviar} className="space-y-4">
          {isDispute && (
            <V2Field label={t('O que aconteceu')} htmlFor="disputa-motivo">
              <V2Select id="disputa-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                {Object.entries(DISPUTE_REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
              </V2Select>
            </V2Field>
          )}
          {meta.needsReason && (
            <V2Field label={isDispute ? t('Conte os detalhes') : t('Motivo')} htmlFor="acao-motivo">
              <V2Textarea id="acao-motivo" rows={3} maxLength={480} value={reason} onChange={(e) => { setReason(e.target.value); setErro(''); }} autoFocus />
            </V2Field>
          )}
          {action.id === 'ship' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <V2Field label={t('Código de rastreio')} htmlFor="rastreio"><V2Input id="rastreio" maxLength={60} value={tracking} onChange={(e) => setTracking(e.target.value)} /></V2Field>
              <V2Field label={t('Transportadora')} htmlFor="transportadora"><V2Input id="transportadora" maxLength={40} placeholder={t('Correios')} value={carrier} onChange={(e) => setCarrier(e.target.value)} /></V2Field>
            </div>
          )}
          {action.id === 'send_proof' && (
            <V2Field label={t('Comprovante (opcional)')} htmlFor="comprovante" hint={t('Foto ou PDF de até 3 MB.')}>
              <input id="comprovante" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-paper file:px-4 file:py-2 file:font-bold file:text-ink" />
              {progress > 0 && progress < 100 && <p className="text-xs text-gray-500">{t('Enviando… {pct}%', { pct: progress })}</p>}
            </V2Field>
          )}
          {erro && <p role="alert" className="text-sm font-medium text-red-500">{erro}</p>}
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onClose}>{t('Voltar')}</V2Button>
            <V2Button type="submit" variant={action.tone === 'danger' ? 'danger' : 'primary'} disabled={busy}>{busy ? t('Enviando…') : action.label}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PixBox({ order }) {
  const p = order.payment;
  if (!p?.pix_key) return null;
  return (
    <V2Surface variant="compacto" className="space-y-3 border-acid/60 p-5">
      <h2 className="font-display text-lg font-bold text-ink">{t('Pague pelo Pix')}</h2>
      <p className="font-display text-3xl font-bold text-ink">{formatBRL(order.total_cents)}</p>
      {order.shipping_to_agree && <p className="text-xs text-amber-700">{t('O frete é a combinar: confirme o valor com o vendedor antes de pagar.')}</p>}
      <div className="space-y-1">
        <p className="text-xs text-gray-500">{t('Chave Pix ({tipo})', { tipo: PIX_KEY_TYPES[p.pix_key_type] ? t(PIX_KEY_TYPES[p.pix_key_type]) : t('chave') })}</p>
        <CopyCodeButton code={p.pix_key} successMessage={t('Chave Pix copiada.')} label={t('Copiar a chave Pix')} />
      </div>
      {p.receiver_name && <p className="text-sm text-gray-600">{t('Confira no app do banco: o Pix vai para')} <strong className="text-ink">{p.receiver_name}</strong>.</p>}
      {p.instructions && <p className="rounded-2xl bg-paper p-3 text-sm text-gray-700">{p.instructions}</p>}
      {order.deadline_at_ms && order.status === 'accepted' && (
        <p className="flex items-center gap-1 text-xs text-gray-500"><Clock className="h-3.5 w-3.5" /> {t('Pague até {data}, senão o pedido expira.', { data: dataHora(order.deadline_at_ms) })}</p>
      )}
    </V2Surface>
  );
}

function ProofLink({ path }) {
  const [busy, setBusy] = useState(false);
  if (!path) return <p className="text-xs text-gray-500">{t('O comprador avisou que pagou, sem anexar comprovante.')}</p>;
  return (
    <V2Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try { window.open(await getMarketFileUrl(path), '_blank', 'noopener,noreferrer'); } catch { toast.error(t('Não foi possível abrir o comprovante.')); } finally { setBusy(false); }
      }}
    >
      <FileText className="h-4 w-4" /> {t('Ver comprovante')}
    </V2Button>
  );
}

function Address({ order, role }) {
  const pode = order.fulfillment === 'shipping' && (role === 'buyer' || role === 'admin' || order.shipping_visible);
  const q = useOrderShipping(order.id, { enabled: pode });
  if (order.fulfillment !== 'shipping') return null;
  if (!pode) return <p className="text-sm text-gray-500">{t('O endereço aparece quando você aceitar o pedido.')}</p>;
  if (q.isError) return <V2ErrorState inline onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={2} />;
  const a = q.data?.address;
  if (!a) return null;
  return (
    <address className="not-italic text-sm leading-6 text-ink">
      <strong>{a.name}</strong><br />
      {a.street}, {a.number}{a.complement ? ` · ${a.complement}` : ''}<br />
      {[a.district, a.city, a.state].filter(Boolean).join(' · ')} · {t('CEP')} {String(a.cep || '').replace(/^(\d{5})(\d{3})$/, '$1-$2')}
      {a.phone && <><br />{t('Tel. {telefone}', { telefone: a.phone })}</>}
    </address>
  );
}

function ReviewBox({ order, role }) {
  const reviews = useOrderReviews(order.id);
  const [nota, setNota] = useState(0);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const m = useMarketMutation(submitReview);
  if (order.status !== 'completed' || !['buyer', 'seller'].includes(role)) return null;
  const minha = reviews.data?.[role] || null;
  const ja = order[`reviewed_by_${role}`] || minha;
  const alvo = role === 'buyer' ? t('o vendedor') : t('o comprador');
  if (ja) {
    return (
      <V2Surface variant="plano" className="flex items-center gap-2 p-4 text-sm text-gray-600">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        {minha && !minha.visible ? t('Você avaliou {quem}. A avaliação aparece quando o outro lado avaliar também (ou em até 14 dias).', { quem: alvo }) : t('Você avaliou {quem}. Obrigado!', { quem: alvo })}
      </V2Surface>
    );
  }
  const enviar = (e) => {
    e.preventDefault();
    const r = validateReview({ rating: nota, comment: texto });
    if (r.error) { setErro(r.error); return; }
    m.mutate({ orderId: order.id, ...r.value }, { onSuccess: () => toast.success(t('Avaliação enviada.')), onError: (er) => setErro(er.message) });
  };
  return (
    <V2Surface variant="compacto" as="section" aria-labelledby="avaliar-titulo" className="space-y-3 p-5">
      <h2 id="avaliar-titulo" className="font-display text-lg font-bold text-ink">{t('Como foi com {quem}?', { quem: alvo })}</h2>
      <p className="text-xs text-gray-500">{t('A avaliação é cega: só aparece quando os dois avaliarem, para ninguém responder no calor do momento.')}</p>
      <form onSubmit={enviar} className="space-y-3">
        <div className="flex gap-1" role="radiogroup" aria-label={t('Nota')}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={nota === n} aria-label={tn(n, '{n} estrela', '{n} estrelas')} onClick={() => { setNota(n); setErro(''); }} className="flex h-11 w-11 items-center justify-center">
              <Star className={cn('h-8 w-8', n <= nota ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />
            </button>
          ))}
        </div>
        <label htmlFor="aval-texto" className="sr-only">{t('Comentário')}</label>
        <V2Textarea id="aval-texto" rows={3} maxLength={1000} value={texto} onChange={(e) => { setTexto(e.target.value); setErro(''); }} placeholder={nota && nota <= 2 ? t('Conte o que deu errado') : t('Conte como foi (opcional)')} />
        {erro && <p role="alert" className="text-sm font-medium text-red-500">{erro}</p>}
        <V2Button type="submit" disabled={m.isPending || !nota}>{m.isPending ? t('Enviando…') : t('Enviar avaliação')}</V2Button>
      </form>
    </V2Surface>
  );
}

function DisputeBox({ order }) {
  const q = useDispute(order.id, { enabled: Boolean(order.dispute_id) });
  if (!order.dispute_id) return null;
  if (q.isError) return <V2ErrorState inline onRetry={() => q.refetch()} />;
  const d = q.data;
  if (!d) return null;
  return (
    <V2Surface variant="compacto" className="space-y-2 border-red-100 p-5">
      <h2 className="flex items-center gap-2 font-bold text-ink"><MessageSquareWarning className="h-5 w-5 text-red-500" /> {t('Problema relatado')}</h2>
      <p className="text-sm text-gray-700">{d.reason}</p>
      {d.status === 'open'
        ? <p className="text-xs text-gray-500">{t('A moderação está analisando. Use a conversa para mandar fotos e detalhes.')}</p>
        : <p className="text-sm font-medium text-ink">{t('Decisão:')} {d.resolution === 'buyer' ? t('a favor do comprador (pedido cancelado)') : t('a favor do vendedor (pedido concluído)')}{d.resolution_note ? ` — ${d.resolution_note}` : ''}</p>}
    </V2Surface>
  );
}

/** Para quem vende: como outros vendedores avaliaram este comprador. */
function BuyerReputation({ uid }) {
  const q = useBuyerReviews(uid);
  if (!q.isSuccess) return null;
  const notas = q.data.map((r) => Number(r.rating) || 0).filter(Boolean);
  const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
      <span>{t('Comprador:')}</span>
      {notas.length >= 3
        ? <Stars avg={media} count={notas.length} />
        : <span className="text-xs font-medium text-gray-500">{notas.length ? t('{n} avaliação(ões), média {media}', { n: notas.length, media: fmtNumero(media, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }) : t('ainda sem avaliações de vendedores')}</span>}
    </p>
  );
}

function History({ orderId }) {
  const q = useOrderEvents(orderId);
  if (q.isError) return <V2ErrorState inline onRetry={() => q.refetch()} />;
  const evs = [...(q.data || [])].sort((a, b) => (a.at_ms || 0) - (b.at_ms || 0));
  if (!evs.length) return null;
  return (
    <section aria-labelledby="hist-titulo" className="space-y-2">
      <h2 id="hist-titulo" className="text-sm font-bold text-ink">{t('Histórico')}</h2>
      <ol className="space-y-2 border-l border-gray-200 pl-4">
        {evs.map((e) => (
          <li key={e.id} className="text-sm">
            <span className="font-medium text-ink">{EVENT_LABELS[e.action] ? t(EVENT_LABELS[e.action]) : ORDER_ACTIONS[e.action] ? t(ORDER_ACTIONS[e.action].label) : e.action}</span>
            <span className="text-xs text-gray-500"> · {dataHora(e.at_ms)}</span>
            {e.reason && <p className="text-xs text-gray-600">{e.reason}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function OrderPage() {
  const settings = useMarketSettings();
  const { orderId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const q = useOrder(orderId);
  const order = q.data ? { id: orderId, ...q.data } : null;
  // Quem passou a gerir a arena depois do pedido também é vendedor (o
  // `seller_manager_uids` do pedido é um retrato da hora da compra).
  const operador = useIsMarketOperator(order?.seller_key);
  const role = orderRoleOf(order, user?.uid, { isAdmin: isPlatformAdmin, managerUids: operador && user?.uid ? [user.uid] : [] });
  const [acao, setAcao] = useState(null);
  const voltar = role === 'seller' ? '/mercado' : role === 'admin' ? (order?.status === 'disputed' ? '/admin?tab=mercado-disputas' : '/admin?tab=mercado-pedidos') : '/mercado/pedidos';
  useEffect(() => { setAcao(null); }, [order?.status]);

  let corpo;
  if (q.isError) corpo = <V2ErrorState onRetry={() => q.refetch()} />;
  else if (q.isLoading) corpo = <V2Skeleton className="h-96" />;
  else if (!order || !role) {
    corpo = (
      <V2Surface className="text-center">
        <h1 className="font-display text-2xl font-bold text-ink">{t('Pedido não disponível')}</h1>
        <p className="mt-2 text-gray-500">{t('Este pedido não existe ou não é da sua conta. Confira se entrou com a conta certa.')}</p>
        <Link to="/mercado/pedidos" className="mt-4 inline-flex font-bold text-ink underline">{t('Ver minhas compras')}</Link>
      </V2Surface>
    );
  } else {
    const acoes = nextActionsFor(order, role, { disputeWindowDays: settings.data?.dispute_window_days });
    const espera = orderWaitingOn(order, role);
    const outro = role === 'buyer'
      ? { id: (order.seller_manager_uids || [])[0], platform_name: order.seller_name }
      : { id: order.buyer_uid, platform_name: order.buyer_name };
    const digital = order.fulfillment === 'digital';
    const principal = acoes.filter((a) => a.tone !== 'danger');
    const perigo = acoes.filter((a) => a.tone === 'danger');
    corpo = (
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <V2Surface className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{role === 'seller' ? t('Venda') : role === 'admin' ? t('Moderação') : t('Compra')} · {order.code}</p>
                <h1 className="font-display text-2xl font-bold text-ink">{ORDER_STATUS_LABELS[order.status] ? t(ORDER_STATUS_LABELS[order.status]) : order.status}</h1>
                <p className="text-sm text-gray-500">{role === 'seller' ? t('Para {nome}', { nome: order.buyer_name }) : role === 'admin' ? t('{comprador} comprou de {vendedor}', { comprador: order.buyer_name, vendedor: order.seller_name }) : t('De {nome}', { nome: order.seller_name })} · {dataHora(order.placed_at_ms)}</p>
              </div>
              <V2Badge tone={statusTone(order.status)}>{order.source === 'offer' ? t('Pela oferta') : fulfillmentLabel(order.fulfillment)}</V2Badge>
            </div>
            {role === 'seller' && <BuyerReputation uid={order.buyer_uid} />}
            <Timeline order={order} />
            {espera && (
              <div className="rounded-2xl bg-paper p-4">
                <p className="font-bold text-ink">{espera}</p>
                {order.deadline_at_ms && !ORDER_FINAL_STATUSES.includes(order.status) && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><Clock className="h-3.5 w-3.5" /> {t('Prazo: {data}', { data: dataHora(order.deadline_at_ms) })}</p>
                )}
              </div>
            )}
            {order.status === 'cancelled' && order.cancel_reason && <p className="rounded-2xl bg-paper p-4 text-sm text-gray-600">{t('Cancelado: {motivo}', { motivo: order.cancel_reason })}</p>}
            {order.status === 'expired' && <p className="rounded-2xl bg-paper p-4 text-sm text-gray-600">{t('O pedido expirou porque passou do prazo. O estoque voltou ao anúncio.')}</p>}
            {(role === 'seller' || role === 'admin') && (order.status === 'payment_review' || order.payment_proof_path) && <ProofLink path={order.payment_proof_path} />}
            {digital && role === 'buyer' && ['delivered', 'completed'].includes(order.status) && (
              <Link to="/mercado/vales" className="flex items-center gap-2 rounded-2xl bg-acid/30 p-4 text-sm font-bold text-ink"><Gift className="h-4 w-4" /> {t('O vale está em Vales-presente: mande para quem vai ganhar ou use você mesmo.')}</Link>
            )}
            {(principal.length > 0 || perigo.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {principal.map((a) => <V2Button key={a.id} type="button" variant={a.tone === 'primary' ? 'primary' : 'secondary'} onClick={() => setAcao(a)}>{a.label}</V2Button>)}
                {perigo.map((a) => <V2Button key={a.id} type="button" variant="danger" onClick={() => setAcao(a)}>{a.label}</V2Button>)}
              </div>
            )}
          </V2Surface>

          {role === 'buyer' && ['accepted', 'payment_review'].includes(order.status) && <PixBox order={order} />}
          <DisputeBox order={order} />
          <ReviewBox order={order} role={role} />

          <V2Surface variant="compacto" as="section" aria-labelledby="itens-titulo" className="p-5">
            <h2 id="itens-titulo" className="mb-2 font-display text-lg font-bold text-ink">{t('Itens')}</h2>
            <ul className="divide-y divide-gray-100">
              {(order.items || []).map((i) => (
                <li key={i.listing_id} className="flex items-center gap-3 py-3">
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-paper">{i.cover_url ? <MarketPhoto src={i.cover_url} aspect={i.cover_aspect} frame={i.cover_frame} loading="lazy" /> : <Package className="m-4 h-6 w-6 text-gray-300" />}</span>
                  {i.listing_id
                    ? <Link to={`/mercado/anuncio/${i.listing_id}`} className="min-w-0 flex-1 text-sm text-ink hover:underline">{i.title}<span className="block text-xs text-gray-500">{i.quantity} × {formatBRL(i.unit_price_cents)}</span></Link>
                    : <span className="min-w-0 flex-1 text-sm text-ink">{i.title}{i.gift?.recipient_name && <span className="block text-xs text-gray-500">{t('Para {nome}', { nome: i.gift.recipient_name })}</span>}</span>}
                  <span className="font-bold text-ink">{formatBRL(i.unit_price_cents * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-gray-100 pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">{t('Produtos')}</dt><dd>{formatBRL(order.subtotal_cents)}</dd></div>
              {!digital && <div className="flex justify-between"><dt className="text-gray-500">{t('Frete')}</dt><dd>{order.shipping_to_agree ? t('A combinar') : order.shipping_cents ? formatBRL(order.shipping_cents) : '—'}</dd></div>}
              {(order.discount_cents > 0 || order.shipping_discount_cents > 0) && (
                <div className="flex justify-between text-green-700"><dt className="flex items-center gap-1"><TicketPercent className="h-3.5 w-3.5" /> {t('Cupom')}{order.coupon?.code ? ` ${order.coupon.code}` : ''}</dt><dd>− {formatBRL((order.discount_cents || 0) + (order.shipping_discount_cents || 0))}</dd></div>
              )}
              {order.gift_card_cents > 0 && (
                <div className="flex justify-between text-green-700"><dt className="flex items-center gap-1"><Gift className="h-3.5 w-3.5" /> {t('Vale-presente')}{(order.gift_cards || []).length ? ` ${order.gift_cards.map((g) => g.code_mask).join(', ')}` : ''}</dt><dd>− {formatBRL(order.gift_card_cents)}</dd></div>
              )}
              <div className="flex justify-between text-base font-bold"><dt>{t('Total')}</dt><dd>{formatBRL(order.total_cents)}</dd></div>
            </dl>
          </V2Surface>
          <History orderId={orderId} />
        </div>

        <aside className="space-y-4 lg:col-span-4">
          {!digital && <V2Surface variant="compacto" className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 font-bold text-ink">{order.fulfillment === 'shipping' ? <Truck className="h-4 w-4" /> : <MapPin className="h-4 w-4" />} {fulfillmentLabel(order.fulfillment)}</h2>
            <Address order={order} role={role} />
            {order.tracking?.code && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500">{t('Rastreio')}{order.tracking.carrier ? ` · ${order.tracking.carrier}` : ''}</p>
                <CopyCodeButton code={order.tracking.code} size="sm" successMessage={t('Código de rastreio copiado.')} label={t('Copiar o código de rastreio')} />
              </div>
            )}
            {order.fulfillment !== 'shipping' && <p className="text-sm text-gray-500">{t('Combinem o local e o horário pela conversa.')}</p>}
            {[...new Set((order.items || []).map((i) => i.pickup_note).filter(Boolean))].map((n) => (
              <p key={n} className="rounded-2xl bg-paper p-3 text-sm text-gray-700"><span className="block text-xs text-gray-500">{t('Onde retirar (do anúncio)')}</span>{n}</p>
            ))}
            {order.buyer_note && <p className="rounded-2xl bg-paper p-3 text-sm text-gray-700"><span className="block text-xs text-gray-500">{t('Recado do comprador')}</span>{order.buyer_note}</p>}
          </V2Surface>}
          {outro.id && role !== 'admin' && (
            <V2Surface variant="compacto" className="space-y-2 p-5">
              <p className="text-sm text-gray-600">{order.status === 'placed'
                ? t('Quer combinar algo antes do aceite? Fale com {quem}.', { quem: role === 'buyer' ? t('o vendedor') : t('o comprador') })
                : t('Dúvida sobre entrega ou pagamento? Fale com {quem}.', { quem: role === 'buyer' ? t('o vendedor') : t('o comprador') })}</p>
              <V2ChatLauncherButton athlete={outro} variant="outline" label={t('Conversar com {nome}', { nome: outro.platform_name || (role === 'buyer' ? t('o vendedor') : t('o comprador')) })} />
            </V2Surface>
          )}
          {role === 'admin' && (
            <V2Surface variant="compacto" className="space-y-2 p-5">
              <p className="text-sm text-gray-600">{t('Precisa ouvir um dos lados antes de decidir?')}</p>
              <V2ChatLauncherButton athlete={{ id: order.buyer_uid, platform_name: order.buyer_name }} variant="outline" label={t('Conversar com {nome}', { nome: order.buyer_name || t('o comprador') })} />
              {(order.seller_manager_uids || [])[0] && <V2ChatLauncherButton athlete={{ id: order.seller_manager_uids[0], platform_name: order.seller_name }} variant="outline" label={t('Conversar com {nome}', { nome: order.seller_name || t('o vendedor') })} />}
            </V2Surface>
          )}
          {role === 'seller' && <Link to={voltar} className="block text-center text-sm font-bold text-ink underline">{t('Voltar ao Mercado')}</Link>}
        </aside>
        {acao && <ActionDialog action={acao} order={order} onClose={() => setAcao(null)} />}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <MarketHeader />
      <V2BackLink to={voltar}>{role === 'seller' ? t('Mercado') : role === 'admin' ? t('Painel admin') : t('Minhas compras')}</V2BackLink>
      {corpo}
    </div>
  );
}

export default function V2MarketOrder() {
  return <MarketGate><OrderPage /></MarketGate>;
}
