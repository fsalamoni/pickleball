/**
 * CoachStudentsSection — roster de alunos do professor (Fase B).
 * Lista alunos, permite adicionar a partir do histórico de aulas, editar a
 * ficha (nível, tags, notas privadas) e mudar status.
 *
 * Usada dentro de V2CoachAgenda. Requer flag coach_lessons (a página já é
 * gated).
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Users, UserPlus, Pencil, Trash2, Check, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  filterStudents, sortStudents, rosterSummary, studentStatusLabel,
  studentStatusTone, studentDocId, STUDENT_STATUS,
} from '../domain/student.js';
import { LESSON_STATUS, lessonSlots } from '../domain/lesson.js';
import { VALIDATION_LEVEL_OPTIONS, latestValidation } from '../domain/validation.js';
import {
  useCoachStudents, useUpsertStudent, useSetStudentStatus, useRemoveStudent,
} from '../hooks/useStudents.js';
import { useCoachValidations, useUpsertValidation } from '../hooks/useValidations.js';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Select, V2Skeleton,
  V2Surface, V2Textarea,
} from '@/v2/ui/primitives';

/** Alunos distintos derivados do histórico de aulas (com id conhecido). */
function candidatesFromLessons(lessons) {
  const map = new Map();
  lessons.forEach((l) => {
    if (!l.student_id) return;
    const prev = map.get(l.student_id) || { student_id: l.student_id, student_name: l.student_name, student_email: l.student_email, completed: 0, last: null };
    if (l.status === LESSON_STATUS.COMPLETED) prev.completed += 1;
    const first = lessonSlots(l)[0];
    if (first && (!prev.last || first.date > prev.last)) prev.last = first.date;
    if (!prev.student_name && l.student_name) prev.student_name = l.student_name;
    map.set(l.student_id, prev);
  });
  return map;
}

function FichaEditor({ coachId, student, onDone }) {
  const upsert = useUpsertStudent();
  const [form, setForm] = useState({
    level: student.level || '',
    tags: (student.tags || []).join(', '),
    private_notes: student.private_notes || '',
  });

  const save = async () => {
    try {
      await upsert.mutateAsync({
        coachId,
        input: {
          student_id: student.student_id,
          student_name: student.student_name,
          student_email: student.student_email,
          level: form.level,
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
          private_notes: form.private_notes,
        },
      });
      toast.success('Ficha atualizada.');
      onDone();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-gray-100 bg-paper-pure p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label="Nível">
          <V2Input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} maxLength={40} placeholder="Ex.: 3.5 / Intermediário" />
        </V2Field>
        <V2Field label="Tags (separadas por vírgula)">
          <V2Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="saque, rede, defesa" />
        </V2Field>
      </div>
      <V2Field label="Notas privadas (só você vê)">
        <V2Textarea value={form.private_notes} onChange={(e) => setForm({ ...form, private_notes: e.target.value })} rows={3} maxLength={2000} />
      </V2Field>
      <div className="flex justify-end gap-2">
        <V2Button size="sm" variant="ghost" onClick={onDone}>Cancelar</V2Button>
        <V2Button size="sm" onClick={save} disabled={upsert.isPending}>{upsert.isPending ? 'Salvando…' : 'Salvar ficha'}</V2Button>
      </div>
    </div>
  );
}

function ValidationEditor({ coachId, coachName, student, current, onDone }) {
  const upsert = useUpsertValidation();
  const [levelId, setLevelId] = useState(current?.level_id || '');
  const [note, setNote] = useState(current?.note || '');

  const save = async () => {
    if (!levelId) { toast.error('Selecione um nível.'); return; }
    try {
      await upsert.mutateAsync({
        coach_id: coachId,
        coach_name: coachName,
        student_id: student.student_id,
        student_name: student.student_name,
        level_id: levelId,
        note,
      });
      toast.success('Nível validado.');
      onDone();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível validar.');
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-3">
      <p className="text-xs text-gray-600">
        Ao validar, o aluno recebe um selo público de nível validado por professor no perfil dele.
      </p>
      <V2Field label="Nível atestado">
        <V2Select value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          <option value="">Selecione…</option>
          {VALIDATION_LEVEL_OPTIONS.map((l) => (
            <option key={l.id} value={l.id}>{l.badge ? `${l.badge} — ${l.name}` : l.name}</option>
          ))}
        </V2Select>
      </V2Field>
      <V2Field label="Observação (opcional, pública)">
        <V2Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} placeholder="Ex.: dink e voleio consistentes" />
      </V2Field>
      <div className="flex justify-end gap-2">
        <V2Button size="sm" variant="ghost" onClick={onDone}>Cancelar</V2Button>
        <V2Button size="sm" onClick={save} disabled={upsert.isPending}>{upsert.isPending ? 'Salvando…' : 'Validar nível'}</V2Button>
      </div>
    </div>
  );
}

function StudentCard({ coachId, coachName, student, completedCount, validation, levelingOn, onStatus, onRemove, isPending }) {
  const [editing, setEditing] = useState(false);
  const [validating, setValidating] = useState(false);
  return (
    <div className="rounded-2xl border border-gray-100 bg-paper p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-ink">
            {(student.student_name || 'A').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-ink">{student.student_name || 'Aluno'}</p>
              <V2Badge tone={studentStatusTone(student.status)}>{studentStatusLabel(student.status)}</V2Badge>
            </div>
            <p className="text-xs text-gray-500">
              {student.level ? `${student.level} · ` : ''}{completedCount} aula(s) concluída(s)
            </p>
            {student.tags?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {student.tags.map((t) => <V2Badge key={t} tone="blue">{t}</V2Badge>)}
              </div>
            )}
            {levelingOn && validation?.level_id && (
              <div className="mt-1">
                <V2Badge tone="green">
                  <ShieldCheck className="mr-1 inline h-3 w-3" />
                  Nível {validation.level_badge || validation.level_name} validado
                </V2Badge>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {levelingOn && (
            <button type="button" onClick={() => setValidating((v) => !v)} className="rounded-full border border-blue-200 p-1.5 text-blue-600 hover:bg-blue-50" aria-label="Validar nível">
              <ShieldCheck className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" onClick={() => setEditing((v) => !v)} className="rounded-full border border-gray-200 p-1.5 text-gray-500 hover:bg-white" aria-label="Editar ficha">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <ConfirmDialog
            title="Remover aluno?"
            description={`${student.student_name || 'O aluno'} será removido do seu roster. As aulas não são afetadas.`}
            confirmLabel="Remover"
            onConfirm={() => onRemove(student)}
            trigger={(
              <button type="button" className="rounded-full border border-red-200 p-1.5 text-red-500 hover:bg-red-50" aria-label="Remover aluno">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          />
        </div>
      </div>

      {student.private_notes && !editing && (
        <p className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">{student.private_notes}</p>
      )}

      <div className="mt-2 flex flex-wrap justify-end gap-2">
        {student.status === STUDENT_STATUS.INVITED && (
          <span className="text-xs text-amber-600">Aguardando o aluno aceitar o convite.</span>
        )}
        {student.status === STUDENT_STATUS.ACTIVE && (
          <button type="button" disabled={isPending} onClick={() => onStatus(student, STUDENT_STATUS.PAUSED)} className="rounded-full border border-gray-200 px-3 py-1 text-xs font-bold text-gray-600 hover:bg-white disabled:opacity-50">
            Pausar
          </button>
        )}
        {student.status === STUDENT_STATUS.PAUSED && (
          <button type="button" disabled={isPending} onClick={() => onStatus(student, STUDENT_STATUS.ACTIVE)} className="rounded-full border border-ink bg-ink px-3 py-1 text-xs font-bold text-white hover:bg-ink/90 disabled:opacity-50">
            <Check className="mr-1 inline h-3 w-3" /> Reativar
          </button>
        )}
      </div>

      {editing && <FichaEditor coachId={coachId} student={student} onDone={() => setEditing(false)} />}
      {levelingOn && validating && (
        <ValidationEditor
          coachId={coachId}
          coachName={coachName}
          student={student}
          current={validation}
          onDone={() => setValidating(false)}
        />
      )}
    </div>
  );
}

export default function CoachStudentsSection({ coachId, lessons = [] }) {
  const { user } = useAuth();
  const levelingOn = useFeatureFlag(FEATURE_FLAG.COACH_LEVELING);
  const { data: students = [], isLoading } = useCoachStudents(coachId);
  const { data: validations = [] } = useCoachValidations(levelingOn ? coachId : null);
  const upsert = useUpsertStudent();
  const setStatus = useSetStudentStatus();
  const remove = useRemoveStudent();
  const [query, setQuery] = useState('');

  const coachName = user?.displayName || '';
  const validationByStudent = useMemo(() => {
    const map = new Map();
    validations.forEach((v) => {
      const prev = map.get(v.student_id);
      map.set(v.student_id, latestValidation([prev, v].filter(Boolean)));
    });
    return map;
  }, [validations]);

  const lessonStats = useMemo(() => candidatesFromLessons(lessons), [lessons]);
  const summary = useMemo(() => rosterSummary(students), [students]);
  const visible = useMemo(() => sortStudents(filterStudents(students, { query })), [students, query]);

  // Candidatos a adicionar: alunos do histórico ainda fora do roster.
  const rosterIds = useMemo(() => new Set(students.map((s) => s.student_id)), [students]);
  const candidates = useMemo(
    () => [...lessonStats.values()].filter((c) => !rosterIds.has(c.student_id)),
    [lessonStats, rosterIds],
  );

  const handleAdd = async (cand) => {
    try {
      await upsert.mutateAsync({
        coachId,
        input: {
          student_id: cand.student_id,
          student_name: cand.student_name,
          student_email: cand.student_email,
          status: STUDENT_STATUS.ACTIVE, // veio de aula real, já é aluno ativo
        },
      });
      toast.success('Aluno adicionado ao roster.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível adicionar.');
    }
  };

  const handleStatus = async (student, next) => {
    try {
      await setStatus.mutateAsync({ student, nextStatus: next });
      toast.success('Status atualizado.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível atualizar.');
    }
  };

  const handleRemove = async (student) => {
    try {
      await remove.mutateAsync({ student });
      toast.success('Aluno removido.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível remover.');
    }
  };

  const completedFor = (id) => lessonStats.get(id)?.completed || 0;

  return (
    <V2Surface>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Alunos</h2>
          {summary.total > 0 && (
            <span className="text-xs text-gray-500">
              {summary.active} ativo(s) · {summary.invited} convidado(s) · {summary.paused} pausado(s)
            </span>
          )}
        </div>
        {students.length > 0 && (
          <V2Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar aluno…" className="w-44" />
        )}
      </div>

      {candidates.length > 0 && (
        <div className="mb-4 rounded-2xl border border-green-100 bg-green-50/50 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-green-700">Do seu histórico de aulas</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {candidates.map((c) => (
              <button
                key={c.student_id}
                type="button"
                disabled={upsert.isPending}
                onClick={() => handleAdd(c)}
                className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-white px-3 py-1 text-xs font-semibold text-green-800 hover:bg-green-100 disabled:opacity-50"
              >
                <UserPlus className="h-3 w-3" /> {c.student_name || 'Aluno'}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <V2Skeleton lines={3} />
      ) : visible.length === 0 ? (
        <V2EmptyState
          icon={Users}
          title={students.length === 0 ? 'Nenhum aluno ainda' : 'Nenhum aluno encontrado'}
          description={students.length === 0
            ? 'Conforme você der aulas, adicione os alunos aqui para acompanhar a evolução.'
            : 'Ajuste a busca para encontrar o aluno.'}
        />
      ) : (
        <div className="space-y-2">
          {visible.map((s) => (
            <StudentCard
              key={studentDocId(coachId, s.student_id)}
              coachId={coachId}
              coachName={coachName}
              student={s}
              completedCount={completedFor(s.student_id)}
              validation={validationByStudent.get(s.student_id)}
              levelingOn={levelingOn}
              onStatus={handleStatus}
              onRemove={handleRemove}
              isPending={setStatus.isPending || remove.isPending}
            />
          ))}
        </div>
      )}
    </V2Surface>
  );
}
