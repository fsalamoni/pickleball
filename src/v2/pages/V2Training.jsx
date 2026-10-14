/**
 * V2Training — o CENTRO DE TREINO (flag `training_center`). Rota: `/treino`.
 *
 * Três grupos de abas, com a aba na URL (`?aba=`) para recarregar, voltar e
 * mandar link sem perder o lugar:
 *  - Treinar: Hoje · Planos · Diário · Evolução · Balanço (flag `game_debrief`)
 *  - Conteúdo: Biblioteca · Meus · Recebidos
 *  - Conversa: Dúvidas · Alunos (só professor)
 *
 * Cada aba é um pedaço separado (`components/training/tabs/`), baixado só
 * quando a pessoa a abre. Esta página só decide QUAL aba e passa a mesma
 * identidade e configuração para todas — nenhuma aba monta isso sozinha.
 */
import React, { Suspense, lazy, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarRange, ClipboardCheck, Inbox, Library, MessageCircleQuestion, NotebookPen, PenLine, Plus, TrendingUp, Users, Zap,
} from 'lucide-react';
import { useTrainingIdentity } from '@/modules/training/hooks/useTrainingIdentity';
import { useTrainingSettings } from '@/modules/training/hooks/useTrainingSettings';
import { useTrainingInbox } from '@/modules/training/hooks/useTrainingShares';
import { useGameDebriefAvailable } from '@/modules/training/hooks/useDebriefs';
import { unreadCount } from '@/modules/training/domain/share';
import { V2Button, V2PageIntro, V2Skeleton } from '@/v2/ui/primitives';
import { V2SectionNav } from '@/v2/ui/V2SectionNav';
import TrainingGate from '@/v2/components/training/TrainingGate';
import { t, tk } from '@/core/i18n';

const TABS = {
  hoje: lazy(() => import('@/v2/components/training/tabs/TodayTab')),
  planos: lazy(() => import('@/v2/components/training/tabs/PlansTab')),
  diario: lazy(() => import('@/v2/components/training/tabs/DiaryTab')),
  evolucao: lazy(() => import('@/v2/components/training/tabs/EvolutionTab')),
  balanco: lazy(() => import('@/v2/components/training/tabs/DebriefTab')),
  biblioteca: lazy(() => import('@/v2/components/training/tabs/LibraryTab')),
  meus: lazy(() => import('@/v2/components/training/tabs/MyItemsTab')),
  recebidos: lazy(() => import('@/v2/components/training/tabs/ReceivedTab')),
  duvidas: lazy(() => import('@/v2/components/training/tabs/QuestionsTab')),
  alunos: lazy(() => import('@/v2/components/training/tabs/StudentsTab')),
};

const GRUPOS = [
  { id: 'treinar', label: tk('Treinar') },
  { id: 'conteudo', label: tk('Conteúdo') },
  { id: 'conversa', label: tk('Conversa') },
];

/** As abas que esta pessoa vê (a de alunos só para professor; a de balanço só com a flag). */
export function trainingSections({ isCoach = false, recebidosNovos = 0, balanco = false } = {}) {
  return [
    { id: 'hoje', label: t('Hoje'), icon: Zap, grupo: 'treinar', dica: 'treino-aba-hoje' },
    { id: 'planos', label: t('Planos'), icon: CalendarRange, grupo: 'treinar', dica: 'treino-aba-planos' },
    { id: 'diario', label: t('Diário'), icon: NotebookPen, grupo: 'treinar', dica: 'treino-aba-diario' },
    { id: 'evolucao', label: t('Evolução'), icon: TrendingUp, grupo: 'treinar', dica: 'treino-aba-evolucao' },
    ...(balanco ? [{ id: 'balanco', label: t('Balanço'), icon: ClipboardCheck, grupo: 'treinar', dica: 'treino-aba-balanco' }] : []),
    { id: 'biblioteca', label: t('Biblioteca'), icon: Library, grupo: 'conteudo', dica: 'treino-aba-biblioteca' },
    { id: 'meus', label: t('Meus'), icon: PenLine, grupo: 'conteudo', dica: 'treino-aba-meus' },
    {
      id: 'recebidos',
      label: recebidosNovos > 0 ? t('Recebidos ({n})', { n: recebidosNovos }) : t('Recebidos'),
      icon: Inbox,
      grupo: 'conteudo',
      dica: 'treino-aba-recebidos',
    },
    { id: 'duvidas', label: t('Dúvidas'), icon: MessageCircleQuestion, grupo: 'conversa', dica: 'treino-aba-duvidas' },
    ...(isCoach ? [{ id: 'alunos', label: t('Alunos'), icon: Users, grupo: 'conversa', dica: 'treino-aba-alunos' }] : []),
  ];
}

function TrainingHub() {
  const identity = useTrainingIdentity();
  const { settings } = useTrainingSettings();
  const inbox = useTrainingInbox(identity.uid);
  const balanco = useGameDebriefAvailable();
  const [params, setParams] = useSearchParams();

  const sections = useMemo(
    () => trainingSections({ isCoach: identity.isCoach, recebidosNovos: inbox.isSuccess ? unreadCount(inbox.data || []) : 0, balanco }),
    [identity.isCoach, inbox.data, balanco],
  );
  const pedida = params.get('aba');
  // Aba de professor pedida por quem não é (ou antes de saber): cai em "Hoje".
  const ativa = sections.some((s) => s.id === pedida) ? pedida : 'hoje';
  const Aba = TABS[ativa];

  const irPara = (aba, extra = {}) => {
    const p = new URLSearchParams();
    p.set('aba', aba);
    Object.entries(extra).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, String(v)); });
    setParams(p);
  };

  return (
    <div className="space-y-6">
      <V2PageIntro
        title={t('Treino')}
        subtitle={t('O que treinar hoje, a biblioteca de drills e o seu diário — no mesmo lugar.')}
        action={(
          <V2Button asChild size="sm" data-dica="treino-criar">
            <Link to="/treino/novo"><Plus className="h-4 w-4" aria-hidden="true" />{' '}{t('Criar drill ou treino')}</Link>
          </V2Button>
        )}
      />
      <V2SectionNav
        sections={sections}
        activeId={ativa}
        grupos={GRUPOS.map((g) => ({ ...g, label: t(g.label) }))}
        ariaLabel={t('Seções do treino')}
        dica="treino-secoes"
        onSelect={(s) => irPara(s.id)}
      />
      <Suspense fallback={<V2Skeleton className="h-64 rounded-4xl" />}>
        <Aba identity={identity} settings={settings} params={params} irPara={irPara} />
      </Suspense>
    </div>
  );
}

export default function V2Training() {
  return (
    <TrainingGate>
      <TrainingHub />
    </TrainingGate>
  );
}
