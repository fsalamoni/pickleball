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
  ArrowRight, BarChart3, Building2, CalendarDays, Dumbbell, Eye, GraduationCap, LayoutDashboard,
  LayoutGrid, Pencil, Settings, Trophy, User, Users,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
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
import { useMyUnifiedLevel } from '@/modules/rating/hooks/useMyUnifiedLevel';
import { LEVEL_SOURCE, LEVEL_SOURCE_LABEL } from '@/modules/rating/domain/unifiedLevel';
import {
  USER_AREA_GROUPS, memberSince, resolveUserAreaSection, userAreaPending, userAreaSections,
} from '@/modules/athletes/domain/userArea';
import { V2Avatar, V2Badge, V2Button, V2ErrorState } from '@/v2/ui/primitives';
import { V2SectionNav } from '@/v2/ui/V2SectionNav';
import { rolarAte } from '@/v2/ui/rolarAte';
import V2DuprRatingBadge from '@/v2/components/rating/V2DuprRatingBadge';
import { SECOES } from './UserAreaSections';

const ICONES = {
  LayoutGrid, User, Dumbbell, BarChart3, CalendarDays, Trophy, Users, GraduationCap, Building2, Settings, LayoutDashboard,
};

/** `true`/`false` quando a leitura respondeu, `'erro'` quando falhou, `undefined` carregando. */
const papelDe = (q, sim) => (q.isError ? 'erro' : q.isSuccess ? sim : undefined);

export default function UserArea() {
  const { user, userProfile, isPlatformAdmin } = useAuth();
  const uid = user?.uid || null;
  const trainingOn = useFeatureFlag(FEATURE_FLAG.TRAINING_CENTER);
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

  const convitesEventoPendentes = (eventInvitesQ.data || []).filter((i) => i?.status === 'invited');
  const temConvite = (clubInvitesQ.data || []).length > 0 || convitesEventoPendentes.length > 0;

  const secoes = useMemo(() => userAreaSections({
    professor: papelDe(coachQ, isCoach),
    arenas: papelDe(arenasQ, (arenasQ.data || []).length > 0),
    // Convite pendente também abre a seção: é nela que a pessoa responde.
    clubes: temConvite ? true : papelDe(clubsQ, (clubsQ.data || []).length > 0),
    admin: !!isPlatformAdmin,
  }, { training_center: trainingOn }).map((s) => ({ ...s, icon: ICONES[s.icone] })),
  [coachQ, isCoach, arenasQ, clubsQ, temConvite, isPlatformAdmin, trainingOn]);

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
  });
  const falhas = [
    arenasQ.isError && 'as suas arenas',
    arenaSummary.pendingError && 'os pedidos de reserva',
    lessonsQ.isError && 'os pedidos de aula',
    (clubInvitesQ.isError || eventInvitesQ.isError) && 'os convites dos clubes',
    trainingOn && (myQuestionsQ.isError || coachQuestionsQ.isError) && 'as dúvidas de treino',
    trainingOn && inboxQ.isError && 'os treinos recebidos',
    balancos.isError && 'os jogos para o balanço',
  ].filter(Boolean);
  const tentarDeNovo = () => {
    [arenasQ, lessonsQ, clubInvitesQ, eventInvitesQ, myQuestionsQ, coachQuestionsQ, inboxQ]
      .filter((q) => q.isError).forEach((q) => q.refetch());
    if (arenaSummary.pendingError) arenaSummary.refetch?.();
    if (balancos.isError) balancos.refetch();
  };

  const ctx = { uid, userProfile, isCoach, coachQ, arenasQ, arenaSummary, clubsQ, clubInvitesQ, eventInvitesQ, lessonsQ, inboxQ, irPara, secoes };

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <Cabecalho user={user} userProfile={userProfile} />

      {(pendencias.length > 0 || falhas.length > 0) && (
        <section aria-labelledby="minha-area-pendencias-titulo" data-dica="minha-area-pendencias" className="rounded-4xl border border-acid/40 bg-acid/10 p-5 sm:p-6">
          <h2 id="minha-area-pendencias-titulo" className="font-display text-lg font-bold text-ink">Precisa de você</h2>
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
              title="Não deu para conferir tudo o que espera por você"
              description={`Ficou de fora: ${falhas.join(', ')}.`}
              onRetry={tentarDeNovo}
            />
          )}
        </section>
      )}

      <div id="minha-area-secoes" className="scroll-mt-4">
        <V2SectionNav
          sections={secoes}
          activeId={ativa}
          onSelect={(s) => irPara(s.id)}
          grupos={USER_AREA_GROUPS}
          ariaLabel="Seções da Minha área"
          dica="minha-area-secoes"
        />
      </div>

      {Secao && <Secao ctx={ctx} />}
    </div>
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
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Minha área</p>
          <h1 className="truncate font-display text-2xl font-bold text-ink sm:text-3xl">{name}</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {[location, year ? `Membro desde ${year}` : null].filter(Boolean).join(' • ') || 'Complete seu perfil para aparecer no diretório'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {mostraNivel && (
              <V2Badge tone="acid" title={LEVEL_SOURCE_LABEL[source] || undefined}>
                Nível {level.toFixed(1)}{LEVEL_SOURCE_LABEL[source] ? ` · ${LEVEL_SOURCE_LABEL[source]}` : ''}
              </V2Badge>
            )}
            <V2DuprRatingBadge uid={user?.uid} />
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-col">
          <V2Button asChild variant="subtle" size="sm" className="flex-1 sm:flex-none">
            <Link to="/perfil/editar" data-dica="perfil-editar"><Pencil className="h-4 w-4" /> Editar perfil</Link>
          </V2Button>
          {user?.uid && (
            <V2Button asChild variant="ghost" size="sm" className="flex-1 sm:flex-none">
              <Link to={`/atleta/${user.uid}`}><Eye className="h-4 w-4" /> Ver perfil público</Link>
            </V2Button>
          )}
        </div>
      </div>
    </header>
  );
}
