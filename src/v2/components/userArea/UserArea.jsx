/**
 * MINHA ÁREA (flag `user_hub`): o `/perfil` como a central da pessoa.
 *
 * Três andares, sempre nesta ordem:
 *  1. o cabeçalho (quem sou, o meu nível, editar e ver o perfil público) —
 *     igual em toda seção, e é nele que mora a âncora `perfil-editar`;
 *  2. "Precisa de você": o que espera uma ação minha, de todos os papéis,
 *     com a MESMA conta da tela que resolve (`userAreaPending`);
 *  3. as seções do que eu sou (`userAreaSections`), com `?secao=` na URL.
 *
 * Só a seção aberta é montada — então só ela consulta. Os papéis saem das
 * consultas que a barra lateral já faz (mesmas chaves, mesmo cache).
 */
import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, Building2, Dumbbell, Eye, GraduationCap, Landmark, LayoutDashboard,
  LayoutGrid, Medal, Pencil, ShoppingBag, Swords, Trophy, User, Users,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';

import { useMyArenaSummary } from '@/modules/arenas/hooks/useMyArenaSummary';
import { useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useCoach } from '@/modules/coaches/hooks/useCoaches';
import { useCoachLessons } from '@/modules/coaches/hooks/useLessons';
import { lessonsAwaitingReply, partitionLessons } from '@/modules/coaches/domain/lesson';
import { useMyClubInvites, useMyClubs, useMyEventInvites } from '@/modules/clubs/hooks/useClubs';
import { useTrainingInbox } from '@/modules/training/hooks/useTrainingShares';
import { useCoachTrainingQuestions, useMyTrainingQuestions } from '@/modules/training/hooks/useTrainingQuestions';
import { unreadCount } from '@/modules/training/domain/share';
import { usePendingDebriefs } from '@/modules/training/hooks/useDebriefs';
import { esperaPorMim } from '@/v2/components/training/questions/questionsView';
import {
  useMyOffers, useMyOrders, useSeller, useSellerOffers, useSellerOrders, useSellerQuestions,
} from '@/modules/marketplace/hooks/useMarket';
import { sellerKeyFor } from '@/modules/marketplace/domain/seller';
import { useMyFederationCharges, useMyFederationRoles, useMyMemberships } from '@/modules/federations/hooks/useFederations';
import { myFederationPending } from '@/modules/federations/domain/federationPending';
import { useMyUnifiedLevel } from '@/modules/rating/hooks/useMyUnifiedLevel';
import { LEVEL_SOURCE, LEVEL_SOURCE_LABEL } from '@/modules/rating/domain/unifiedLevel';
import {
  USER_AREA_GROUPS, marketPendingCounts, memberSince, resolveUserAreaSection, userAreaPending, userAreaSections,
} from '@/modules/athletes/domain/userArea';
import { V2Avatar, V2Badge, V2Button, V2ErrorState, V2Page, PAGE_TITLE } from '@/v2/ui/primitives';
import { V2SectionNav } from '@/v2/ui/V2SectionNav';
import { rolarAte } from '@/v2/ui/rolarAte';
import V2DuprRatingBadge from '@/v2/components/rating/V2DuprRatingBadge';
import { SECOES } from './UserAreaSections';
import { t } from '@/core/i18n';

const ICONES = {
  LayoutGrid, User, Dumbbell, Swords, Trophy, Medal, ShoppingBag, Landmark, Users, GraduationCap, Building2, LayoutDashboard,
};

/** `true`/`false` quando a leitura respondeu, `'erro'` quando falhou, `undefined` carregando. */
const papelDe = (q, sim) => (q.isError ? 'erro' : q.isSuccess ? sim : undefined);

export default function UserArea() {
  const { user, userProfile, isPlatformAdmin } = useAuth();
  const uid = user?.uid || null;
  const trainingOn = true;
  const [params, setParams] = useSearchParams();

  // Papéis: as mesmas consultas da barra lateral.
  const coachQ = useCoach(uid);
  const isCoach = !!coachQ.data;
  const arenasQ = useMyManagedArenas();
  const clubsQ = useMyClubs();
  const clubInvitesQ = useMyClubInvites();
  const eventInvitesQ = useMyEventInvites();
  const arenaSummary = useMyArenaSummary();
  const lessonsQ = useCoachLessons(isCoach ? uid : null);
  const inboxQ = useTrainingInbox(trainingOn ? uid : null);
  const myQuestionsQ = useMyTrainingQuestions(trainingOn ? uid : null);
  const coachQuestionsQ = useCoachTrainingQuestions(trainingOn ? uid : null, { enabled: isCoach });
  // Balanço do jogo: só consulta para quem ligou (flag + escolha da pessoa).
  const balancos = usePendingDebriefs();

  // Federações (flag `federations`): filiações, cobranças e papéis na equipe.
  // A seção só existe para quem tem alguma coisa lá (ou cuja leitura falhou).
  const { flags } = useFeatureFlags();
  const federacoesOn = Boolean(flags?.[FEATURE_FLAG.FEDERATIONS]);
  const fedMembersQ = useMyMemberships({ enabled: federacoesOn });
  const fedChargesQ = useMyFederationCharges({ enabled: federacoesOn });
  const fedRolesQ = useMyFederationRoles({ enabled: federacoesOn });
  const fedQs = [fedMembersQ, fedChargesQ, fedRolesQ];
  const temFederacao = (fedMembersQ.data || []).some((m) => !['cancelled', 'rejected'].includes(m.status)) || (fedRolesQ.data || []).length > 0;

  // Mercado (flag `marketplace`). As vendas só se consultam para quem já vende.
  // ponytail: só a ficha pessoal (`athlete_{uid}`); vendas como professor,
  // arena ou loja ficam no painel de vendas — somar aqui = 4 leituras por ficha.
  const mercadoOn = Boolean(flags?.[FEATURE_FLAG.MARKETPLACE]);
  const sellerKey = mercadoOn && uid ? sellerKeyFor('athlete', uid) : null;
  const sellerQ = useSeller(sellerKey);
  const vendeKey = sellerQ.data ? sellerKey : null;
  const sellerOrdersQ = useSellerOrders(vendeKey);
  const sellerOffersQ = useSellerOffers(vendeKey);
  const sellerQuestionsQ = useSellerQuestions(vendeKey);
  const myOrdersQ = useMyOrders(mercadoOn ? uid : null);
  const myOffersQ = useMyOffers(mercadoOn ? uid : null);
  const mercadoQs = [sellerQ, sellerOrdersQ, sellerOffersQ, sellerQuestionsQ, myOrdersQ, myOffersQ];

  const convitesEventoPendentes = (eventInvitesQ.data || []).filter((i) => i?.status === 'invited');
  const temConvite = (clubInvitesQ.data || []).length > 0 || convitesEventoPendentes.length > 0;

  const secoes = useMemo(() => userAreaSections({
    professor: papelDe(coachQ, isCoach),
    arenas: papelDe(arenasQ, (arenasQ.data || []).length > 0),
    // Convite pendente também abre a seção: é nela que a pessoa responde.
    clubes: temConvite ? true : papelDe(clubsQ, (clubsQ.data || []).length > 0),
    admin: !!isPlatformAdmin,
    mercado: mercadoOn,
    federacoes: federacoesOn ? (fedQs.some((q) => q.isError) ? 'erro' : fedMembersQ.isSuccess && fedRolesQ.isSuccess ? temFederacao : undefined) : false,
  }).map((s) => ({ ...s, icon: ICONES[s.icone] })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [coachQ, isCoach, arenasQ, clubsQ, temConvite, isPlatformAdmin, mercadoOn, federacoesOn, temFederacao, fedMembersQ.isSuccess, fedRolesQ.isSuccess, fedMembersQ.isError, fedChargesQ.isError, fedRolesQ.isError]);

  const ativa = resolveUserAreaSection(params.get('secao'), secoes);
  const Secao = SECOES[ativa];

  const irPara = (id) => {
    const proximo = new URLSearchParams(params);
    if (id === 'resumo') proximo.delete('secao');
    else proximo.set('secao', id);
    setParams(proximo, { replace: false });
    rolarAte(document.getElementById('minha-area-secoes'));
  };

  // "Precisa de você": fonte que não respondeu fica `undefined` (nunca zero).
  const duvidasEsperando = trainingOn && myQuestionsQ.isSuccess && (!isCoach || coachQuestionsQ.isSuccess)
    ? [...(myQuestionsQ.data || []), ...(isCoach ? coachQuestionsQ.data || [] : [])].filter((q) => esperaPorMim(q, uid)).length
    : undefined;
  const pendencias = userAreaPending({
    arenas: arenasQ.isSuccess
      ? arenasQ.data.map((a) => ({ id: a.id, name: a.name, pendentes: arenaSummary.pendingByArena?.[a.id] }))
      : undefined,
    aulasAResponder: lessonsQ.isSuccess ? lessonsAwaitingReply(partitionLessons(lessonsQ.data || []).upcoming).length : undefined,
    convitesClube: clubInvitesQ.isSuccess ? clubInvitesQ.data : undefined,
    convitesEvento: eventInvitesQ.isSuccess ? eventInvitesQ.data : undefined,
    duvidasEsperando,
    treinosNaoLidos: trainingOn && inboxQ.isSuccess ? unreadCount(inboxQ.data || []) : undefined,
    balancosPendentes: balancos.isSuccess ? balancos.pending.length : undefined,
    mercado: mercadoOn ? marketPendingCounts({
      sellerOrders: sellerOrdersQ.isSuccess ? sellerOrdersQ.data : undefined,
      sellerOffers: sellerOffersQ.isSuccess ? sellerOffersQ.data : undefined,
      sellerQuestions: sellerQuestionsQ.isSuccess ? sellerQuestionsQ.data : undefined,
      myOrders: myOrdersQ.isSuccess ? myOrdersQ.data : undefined,
      myOffers: myOffersQ.isSuccess ? myOffersQ.data : undefined,
    }) : undefined,
    federacoes: federacoesOn ? myFederationPending(fedMembersQ.isSuccess ? fedMembersQ.data : undefined, fedChargesQ.isSuccess ? fedChargesQ.data : undefined) : undefined,
  });
  const falhas = [
    arenasQ.isError && t('as suas arenas'),
    arenaSummary.pendingError && t('os pedidos de reserva'),
    lessonsQ.isError && t('os pedidos de aula'),
    (clubInvitesQ.isError || eventInvitesQ.isError) && t('os convites dos clubes'),
    trainingOn && (myQuestionsQ.isError || coachQuestionsQ.isError) && t('as dúvidas de treino'),
    trainingOn && inboxQ.isError && t('os treinos recebidos'),
    balancos.isError && t('os jogos para o balanço'),
    mercadoOn && mercadoQs.some((q) => q.isError) && t('as suas compras e vendas no Mercado'),
    federacoesOn && fedQs.some((q) => q.isError) && t('as suas federações'),
  ].filter(Boolean);
  const tentarDeNovo = () => {
    [arenasQ, lessonsQ, clubInvitesQ, eventInvitesQ, myQuestionsQ, coachQuestionsQ, inboxQ, ...mercadoQs, ...fedQs]
      .filter((q) => q.isError).forEach((q) => q.refetch());
    if (arenaSummary.pendingError) arenaSummary.refetch?.();
    if (balancos.isError) balancos.refetch();
  };

  const ctx = { uid, userProfile, isCoach, coachQ, arenasQ, arenaSummary, clubsQ, clubInvitesQ, eventInvitesQ, lessonsQ, inboxQ, irPara, secoes, mercado: { sellerKey, sellerQ, sellerOrdersQ, sellerOffersQ, sellerQuestionsQ, myOrdersQ }, federacoes: { membersQ: fedMembersQ, chargesQ: fedChargesQ, rolesQ: fedRolesQ } };

  return (
    <V2Page className="space-y-6">
      <Cabecalho user={user} userProfile={userProfile} />

      {(pendencias.length > 0 || falhas.length > 0) && (
        <section aria-labelledby="minha-area-pendencias-titulo" data-dica="minha-area-pendencias" className="rounded-4xl border border-acid/40 bg-acid/10 p-5 sm:p-6">
          <h2 id="minha-area-pendencias-titulo" className="font-display text-lg font-bold text-ink">{t('Precisa de você')}</h2>
          {pendencias.length > 0 && (
            <ul className="mt-3 space-y-2">
              {pendencias.map((p) => (
                <li key={p.id}>
                  <PendenciaLink item={p} onSecao={irPara} />
                </li>
              ))}
            </ul>
          )}
          {falhas.length > 0 && (
            <V2ErrorState
              inline
              className="mt-3"
              title={t('Não deu para conferir tudo o que espera por você')}
              description={t('Ficou de fora: {lista}.', { lista: falhas.join(', ') })}
              onRetry={tentarDeNovo}
            />
          )}
        </section>
      )}

      <div id="minha-area-secoes" className="scroll-mt-4">
        <V2SectionNav
          sections={secoes.map((s) => ({ ...s, label: t(s.label) }))}
          activeId={ativa}
          onSelect={(s) => irPara(s.id)}
          grupos={USER_AREA_GROUPS.map((g) => ({ ...g, label: t(g.label) }))}
          ariaLabel={t('Seções da Minha área')}
          dica="minha-area-secoes"
        />
      </div>

      {Secao && <Secao ctx={ctx} />}
    </V2Page>
  );
}

function PendenciaLink({ item, onSecao }) {
  const conteudo = (
    <>
      <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-ink px-2 text-sm font-bold text-acid">{item.count}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{item.label}</span>
        {item.detalhe && <span className="block truncate text-xs text-gray-500">{item.detalhe}</span>}
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
    </>
  );
  const cls = 'flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-paper-pure p-3 text-left transition-colors hover:border-ink/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink';
  if (item.to) return <Link to={item.to} className={cls}>{conteudo}</Link>;
  return <button type="button" onClick={() => onSecao(item.secao)} className={cls}>{conteudo}</button>;
}

function Cabecalho({ user, userProfile }) {
  const { level, source } = useMyUnifiedLevel();
  const name = userProfile?.platform_name || user?.displayName || 'Atleta';
  const photo = userProfile?.photo_url || user?.photoURL || '';
  const location = [userProfile?.city, userProfile?.state].filter(Boolean).join(', ');
  const year = memberSince(userProfile);
  // O selo 2.0–8.0 já mostra o nível da plataforma; o chip só aparece quando
  // o nível que os sorteios usam vem de OUTRA fonte (DUPR, ELO, indicado).
  const mostraNivel = level !== null && source !== LEVEL_SOURCE.PLATFORM_SKILL;

  return (
    <header className="rounded-4xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <V2Avatar name={name} photoUrl={photo} size="xl" className="h-20 w-20 text-2xl" />
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Minha área')}</p>
          <h1 className={`truncate ${PAGE_TITLE}`}>{name}</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {[location, year ? t('Membro desde {ano}', { ano: year }) : null].filter(Boolean).join(' • ') || t('Complete seu perfil para aparecer no diretório')}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {mostraNivel && (
              <V2Badge tone="acid" title={LEVEL_SOURCE_LABEL[source] ? t(LEVEL_SOURCE_LABEL[source]) : undefined}>
                {t('Nível {n}', { n: level.toFixed(1) })}{LEVEL_SOURCE_LABEL[source] ? ` · ${t(LEVEL_SOURCE_LABEL[source])}` : ''}
              </V2Badge>
            )}
            <V2DuprRatingBadge uid={user?.uid} />
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col">
          <V2Button asChild variant="subtle" size="sm" className="flex-1 sm:flex-none">
            <Link to="/perfil/editar" data-dica="perfil-editar"><Pencil className="h-4 w-4" /> {t('Editar perfil')}</Link>
          </V2Button>
          {user?.uid && (
            <V2Button asChild variant="ghost" size="sm" className="flex-1 sm:flex-none">
              <Link to={`/atleta/${user.uid}`}><Eye className="h-4 w-4" /> {t('Ver perfil público')}</Link>
            </V2Button>
          )}
        </div>
      </div>
    </header>
  );
}
