/**
 * V2CoachAgenda — Hub do professor: disponibilidade semanal + agenda de aulas.
 *
 * Rota: /aulas
 * Acesso: usuário com perfil de professor (Sistema A). Gated pela flag
 * coach_lessons.
 *
 * Aditivo — não altera o diretório/perfil existente.
 */

import React, { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  GraduationCap, Plus, Trash2, Clock, CalendarDays, CalendarOff, Check, X,
  UserCircle, Image as ImageIcon, Users, Wallet, Package, Store, BookOpen, Handshake,
} from 'lucide-react';
import { FEATURE_FLAG } from '@/core/featureFlags';
import FeatureFlagGuard from '@/v2/components/FeatureFlagGuard';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useCoach } from '@/modules/coaches/hooks/useCoaches';
import {
  useCoachAvailability, useSaveAvailability, useCoachLessons, useRespondLesson,
} from '@/modules/coaches/hooks/useLessons';
import { SLOT_MINUTES_DEFAULT } from '@/modules/coaches/domain/availability';
import {
  partitionLessons, availableActions, lessonStatusLabel, lessonStatusTone,
  lessonFormatLabel, lessonSlots, LESSON_STATUS,
} from '@/modules/coaches/domain/lesson';
import CoachStudentsSection from '@/modules/coaches/components/CoachStudentsSection';
import CoachPackagesSection from '@/modules/coaches/components/CoachPackagesSection';
import CoachContentSection from '@/modules/coaches/components/CoachContentSection';
import CoachStoreSection from '@/modules/coaches/components/CoachStoreSection';
import CoachPartnersSection from '@/modules/coaches/components/CoachPartnersSection';
import CoachCourtBookingsSection from '@/modules/coaches/components/CoachCourtBookingsSection';
import { CoachInfoSection, CoachPhotosSection } from '@/modules/coaches/components/CoachProfileSections';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { cn } from '@/core/lib/utils';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton, V2Surface,
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

function AvailabilityEditor({ coachId }) {
  const { data: availability, isLoading } = useCoachAvailability(coachId);
  const save = useSaveAvailability();
  const [windows, setWindows] = useState(null);
  const [slotMinutes, setSlotMinutes] = useState(SLOT_MINUTES_DEFAULT);

  // Inicializa a partir do doc salvo (uma vez).
  React.useEffect(() => {
    if (availability && windows === null) {
      setWindows((availability.windows || []).map((w) => ({ ...w, location: w.location || '' })));
      setSlotMinutes(availability.slot_minutes || SLOT_MINUTES_DEFAULT);
    } else if (!isLoading && !availability && windows === null) {
      setWindows([]);
    }
  }, [availability, isLoading, windows]);

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
    <V2Surface>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Disponibilidade semanal</h2>
        </div>
        <V2Button size="sm" variant="ghost" onClick={() => setWindows((p) => [...p, emptyWindow()])}>
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
        <V2Button onClick={handleSave} disabled={save.isPending}>
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
  const { data: coach, isLoading: coachLoading } = useCoach(user?.uid);
  const { data: lessons = [], isLoading: lessonsLoading } = useCoachLessons(user?.uid);
  const respond = useRespondLesson();
  const sharedBookingsOn = useFeatureFlag(FEATURE_FLAG.SHARED_BOOKINGS);
  const [tab, setTab] = useState('agenda');

  const { upcoming, history } = useMemo(() => partitionLessons(lessons), [lessons]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (coachLoading) return <div className="mx-auto max-w-[900px] p-4"><V2Skeleton lines={6} /></div>;

  if (!coach) {
    return (
      <div className="mx-auto max-w-[700px] p-4">
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

  const activeSection = COACH_SECTIONS.find((s) => s.tabs.some((t) => t.value === tab)) || COACH_SECTIONS[0];

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

      {/* Navegação em dois níveis */}
      <div className="space-y-3">
        <div className="overflow-x-auto">
          <div className="inline-flex gap-1.5 rounded-full border border-gray-100 bg-paper-pure p-1.5 shadow-sm">
            {COACH_SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = section.id === activeSection.id;
              return (
                <button key={section.id} onClick={() => setTab(section.tabs[0].value)}
                  aria-current={active ? 'page' : undefined}
                  className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors', active ? 'bg-ink text-white shadow-md' : 'text-gray-500 hover:text-ink')}>
                  {Icon && <Icon className={cn('h-4 w-4', active ? 'text-acid' : 'text-gray-400')} />}
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>
        {activeSection.tabs.length > 1 && (
          <div className="overflow-x-auto">
            <div className="inline-flex flex-wrap gap-1.5 px-1">
              {activeSection.tabs.map((t) => {
                const Icon = t.icon;
                const active = tab === t.value;
                return (
                  <button key={t.value} onClick={() => setTab(t.value)}
                    aria-current={active ? 'page' : undefined}
                    className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors', active ? 'border-ink bg-ink/5 text-ink' : 'border-gray-200 text-gray-500 hover:border-ink/40 hover:text-ink')}>
                    {Icon && <Icon className={cn('h-3.5 w-3.5', active ? 'text-ink' : 'text-gray-400')} />}
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-6">
        {tab === 'info' && <CoachInfoSection coach={coach} />}
        {tab === 'fotos' && <CoachPhotosSection coach={coach} />}
        {tab === 'agenda' && (
          <>
            <AvailabilityEditor coachId={coachId} />
            {sharedBookingsOn && <CoachCourtBookingsSection coach={coach} />}
            <V2Surface>
              <h2 className="mb-4 font-display text-lg font-bold text-ink">Próximas aulas</h2>
              {lessonsLoading ? (
                <V2Skeleton lines={3} />
              ) : upcoming.length === 0 ? (
                <V2EmptyState icon={CalendarDays} title="Nenhuma aula agendada" description="Solicitações de aula dos alunos aparecem aqui para você confirmar." />
              ) : (
                <div className="space-y-2">
                  {upcoming.map((l) => <LessonCard key={l.id} lesson={l} onAction={handleAction} isPending={respond.isPending} />)}
                </div>
              )}
            </V2Surface>
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
        {tab === 'pacotes' && <CoachPackagesSection coachId={coachId} />}
        {tab === 'loja' && <CoachStoreSection coachId={coachId} />}
        {tab === 'conteudo' && <CoachContentSection coachId={coachId} />}
        {tab === 'parceiros' && <CoachPartnersSection coachId={coachId} />}
      </div>
    </div>
  );
}

export default function V2CoachAgenda() {
  return (
    <FeatureFlagGuard
      flag={FEATURE_FLAG.COACH_LESSONS}
      label="Aulas de professores"
      description="A agenda de aulas, disponibilidade e solicitações ficam disponíveis quando a flag Aulas de professores está ligada."
    >
      <V2CoachAgendaContent />
    </FeatureFlagGuard>
  );
}
