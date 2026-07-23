/**
 * V2ArenaLeagues — Torneios internos, ladder, open play.
 *
 * Rota: /arenas/:arenaId/torneios (público)
 *       /arenas/:arenaId/gerir/torneios (admin)
 */

import React, { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Trophy, Plus, TrendingUp } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import {
  useCanArenaUseModule, useArenaTournaments, useArenaLadder,
  useCreateTournament, useJoinTournament,
} from '@/modules/arenas/hooks/useArenaV3';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';

const FORMAT_LABEL = {
  single_elimination: 'Mata-mata',
  double_elimination: 'Dupla eliminação',
  round_robin: 'Round-robin',
  americano: 'Americano',
};

function CreateForm({ arenaId, onClose }) {
  const [form, setForm] = useState({
    name: '', description: '', date: '', max_participants: 8, entry_fee: 0, format: 'single_elimination',
  });
  const create = useCreateTournament();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await create.mutateAsync({
        arenaId,
        input: {
          ...form,
          max_participants: Number(form.max_participants),
          entry_fee: Number(form.entry_fee),
        },
      });
      toast.success('Torneio criado!');
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-gray-100 bg-paper p-4">
      <h3 className="font-display text-base font-bold text-ink">Novo torneio</h3>
      <V2Field label="Nome">
        <V2Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} />
      </V2Field>
      <V2Field label="Descrição">
        <V2Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} maxLength={500} />
      </V2Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <V2Field label="Data">
          <V2Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        </V2Field>
        <V2Field label="Vagas">
          <V2Input type="number" min="2" max="64" value={form.max_participants} onChange={(e) => setForm({ ...form, max_participants: e.target.value })} required />
        </V2Field>
        <V2Field label="Taxa (R$)">
          <V2Input type="number" min="0" step="0.01" value={form.entry_fee} onChange={(e) => setForm({ ...form, entry_fee: e.target.value })} />
        </V2Field>
      </div>
      <V2Field label="Formato">
        <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm">
          <option value="single_elimination">Mata-mata</option>
          <option value="double_elimination">Dupla eliminação</option>
          <option value="round_robin">Round-robin</option>
          <option value="americano">Americano</option>
        </select>
      </V2Field>
      <div className="flex justify-end gap-2 pt-2">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={create.isPending}>{create.isPending ? 'Criando...' : 'Criar'}</V2Button>
      </div>
    </form>
  );
}

export default function V2ArenaLeagues() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading: arenaLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const canInternal = useCanArenaUseModule(arenaId, 'leagues_internal');
  const { data: tournaments = [], isLoading: tournamentsLoading } = useArenaTournaments(arenaId, { onlyFuture: true });
  const { data: ladder = [] } = useArenaLadder(arenaId);
  const join = useJoinTournament();
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
  if (!canInternal) {
    return (
      <div className="mx-auto max-w-[700px]">
        <div className="mb-4">
          <Link to={`/arenas/${arena.id}`} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Link>
        </div>
        <V2Surface>
          <V2EmptyState icon={Trophy} title="Torneios indisponíveis" description="Esta arena não ativou o módulo de torneios internos." />
        </V2Surface>
      </div>
    );
  }

  const handleJoin = async (t) => {
    if (!user) {
      toast.error('Faça login.');
      return;
    }
    try {
      await join.mutateAsync(t.id);
      toast.success('Inscrito!');
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
              Torneios · {arena.name}
            </h1>
            <p className="mt-2 font-medium text-gray-500">
              Participe dos torneios e suba na ladder.
            </p>
          </div>
          {canManage && !showForm && (
            <V2Button onClick={() => setShowForm(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Novo torneio
            </V2Button>
          )}
        </div>
      </div>

      {showForm && canManage && (
        <div className="mb-6">
          <CreateForm arenaId={arena.id} onClose={() => setShowForm(false)} />
        </div>
      )}

      {/* Ladder */}
      <V2Surface className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-amber-600" />
          <h2 className="font-display text-lg font-bold text-ink">Ladder da semana</h2>
        </div>
        {ladder.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum ranking ainda. Jogue para aparecer aqui.</p>
        ) : (
          <ol className="space-y-2">
            {ladder.slice(0, 10).map((p, idx) => (
              <li key={p.user_id || idx} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-paper p-2">
                <span className={['flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                  idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-gray-100 text-gray-600' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-paper text-gray-500',
                ].join(' ')}>{idx + 1}</span>
                <div className="flex-1">
                  <p className="font-bold text-ink">{p.user_name || 'Atleta'}</p>
                  <p className="text-xs text-gray-500">{p.wins || 0}V · {p.losses || 0}D</p>
                </div>
                <span className="font-display text-lg font-bold text-ink">{p.points || 0}</span>
              </li>
            ))}
          </ol>
        )}
      </V2Surface>

      {/* Próximos torneios */}
      <V2Surface>
        <h2 className="mb-4 font-display text-lg font-bold text-ink">Próximos torneios</h2>
        {tournamentsLoading ? (
          <V2Skeleton className="h-24 rounded-2xl" />
        ) : tournaments.length === 0 ? (
          <V2EmptyState
            icon={Trophy}
            title="Nenhum torneio agendado"
            description={canManage ? 'Crie o primeiro torneio.' : 'A arena ainda não agendou torneios.'}
          />
        ) : (
          <div className="space-y-2">
            {tournaments.map((t) => {
              const isFull = (t.enrolled || 0) >= (t.max_participants || 1);
              return (
                <div key={t.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-paper p-3">
                  <div>
                    <p className="font-bold text-ink">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.date} · {FORMAT_LABEL[t.format] || t.format} · {t.enrolled || 0}/{t.max_participants}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.entry_fee > 0 && <span className="text-sm font-bold text-ink">{formatPrice(t.entry_fee)}</span>}
                    {isFull ? <V2Badge tone="red">Lotado</V2Badge> : (
                      <V2Button size="sm" onClick={() => handleJoin(t)} disabled={join.isPending}>
                        Inscrever
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
