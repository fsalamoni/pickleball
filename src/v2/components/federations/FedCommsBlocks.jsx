/**
 * Os blocos PÚBLICOS da comunicação da federação (PR 4), na página dentro do
 * app (`/federacoes/:id`) e — os que não pedem conta — na pública (`/f/:slug`):
 *  - `FedNewsSection`: as notícias publicadas (módulo `news`); as "só
 *    filiados" aparecem a quem tem filiação ativa. `?noticia=<id>` (o link do
 *    aviso) abre e rola até a notícia;
 *  - `FedPromosSection`: cupons e banners da federação (módulo `promos`) —
 *    só no app: a divulgação é legível por conta logada;
 *  - `FedSponsorsStrip`: os patrocinadores (módulo `sponsors`);
 *  - `FedGovernanceBlock`: estatuto, mandato, diretoria e atas (sempre que
 *    preenchido — transparência não é módulo);
 *  - `FedStoreLink`: a loja oficial no Mercado (módulo `store`).
 * Falha não é vazio (`docs/27-FALHA-NAO-E-VAZIO.md`).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ExternalLink, FileText, Lock, Newspaper, Pin, ScrollText, ShoppingBag, Tag } from 'lucide-react';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { visibleNews } from '@/modules/federations/domain/news';
import { visibleSponsors } from '@/modules/federations/domain/sponsors';
import { hasGovernance, sortMinutes } from '@/modules/federations/domain/governance';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { NEWS_AUDIENCE, SPONSOR_TIER_LABELS } from '@/modules/federations/domain/constants';
import { useMemberNews, usePublicNews } from '@/modules/federations/hooks/useFederations';
import { isVisibleTo, livePromoBanners, livePromoCoupons } from '@/modules/promo/domain/promo';
import { useFederationPublicPromos, usePromoViewer } from '@/modules/promo/hooks/usePromo';
import { todayISO } from '@/modules/arenas/domain/subscription';
import PromoCampaignBanner from '@/v2/components/promo/PromoCampaignBanner';
import PromoCouponCard from '@/v2/components/promo/PromoCouponCard';
import { rolarAte } from '@/v2/ui/rolarAte';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { V2Badge, V2Button, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { safeHttpUrl } from '@/core/domain/externalUrl';
import { destinoDeAviso } from '@/core/domain/internalLink';
import { quando } from './federationUi';

/* ---------------------------------------------------------------- notícias -- */

function Noticia({ n, aberta, onToggle, ancoraRef }) {
  // O link vem do banco: interno só caminho de UMA barra; externo só http(s).
  const interno = destinoDeAviso(n.link);
  const externo = interno ? '' : safeHttpUrl(n.link);
  return (
    <li ref={ancoraRef} id={`noticia-${n.id}`} className="scroll-mt-4">
      <V2Surface variant="compacto" className="p-4">
        <button type="button" onClick={onToggle} aria-expanded={aberta} className="flex w-full items-start gap-3 text-left">
          {n.pinned ? <Pin className="mt-1 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" /> : <Newspaper className="mt-1 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />}
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2 font-bold text-ink">
              {n.title}
              {n.audience === NEWS_AUDIENCE.MEMBERS && <V2Badge tone="ink"><Lock className="h-3 w-3" aria-hidden="true" />{t('Só filiados')}</V2Badge>}
            </span>
            <span className="block text-xs text-gray-500">{n.published_at ? quando(n.published_at) : ''}</span>
            {!aberta && <span className="mt-1 block text-sm text-gray-600">{n.summary || `${String(n.body || '').slice(0, 180)}${String(n.body || '').length > 180 ? '…' : ''}`}</span>}
          </span>
          <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-gray-500 transition-transform ${aberta ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {aberta && (
          <div className="mt-3 space-y-3 pl-7">
            {n.image_url && <img src={n.image_url} alt="" loading="lazy" className="max-h-80 w-full rounded-2xl object-cover" />}
            <p className="whitespace-pre-line text-sm leading-6 text-gray-700">{n.body}</p>
            {(interno || externo) && (interno
              ? <Link to={interno} className="inline-flex items-center gap-1 text-sm font-bold text-ink underline">{t('Saiba mais')}</Link>
              : <a href={externo} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-sm font-bold text-ink underline"><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />{t('Saiba mais')}</a>)}
          </div>
        )}
      </V2Surface>
    </li>
  );
}

/** As notícias publicadas. `memberOf`: a pessoa tem filiação ATIVA (lê também as "só filiados"). */
export function FedNewsSection({ federation, memberOf = false, limite = 6, onVerTodas = null }) {
  const ligado = fedModuleOn(federation, 'news');
  const pub = usePublicNews(federation?.id, { enabled: ligado });
  const mem = useMemberNews(federation?.id, { enabled: ligado && memberOf });
  const [params] = useSearchParams();
  const pedida = params.get('noticia');
  const [abertas, setAbertas] = useState(() => new Set(pedida ? [pedida] : []));
  const [todas, setTodas] = useState(false);
  const alvo = useRef(null);
  const rolou = useRef(false);
  const lista = useMemo(() => (pub.isSuccess
    ? visibleNews([...(pub.data || []), ...(memberOf && mem.isSuccess ? mem.data || [] : [])], { memberOf })
    : null), [pub.isSuccess, pub.data, mem.isSuccess, mem.data, memberOf]);
  // A notícia do aviso: aberta e na tela, mesmo além do limite.
  const indicePedida = lista && pedida ? lista.findIndex((n) => n.id === pedida) : -1;
  useEffect(() => {
    if (rolou.current || indicePedida < 0 || !alvo.current) return;
    rolou.current = true;
    requestAnimationFrame(() => rolarAte(alvo.current));
  }, [indicePedida]);
  if (!ligado) return null;
  const mostradas = lista ? (todas || indicePedida >= limite ? lista : lista.slice(0, limite)) : [];
  const alternar = (id) => setAbertas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <section id="federacao-noticias" aria-labelledby="fed-noticias" className="scroll-mt-4 space-y-3" data-dica="federacao-noticias-publicas">
      <h2 id="fed-noticias" className="font-display text-xl font-bold text-ink">{t('Notícias')}</h2>
      {pub.isError && <V2ErrorState inline title={t('Não carregaram as notícias')} onRetry={() => pub.refetch()} />}
      {memberOf && mem.isError && <V2ErrorState inline title={t('Não carregaram as notícias dos filiados')} onRetry={() => mem.refetch()} />}
      {pub.isLoading && <V2Skeleton lines={3} />}
      {lista && lista.length === 0 && !(memberOf && mem.isError) && <p className="text-sm text-gray-500">{t('A federação ainda não publicou notícias.')}</p>}
      {pedida && lista && indicePedida < 0 && !mem.isLoading && <p className="text-sm text-gray-500">{t('Esta notícia não está mais publicada.')}</p>}
      {mostradas.length > 0 && (
        <ul className="space-y-2">
          {mostradas.map((n) => <Noticia key={n.id} n={n} aberta={abertas.has(n.id)} onToggle={() => alternar(n.id)} ancoraRef={n.id === pedida ? alvo : undefined} />)}
        </ul>
      )}
      {lista && lista.length > mostradas.length && <V2Button type="button" variant="ghost" size="sm" onClick={onVerTodas || (() => setTodas(true))}>{t('Ver todas as {n} notícias', { n: lista.length })}</V2Button>}
    </section>
  );
}

/* -------------------------------------------------------------- divulgação -- */

/** Os cupons e banners que a federação divulga na página (só dentro do app). */
export function FedPromosSection({ federation }) {
  // Cupons e campanhas só a conta logada lê (`promo_*`): sem conta, nem consulta.
  const { isAuthenticated } = useAuth();
  const ligado = fedModuleOn(federation, 'promos') && Boolean(isAuthenticated);
  const q = useFederationPublicPromos(federation?.id, { enabled: ligado });
  const quem = usePromoViewer({ enabled: false, federations: ligado });
  const hoje = todayISO();
  const { cupons, banners } = useMemo(() => {
    const ver = (d) => isVisibleTo(d, quem);
    return {
      cupons: livePromoCoupons(q.data?.coupons || []).filter(ver),
      banners: livePromoBanners(q.data?.campaigns || [], { today: hoje, lugar: 'page' }).filter(ver),
    };
  }, [q.data, quem, hoje]);
  if (!ligado) return null;
  if (q.isLoading) return null;
  if (q.isError) return <V2ErrorState inline title={t('Não carregaram as promoções da federação')} onRetry={() => q.refetch()} />;
  // Vitrine: sem nada no ar, a seção não aparece.
  if (cupons.length + banners.length === 0) return null;
  return (
    <section id="federacao-promocoes" aria-labelledby="fed-promocoes" className="scroll-mt-4 space-y-3" data-dica="federacao-promocoes">
      <h2 id="fed-promocoes" className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Tag className="h-5 w-5" aria-hidden="true" />{t('Promoções e benefícios')}</h2>
      {quem.falhou && <V2ErrorState inline title={t('Não deu para conferir a sua filiação')} description={t('Benefícios só para filiados podem não aparecer.')} onRetry={() => quem.recarregar()} />}
      {banners.length > 0 && <div className="grid gap-4 md:grid-cols-2">{banners.map((c) => <PromoCampaignBanner key={c.id} campaign={c} />)}</div>}
      {cupons.length > 0 && <div className="grid gap-4 md:grid-cols-2">{cupons.map((c) => <PromoCouponCard key={c.id} coupon={c} showIssuer={false} />)}</div>}
    </section>
  );
}

/* ---------------------------------------------------------- patrocinadores -- */

/** A faixa de patrocinadores (logo + nome, com o site quando houver). */
export function FedSponsorsStrip({ federation, titulo = true }) {
  const lista = visibleSponsors(federation);
  if (lista.length === 0) return null;
  return (
    <section aria-labelledby="fed-patrocinadores" className="space-y-3" data-dica="federacao-patrocinadores-publico">
      {titulo && <h2 id="fed-patrocinadores" className="font-display text-xl font-bold text-ink">{t('Patrocinadores')}</h2>}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {lista.map((s, i) => {
          const corpo = (
            <>
              {s.logo_url ? <img src={s.logo_url} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper font-display text-sm font-bold text-gray-500">{s.name.slice(0, 2).toUpperCase()}</span>}
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{s.name}</span>
                <span className="block truncate text-xs text-gray-500">{t(SPONSOR_TIER_LABELS[s.tier] || '')}</span>
              </span>
            </>
          );
          const classe = 'flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3';
          return (
            <li key={`${s.name}-${i}`}>
              {safeHttpUrl(s.url)
                ? <a href={safeHttpUrl(s.url)} target="_blank" rel="noopener noreferrer nofollow sponsored" className={`${classe} transition-colors hover:border-acid/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30`}>{corpo}</a>
                : <div className={classe}>{corpo}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------- governança -- */

/** Estatuto, mandato, diretoria e atas — quando a federação preencheu algo. */
export function FedGovernanceBlock({ federation }) {
  const g = federation?.governance;
  if (!hasGovernance(g)) return null;
  const atas = sortMinutes(g.minutes || []);
  const mandato = g.mandate?.start || g.mandate?.end ? [g.mandate.start ? quando(g.mandate.start) : '…', g.mandate.end ? quando(g.mandate.end) : '…'].join(' – ') : '';
  return (
    <section aria-labelledby="fed-governanca" className="space-y-3" data-dica="federacao-governanca-publica">
      <h2 id="fed-governanca" className="flex items-center gap-2 font-display text-xl font-bold text-ink"><ScrollText className="h-5 w-5" aria-hidden="true" />{t('Transparência')}</h2>
      <V2Surface variant="compacto" className="space-y-4 p-4">
        {(g.statute_url || mandato) && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {safeHttpUrl(g.statute_url) && <a href={safeHttpUrl(g.statute_url)} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-bold text-ink underline"><FileText className="h-4 w-4" aria-hidden="true" />{t('Estatuto')}</a>}
            {mandato && <span className="text-gray-600">{t('Mandato da diretoria: {periodo}', { periodo: mandato })}</span>}
          </div>
        )}
        {g.board?.length > 0 && (
          <div>
            <p className="mb-2 text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Diretoria')}</p>
            <ul className="grid gap-1 text-sm sm:grid-cols-2">{g.board.map((m, i) => (
              <li key={i}>
                <span className="text-gray-500">{m.role}:</span> <span className="font-semibold text-ink">{m.name}</span>
                {/* Remuneração (Lei 9.615/98, art. 18-A): só quando informada. */}
                {Number.isInteger(m.pay_cents) && <span className="text-gray-500"> · {m.pay_cents > 0 ? t('{valor} por mês', { valor: formatBrlCents(m.pay_cents) }) : t('não remunerado')}</span>}
                {m.pay_note && <span className="text-gray-500"> ({m.pay_note})</span>}
              </li>
            ))}</ul>
          </div>
        )}
        {g.bylaws && <p className="whitespace-pre-line text-sm text-gray-700">{g.bylaws}</p>}
        {atas.length > 0 && (
          <div>
            <p className="mb-2 text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Atas e documentos')}</p>
            <ul className="space-y-1 text-sm">
              {atas.map((a, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  {safeHttpUrl(a.url) ? <a href={safeHttpUrl(a.url)} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-ink underline">{a.title}</a> : <span className="font-semibold text-ink">{a.title}</span>}
                  {a.date && <span className="text-xs text-gray-500">{quando(a.date)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </V2Surface>
    </section>
  );
}

/* -------------------------------------------------------------------- loja -- */

/** O atalho para a loja oficial no Mercado (módulo `store`). */
export function FedStoreLink({ federation }) {
  // O Mercado pede conta e a funcionalidade ligada; sem isso o link cai no login ou volta ao início.
  const { isAuthenticated } = useAuth();
  const mercado = useFeatureFlag(FEATURE_FLAG.MARKETPLACE);
  if (!fedModuleOn(federation, 'store') || !isAuthenticated || !mercado) return null;
  return (
    <V2Surface variant="compacto" className="flex flex-wrap items-center justify-between gap-3 p-4" data-dica="federacao-loja-publica">
      <div className="flex items-center gap-3">
        <ShoppingBag className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
        <div>
          <p className="font-bold text-ink">{t('Loja oficial')}</p>
          <p className="text-sm text-gray-500">{t('Uniformes, material e produtos da federação, pelo Mercado.')}</p>
        </div>
      </div>
      <V2Button asChild variant="secondary" size="sm"><Link to={`/mercado/vendedor/federation_${encodeURIComponent(federation.id)}`}>{t('Ver a loja')}</Link></V2Button>
    </V2Surface>
  );
}
