/**
 * V2CoachAgenda — Hub do professor: disponibilidade semanal + agenda de aulas.
 *
 * Rota: /aulas
 * Acesso: usuário com perfil de professor (Sistema A). Gated pela flag
 * coach_lessons.
 *
 * Aditivo — não altera o diretório/perfil existente.
 */

import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { MyTaughtArenaClasses } from '@/v2/components/arenas/classes/MyArenaClasses';
import { toast } from 'sonner';
import {
  GraduationCap, Plus, Trash2, Clock, CalendarDays, CalendarOff, Check, X,
  UserCircle, Image as ImageIcon, Users, Wallet, Package, Store, BookOpen, Handshake,
  Sparkles, Megaphone, Tag, Trophy,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useCoach } from '@/modules/coaches/hooks/useCoaches';
import {
  useCoachAvailability, useSaveAvailability, useCoachLessons, useRespondLesson, useReturnPendingCouponUses,
} from '@/modules/coaches/hooks/useLessons';
import { SLOT_MINUTES_DEFAULT } from '@/modules/coaches/domain/availability';
import { lessonCouponLine } from '@/modules/promo/domain/lessonCoupon';
import {
  partitionLessons, lessonsAwaitingReply, upcomingRepliesFirst, availableActions, lessonStatusLabel, lessonStatusTone,
  lessonFormatLabel, lessonSlots, LESSON_STATUS,
} from '@/modules/coaches/domain/lesson';
import CoachStudentsSection from '@/modules/coaches/components/CoachStudentsSection';
import CoachClinicsSection from '@/modules/coaches/components/CoachClinicsSection';
import CoachPackagesSection from '@/modules/coaches/components/CoachPackagesSection';
import CoachContentSection from '@/modules/coaches/components/CoachContentSection';
import CoachStoreSection from '@/modules/coaches/components/CoachStoreSection';
import CoachPartnersSection from '@/modules/coaches/components/CoachPartnersSection';
import CoachCourtBookingsSection from '@/modules/coaches/components/CoachCourtBookingsSection';
import LinkedClubsSection from '@/modules/clubs/components/LinkedClubsSection';
import { CoachInfoSection, CoachPhotosSection } from '@/modules/coaches/components/CoachProfileSections';
import ConfirmDialog from '@/components/ConfirmDialog';
import { V2SectionNav, V2SubTabs } from '@/v2/ui/V2SectionNav';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton, V2Surface,
  V2ErrorState,
} from '@/v2/ui/primitives';

// Navegação em dois níveis do hub do professor (espelha o admin da arena).
// Ordem lógica: perfil → agenda → alunos → comercial → conteúdo → parceiros.
const COACH_SECTIONS = [
  {
    id: 'perfil',
    label: 'Perfil',
    icon: UserCircle,
    tabs: [
      { value: 'info', label: 'Informações', icon: UserCircle },
      { value: 'fotos', label: 'Fotos', icon: ImageIcon },
    ],
  },
  {
    id: 'agenda',
    label: 'Agenda',
    icon: CalendarDays,
    tabs: [{ value: 'agenda', label: 'Calendário', icon: CalendarDays }],
  },
  {
    id: 'alunos',
    label: 'Alunos',
    icon: Users,
    tabs: [{ value: 'alunos', label: 'Alunos', icon: Users }],
  },
  {
    id: 'comercial',
    label: 'Comercial',
    icon: Wallet,
    tabs: [
      { value: 'pacotes', label: 'Pacotes', icon: Package },
      { value: 'loja', label: 'Loja', icon: Store },
    ],
  },
  {
    id: 'conteudo',
    label: 'Conteúdo',
    icon: BookOpen,
    tabs: [{ value: 'conteudo', label: 'Conteúdo', icon: BookOpen }],
  },
  {
    id: 'parceiros',
    label: 'Parceiros',
    icon: Handshake,
    tabs: [{ value: 'parceiros', label: 'Parceiros', icon: Handshake }],
  },
];

// Cupons e campanhas DO PROFESSOR (Onda CG, flag `coach_marketing`). Sob
// demanda: o console de divulgação só baixa quando a seção abre.
const CoachPromoConsole = lazy(() => import('@/v2/components/promo/CoachPromoConsole'));
// Engajamento (gamificação V2, flag `gamification_v2`): saúde do trabalho, metas, desafios e
// recompensas do professor — também sob demanda.
const CoachEngagementPanel = lazy(() => import('@/v2/components/gamification/issuer/CoachEngagementPanel'));
const SECAO_ENGAJAMENTO = {
  id: 'engajamento',
  label: 'Engajamento',
  icon: Trophy,
  dica: 'professor-aba-engajamento',
  tabs: [{ value: 'engajamento', label: 'Saúde, desafios e recompensas', icon: Trophy }],
};
const SECAO_DIVULGACAO = {
  id: 'divulgacao',
  label: 'Divulgação',
  icon: Megaphone,
  tabs: [{ value: 'divulgacao', label: 'Cupons e campanhas', icon: Megaphone }],
};

/**
 * A aba que abre, pela URL: `?aba=<valor>` (uma aba) ou `?secao=<id>` (a
 * primeira aba da seção) — é assim que a tela inicial leva direto à
 * divulgação. Valor desconhecido cai na Agenda, nunca em branco.
 */
export function coachTabFromUrl(params, sections) {
  const aba = params.get('aba');
  if (aba && sections.some((s) => s.tabs.some((t) => t.value === aba))) return aba;
  const secao = sections.find((s) => s.id === params.get('secao'));
  return secao ? secao.tabs[0].value : 'agenda';
}

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY_SHORT[date.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

function emptyWindow() {
  return { id: `w_${Math.random().toString(36).slice(2, 9)}`, weekdays: [], start: '08:00', end: '12:00', location: '' };
}

/* ----------------------- Editor de disponibilidade ----------------------- */

export function AvailabilityEditor({ coachId }) {
  const { data: availability, isLoading, isError, refetch } = useCoachAvailability(coachId);
  const save = useSaveAvailability();
  const [windows, setWindows] = useState(null);
  const [slotMinutes, setSlotMinutes] = useState(SLOT_MINUTES_DEFAULT);

  // Inicializa a partir do doc salvo (uma vez).
  // 🐞 Com a leitura FALHANDO, `availability` vinha vazio e o editor abria em
  // branco — "Salvar" gravava a agenda vazia por cima da verdadeira. Só se
  // começa do zero quando a leitura CONFIRMOU que não há disponibilidade.
  React.useEffect(() => {
    if (availability && windows === null) {
      setWindows((availability.windows || []).map((w) => ({ ...w, location: w.location || '' })));
      setSlotMinutes(availability.slot_minutes || SLOT_MINUTES_DEFAULT);
    } else if (!isLoading && !isError && !availability && windows === null) {
      setWindows([]);
    }
  }, [availability, isLoading, isError, windows]);

  if (isError && windows === null) {
    return (
      <V2ErrorState
        title="Não foi possível carregar a sua disponibilidade"
        description="Tente de novo antes de editar — salvar agora gravaria a agenda em branco."
        onRetry={() => refetch()}
      />
    );
  }
  if (isLoading || windows === null) return <V2Skeleton lines={4} />;

  const toggleWeekday = (idx, wd) => {
    setWindows((prev) => prev.map((w, i) => {
      if (i !== idx) return w;
      const has = w.weekdays.includes(wd);
      return { ...w, weekdays: has ? w.weekdays.filter((d) => d !== wd) : [...w.weekdays, wd].sort((a, b) => a - b) };
    }));
  };
  const setField = (idx, key, val) => setWindows((prev) => prev.map((w, i) => (i === idx ? { ...w, [key]: val } : w)));
  const removeWindow = (idx) => setWindows((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        coachId,
        input: { windows, slot_minutes: Number(slotMinutes), exceptions: availability?.exceptions || [] },
      });
      toast.success('Disponibilidade salva!');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    }
  };

  return (
    <V2Surface data-dica="professor-disponibilidade">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Disponibilidade semanal</h2>
        </div>
        <V2Button size="sm" variant="ghost" onClick={() => setWindows((p) => [...p, emptyWindow()])} data-dica="professor-janela">
          <Plus className="mr-1 h-4 w-4" /> Janela
        </V2Button>
      </div>

      {windows.length === 0 ? (
        <V2EmptyState
          icon={CalendarOff}
          title="Sem janelas de horário"
          description="Adicione as janelas em que você dá aula. Os alunos verão os horários livres para solicitar."
        />
      ) : (
        <div className="space-y-3">
          {windows.map((w, idx) => (
            <div key={w.id} className="rounded-2xl border border-gray-100 bg-paper p-3">
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_SHORT.map((label, wd) => (
                  <button
                    key={wd}
                    type="button"
                    onClick={() => toggleWeekday(idx, wd)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                      w.weekdays.includes(wd) ? 'border-ink bg-ink text-white' : 'border-gray-200 text-gray-500 hover:bg-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <V2Field label="Início">
                  <V2Input type="time" value={w.start} onChange={(e) => setField(idx, 'start', e.target.value)} />
                </V2Field>
                <V2Field label="Fim">
                  <V2Input type="time" value={w.end} onChange={(e) => setField(idx, 'end', e.target.value)} />
                </V2Field>
                <V2Field label="Local (opcional)" className="sm:col-span-2">
                  <V2Input value={w.location} onChange={(e) => setField(idx, 'location', e.target.value)} maxLength={120} placeholder="Ex.: Arena X, quadra 2" />
                </V2Field>
              </div>
              <div className="mt-2 flex justify-end">
                <button type="button" onClick={() => removeWindow(idx)} className="text-xs font-bold text-red-500 hover:text-red-700">
                  <Trash2 className="mr-1 inline h-3 w-3" /> Remover janela
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-gray-100 pt-4">
        <V2Field label="Duração de cada aula (min)" className="w-40">
          <V2Input type="number" min="15" max="240" step="15" value={slotMinutes} onChange={(e) => setSlotMinutes(e.target.value)} />
        </V2Field>
        <V2Button onClick={handleSave} disabled={save.isPending} data-dica="professor-salvar-disponibilidade">
          {save.isPending ? 'Salvando…' : 'Salvar disponibilidade'}
        </V2Button>
      </div>
    </V2Surface>
  );
}

/* ----------------------------- Card de aula ----------------------------- */

function LessonCard({ lesson, onAction, isPending }) {
  const slots = lessonSlots(lesson);
  const first = slots[0];
  const actions = availableActions(lesson, 'coach');
  return (
    <div className="rounded-2xl border border-gray-100 bg-paper p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-ink">{lesson.student_name || 'Aluno'}</p>
            <V2Badge tone={lessonStatusTone(lesson.status)}>{lessonStatusLabel(lesson.status)}</V2Badge>
            <V2Badge tone="neutral">{lessonFormatLabel(lesson.format)}</V2Badge>
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <CalendarDays className="h-3.5 w-3.5" />
            {first ? `${fmtDate(first.date)} · ${first.start}–${first.end}` : 'Horário a combinar'}
            {slots.length > 1 && <span className="ml-1">+{slots.length - 1} data(s)</span>}
          </div>
          {lesson.notes && <p className="mt-1.5 text-xs text-gray-500">{lesson.notes}</p>}
          {lesson.coupon?.code && (
            <p className={`mt-1.5 inline-flex items-start gap-1 rounded-xl px-2 py-0.5 text-[11px] font-bold leading-4 ${lesson.coupon.status === 'rejected' ? 'bg-amber-50 text-amber-800' : 'bg-acid/20 text-ink'}`}>
              <Tag className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> <span>{lessonCouponLine(lesson.coupon, { lessonStatus: lesson.status })}</span>
            </p>
          )}
        </div>
      </div>
      {actions.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {actions.map((a) => {
            const destructive = a.to === LESSON_STATUS.DECLINED || a.to === LESSON_STATUS.CANCELLED;
            const Icon = a.to === LESSON_STATUS.CONFIRMED || a.to === LESSON_STATUS.COMPLETED ? Check : X;
            if (destructive) {
              return (
                <ConfirmDialog
                  key={a.to}
                  title={`${a.label} aula?`}
                  description={`A aula de ${lesson.student_name || 'aluno'} será ${a.to === LESSON_STATUS.DECLINED ? 'recusada' : 'cancelada'}.`}
                  confirmLabel={a.label}
                  onConfirm={() => onAction(lesson, a.to)}
                  trigger={(
                    <button type="button" disabled={isPending} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50">
                      <Icon className="mr-1 inline h-3 w-3" /> {a.label}
                    </button>
                  )}
                />
              );
            }
            return (
              <button
                key={a.to}
                type="button"
                disabled={isPending}
                onClick={() => onAction(lesson, a.to)}
                className="rounded-full border border-ink bg-ink px-3 py-1 text-xs font-bold text-white hover:bg-ink/90 disabled:opacity-50"
              >
                <Icon className="mr-1 inline h-3 w-3" /> {a.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Página -------------------------------- */

function V2CoachAgendaContent() {
  const { user, isAuthenticated } = useAuth();
  const { data: coach, isLoading: coachLoading, isError: perfilFalhou, refetch: recarregarPerfil } = useCoach(user?.uid);
  const {
    data: lessons = [], isLoading: lessonsLoading, isError: aulasFalharam, refetch: recarregarAulas,
  } = useCoachLessons(user?.uid);
  const respond = useRespondLesson();
  // Aula que o aluno cancelou com o cupom já contado: o uso volta para ele.
  useReturnPendingCouponUses(lessons, user?.uid);
  const sharedBookingsOn = true;
  const linkedClubsOn = true;
  const clinicsOn = true;
  const marketingOn = useFeatureFlag(FEATURE_FLAG.COACH_MARKETING);
  const gamificationOn = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);

  const sections = useMemo(() => {
    const out = [...COACH_SECTIONS];
    if (clinicsOn) {
      const extra = { id: 'clinicas', label: 'Clínicas', icon: Sparkles, tabs: [{ value: 'clinicas', label: 'Clínicas', icon: Sparkles }] };
      // Insere logo após "Alunos".
      const idx = out.findIndex((s) => s.id === 'alunos');
      out.splice(idx >= 0 ? idx + 1 : out.length, 0, extra);
    }
    // Divulgação logo depois de Comercial: é o que faz o comercial vender.
    if (marketingOn) {
      const idx = out.findIndex((s) => s.id === 'comercial');
      out.splice(idx >= 0 ? idx + 1 : out.length, 0, SECAO_DIVULGACAO);
    }
    // Engajamento depois de Conteúdo: é o retrato de como o trabalho vai.
    if (gamificationOn) {
      const idx = out.findIndex((s) => s.id === 'conteudo');
      out.splice(idx >= 0 ? idx + 1 : out.length, 0, SECAO_ENGAJAMENTO);
    }
    return out;
  }, [clinicsOn, marketingOn, gamificationOn]);

  const [params, setParams] = useSearchParams();
  const [tabEscolhida, setTabEscolhida] = useState(null);
  // A URL manda quando diz a aba: um link com `?aba=` (um aviso, um guia das
  // dicas) tem de trocar a aba mesmo com o painel já aberto noutra.
  const urlDizAba = Boolean(params.get('aba') || params.get('secao'));
  const tab = urlDizAba ? coachTabFromUrl(params, sections) : (tabEscolhida || coachTabFromUrl(params, sections));
  const setTab = (valor) => {
    setTabEscolhida(valor);
    // A aba vai para a URL: recarregar ou voltar não perde o lugar.
    const next = new URLSearchParams(params);
    next.set('aba', valor);
    next.delete('secao');
    setParams(next, { replace: true });
  };

  const { upcoming, history } = useMemo(() => partitionLessons(lessons), [lessons]);
  // Os pedidos que esperam resposta vêm primeiro: só eles dependem do professor.
  const proximas = useMemo(() => upcomingRepliesFirst(upcoming), [upcoming]);
  const aResponder = useMemo(() => lessonsAwaitingReply(upcoming).length, [upcoming]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (coachLoading) return <div className="mx-auto max-w-[900px] p-4"><V2Skeleton lines={6} /></div>;

  // Falha não é "você não é professor": o convite a criar o perfil mandaria o
  // professor recadastrar o que já tem.
  if (!coach && perfilFalhou) {
    return (
      <div className="mx-auto max-w-[700px] space-y-6 p-4">
        <V2ErrorState
          title="Não foi possível abrir o seu painel de professor"
          description="O seu perfil continua lá — a conexão falhou no meio do caminho."
          onRetry={() => recarregarPerfil()}
        />
      </div>
    );
  }

  if (!coach) {
    // Professor da ARENA sem perfil de professor da plataforma: a agenda dele
    // nas arenas vem primeiro — sem isto, ele abria "Minha agenda" e lia que
    // não é professor, com aulas marcadas.
    return (
      <div className="mx-auto max-w-[700px] space-y-6 p-4">
        <MyTaughtArenaClasses />
        <V2Surface>
          <V2EmptyState
            icon={GraduationCap}
            title="Você ainda não tem perfil de professor"
            description="Crie seu perfil de professor para publicar horários e receber solicitações de aula."
            action={<Link to="/coaches" className="text-sm font-bold text-ink underline">Criar perfil de professor →</Link>}
          />
        </V2Surface>
      </div>
    );
  }

  const activeSection = sections.find((s) => s.tabs.some((t) => t.value === tab)) || sections[0];

  const handleAction = async (lesson, nextStatus) => {
    try {
      await respond.mutateAsync({ lesson, nextStatus });
      toast.success('Aula atualizada.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível atualizar a aula.');
    }
  };

  const coachId = user.uid;

  return (
    <div className="mx-auto max-w-[900px] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Painel do professor</h1>
        <Link to={`/coaches/${coachId}`} className="text-xs font-bold text-ink hover:underline">Ver perfil público →</Link>
      </div>
      <p className="mb-5 font-medium text-gray-500">Gerencie perfil, agenda, alunos, comercial, conteúdo e parcerias.</p>

      {/* Navegação em dois níveis — quebra em linhas, nunca rola para o lado */}
      <div className="space-y-3">
        <V2SectionNav
          ariaLabel="Seções do painel do professor"
          dica="professor-secoes"
          sections={sections}
          activeId={activeSection.id}
          onSelect={(section) => setTab(section.tabs[0].value)}
        />
        {activeSection.tabs.length > 1 && (
          <V2SubTabs
            ariaLabel={`Abas de ${activeSection.label}`}
            tabs={activeSection.tabs}
            activeValue={tab}
            onSelect={(t) => setTab(t.value)}
          />
        )}
      </div>

      <div className="mt-6 space-y-6">
        {tab === 'info' && <CoachInfoSection coach={coach} />}
        {tab === 'fotos' && <CoachPhotosSection coach={coach} />}
        {tab === 'agenda' && (
          <>
            {/* As próximas aulas vêm PRIMEIRO, com os pedidos que esperam
                resposta no topo: é o que tem prazo (o aluno está esperando para
                marcar). Antes elas ficavam no fim da aba, abaixo do editor de
                disponibilidade — configuração que muda pouco. */}
            <V2Surface>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold text-ink">Próximas aulas</h2>
                {!lessonsLoading && !aulasFalharam && aResponder > 0 && (
                  <V2Badge tone="amber">
                    {aResponder === 1 ? '1 pedido esperando a sua resposta' : `${aResponder} pedidos esperando a sua resposta`}
                  </V2Badge>
                )}
              </div>
              {lessonsLoading ? (
                <V2Skeleton lines={3} />
              ) : aulasFalharam ? (
                <V2ErrorState
                  inline
                  title="Não foi possível carregar as suas aulas"
                  description="Pode haver pedido de aula esperando resposta."
                  onRetry={() => recarregarAulas()}
                />
              ) : upcoming.length === 0 ? (
                <V2EmptyState icon={CalendarDays} title="Nenhuma aula agendada" description="Solicitações de aula dos alunos aparecem aqui para você confirmar." />
              ) : (
                <div className="space-y-2">
                  {proximas.map((l) => <LessonCard key={l.id} lesson={l} onAction={handleAction} isPending={respond.isPending} />)}
                </div>
              )}
            </V2Surface>
            {/* As aulas que ele dá na agenda das ARENAS (módulo de aulas). */}
            <MyTaughtArenaClasses />
            <AvailabilityEditor coachId={coachId} />
            {sharedBookingsOn && <CoachCourtBookingsSection coach={coach} />}
            {history.length > 0 && (
              <V2Surface>
                <h2 className="mb-4 font-display text-lg font-bold text-ink">Histórico</h2>
                <div className="space-y-2">
                  {history.map((l) => <LessonCard key={l.id} lesson={l} onAction={handleAction} isPending={respond.isPending} />)}
                </div>
              </V2Surface>
            )}
          </>
        )}
        {tab === 'alunos' && <CoachStudentsSection coachId={coachId} lessons={lessons} />}
        {tab === 'clinicas' && clinicsOn && <CoachClinicsSection coachId={coachId} coachName={coach.display_name || user?.displayName || ''} />}
        {tab === 'pacotes' && <CoachPackagesSection coachId={coachId} />}
        {tab === 'loja' && <CoachStoreSection coachId={coachId} />}
        {tab === 'conteudo' && <CoachContentSection coachId={coachId} />}
        {tab === 'divulgacao' && marketingOn && (
          <Suspense fallback={<V2Skeleton lines={4} />}>
            <CoachPromoConsole coachId={coachId} coach={coach} />
          </Suspense>
        )}
        {tab === 'engajamento' && gamificationOn && (
          <Suspense fallback={<V2Skeleton lines={4} />}>
            <CoachEngagementPanel coach={{ id: coachId, name: coach.display_name || user?.displayName || '' }} />
          </Suspense>
        )}
        {tab === 'parceiros' && (
          <>
            <CoachPartnersSection coachId={coachId} />
            {linkedClubsOn && <LinkedClubsSection ownerType="coach" ownerId={coachId} canManage title="Meus clubes" />}
          </>
        )}
      </div>
    </div>
  );
}

export default function V2CoachAgenda() {
  return <V2CoachAgendaContent />;
}
