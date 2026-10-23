/**
 * FederationProfile — o ROSTO PÚBLICO da federação, o mesmo em todo lugar: a
 * página dentro do app (`/federacoes/:id`) e a página sem conta (`/f/:slug`)
 * montam ESTE componente, então o público vê exatamente a mesma coisa (antes
 * eram duas montagens dos mesmos blocos, que divergiam).
 *
 * Capa (marca, selos, filiados e a ação principal, que quem monta decide) e
 * abas na URL (`?aba=`), só as dos módulos ligados — `profileTabs`. O que é
 * da PESSOA (a faixa "Sua filiação", a aba "Minha filiação") e o que é da
 * EQUIPE (a barra com a Central) chegam de fora, por `above` e `mine`: aqui
 * não há nada de gestão.
 */
import React, { Suspense, lazy, useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { BadgeCheck, BookOpen, CalendarDays, Globe, Home, IdCard, Instagram, Library, Mail, MessageCircle, Newspaper, Phone, Share2, Trophy, Building2, Users, Vote } from 'lucide-react';
import { PROFILE_TAB, profileTabs, resolveProfileTab, whatsappLink } from '@/modules/federations/domain/profile';
import { V2Button, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { V2SectionNav } from '@/v2/ui/V2SectionNav';
import { PAGE_TITLE } from '@/v2/ui/pageFrame';
import { FedBadges, FedLogo, fedPublicPath, publicHost } from '../federationUi';
import { useClipboard } from '@/core/lib/useClipboard';
import PlansList from '../PlansList';
import { FedAcervoBlock } from '../acervo/AcervoPublic';
import { FedAgendaBlock } from '../agenda/AgendaPublic';
import FedAccountsPublic from '../accounts/FedAccountsPublic';
import { FedAffiliatesSection, FedCoursesSection, FedCredentialsDirectory, FedOmbudsmanBlock, FedRankingBlock, FedSanctionedTournaments } from '../FedPublicBlocks';
import { FedRefereesBoard } from '../referees/RefereesPublic';
import { FedCredentialedCoaches } from '../coaching/CoachBadges';
import { FedCallupsBlock, FedGrantsBlock } from '../selection/SelectionPublic';
import { FedGovernanceBlock, FedNewsSection, FedPromosSection, FedSponsorsStrip, FedStoreLink } from '../FedCommsBlocks';
import { safeHttpUrl } from '@/core/domain/externalUrl';
import { useHashScroll } from '@/v2/ui/useHashScroll';
import { t, tn } from '@/core/i18n';

// A aba Eleições (edital, chapas, voto e a área da comissão) baixa só quando abre.
const ElectionsPublic = lazy(() => import('../elections/ElectionsPublic'));

const ICONE = {
  [PROFILE_TAB.OVERVIEW]: Home,
  [PROFILE_TAB.MINE]: IdCard,
  [PROFILE_TAB.NEWS]: Newspaper,
  [PROFILE_TAB.AGENDA]: CalendarDays,
  [PROFILE_TAB.COMPETITIONS]: Trophy,
  [PROFILE_TAB.DOCUMENTS]: Library,
  [PROFILE_TAB.COURSES]: BookOpen,
  [PROFILE_TAB.CLUBS]: Building2,
  [PROFILE_TAB.CONTACT]: MessageCircle,
  [PROFILE_TAB.ELECTIONS]: Vote,
};

/** O contato público (e-mail, telefone, site, Instagram, CNPJ mascarado). */
export function FedContactCard({ federation: f }) {
  const c = f.contact_public || {};
  const site = safeHttpUrl(f.site);
  const algum = c.email || c.phone || site || f.instagram || f.cnpj_masked;
  const zap = whatsappLink(c.phone);
  return (
    <V2Surface as="section" variant="compacto" className="space-y-2 p-4" aria-labelledby="fed-contato">
      <h2 id="fed-contato" className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Contato')}</h2>
      {!algum && <p className="text-sm text-gray-500">{t('A federação ainda não publicou um contato.')}</p>}
      {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 break-all text-sm text-ink hover:underline"><Mail className="h-4 w-4 shrink-0" aria-hidden="true" />{c.email}</a>}
      {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-sm text-ink hover:underline"><Phone className="h-4 w-4 shrink-0" aria-hidden="true" />{c.phone}</a>}
      {zap && <a href={zap} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-2 text-sm text-ink hover:underline"><MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />{t('Conversar pelo WhatsApp')}</a>}
      {site && <a href={site} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-2 break-all text-sm text-ink hover:underline"><Globe className="h-4 w-4 shrink-0" aria-hidden="true" />{f.site.replace(/^https?:\/\//, '')}</a>}
      {f.instagram && <a href={`https://instagram.com/${f.instagram}`} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-2 text-sm text-ink hover:underline"><Instagram className="h-4 w-4 shrink-0" aria-hidden="true" />@{f.instagram}</a>}
      {f.cnpj_masked && <p className="text-xs text-gray-500">{t('CNPJ {n}', { n: f.cnpj_masked })}</p>}
    </V2Surface>
  );
}

/** Conferir uma carteirinha (a verificação pública, sem conta). */
function VerifyCard() {
  return (
    <V2Surface variant="compacto" className="flex items-start gap-3 p-4">
      <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-bold text-ink">{t('Conferir uma carteirinha')}</p>
        <p className="text-sm text-gray-500">{t('Leia o QR da carteirinha ou digite o código para saber se a filiação está em dia.')}</p>
        <Link to="/f/verificar" className="mt-1 inline-block text-sm font-bold text-ink underline">{t('Verificar')}</Link>
      </div>
    </V2Surface>
  );
}

/** Compartilhar a página pública (o endereço `/f/:slug`), por quem quer que veja. */
export function FedShareButton({ federation }) {
  const { copy } = useClipboard();
  const url = `${typeof window !== 'undefined' ? window.location.origin : `https://${publicHost()}`}${fedPublicPath(federation)}`;
  const compartilhar = async () => {
    if (navigator.share) { try { await navigator.share({ title: federation.name, url }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
    copy(url, t('Link da federação copiado.'));
  };
  return <V2Button type="button" variant="ghost" onClick={compartilhar}><Share2 className="h-4 w-4" />{t('Compartilhar')}</V2Button>;
}

function Visao({ federation: f, plansQ, memberOf, irPara, tabs, planAction }) {
  const tem = (id) => tabs.some((x) => x.id === id);
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-8 lg:col-span-8">
        {f.about && (
          <section aria-labelledby="fed-sobre" className="space-y-2">
            <h2 id="fed-sobre" className="font-display text-xl font-bold text-ink">{t('Sobre')}</h2>
            <p className="whitespace-pre-line leading-7 text-gray-700">{f.about}</p>
          </section>
        )}
        <section aria-labelledby="fed-planos" className="space-y-3">
          <div>
            <h2 id="fed-planos" className="font-display text-xl font-bold text-ink">{t('Planos de filiação')}</h2>
            <p className="text-sm text-gray-500">{t('Mensalidade ou anuidade, por tipo de pessoa. O Pix vai direto para a federação.')}</p>
          </div>
          {plansQ.isError ? <V2ErrorState inline title={t('Não carregaram os planos')} onRetry={() => plansQ.refetch()} /> : plansQ.isLoading ? <V2Skeleton lines={4} /> : <PlansList plans={plansQ.data} federation={f} action={planAction} />}
        </section>
        <FedPromosSection federation={f} />
        {tem(PROFILE_TAB.NEWS) && <FedNewsSection federation={f} memberOf={memberOf} limite={3} onVerTodas={() => irPara(PROFILE_TAB.NEWS)} />}
        {tem(PROFILE_TAB.AGENDA) && <FedAgendaBlock federation={f} limite={3} />}
        <FedSponsorsStrip federation={f} />
      </div>
      <aside className="space-y-3 lg:col-span-4">
        <FedContactCard federation={f} />
        <FedStoreLink federation={f} />
        <VerifyCard />
      </aside>
    </div>
  );
}

/**
 * @param {object} props
 * @param {object} props.federation
 * @param {object} props.plansQ consulta dos planos (`useFederationPlans`)
 * @param {React.ReactNode} [props.actions] a ação principal da capa (filiar-se, entrar…)
 * @param {React.ReactNode|Function} [props.above] entre a capa e as abas (a faixa "Sua filiação"); função ⇒ recebe `{ aba, irPara }`
 * @param {React.ReactNode} [props.mine] o conteúdo da aba "Minha filiação" — ausente, a aba não existe
 * @param {boolean} [props.memberOf] filiado ativo (vê as notícias "só filiados")
 * @param {string|null} [props.meUid] destaca a pessoa no ranking
 * @param {React.ReactNode} [props.footer] depois das abas
 * @param {Function} [props.planAction] `(plano) => nó`: o botão de cada plano ("Filiar-se neste plano"); ausente, os planos só informam
 */
export default function FederationProfile({ federation: f, plansQ, actions = null, above = null, mine = null, memberOf = false, meUid = null, footer = null, planAction = null }) {
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const tabs = useMemo(() => profileTabs(f, { member: Boolean(mine) }), [f, mine]);
  const aba = resolveProfileTab(tabs, { aba: params.get('aba') || '', hash, noticia: params.get('noticia') || '' });
  useHashScroll(); // `#fed-cursos` (o aviso) rola até a seção quando a aba dela aparece

  const irPara = (id) => {
    setParams((atual) => { const novo = new URLSearchParams(atual); if (id === PROFILE_TAB.OVERVIEW) novo.delete('aba'); else novo.set('aba', id); novo.delete('noticia'); return novo; });
  };
  const lugar = [f.city, f.state].filter(Boolean).join(' / ');
  const secoes = tabs.map((x) => ({ id: x.id, label: t(x.label), icon: ICONE[x.id], dica: x.dica }));

  return (
    <div className="space-y-6">
      <V2Surface className="p-5 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-4 sm:gap-5">
          <FedLogo federation={f} size="lg" className="sm:hidden" />
          <FedLogo federation={f} size="xl" className="hidden sm:flex" />
          <div className="min-w-0 flex-1">
            {lugar && <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{lugar}</p>}
            <h1 className={PAGE_TITLE}>{f.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <FedBadges federation={f} />
              {f.member_count > 0 && <span className="inline-flex items-center gap-1 text-sm text-gray-500"><Users className="h-4 w-4" aria-hidden="true" />{tn(f.member_count, '{n} filiado', '{n} filiados')}</span>}
            </div>
          </div>
          </div>
          {actions && <div className="grid gap-2 sm:w-60 sm:shrink-0 [&>*]:w-full">{actions}</div>}
        </div>
      </V2Surface>

      {typeof above === 'function' ? above({ aba, irPara }) : above}

      {tabs.length > 1 && <V2SectionNav ariaLabel={t('Seções da página da federação')} dica="federacao-pub-secoes" sections={secoes} activeId={aba} onSelect={(s) => irPara(s.id)} />}

      <div>
        {aba === PROFILE_TAB.OVERVIEW && <Visao federation={f} plansQ={plansQ} memberOf={memberOf} irPara={irPara} tabs={tabs} planAction={planAction} />}
        {aba === PROFILE_TAB.MINE && mine}
        {aba === PROFILE_TAB.NEWS && <FedNewsSection federation={f} memberOf={memberOf} limite={30} />}
        {aba === PROFILE_TAB.AGENDA && <FedAgendaBlock federation={f} limite={12} />}
        {aba === PROFILE_TAB.COMPETITIONS && (
          <div className="space-y-8">
            <FedSanctionedTournaments federation={f} />
            <FedRankingBlock federation={f} meUid={meUid} />
            <FedRefereesBoard federation={f} />
            <FedCallupsBlock federation={f} />
            <FedGrantsBlock federation={f} meUid={meUid} />
          </div>
        )}
        {aba === PROFILE_TAB.DOCUMENTS && (
          <div className="space-y-8">
            <FedAcervoBlock federation={f} limite={10} />
            <FedAccountsPublic federation={f} />
            <FedGovernanceBlock federation={f} />
          </div>
        )}
        {aba === PROFILE_TAB.COURSES && (
          <div className="space-y-8">
            <FedCoursesSection federation={f} />
            <FedCredentialsDirectory federation={f} />
            <FedCredentialedCoaches federation={f} />
          </div>
        )}
        {aba === PROFILE_TAB.CLUBS && <FedAffiliatesSection federation={f} />}
        {aba === PROFILE_TAB.ELECTIONS && <Suspense fallback={<V2Skeleton lines={5} />}><ElectionsPublic federation={f} meUid={meUid} memberOf={memberOf} /></Suspense>}
        {aba === PROFILE_TAB.CONTACT && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <FedOmbudsmanBlock federation={f} />
              <VerifyCard />
            </div>
            <aside className="lg:col-span-4"><FedContactCard federation={f} /></aside>
          </div>
        )}
      </div>
      {footer}
    </div>
  );
}
