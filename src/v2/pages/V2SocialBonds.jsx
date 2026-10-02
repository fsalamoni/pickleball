import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, GraduationCap, Swords, Users } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useHeadToHead } from '@/modules/rating/hooks/useHeadToHead';
import {
  useUserCrews, usePublicCrews, useCrewActions,
  useUserMentorships, useMentorshipActions,
} from '@/modules/progression/hooks/useUserSocialBonds';
import RivalsList from '@/modules/progression/components/RivalsList';
import CrewsPanel from '@/modules/progression/components/CrewsPanel';
import MentorshipsPanel from '@/modules/progression/components/MentorshipsPanel';
import MentorshipInvite from '@/modules/progression/components/MentorshipInvite';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { usePeople } from '@/modules/progression/hooks/usePeople';
import {
  V2Button, V2EmptyState, V2PageIntro, V2Surface,
} from '@/v2/ui/primitives';
import { TermNote } from '@/v2/components/gamification/TermHint';

const ABAS = [
  { key: 'rivais', label: 'Rivais', icon: Swords, dica: 'vinculos-aba-rivais' },
  { key: 'crews', label: 'Crews', icon: Users, dica: 'vinculos-aba-crews' },
  { key: 'mentorias', label: 'Mentorias', icon: GraduationCap, dica: 'vinculos-aba-mentorias' },
];

/**
 * V2SocialBonds — `/vinculos`
 *
 * Os três vínculos sociais da gamificação num só lugar: rivais (derivados dos
 * confrontos reais), crews e mentorias.
 *
 * Gated por GAMIFICATION_V2.
 */
export default function V2SocialBonds() {
  const gamificationOn = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);
  if (!gamificationOn) {
    return (
      <div className="mx-auto max-w-[1000px]">
        <V2PageIntro title="Vínculos" subtitle="Rivais, crews e mentorias." />
        <V2Surface>
          <V2EmptyState
            icon={Users}
            title="Vínculos em construção"
            description="Esta seção estará disponível em breve."
            action={
              <V2Button asChild>
                <Link to="/meu-desempenho">Ir para Meu desempenho</Link>
              </V2Button>
            }
          />
        </V2Surface>
      </div>
    );
  }
  return <V2SocialBondsOn />;
}

function V2SocialBondsOn() {
  const { user } = useAuth();
  const uid = user?.uid;
  // `?aba=mentorias` (o aviso do convite) abre direto na aba certa.
  const [params] = useSearchParams();
  const [aba, setAba] = useState(() => (ABAS.some((t) => t.key === params.get('aba')) ? params.get('aba') : 'rivais'));

  // Rivais vêm do histórico real de confrontos — não de uma coleção própria,
  // que nada preencheria.
  const { data: h2h, isLoading: rivaisCarregando } = useHeadToHead(uid, !!uid);

  const { data: myCrews = [], isLoading: crewsCarregando } = useUserCrews(uid, !!uid);
  const { data: publicCrews = [] } = usePublicCrews(!!uid);
  const {
    create, join, leave, isCreating, isJoining, isLeaving,
  } = useCrewActions();

  const { data: mentorships = [], isLoading: mentoriasCarregando } = useUserMentorships(uid, !!uid);
  const { start, respond, recordLesson, end, isStarting, isResponding, isRecording, isEnding } = useMentorshipActions();
  const { data: diretorio = [] } = useAthletes(aba === 'mentorias');
  const { people } = usePeople(mentorships.flatMap((m) => [m.mentorUid, m.apprenticeUid]));

  const [erroCrew, setErroCrew] = useState(null);
  const crewOcupado = isCreating || isJoining || isLeaving;

  const rivais = useMemo(() => h2h?.rivals || [], [h2h]);

  const contagem = {
    rivais: rivais.length,
    crews: myCrews.length,
    // convite que espera a MINHA resposta também conta: é o que pede atenção
    mentorias: mentorships.filter((m) => m.status === 'active' || (m.status === 'pending' && m.proposedBy !== uid)).length,
  };

  // As mutações do React Query aceitam `{ onError }` como segundo argumento;
  // é assim que a mensagem do service (ex.: "crew lotada") chega à tela em
  // vez de morrer no console.
  const aoFalhar = {
    onError: (e) => setErroCrew(e?.message || 'Não foi possível concluir a ação.'),
  };
  function executar(fn, variaveis) {
    setErroCrew(null);
    fn(variaveis, aoFalhar);
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <V2PageIntro
        title="Vínculos"
        subtitle="Seus rivais de quadra, suas crews e suas mentorias."
        action={
          <Link
            to="/gamification"
            className="inline-flex items-center gap-1 text-sm font-bold text-ink hover:underline"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Gamificação
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap gap-1.5" role="tablist" aria-label="Tipo de vínculo" data-dica="vinculos-abas">
        {ABAS.map((t) => {
          const Icone = t.icon;
          const ativa = aba === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => setAba(t.key)}
              data-testid={`bonds-tab-${t.key}`}
              data-dica={t.dica}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
                ativa ? 'bg-ink text-white' : 'bg-paper text-gray-600 hover:bg-gray-100',
              )}
            >
              <Icone className="h-3.5 w-3.5" aria-hidden="true" />
              {t.label}
              {contagem[t.key] > 0 && (
                <span className={cn('tabular-nums', ativa ? 'text-white/70' : 'text-gray-400')}>
                  {contagem[t.key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <TermNote term={{ rivais: 'rivais', crews: 'crews', mentorias: 'mentoria' }[aba]} className="mb-5" />

      {aba === 'rivais' && (
        <div data-dica="vinculos-rivais"><RivalsList rivals={rivais} isLoading={rivaisCarregando} /></div>
      )}

      {aba === 'crews' && (
        <div data-dica="vinculos-crews">
          <CrewsPanel
            uid={uid}
            myCrews={myCrews}
            publicCrews={publicCrews}
            isLoading={crewsCarregando}
            isBusy={crewOcupado}
            error={erroCrew}
            onCreate={({ name }) => executar(create, { createdBy: uid, name })}
            onJoin={(crewId) => executar(join, { crewId, uid })}
            onLeave={(crewId) => executar(leave, { crewId, uid })}
          />
        </div>
      )}

      {aba === 'mentorias' && (
        <div className="space-y-5" data-dica="vinculos-mentorias">
          <MentorshipsPanel
            uid={uid}
            mentorships={mentorships}
            isLoading={mentoriasCarregando}
            isBusy={isRecording || isEnding || isResponding}
            nameOf={(u) => people.get(u)?.name || 'um atleta'}
            onRecordLesson={(pairKey) => recordLesson({ pairKey })}
            onEnd={(pairKey) => end({ pairKey, status: 'completed' })}
            onRespond={(pairKey, accept) => executar(respond, { pairKey, accept, actorUid: uid })}
          />
          <MentorshipInvite
            uid={uid}
            candidates={diretorio}
            busy={isStarting}
            onInvite={({ role, otherUid }) => executar(start, {
              mentorUid: role === 'mentor' ? uid : otherUid,
              apprenticeUid: role === 'mentor' ? otherUid : uid,
              proposedBy: uid,
              proposerName: user?.displayName || '',
            })}
          />
          {erroCrew && <p role="alert" className="text-sm text-red-600">{erroCrew}</p>}
        </div>
      )}
    </div>
  );
}
