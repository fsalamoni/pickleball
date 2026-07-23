/**
 * V2ArenaClasses — Aulas e instrutores da arena.
 *
 * Rota: /arenas/:arenaId/aulas (público)
 *       /arenas/:arenaId/gerir/aulas (admin)
 *
 * Aditivo.
 */

import React, { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, GraduationCap, Plus, User, Calendar } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import {
  useCanArenaUseModule, useArenaCoaches, useArenaClasses,
  useCreateCoach, useCreateClass, useBookClass,
} from '@/modules/arenas/hooks/useArenaV3';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';

const COACH_LEVEL_LABEL = {
  beginner: 'Iniciante', intermediate: 'Intermediário', advanced: 'Avançado', pro: 'Pro',
};

const FORMAT_LABEL = {
  private: 'Particular', group: 'Grupo', clinic: 'Clínica',
};

function CreateClassForm({ arenaId, onClose }) {
  const [form, setForm] = useState({
    date: '', start: '', end: '', max_students: 6, price: 100, format: 'group', level: 'beginner', notes: '',
  });
  const create = useCreateClass();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await create.mutateAsync({
        arenaId,
        input: {
          ...form,
          max_students: Number(form.max_students),
          price: Number(form.price),
        },
      });
      toast.success('Aula criada!');
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-gray-100 bg-paper p-4">
      <h3 className="font-display text-base font-bold text-ink">Nova aula</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <V2Field label="Data">
          <V2Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        </V2Field>
        <V2Field label="Início">
          <V2Input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} required />
        </V2Field>
        <V2Field label="Fim">
          <V2Input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} required />
        </V2Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <V2Field label="Formato">
          <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm">
            <option value="private">Particular</option>
            <option value="group">Grupo</option>
            <option value="clinic">Clínica</option>
          </select>
        </V2Field>
        <V2Field label="Nível">
          <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm">
            <option value="beginner">Iniciante</option>
            <option value="intermediate">Intermediário</option>
            <option value="advanced">Avançado</option>
            <option value="pro">Pro</option>
          </select>
        </V2Field>
        <V2Field label="Vagas">
          <V2Input type="number" min="1" max="50" value={form.max_students} onChange={(e) => setForm({ ...form, max_students: e.target.value })} required />
        </V2Field>
      </div>
      <V2Field label="Preço (R$)">
        <V2Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
      </V2Field>
      <V2Field label="Observações">
        <V2Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} maxLength={500} />
      </V2Field>
      <div className="flex justify-end gap-2 pt-2">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={create.isPending}>{create.isPending ? 'Criando...' : 'Criar'}</V2Button>
      </div>
    </form>
  );
}

export default function V2ArenaClasses() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading: arenaLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const canCatalog = useCanArenaUseModule(arenaId, 'classes_catalog');
  const { data: coaches = [], isLoading: coachesLoading } = useArenaCoaches(arenaId);
  const { data: classes = [], isLoading: classesLoading } = useArenaClasses(arenaId, { onlyFuture: true });
  const book = useBookClass();
  const [showForm, setShowForm] = useState(false);

  if (arenaLoading) return <V2Skeleton className="mx-auto h-96 max-w-[1100px] rounded-4xl" />;
  if (!arena) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface>
          <V2EmptyState title="Arena não encontrada" action={<Link to="/arenas" className="text-sm font-bold text-ink underline">← Voltar</Link>} />
        </V2Surface>
      </div>
    );
  }

  const canManage = arena.owner_id === user?.uid || managed.some((m) => m.id === arena.id) || isPlatformAdmin;
  if (!canCatalog) {
    return (
      <div className="mx-auto max-w-[700px]">
        <div className="mb-4">
          <Link to={`/arenas/${arena.id}`} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Link>
        </div>
        <V2Surface>
          <V2EmptyState icon={GraduationCap} title="Aulas indisponíveis" description="Esta arena não ativou o módulo de aulas." />
        </V2Surface>
      </div>
    );
  }

  const handleBook = async (cls) => {
    if (!user) {
      toast.error('Faça login para reservar.');
      return;
    }
    try {
      await book.mutateAsync(cls.id);
      toast.success('Reservado! Pague na arena.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-6">
        <Link to={canManage ? `/arenas/${arena.id}/gerir` : `/arenas/${arena.id}`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
              Aulas · {arena.name}
            </h1>
            <p className="mt-2 font-medium text-gray-500">
              Veja os instrutores da arena e reserve aulas.
            </p>
          </div>
          {canManage && !showForm && (
            <V2Button onClick={() => setShowForm(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Nova aula
            </V2Button>
          )}
        </div>
      </div>

      {showForm && canManage && (
        <div className="mb-6">
          <CreateClassForm arenaId={arena.id} onClose={() => setShowForm(false)} />
        </div>
      )}

      {/* Instrutores */}
      <V2Surface className="mb-6">
        <h2 className="mb-4 font-display text-lg font-bold text-ink">Instrutores</h2>
        {coachesLoading ? (
          <V2Skeleton className="h-24 rounded-2xl" />
        ) : coaches.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum instrutor cadastrado.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {coaches.map((coach) => (
              <div key={coach.id} className="rounded-2xl border border-gray-100 bg-paper p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-ink">{coach.name}</p>
                    <p className="text-xs text-gray-500">{COACH_LEVEL_LABEL[coach.level] || coach.level}</p>
                  </div>
                </div>
                {coach.bio && <p className="mt-2 text-xs text-gray-500 line-clamp-2">{coach.bio}</p>}
                {coach.price_per_hour > 0 && (
                  <p className="mt-2 text-sm font-bold text-ink">{formatPrice(coach.price_per_hour)}/h</p>
                )}
              </div>
            ))}
          </div>
        )}
      </V2Surface>

      {/* Próximas aulas */}
      <V2Surface>
        <h2 className="mb-4 font-display text-lg font-bold text-ink">Próximas aulas</h2>
        {classesLoading ? (
          <V2Skeleton className="h-24 rounded-2xl" />
        ) : classes.length === 0 ? (
          <V2EmptyState
            icon={Calendar}
            title="Nenhuma aula agendada"
            description={canManage ? 'Crie a primeira aula para começar.' : 'A arena ainda não agendou aulas.'}
          />
        ) : (
          <div className="space-y-2">
            {classes.map((cls) => {
              const isFull = (cls.enrolled || 0) >= (cls.max_students || 1);
              return (
                <div key={cls.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-paper p-3">
                  <div>
                    <p className="font-bold text-ink">{cls.date} · {cls.start}–{cls.end}</p>
                    <p className="text-xs text-gray-500">
                      {FORMAT_LABEL[cls.format] || cls.format} · {COACH_LEVEL_LABEL[cls.level] || cls.level} · {cls.enrolled || 0}/{cls.max_students}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink">{formatPrice(cls.price)}</span>
                    {isFull ? (
                      <V2Badge tone="red">Lotado</V2Badge>
                    ) : (
                      <V2Button size="sm" onClick={() => handleBook(cls)} disabled={book.isPending}>
                        Reservar
                      </V2Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </V2Surface>
    </div>
  );
}
