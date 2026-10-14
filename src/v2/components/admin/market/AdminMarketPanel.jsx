/**
 * Painel admin → Mercado. As abas do Mercado (`mercado-*`):
 *  - Visão geral: o que foi vendido, o que está andando, o que travou;
 *  - Problemas: as disputas de pedido abertas (a decisão é no próprio pedido);
 *  - Anúncios: as denúncias (agrupadas por anúncio) e o que a moderação tirou;
 *  - Pedidos: todos, por estado;
 *  - Lojas: a fila de aprovação e o cuidado com as que já vendem;
 *  - Cupons e vales: o que está no ar, quanto foi usado e o saldo em aberto;
 *  - Configurações: o que vale para o Mercado inteiro.
 *
 * Toda decisão avisa o dono da loja e vai para a auditoria (`reviewSeller`).
 * Os dados da empresa (razão social, CNPJ inteiro, telefone) só são lidos
 * quando o admin abre a ficha.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Building2, CheckCircle2, ExternalLink, Flag, Gift, MessageSquareWarning, Package, Store, TicketPercent } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { adminDisableCoupon, moderateListing, resolveListingReports, reviewSeller, saveMarketSettings } from '@/modules/marketplace/services/marketService';
import {
  useAdminListings, useAdminOrders, useAdminPromos, useAdminStores, useListingsByIds, useMarketMutation, useMarketSettings, useOpenDisputes,
  useOpenReports, usePublicListings, useSellerPrivate,
} from '@/modules/marketplace/hooks/useMarket';
import {
  ORDER_FINAL_STATUSES, ORDER_STATUS_LABELS, REPORT_REASON_LABELS, SELLER_STATUS_LABELS, SELLER_TYPE_LABELS,
} from '@/modules/marketplace/domain/constants';
import { normalizeMarketSettings, DEFAULT_BANNED_TERMS } from '@/modules/marketplace/domain/settings';
import { MARKET_CATEGORIES } from '@/modules/marketplace/domain/taxonomy';
import { marketMetrics, promoOverview } from '@/modules/marketplace/domain/metrics';
import { couponBenefitLabel, couponConditionsLabel } from '@/modules/marketplace/domain/promotions';
import { formatBRL } from '@/modules/marketplace/domain/money';
import { statusTone } from '@/v2/components/marketplace/marketUi';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import MarketPhoto from '@/v2/components/marketplace/MarketPhoto';
import {
  V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Input, V2Skeleton, V2Surface, V2Textarea, V2Toggle,
} from '@/v2/ui/primitives';
import { t, tk, tn, fmtData } from '@/core/i18n';

const FILTROS = [
  { id: 'pending', label: tk('Em análise') },
  { id: 'active', label: tk('Ativas') },
  { id: 'suspended', label: tk('Suspensas') },
  { id: 'rejected', label: tk('Recusadas') },
];

const quando = (ts) => {
  const ms = ts?.toMillis ? ts.toMillis() : Number(ts) || 0;
  return ms ? fmtData(ms, { day: '2-digit', month: 'short', year: 'numeric' }) : '';
};
const cnpjFmt = (c) => (String(c || '').length === 14 ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c || '—');

function CompanyData({ sellerKey }) {
  const q = useSellerPrivate(sellerKey);
  if (q.isError) return <V2ErrorState inline onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={3} />;
  const p = q.data || {};
  return (
    <dl className="grid gap-x-6 gap-y-1 rounded-2xl bg-paper p-4 text-sm sm:grid-cols-3">
      <div><dt className="text-xs text-gray-500">{t('Razão social')}</dt><dd className="font-medium text-ink">{p.legal_name || '—'}</dd></div>
      <div><dt className="text-xs text-gray-500">{t('CNPJ')}</dt><dd className="font-medium text-ink">{cnpjFmt(p.cnpj)}</dd></div>
      <div><dt className="text-xs text-gray-500">{t('Telefone')}</dt><dd className="font-medium text-ink">{p.phone || '—'}</dd></div>
    </dl>
  );
}

/** Recusar / suspender: o motivo é obrigatório, porque a pessoa vai ler. */
function ReasonDialog({ acao, loja, onClose }) {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const m = useMarketMutation(({ status, reason }) => reviewSeller(loja, { status, reason }, { actor: user }));
  const recusar = acao === 'rejected';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-md">
        <DialogTitle>{recusar ? t('Recusar o cadastro') : t('Suspender as vendas')}</DialogTitle>
        <DialogDescription>{loja.display_name}. {recusar ? t('A pessoa lê o motivo e pode corrigir e pedir de novo.') : t('Os anúncios saem da vitrine até você reativar.')}</DialogDescription>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate({ status: acao, reason: motivo }, {
              onSuccess: () => { toast.success(recusar ? t('Cadastro recusado. A pessoa foi avisada.') : t('Vendas suspensas. A pessoa foi avisada.')); onClose(); },
              onError: (er) => setErro(er.message),
            });
          }}
        >
          <V2Field label={t('Motivo')} htmlFor="motivo-loja" error={erro}>
            <V2Textarea id="motivo-loja" rows={3} maxLength={300} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(''); }} autoFocus
              placeholder={recusar ? t('Ex.: o CNPJ não está ativo na Receita.') : t('Ex.: pedidos pagos sem entrega.')} />
          </V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onClose}>{t('Voltar')}</V2Button>
            <V2Button type="submit" variant="danger" disabled={m.isPending}>{recusar ? t('Recusar') : t('Suspender')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StoreRow({ loja }) {
  const { user } = useAuth();
  const [aberta, setAberta] = useState(loja.status === 'pending');
  const [motivo, setMotivo] = useState(null);
  const m = useMarketMutation((patch) => reviewSeller(loja, patch, { actor: user }));
  const agir = (patch, msg) => m.mutate(patch, { onSuccess: () => toast.success(msg), onError: (e) => toast.error(e.message) });
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <V2Avatar name={loja.display_name} photoUrl={loja.logo_url} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
              {loja.display_name}
              {loja.verified && <BadgeCheck className="h-4 w-4 text-blue-600" aria-label={t('Verificada')} />}
              <V2Badge tone={loja.status === 'active' ? 'green' : loja.status === 'pending' ? 'amber' : 'neutral'}>{SELLER_STATUS_LABELS[loja.status] || loja.status}</V2Badge>
            </p>
            <p className="text-xs text-gray-500">{[loja.city, loja.state].filter(Boolean).join(' · ')}{loja.cnpj_masked ? ` · CNPJ ${loja.cnpj_masked}` : ''} · desde {quando(loja.created_at)}</p>
            {loja.reject_reason && loja.status !== 'active' && <p className="mt-1 text-sm text-red-600">{t('Motivo: {reject_reason}', { reject_reason: loja.reject_reason })}</p>}
          </div>
          <V2Button type="button" size="sm" variant="ghost" aria-expanded={aberta} onClick={() => setAberta((x) => !x)}>{aberta ? t('Fechar ficha') : t('Ver ficha')}</V2Button>
        </div>
        {aberta && (
          <div className="space-y-3">
            {loja.bio && <p className="whitespace-pre-line text-sm text-gray-700">{loja.bio}</p>}
            <p className="text-sm text-gray-600">{t('Devolução em até')} {loja.policies?.return_days ?? '—'} {t('dias · despacha em até')} {loja.policies?.ship_within_hours ?? '—'} h{loja.website ? <> · <a href={loja.website} target="_blank" rel="noopener noreferrer nofollow" className="font-bold text-ink underline">{t('site')}</a></> : null}</p>
            <CompanyData sellerKey={loja.id} />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {loja.status === 'pending' && (
            <>
              <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => agir({ status: 'active' }, 'Loja aprovada. O dono foi avisado.')}>{t('Aprovar')}</V2Button>
              <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => agir({ status: 'active', verified: true }, 'Loja aprovada e verificada.')} variant="secondary">{t('Aprovar e verificar')}</V2Button>
              <V2Button type="button" size="sm" variant="danger" onClick={() => setMotivo('rejected')}>{t('Recusar')}</V2Button>
            </>
          )}
          {loja.status === 'active' && (
            <>
              <V2Button type="button" size="sm" variant="secondary" disabled={m.isPending} onClick={() => agir({ verified: !loja.verified }, loja.verified ? 'Selo retirado.' : 'Selo de verificada dado.')}>
                {loja.verified ? t('Tirar o selo') : t('Dar o selo de verificada')}
              </V2Button>
              <V2Button type="button" size="sm" variant="danger" onClick={() => setMotivo('suspended')}>{t('Suspender')}</V2Button>
              <V2Button asChild size="sm" variant="ghost"><Link to={`/mercado/vendedor/${loja.id}`}>{t('Ver vitrine')} <ExternalLink className="h-3.5 w-3.5" /></Link></V2Button>
            </>
          )}
          {loja.status === 'suspended' && (
            <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => agir({ status: 'active' }, 'Loja reativada. O dono foi avisado.')}>{t('Reativar')}</V2Button>
          )}
        </div>
      </V2Surface>
      {motivo && <ReasonDialog acao={motivo} loja={loja} onClose={() => setMotivo(null)} />}
    </li>
  );
}

function StoresTab() {
  const q = useAdminStores();
  const [filtro, setFiltro] = useState('pending');
  if (q.isError) return <V2ErrorState onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={6} />;
  const todas = q.data || [];
  const lista = todas.filter((l) => l.status === filtro).sort((a, b) => (a.created_at?.toMillis?.() || 0) - (b.created_at?.toMillis?.() || 0));
  return (
    <section className="space-y-4" aria-label={t('Lojas do Mercado')}>
      <div>
        <h2 className="font-display text-xl font-bold text-ink">{t('Lojas')}</h2>
        <p className="text-sm text-gray-500">{t('Quem vende como empresa passa por aqui antes de abrir. Confira o CNPJ na Receita antes de aprovar.')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => <V2FilterChip key={f.id} active={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.label} ({todas.filter((l) => l.status === f.id).length})</V2FilterChip>)}
      </div>
      {!lista.length ? (
        <V2EmptyState icon={filtro === 'pending' ? Store : Building2} title={filtro === 'pending' ? t('Nenhuma loja esperando') : t('Nada aqui')} description={filtro === 'pending' ? t('Quando alguém pedir para abrir uma loja, o cadastro aparece aqui.') : undefined} />
      ) : (
        <ul className="space-y-3">{lista.map((l) => <StoreRow key={l.id} loja={l} />)}</ul>
      )}
    </section>
  );
}

const ALL_ORDER_STATUSES = Object.keys(ORDER_STATUS_LABELS);
const msDe = (ts) => (ts?.toMillis ? ts.toMillis() : Number(ts) || 0);
const haQuanto = (ms) => {
  if (!ms) return '';
  const h = Math.floor((Date.now() - ms) / 3600000);
  if (h < 1) return t('agora há pouco');
  if (h < 48) return t('há {h} h', { h });
  return t('há {valor} dias', { valor: Math.floor(h / 24) });
};

function TabTitle({ title, children }) {
  return (
    <div>
      <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
      {children && <p className="text-sm text-gray-500">{children}</p>}
    </div>
  );
}

/* ------------------------------------------------------- visão geral -- */

function Numero({ label, value, hint }) {
  return (
    <V2Surface variant="compacto" className="p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </V2Surface>
  );
}

function OverviewTab() {
  const pedidos = useAdminOrders(ALL_ORDER_STATUSES);
  const anuncios = usePublicListings();
  const lojas = useAdminStores();
  const m = useMemo(() => marketMetrics(pedidos.data || []), [pedidos.data]);
  if (pedidos.isError) return <V2ErrorState onRetry={() => pedidos.refetch()} />;
  if (pedidos.isLoading) return <V2Skeleton lines={6} />;
  const vendedores = new Set((anuncios.data || []).map((l) => l.seller_key));
  const porTipo = (anuncios.data || []).reduce((acc, l) => ({ ...acc, [l.seller_type]: (acc[l.seller_type] || 0) + 1 }), {});
  return (
    <section className="space-y-5" aria-label={t('Visão geral do Mercado')}>
      <TabTitle title={t('Visão geral')}>{t('Só o que foi concluído conta como vendido. O dinheiro vai direto do comprador para quem vende (Pix), sem passar pela plataforma.')}</TabTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero label={t('Vendido nos últimos 30 dias')} value={formatBRL(m.recentCompletedCents)} hint={tn(m.recentCompletedCount, '{n} pedido', '{n} pedidos')} />
        <Numero label={t('Vendido desde o início')} value={formatBRL(m.completedCents)} hint={m.avgTicketCents != null ? t('ticket médio {avgTicketCents}', { avgTicketCents: formatBRL(m.avgTicketCents) }) : t('nenhuma venda concluída')} />
        <Numero label={t('Pedidos em andamento')} value={m.activeCount} hint={m.disputedCount ? t('{disputedCount} em disputa', { disputedCount: m.disputedCount }) : t('nenhum em disputa')} />
        <Numero label={t('Pedidos que chegam ao fim')} value={m.completionRate == null ? '—' : `${Math.round(m.completionRate * 100)}%`} hint={tn(m.lostCount, '{n} cancelado ou expirado', '{n} cancelados ou expirados')} />
      </div>
      {anuncios.isError ? <V2ErrorState inline onRetry={() => anuncios.refetch()} /> : !anuncios.isLoading && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Numero label={t('Anúncios na vitrine')} value={(anuncios.data || []).length} hint={`${vendedores.size} vendedor(es)`} />
          <V2Surface variant="compacto" className="col-span-2 p-4">
            <p className="text-xs font-medium text-gray-500">{t('Anúncios por quem vende')}</p>
            <dl className="mt-2 grid grid-cols-4 gap-2">
              {Object.entries(SELLER_TYPE_LABELS).map(([k, l]) => (
                <div key={k}><dt className="text-xs text-gray-500">{l}</dt><dd className="font-display text-xl font-bold text-ink">{porTipo[k] || 0}</dd></div>
              ))}
            </dl>
          </V2Surface>
        </div>
      )}
      {lojas.isSuccess && <p className="text-sm text-gray-500">{tn((lojas.data || []).filter((x) => x.status === 'active').length, '{n} loja ativa · {esperando} esperando aprovação.', '{n} lojas ativas · {esperando} esperando aprovação.', { esperando: (lojas.data || []).filter((x) => x.status === 'pending').length })}</p>}
    </section>
  );
}

/* ----------------------------------------------------------- disputas -- */

function DisputesTab() {
  const q = useOpenDisputes();
  if (q.isError) return <V2ErrorState onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={5} />;
  const lista = [...(q.data || [])].sort((a, b) => (a.created_at_ms || 0) - (b.created_at_ms || 0));
  return (
    <section className="space-y-4" aria-label={t('Problemas em pedidos')}>
      <TabTitle title={t('Problemas em pedidos')}>{t('O comprador relatou um problema depois de pagar. Abra o pedido, leia o histórico e decida a favor de um dos lados (o motivo vai para os dois). Os mais antigos primeiro.')}</TabTitle>
      {!lista.length ? (
        <V2EmptyState icon={CheckCircle2} title={t('Nenhum problema aberto')} description={t('Quando um comprador relatar um problema, o pedido aparece aqui.')} />
      ) : (
        <ul className="space-y-3">
          {lista.map((d) => (
            <li key={d.id}>
              <V2Surface variant="compacto" className="flex flex-wrap items-start gap-3 p-4">
                <MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">{t('Pedido')} {d.order_code || d.id}</p>
                  <p className="text-sm text-gray-700">{d.reason}</p>
                  <p className="text-xs text-gray-500">{t('Aberto')} {haQuanto(d.created_at_ms)}{d.previous_status ? ` · estava "${ORDER_STATUS_LABELS[d.previous_status] || d.previous_status}"` : ''}</p>
                </div>
                <V2Button asChild size="sm"><Link to={`/mercado/pedidos/${d.order_id || d.id}`}>{t('Abrir e decidir')}</Link></V2Button>
              </V2Surface>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ----------------------------------------------------------- anúncios -- */

function RemoveForm({ listing, onDone }) {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const m = useMarketMutation(() => moderateListing(listing, { action: 'remove', reason: motivo }, { uid: user?.uid, actor: user }));
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); m.mutate(undefined, { onSuccess: () => { toast.success(t('Anúncio retirado. Quem vende foi avisado.')); onDone(); }, onError: (er) => setErro(er.message) }); }}>
      <V2Field label={t('Motivo (quem vende vai ler)')} htmlFor={`motivo-${listing.id}`} error={erro}>
        <V2Textarea id={`motivo-${listing.id}`} rows={2} maxLength={300} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(''); }} autoFocus />
      </V2Field>
      <div className="flex gap-2">
        <V2Button type="button" size="sm" variant="ghost" onClick={onDone}>{t('Voltar')}</V2Button>
        <V2Button type="submit" size="sm" variant="danger" disabled={m.isPending}>{t('Tirar do ar')}</V2Button>
      </div>
    </form>
  );
}

function ReportedRow({ listingId, reports, listing }) {
  const { user } = useAuth();
  const [tirando, setTirando] = useState(false);
  const manter = useMarketMutation(() => resolveListingReports(listingId, { outcome: 'kept', uid: user?.uid }));
  const titulo = listing?.title || reports[0].listing_title || t('Anúncio');
  const motivos = reports.reduce((acc, r) => ({ ...acc, [r.reason]: (acc[r.reason] || 0) + 1 }), {});
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-paper">
            {listing?.media?.[0]?.thumb_url || listing?.media?.[0]?.url ? <MarketPhoto src={listing.media[0].thumb_url || listing.media[0].url} aspect={listing.media[0].aspect} frame={listing.media[0].frame} loading="lazy" /> : <Package className="m-4 h-6 w-6 text-gray-300" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{titulo}</p>
            <p className="text-xs text-gray-500">{listing ? `${listing.seller_name || ''} · ${formatBRL(listing.price_cents)}` : t('Não deu para carregar o anúncio')}{listing?.status === 'removed' ? t(' · já retirado') : ''}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(motivos).map(([k, n]) => <V2Badge key={k} tone="red">{REPORT_REASON_LABELS[k] || k}{n > 1 ? ` · ${n}` : ''}</V2Badge>)}
            </div>
            {reports.filter((r) => r.text).map((r) => <p key={r.id} className="mt-2 rounded-xl bg-paper p-2 text-sm text-gray-700">“{r.text}”</p>)}
          </div>
        </div>
        {tirando ? <RemoveForm listing={listing} onDone={() => setTirando(false)} /> : (
          <div className="flex flex-wrap gap-2">
            {listing && listing.status !== 'removed' && <V2Button type="button" size="sm" variant="danger" onClick={() => setTirando(true)}>{t('Tirar do ar')}</V2Button>}
            <V2Button type="button" size="sm" variant="secondary" disabled={manter.isPending} onClick={() => manter.mutate(undefined, { onSuccess: () => toast.success(t('Denúncias encerradas. O anúncio segue no ar.')), onError: (e) => toast.error(e.message) })}>
              {listing?.status === 'removed' ? t('Encerrar as denúncias') : t('Está tudo certo, manter')}
            </V2Button>
            <V2Button asChild size="sm" variant="ghost"><Link to={`/mercado/anuncio/${listingId}`}>{t('Ver o anúncio')} <ExternalLink className="h-3.5 w-3.5" /></Link></V2Button>
          </div>
        )}
      </V2Surface>
    </li>
  );
}

function ModeratedRow({ listing }) {
  const { user } = useAuth();
  const m = useMarketMutation(() => moderateListing(listing, { action: 'restore' }, { uid: user?.uid, actor: user }));
  return (
    <li>
      <V2Surface variant="compacto" className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">{listing.title}</p>
          <p className="text-xs text-gray-500">{listing.seller_name} · {listing.moderation?.auto ? t('Pausado automaticamente') : t('Retirado')}{listing.moderation?.reason ? `: ${listing.moderation.reason}` : ''}</p>
        </div>
        {listing.status === 'removed' && <V2Button type="button" size="sm" variant="secondary" disabled={m.isPending} onClick={() => m.mutate(undefined, { onSuccess: () => toast.success(t('Anúncio liberado. Quem vende foi avisado.')), onError: (e) => toast.error(e.message) })}>{t('Liberar')}</V2Button>}
        <V2Button asChild size="sm" variant="ghost"><Link to={`/mercado/anuncio/${listing.id}`}>{t('Ver')}</Link></V2Button>
      </V2Surface>
    </li>
  );
}

function ListingsTab() {
  const reports = useOpenReports();
  const moderados = useAdminListings(['removed', 'paused']);
  const [vista, setVista] = useState('denuncias');
  const grupos = useMemo(() => {
    const g = {};
    (reports.data || []).forEach((r) => { (g[r.listing_id] = g[r.listing_id] || []).push(r); });
    return Object.entries(g).sort((a, b) => b[1].length - a[1].length);
  }, [reports.data]);
  const anuncios = useListingsByIds(grupos.map(([id]) => id));
  const listaModerados = (moderados.data || []).filter((l) => l.status === 'removed' || l.moderation?.auto);
  return (
    <section className="space-y-4" aria-label={t('Anúncios')}>
      <TabTitle title={t('Anúncios')}>{t('As denúncias chegam agrupadas por anúncio. Anúncio com termo proibido é pausado sozinho e quem vende é avisado. Para tirar do ar qualquer outro, abra o anúncio: o admin vê a caixa “Moderação”.')}</TabTitle>
      <div className="flex flex-wrap gap-2">
        <V2FilterChip active={vista === 'denuncias'} onClick={() => setVista('denuncias')}>{t('Denunciados')}{reports.isSuccess ? ` (${grupos.length})` : ''}</V2FilterChip>
        <V2FilterChip active={vista === 'moderados'} onClick={() => setVista('moderados')}>{t('Retirados e pausados pela moderação')}{moderados.isSuccess ? ` (${listaModerados.length})` : ''}</V2FilterChip>
      </div>
      {vista === 'denuncias' ? (
        reports.isError ? <V2ErrorState onRetry={() => reports.refetch()} />
          : reports.isLoading ? <V2Skeleton lines={5} />
            : !grupos.length ? <V2EmptyState icon={Flag} title={t('Nenhuma denúncia aberta')} description={t('Quando alguém denunciar um anúncio, ele aparece aqui.')} />
              : <ul className="space-y-3">{grupos.map(([id, rs]) => <ReportedRow key={id} listingId={id} reports={rs} listing={anuncios.data?.[id]} />)}</ul>
      ) : (
        moderados.isError ? <V2ErrorState onRetry={() => moderados.refetch()} />
          : moderados.isLoading ? <V2Skeleton lines={5} />
            : !listaModerados.length ? <V2EmptyState icon={CheckCircle2} title={t('Nada retirado')} description={t('Os anúncios que a moderação tirar do ar ficam aqui, para liberar se for o caso.')} />
              : <ul className="space-y-3">{listaModerados.map((l) => <ModeratedRow key={l.id} listing={l} />)}</ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ pedidos -- */

function OrdersTab() {
  const q = useAdminOrders(ALL_ORDER_STATUSES);
  const [filtro, setFiltro] = useState('andamento');
  const [busca, setBusca] = useState('');
  if (q.isError) return <V2ErrorState onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={6} />;
  const todos = q.data || [];
  const filtros = {
    andamento: (o) => !ORDER_FINAL_STATUSES.includes(o.status) && o.status !== 'disputed',
    disputa: (o) => o.status === 'disputed',
    concluidos: (o) => o.status === 'completed',
    perdidos: (o) => o.status === 'cancelled' || o.status === 'expired',
  };
  const termo = busca.trim().toLowerCase();
  const lista = todos.filter(filtros[filtro]).filter((o) => !termo || [o.code, o.buyer_name, o.seller_name].some((x) => String(x || '').toLowerCase().includes(termo)));
  return (
    <section className="space-y-4" aria-label={t('Pedidos do Mercado')}>
      <TabTitle title={t('Pedidos')}>{t('Todos os pedidos do Mercado. O admin abre qualquer um e pode cancelar com motivo (os dois lados são avisados).')}</TabTitle>
      <div className="flex flex-wrap gap-2">
        {[['andamento', t('Em andamento')], ['disputa', t('Em disputa')], ['concluidos', t('Concluídos')], ['perdidos', t('Cancelados e expirados')]].map(([id, l]) => (
          <V2FilterChip key={id} active={filtro === id} onClick={() => setFiltro(id)}>{l} ({todos.filter(filtros[id]).length})</V2FilterChip>
        ))}
      </div>
      <label htmlFor="busca-pedido" className="sr-only">{t('Buscar pedido')}</label>
      <V2Input id="busca-pedido" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('Código, comprador ou vendedor')} className="max-w-sm" />
      {!lista.length ? <V2EmptyState icon={Package} title={t('Nenhum pedido aqui')} /> : (
        <ul className="divide-y divide-gray-100 rounded-3xl border border-gray-100 bg-paper-pure">
          {lista.slice(0, 200).map((o) => (
            <li key={o.id}>
              <Link to={`/mercado/pedidos/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-paper">
                <span className="font-bold text-ink">{o.code}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-gray-600">{o.buyer_name} → {o.seller_name}</span>
                <span className="text-sm font-bold text-ink">{formatBRL(o.total_cents)}</span>
                <V2Badge tone={statusTone(o.status)}>{ORDER_STATUS_LABELS[o.status] || o.status}</V2Badge>
                <span className="w-full text-xs text-gray-500 sm:w-auto">{haQuanto(o.placed_at_ms || msDe(o.created_at))}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {lista.length > 200 && <p className="text-xs text-gray-500">{t('Mostrando os 200 mais recentes. Use a busca para achar um pedido.')}</p>}
    </section>
  );
}

/* ---------------------------------------------------- cupons e vales -- */

function DisableCouponForm({ coupon, onDone }) {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const m = useMarketMutation(() => adminDisableCoupon(coupon, { reason: motivo, actor: user }));
  return (
    <form className="w-full space-y-2" onSubmit={(e) => { e.preventDefault(); m.mutate(undefined, { onSuccess: () => { toast.success(t('Cupom desligado. Quem vende foi avisado.')); onDone(); }, onError: (er) => setErro(er.message) }); }}>
      <V2Field label={t('Motivo (quem vende vai ler)')} htmlFor={`motivo-cupom-${coupon.id}`} error={erro}>
        <V2Textarea id={`motivo-cupom-${coupon.id}`} rows={2} maxLength={300} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(''); }} autoFocus />
      </V2Field>
      <div className="flex gap-2">
        <V2Button type="button" size="sm" variant="ghost" onClick={onDone}>{t('Voltar')}</V2Button>
        <V2Button type="submit" size="sm" variant="danger" disabled={m.isPending}>{t('Desligar o cupom')}</V2Button>
      </div>
    </form>
  );
}

function PromosTab() {
  const q = useAdminPromos();
  const [busca, setBusca] = useState('');
  const [desligar, setDesligar] = useState(null);
  const m = useMemo(() => promoOverview(q.data?.coupons || [], q.data?.giftCards || []), [q.data]);
  if (q.isError) return <V2ErrorState onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={6} />;
  const termo = busca.trim().toLowerCase();
  const cupons = m.topCoupons.filter((c) => !termo || [c.code, c.seller_key].some((x) => String(x || '').toLowerCase().includes(termo)));
  return (
    <section className="space-y-5" aria-label={t('Cupons e vales do Mercado')}>
      <TabTitle title={t('Cupons e vales')}>{t('Os cupons que as lojas criaram e os vales-presente vendidos. O saldo em aberto é o que as lojas ainda devem em mercadoria.')}</TabTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero label={t('Cupons no ar')} value={m.couponsActive} hint={tn(m.topCoupons.length, '{n} criado', '{n} criados')} />
        <Numero label={t('Usos de cupom')} value={m.couponUses} hint={t('pedidos que levaram desconto')} />
        <Numero label={t('Vales para usar')} value={m.giftCardsActive} hint={t('saldo de {openBalanceCents}', { openBalanceCents: formatBRL(m.openBalanceCents) })} />
        <Numero label={t('Saldo que venceu')} value={formatBRL(m.expiredBalanceCents)} hint={t('vale vencido com saldo')} />
      </div>
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><TicketPercent className="h-4 w-4" /> {t('Cupons')}</h3>
        <label htmlFor="busca-cupom" className="sr-only">{t('Buscar cupom')}</label>
        <V2Input id="busca-cupom" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('Código ou loja')} className="max-w-sm" />
        {!cupons.length ? <V2EmptyState icon={TicketPercent} title={termo ? t('Nenhum cupom com esta busca') : t('Nenhuma loja criou cupom ainda')} /> : (
          <V2Surface as="ul" variant="compacto" className="divide-y divide-gray-100 p-0">
            {cupons.slice(0, 200).map((c) => {
              const vivo = m.isLive(c);
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                  <span className="font-bold text-ink">{c.code}</span>
                  <span className="min-w-0 flex-1 text-sm text-gray-600">
                    {couponBenefitLabel(c)}{couponConditionsLabel(c) ? ` · ${couponConditionsLabel(c)}` : ''}
                    <Link to={`/mercado/vendedor/${c.seller_key}`} className="block truncate text-xs text-gray-500 underline">{c.seller_key}</Link>
                  </span>
                  <span className="text-sm text-gray-600">{tn(c.uses_count || 0, '{n} uso', '{n} usos')}</span>
                  <V2Badge tone={vivo ? 'green' : 'neutral'}>{c.active === false ? t('Desligado') : vivo ? t('No ar') : t('Fora do prazo')}</V2Badge>
                  {c.active !== false && desligar !== c.id && <V2Button type="button" size="sm" variant="ghost" onClick={() => setDesligar(c.id)}>{t('Desligar')}</V2Button>}
                  {desligar === c.id && <DisableCouponForm coupon={c} onDone={() => setDesligar(null)} />}
                </li>
              );
            })}
          </V2Surface>
        )}
      </div>
      <div className="space-y-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><Gift className="h-4 w-4" /> {t('Saldo de vales por loja')}</h3>
        {!m.giftCardsByStore.length ? <V2EmptyState icon={Gift} title={t('Nenhum vale com saldo para usar')} /> : (
          <V2Surface as="ul" variant="compacto" className="divide-y divide-gray-100 p-0">
            {m.giftCardsByStore.map((l) => (
              <li key={l.seller_key} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
                <Link to={`/mercado/vendedor/${l.seller_key}`} className="min-w-0 flex-1 truncate font-bold text-ink hover:underline">{l.seller_name || l.seller_key}</Link>
                <span className="text-sm text-gray-600">{tn(l.count, '{n} vale', '{n} vales')}</span>
                <span className="text-sm font-bold text-ink">{formatBRL(l.balance_cents)}</span>
              </li>
            ))}
          </V2Surface>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------ configurações -- */

function NumberField({ id, label, hint, value, onChange, min, max }) {
  return (
    <V2Field label={label} htmlFor={id} hint={hint}>
      <V2Input id={id} type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)} className="max-w-[10rem]" />
    </V2Field>
  );
}

function SettingsTab() {
  const { user } = useAuth();
  const q = useMarketSettings();
  const [v, setV] = useState(null);
  const [termos, setTermos] = useState('');
  useEffect(() => {
    if (q.data && !v) { setV(q.data); setTermos((q.data.banned_terms || []).join('\n')); }
  }, [q.data, v]);
  const m = useMarketMutation((input) => saveMarketSettings(input, { uid: user?.uid }));
  if (q.isError) return <V2ErrorState onRetry={() => q.refetch()} />;
  if (!v) return <V2Skeleton lines={8} />;
  const set = (k, val) => setV((x) => ({ ...x, [k]: val }));
  const desligadas = new Set(v.disabled_categories || []);
  const alternarCat = (slug) => set('disabled_categories', desligadas.has(slug) ? [...desligadas].filter((s) => s !== slug) : [...desligadas, slug]);
  const salvar = (e) => {
    e.preventDefault();
    const final = normalizeMarketSettings({ ...v, banned_terms: termos.split('\n') });
    m.mutate(final, { onSuccess: (r) => { setV(r); toast.success(t('Configurações do Mercado salvas.')); }, onError: (er) => toast.error(er.message) });
  };
  return (
    <form className="space-y-6" onSubmit={salvar} aria-label={t('Configurações do Mercado')}>
      <TabTitle title={t('Configurações')}>{t('Vale para o Mercado inteiro, na hora. Ligar ou desligar o Mercado em si fica em Funcionalidades.')}</TabTitle>
      <V2Surface variant="compacto" className="space-y-4 p-5">
        <h3 className="font-bold text-ink">{t('O que está aberto')}</h3>
        <V2Toggle id="cfg-pedidos" checked={v.orders_enabled} onChange={(x) => set('orders_enabled', x)} label={t('Pedidos')} hint={t('Desligado, ninguém finaliza compra (os pedidos em andamento seguem).')} />
        <V2Toggle id="cfg-ofertas" checked={v.offers_enabled} onChange={(x) => set('offers_enabled', x)} label={t('Ofertas')} hint={t('Desligado, some o botão Fazer oferta.')} />
        <V2Toggle id="cfg-lojas" checked={v.stores_enabled} onChange={(x) => set('stores_enabled', x)} label={t('Novos cadastros de loja')} hint={t('Desligado, a página de abrir loja avisa que os cadastros estão fechados.')} />
      </V2Surface>
      <V2Surface variant="compacto" className="space-y-4 p-5">
        <h3 className="font-bold text-ink">{t('Prazos')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField id="cfg-resposta" label={t('Vendedor responde o pedido em (horas)')} min={12} max={240} value={v.seller_answer_hours} onChange={(x) => set('seller_answer_hours', x)} />
          <NumberField id="cfg-pagamento" label={t('Comprador paga em (horas)')} min={6} max={168} value={v.payment_hours} onChange={(x) => set('payment_hours', x)} />
          <NumberField id="cfg-concluir" label={t('Conclusão automática depois de enviado (dias)')} min={2} max={30} value={v.auto_complete_days} onChange={(x) => set('auto_complete_days', x)} />
          <NumberField id="cfg-disputa" label={t('Prazo para relatar problema (dias)')} min={2} max={30} value={v.dispute_window_days} onChange={(x) => set('dispute_window_days', x)} />
          <NumberField id="cfg-rodadas" label={t('Rodadas de oferta e contraoferta')} min={1} max={10} value={v.offer_max_rounds} onChange={(x) => set('offer_max_rounds', x)} />
          <NumberField id="cfg-oferta" label={t('Oferta vale por (horas)')} min={6} max={240} value={v.offer_ttl_hours} onChange={(x) => set('offer_ttl_hours', x)} />
        </div>
      </V2Surface>
      <V2Surface variant="compacto" className="space-y-4 p-5">
        <h3 className="font-bold text-ink">{t('Anúncios no ar por vendedor')}</h3>
        <div className="grid gap-4 sm:grid-cols-4">
          {Object.entries(SELLER_TYPE_LABELS).map(([k, l]) => (
            <NumberField key={k} id={`cfg-lim-${k}`} label={l} min={1} max={10000} value={v.max_active_listings?.[k] ?? ''} onChange={(x) => set('max_active_listings', { ...v.max_active_listings, [k]: x })} />
          ))}
        </div>
      </V2Surface>
      <V2Surface variant="compacto" className="space-y-3 p-5">
        <h3 className="font-bold text-ink">{t('Termos proibidos')}</h3>
        <p className="text-sm text-gray-500">{t('Um por linha. O anúncio que citar um deles nem é publicado, e o que já estava no ar é pausado (quem vende é avisado). Já valem sempre:')} {DEFAULT_BANNED_TERMS.join(', ')}.</p>
        <label htmlFor="cfg-termos" className="sr-only">{t('Termos proibidos')}</label>
        <V2Textarea id="cfg-termos" rows={5} value={termos} onChange={(e) => setTermos(e.target.value)} placeholder={t('Ex.: atacado')} />
      </V2Surface>
      <V2Surface variant="compacto" className="space-y-3 p-5">
        <h3 className="font-bold text-ink">{t('Categorias')}</h3>
        <p className="text-sm text-gray-500">{t('Toque para desligar. Categoria desligada some da vitrine e da escolha ao anunciar.')}</p>
        <div className="space-y-3">
          {MARKET_CATEGORIES.map((c) => (
            <div key={c.slug} className="flex flex-wrap items-center gap-1.5">
              <V2FilterChip active={!desligadas.has(c.slug)} onClick={() => alternarCat(c.slug)}>{c.label}</V2FilterChip>
              {!desligadas.has(c.slug) && (c.children || []).map((k) => <V2FilterChip key={k.slug} active={!desligadas.has(k.slug)} onClick={() => alternarCat(k.slug)} className="text-xs">{k.label}</V2FilterChip>)}
            </div>
          ))}
        </div>
      </V2Surface>
      <div className="sticky bottom-4 flex justify-end">
        <V2Button type="submit" disabled={m.isPending}>{m.isPending ? t('Salvando…') : t('Salvar configurações')}</V2Button>
      </div>
    </form>
  );
}

const TABS = {
  'mercado-resumo': OverviewTab,
  'mercado-disputas': DisputesTab,
  'mercado-anuncios': ListingsTab,
  'mercado-pedidos': OrdersTab,
  'mercado-lojas': StoresTab,
  'mercado-promocoes': PromosTab,
  'mercado-config': SettingsTab,
};

export default function AdminMarketPanel({ tab }) {
  const Tab = TABS[tab];
  return Tab ? <Tab /> : null;
}
