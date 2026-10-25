/**
 * A vitrine do clube-associação: o que quem visita (e quem é do clube) vê de
 * vantagens, comunicados e patrocinadores.
 *  - `ClubBenefitsShowcase`: as vantagens públicas — o convite para se associar;
 *  - `ClubMemberBenefits`: as vantagens do associado em dia, com o "como usar"
 *    e o código (vêm do SERVIDOR; vencido ou sem filiação, nada do segredo);
 *  - `ClubNewsSection`: os comunicados (os públicos e, para quem é do clube,
 *    os "só associados"); `?noticia=<id>` (o link do aviso) abre e rola até ele;
 *  - `ClubSponsorsStrip`: os patrocinadores;
 *  - `ClubPromosSection`: os cupons e banners que o clube divulga (só dentro do app);
 *  - `ClubStoreCard`: a loja do clube no Mercado, quando ela existe e está no ar.
 * Falha não é vazio (`docs/27-FALHA-NAO-E-VAZIO.md`): cada fonte diz que não carregou.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ExternalLink, Gift, Lock, Newspaper, Pin, Store, Tag, Ticket } from 'lucide-react';
import { visibleClubNews, visibleClubSponsors, benefitMetaLine, liveBenefits, BENEFIT_KIND_LABELS, NEWS_AUDIENCE, SPONSOR_TIER } from '@/modules/clubs/domain/content';
import { SPONSOR_TIER_LABELS } from '@/modules/federations/domain/constants';
import {
  useMemberClubNews, useMyBenefits, usePublicBenefits, usePublicClubNews, usePublicClubSponsors, usePublicPlans,
} from '@/modules/clubs/hooks/useClubAssociation';
import { livePromoBanners, livePromoCoupons } from '@/modules/promo/domain/promo';
import { useClubPublicPromos } from '@/modules/promo/hooks/usePromo';
import { todayISO } from '@/modules/arenas/domain/subscription';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { useSeller } from '@/modules/marketplace/hooks/useMarket';
import PromoCampaignBanner from '@/v2/components/promo/PromoCampaignBanner';
import PromoCouponCard from '@/v2/components/promo/PromoCouponCard';
import { safeHttpUrl } from '@/core/domain/externalUrl';
import { destinoDeAviso } from '@/core/domain/internalLink';
import { podeAfirmarVazio } from '@/core/lib/queryState';
import { rolarAte } from '@/v2/ui/rolarAte';
import CopyCodeButton from '@/v2/ui/CopyCodeButton';
import { V2Badge, V2Button, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { quando } from '@/v2/components/federations/federationUi';
import { t } from '@/core/i18n';

/* ---------------------------------------------------------------- vantagens -- */

function BenefitCard({ b, planNames, children }) {
  return (
    <V2Surface as="li" variant="compacto" className="flex flex-col gap-2 p-4">
      <div className="flex items-start gap-3">
        <Gift className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">{b.title}</p>
          <V2Badge tone="neutral">{t(BENEFIT_KIND_LABELS[b.kind] || BENEFIT_KIND_LABELS.other)}</V2Badge>
        </div>
      </div>
      {b.summary && <p className="text-sm text-gray-600">{b.summary}</p>}
      {benefitMetaLine(b, planNames) && <p className="text-xs text-gray-500">{benefitMetaLine(b, planNames)}</p>}
      {children}
    </V2Surface>
  );
}

/** As vantagens públicas: o que o associado ganha (sem o "como usar"). Sem nada no ar, não aparece. */
export function ClubBenefitsShowcase({ clubId, enabled = true }) {
  const q = usePublicBenefits(clubId, { enabled });
  const plansQ = usePublicPlans(clubId, { enabled });
  const planNames = useMemo(() => Object.fromEntries((plansQ.data || []).map((p) => [p.id, p.name])), [plansQ.data]);
  const lista = useMemo(() => (q.isSuccess ? liveBenefits(q.data) : []), [q.isSuccess, q.data]);
  if (!enabled || q.isLoading) return null;
  if (q.isError) return <V2ErrorState inline title={t('Não carregaram as vantagens do clube')} onRetry={() => q.refetch()} />;
  if (lista.length === 0) return null;
  return (
    <section aria-labelledby="clube-vantagens-titulo" className="space-y-3" data-dica="clube-vantagens-publicas">
      <h2 id="clube-vantagens-titulo" className="font-display text-xl font-bold text-ink">{t('O que o associado ganha')}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">{lista.map((b) => <BenefitCard key={b.id} b={b} planNames={planNames} />)}</ul>
    </section>
  );
}

/** As vantagens do associado em dia, com o "como usar" e o código. */
export function ClubMemberBenefits({ club, onVerAssociacao }) {
  const q = useMyBenefits(club.id);
  const plansQ = usePublicPlans(club.id);
  const planNames = useMemo(() => Object.fromEntries((plansQ.data || []).map((p) => [p.id, p.name])), [plansQ.data]);
  if (q.isLoading) return <V2Skeleton lines={4} />;
  if (q.isError) return <V2ErrorState title={t('Não carregaram as suas vantagens')} onRetry={() => q.refetch()} />;
  if (!q.data?.eligible) {
    return (
      <V2Surface className="space-y-2 p-6" data-dica="clube-vantagens-membro">
        <p className="font-display text-lg font-bold text-ink">{t('As vantagens são de quem está em dia')}</p>
        <p className="text-sm text-gray-600">{t('Associe-se ao clube — ou renove a sua filiação — para usar descontos, parceiros e prioridades.')}</p>
        {onVerAssociacao && <button type="button" onClick={onVerAssociacao} className="text-sm font-bold text-ink underline">{t('Ver a minha associação')}</button>}
      </V2Surface>
    );
  }
  const lista = liveBenefits(q.data.items || []);
  if (podeAfirmarVazio(q) && lista.length === 0) return <V2Surface className="p-6"><p className="text-sm text-gray-600">{t('O clube ainda não cadastrou vantagens para a sua filiação.')}</p></V2Surface>;
  return (
    <section aria-label={t('Minhas vantagens')} className="space-y-3" data-dica="clube-vantagens-membro">
      <ul className="grid gap-3 sm:grid-cols-2">
        {lista.map((b) => (
          <BenefitCard key={b.id} b={b} planNames={planNames}>
            {b.how_to && <p className="whitespace-pre-line rounded-xl bg-paper p-3 text-sm text-gray-700"><span className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500"><Ticket className="h-3.5 w-3.5" aria-hidden="true" />{t('Como usar')}</span>{b.how_to}</p>}
            {b.code && <CopyCodeButton code={b.code} />}
          </BenefitCard>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------- comunicados -- */

function Comunicado({ n, aberto, onToggle, ancoraRef }) {
  // O link vem do banco: interno só caminho de UMA barra; externo só http(s).
  const interno = destinoDeAviso(n.link);
  const externo = interno ? '' : safeHttpUrl(n.link);
  return (
    <li ref={ancoraRef} id={`noticia-${n.id}`} className="scroll-mt-4">
      <V2Surface variant="compacto" className="p-4">
        <button type="button" onClick={onToggle} aria-expanded={aberto} className="flex w-full items-start gap-3 text-left">
          {n.pinned ? <Pin className="mt-1 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" /> : <Newspaper className="mt-1 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />}
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2 font-bold text-ink">
              {n.title}
              {n.audience === NEWS_AUDIENCE.MEMBERS && <V2Badge tone="ink"><Lock className="h-3 w-3" aria-hidden="true" />{t('Só associados')}</V2Badge>}
            </span>
            <span className="block text-xs text-gray-500">{n.published_at ? quando(n.published_at) : ''}</span>
            {!aberto && <span className="mt-1 block text-sm text-gray-600">{n.summary || `${String(n.body || '').slice(0, 180)}${String(n.body || '').length > 180 ? '…' : ''}`}</span>}
          </span>
          <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-gray-500 transition-transform ${aberto ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {aberto && (
          <div className="mt-3 space-y-3 pl-7">
            {n.image_url && safeHttpUrl(n.image_url) && <img src={safeHttpUrl(n.image_url)} alt="" loading="lazy" className="max-h-80 w-full rounded-2xl object-cover" />}
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

/** Os comunicados. `member`: a pessoa é do clube (lê também os "só associados"). */
export function ClubNewsSection({ clubId, member = false, limite = 6, titulo = true, publicOn = true }) {
  // Fechada ao público, a regra só entrega os "só associados": a consulta dos públicos seria recusada.
  const pub = usePublicClubNews(clubId, { enabled: publicOn });
  const mem = useMemberClubNews(clubId, { enabled: member });
  const [params] = useSearchParams();
  const pedida = params.get('noticia');
  const [abertos, setAbertos] = useState(() => new Set(pedida ? [pedida] : []));
  const [todos, setTodos] = useState(false);
  const alvo = useRef(null);
  const rolou = useRef(false);
  const lista = useMemo(() => {
    const pronto = publicOn ? pub.isSuccess : (member && mem.isSuccess);
    return pronto ? visibleClubNews([...(publicOn ? pub.data || [] : []), ...(member && mem.isSuccess ? mem.data || [] : [])], { member }) : null;
  }, [publicOn, pub.isSuccess, pub.data, mem.isSuccess, mem.data, member]);
  // O comunicado do aviso: aberto e na tela, mesmo além do limite.
  const indicePedido = lista && pedida ? lista.findIndex((n) => n.id === pedida) : -1;
  useEffect(() => {
    if (rolou.current || indicePedido < 0 || !alvo.current) return;
    rolou.current = true;
    requestAnimationFrame(() => rolarAte(alvo.current));
  }, [indicePedido]);
  const mostrados = lista ? (todos || indicePedido >= limite ? lista : lista.slice(0, limite)) : [];
  const alternar = (id) => setAbertos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <section id="clube-comunicados" aria-labelledby="clube-comunicados-titulo" className="scroll-mt-4 space-y-3" data-dica="clube-comunicados-publicos">
      {titulo && <h2 id="clube-comunicados-titulo" className="font-display text-xl font-bold text-ink">{t('Comunicados')}</h2>}
      {pub.isError && <V2ErrorState inline title={t('Não carregaram os comunicados')} onRetry={() => pub.refetch()} />}
      {member && mem.isError && <V2ErrorState inline title={t('Não carregaram os comunicados dos associados')} onRetry={() => mem.refetch()} />}
      {(pub.isLoading || (!publicOn && mem.isLoading)) && <V2Skeleton lines={3} />}
      {lista && lista.length === 0 && !(member && mem.isError) && <p className="text-sm text-gray-500">{t('O clube ainda não publicou comunicados.')}</p>}
      {pedida && lista && indicePedido < 0 && !mem.isLoading && <p className="text-sm text-gray-500">{t('Este comunicado não está mais publicado.')}</p>}
      {mostrados.length > 0 && <ul className="space-y-2">{mostrados.map((n) => <Comunicado key={n.id} n={n} aberto={abertos.has(n.id)} onToggle={() => alternar(n.id)} ancoraRef={n.id === pedida ? alvo : undefined} />)}</ul>}
      {lista && lista.length > mostrados.length && <button type="button" onClick={() => setTodos(true)} className="text-sm font-bold text-ink underline">{t('Ver todos os {n} comunicados', { n: lista.length })}</button>}
    </section>
  );
}

/* ------------------------------------------------------------ patrocinadores -- */

/** A faixa de patrocinadores (logo + nome, com o site quando houver). Sem nenhum, não aparece. */
export function ClubSponsorsStrip({ clubId, titulo = true, enabled = true }) {
  const q = usePublicClubSponsors(clubId, { enabled });
  const lista = useMemo(() => visibleClubSponsors(q.data || []), [q.data]);
  if (!enabled || q.isLoading) return null;
  if (q.isError) return <V2ErrorState inline title={t('Não carregaram os patrocinadores')} onRetry={() => q.refetch()} />;
  if (lista.length === 0) return null;
  return (
    <section aria-labelledby="clube-patrocinadores-titulo" className="space-y-3" data-dica="clube-patrocinadores-publico">
      {titulo && <h2 id="clube-patrocinadores-titulo" className="font-display text-xl font-bold text-ink">{t('Patrocinadores')}</h2>}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {lista.map((s) => {
          const corpo = (
            <>
              {safeHttpUrl(s.logo_url) ? <img src={safeHttpUrl(s.logo_url)} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-xl bg-white object-contain" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper font-display text-sm font-bold text-gray-500">{s.name.slice(0, 2).toUpperCase()}</span>}
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">{s.name}</span>
                <span className="block truncate text-xs text-gray-500">{t(SPONSOR_TIER_LABELS[s.tier || SPONSOR_TIER.SUPPORT] || '')}</span>
              </span>
            </>
          );
          const classe = 'flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3';
          return (
            <li key={s.id}>
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

/* -------------------------------------------------------------- divulgação -- */

/**
 * Os cupons e banners que o clube divulga na página. Cupom e campanha só a
 * conta logada lê (`promo_*`): sem conta, nem consulta. Sem nada no ar, a seção
 * não aparece; consulta que falhou diz que não carregou.
 */
export function ClubPromosSection({ clubId, enabled = true }) {
  const { isAuthenticated } = useAuth();
  const ligado = enabled && Boolean(isAuthenticated);
  const q = useClubPublicPromos(clubId, { enabled: ligado });
  const hoje = todayISO();
  const { cupons, banners } = useMemo(() => ({
    cupons: livePromoCoupons(q.data?.coupons || []),
    banners: livePromoBanners(q.data?.campaigns || [], { today: hoje, lugar: 'page' }),
  }), [q.data, hoje]);
  if (!ligado || q.isLoading) return null;
  if (q.isError) return <V2ErrorState inline title={t('Não carregaram as promoções do clube')} onRetry={() => q.refetch()} />;
  if (cupons.length + banners.length === 0) return null;
  return (
    <section id="clube-promocoes" aria-labelledby="clube-promocoes-titulo" className="scroll-mt-4 space-y-3" data-dica="clube-promocoes">
      <h2 id="clube-promocoes-titulo" className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Tag className="h-5 w-5" aria-hidden="true" />{t('Promoções do clube')}</h2>
      {banners.length > 0 && <div className="grid gap-4 md:grid-cols-2">{banners.map((c) => <PromoCampaignBanner key={c.id} campaign={c} />)}</div>}
      {cupons.length > 0 && <div className="grid gap-4 md:grid-cols-2">{cupons.map((c) => <PromoCouponCard key={c.id} coupon={c} showIssuer={false} />)}</div>}
    </section>
  );
}

/* --------------------------------------------------------------------- loja -- */

/**
 * A loja do clube no Mercado: só dentro do app (o vendedor é legível por conta
 * logada), só com o Mercado aberto e a loja no ar. Sem loja, ou com a consulta
 * falhando, a seção não aparece — não há o que afirmar nem o que oferecer.
 */
export function ClubStoreCard({ clubId, enabled = true }) {
  const { isAuthenticated } = useAuth();
  const mercadoOn = useFeatureFlag(FEATURE_FLAG.MARKETPLACE);
  const ligado = enabled && Boolean(isAuthenticated) && mercadoOn;
  const q = useSeller(ligado ? `club_${clubId}` : '');
  if (!ligado || !q.data || q.data.status !== 'active') return null;
  return (
    <section id="clube-loja" aria-labelledby="clube-loja-titulo" className="scroll-mt-4" data-dica="clube-loja-publica">
      <V2Surface className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-acid/30"><Store className="h-5 w-5 text-ink" aria-hidden="true" /></span>
          <div className="min-w-0">
            <h2 id="clube-loja-titulo" className="font-display text-lg font-bold text-ink">{t('Loja do clube')}</h2>
            <p className="text-sm text-gray-600">{t('Uniforme, material e inscrições, direto com o clube.')}</p>
          </div>
        </div>
        <V2Button asChild variant="secondary"><Link to={`/mercado/vendedor/club_${clubId}`}>{t('Ver a loja')}</Link></V2Button>
      </V2Surface>
    </section>
  );
}
