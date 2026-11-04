/**
 * MINHA CARREIRA (`/carreira`, flag `athlete_career`, docs/54).
 *
 * Abas (`?aba=`, contrato): `linha-do-tempo` (abre aqui) e `conquistas` (a
 * estante, com "Fora da plataforma"). `proximos` e `metas` chegam no PR 4 —
 * não há aba vazia. Só a aba aberta consulta.
 *
 * Outros parâmetros: `?evento=<id>` abre a ficha de um torneio de fora,
 * `?registrar=1` abre o registro rápido e `?lista=1` o modo lista.
 *
 * O resultado declarado aqui nunca entra em ranking, rating nem XP.
 */
import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { ListPlus, Medal, Plus, Route } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { CAREER_TAB, careerTabFromParam } from '@/modules/career/domain/timeline.js';
import { repeatEvent } from '@/modules/career/domain/careerEvent.js';
import { useCareerSaveWithDraft, useCareerTimeline } from '@/modules/career/hooks/useCareer';
import { V2Button, V2ErrorState, V2Page, V2PageIntro, V2Skeleton } from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import CareerTimeline from '@/v2/components/career/CareerTimeline';
import TrophyShelf, { ABA_FORA } from '@/v2/components/trophies/TrophyShelf';
import { t, tk } from '@/core/i18n';

const CareerQuickRegister = lazy(() => import('@/v2/components/career/CareerQuickRegister'));
const CareerEventSheet = lazy(() => import('@/v2/components/career/CareerEventSheet'));
const CareerListMode = lazy(() => import('@/v2/components/career/CareerListMode'));

const ABAS = [
  { value: CAREER_TAB.TIMELINE, label: tk('Linha do tempo'), icon: Route, dica: 'carreira-aba-linha-do-tempo' },
  { value: CAREER_TAB.ACHIEVEMENTS, label: tk('Conquistas'), icon: Medal, dica: 'carreira-aba-conquistas' },
];

function Carreira() {
  const { user, userProfile } = useAuth();
  const [params, setParams] = useSearchParams();
  const aba = careerTabFromParam(params.get('aba'));
  const linhaDoTempo = useCareerTimeline({ enabled: aba === CAREER_TAB.TIMELINE });
  const rascunho = useCareerSaveWithDraft();
  const [repetir, setRepetir] = useState(null);
  // O recém-registrado (ainda fora da lista, ou guardado sem sinal) abre a ficha mesmo assim.
  const [fichaLocal, setFichaLocal] = useState(null);

  const muda = (mexer) => {
    const p = new URLSearchParams(params);
    mexer(p);
    setParams(p, { replace: false });
  };
  const abrirFicha = (id) => muda((p) => { p.set('evento', id); p.delete('registrar'); });
  const fechar = (k) => muda((p) => p.delete(k));

  const eventoId = params.get('evento');
  const evento = useMemo(() => (linhaDoTempo.events || []).find((e) => e.id === eventoId)
    || (fichaLocal?.id === eventoId ? fichaLocal : null), [linhaDoTempo.events, eventoId, fichaLocal]);
  const registrar = params.get('registrar') === '1';
  const lista = params.get('lista') === '1';

  return (
    <V2Page className="space-y-6">
      <V2PageIntro
        title={t('Minha carreira')}
        subtitle={t('Os torneios que você jogou, aqui e fora do PickleRush, numa linha do tempo só sua.')}
        action={(
          <>
            <V2Button type="button" variant="secondary" data-dica="carreira-lista" onClick={() => muda((p) => p.set('lista', '1'))}>
              <ListPlus className="h-4 w-4" /> {t('Vários de uma vez')}
            </V2Button>
            <V2Button type="button" variant="primary" data-dica="carreira-registrar" onClick={() => { setRepetir(null); muda((p) => p.set('registrar', '1')); }}>
              <Plus className="h-4 w-4" /> {t('Registrar torneio')}
            </V2Button>
          </>
        )}
      />

      <V2SubTabs
        tabs={ABAS.map((a) => ({ ...a, label: t(a.label) }))}
        activeValue={aba}
        onSelect={(a) => muda((p) => { if (a.value === CAREER_TAB.TIMELINE) p.delete('aba'); else p.set('aba', a.value); })}
        ariaLabel={t('Abas da Minha carreira')}
        dica="carreira-abas"
      />

      {aba === CAREER_TAB.TIMELINE && (
        <CareerTimeline
          data={linhaDoTempo}
          pending={rascunho.pending}
          onFlush={rascunho.flush}
          onOpenEvent={abrirFicha}
          onRegister={() => muda((p) => p.set('registrar', '1'))}
        />
      )}
      {aba === CAREER_TAB.ACHIEVEMENTS && (
        <TrophyShelf uid={user?.uid} nome={userProfile?.platform_name || user?.displayName || ''} mine abaInicial={ABA_FORA} />
      )}

      <Suspense fallback={null}>
        {(registrar || repetir) && (
          <CareerQuickRegister
            open
            onOpenChange={(v) => { if (!v) { setRepetir(null); fechar('registrar'); } }}
            save={rascunho.save}
            events={linhaDoTempo.events}
            initial={repetir}
            onDetail={(ev) => { setRepetir(null); setFichaLocal(ev); abrirFicha(ev.id); }}
          />
        )}
        {eventoId && evento && (
          <CareerEventSheet
            open
            event={evento}
            // A exclusão pode ter tirado um rascunho da fila: a faixa relê.
            onOpenChange={(v) => { if (!v) { rascunho.refresh(); fechar('evento'); } }}
            save={rascunho.save}
            myTournaments={linhaDoTempo.myTournaments}
            onRepeat={(ev) => { setRepetir(repeatEvent(ev)); fechar('evento'); }}
          />
        )}
        {lista && <CareerListMode open onOpenChange={(v) => { if (!v) fechar('lista'); }} />}
      </Suspense>
      {/* Link para a ficha com a lista falhando: dizer por que ela não abriu. */}
      {eventoId && !evento && aba === CAREER_TAB.TIMELINE && !linhaDoTempo.isPending && linhaDoTempo.events === undefined && (
        <V2ErrorState
          inline
          title={t('Não deu para abrir a ficha deste torneio')}
          description={t('Os torneios de fora não carregaram. A ficha continua lá — a conexão é que falhou.')}
          onRetry={linhaDoTempo.retry}
        />
      )}
    </V2Page>
  );
}

export default function V2Career() {
  const { flags, isLoading } = useFeatureFlags();
  if (isLoading) return <V2Page className="space-y-4"><V2Skeleton className="h-12" /><V2Skeleton className="h-64" /></V2Page>;
  if (!flags?.[FEATURE_FLAG.ATHLETE_CAREER]) return <Navigate to="/perfil" replace />;
  return <Carreira />;
}
