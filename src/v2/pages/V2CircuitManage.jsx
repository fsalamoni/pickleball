/**
 * V2CircuitManage — Dashboard de gestão de circuito (Sprint 4 ORG-20).
 *
 * Rota: /circuits/:circuitId
 * Mostra:
 *  - Info do circuito
 *  - Lista de torneios do circuito
 *  - Ranking (top 50)
 *  - Botão para adicionar torneio (se user é admin)
 */

import React, { useState, useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Trophy, Plus, Award, Users, Calendar, Trash2, Edit3 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { cn } from '@/core/lib/utils';
import {
  useCircuit, useCircuitTournaments, useCircuitRanking,
  useAddTournamentToCircuit, useRemoveTournamentFromCircuit,
  useUpdateCircuit, useMyCircuits,
} from '@/modules/circuits/hooks/useCircuits';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Surface, V2Textarea,
  V2Skeleton,
} from '@/v2/ui/primitives';

const RANK_TONES = {
  1: 'amber', 2: 'sky', 3: 'orange',
};

function RankBadge({ rank }) {
  if (!rank) return null;
  const tone = RANK_TONES[rank] || 'neutral';
  return <V2Badge tone={tone} className="font-bold">#{rank}</V2Badge>;
}

function CircuitInfo({ circuit, isAdmin, onEdit }) {
  return (
    <V2Surface>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h2 className="font-display text-2xl font-bold text-ink">{circuit.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <V2Badge tone="emerald"><Calendar className="h-3 w-3" /> {circuit.season}</V2Badge>
            {circuit.start_date && <span>· {circuit.start_date} → {circuit.end_date || 'em aberto'}</span>}
            {!circuit.active && <V2Badge tone="red">Inativo</V2Badge>}
          </div>
        </div>
        {isAdmin && (
          <V2Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit3 className="h-4 w-4" /> Editar
          </V2Button>
        )}
      </div>
      {circuit.description && (
        <p className="mt-3 whitespace-pre-line text-sm text-gray-600">{circuit.description}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {(circuit.categories || []).map((cat) => (
          <V2Badge key={cat} tone="sky">{cat}</V2Badge>
        ))}
      </div>
    </V2Surface>
  );
}

function TournamentList({ circuitId, isAdmin }) {
  const { data: tournaments = [], isLoading } = useCircuitTournaments(circuitId);
  const [adding, setAdding] = useState(false);
  const [tournamentId, setTournamentId] = useState('');
  const add = useAddTournamentToCircuit();
  const remove = useRemoveTournamentFromCircuit();

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!tournamentId.trim()) return;
    try {
      await add.mutateAsync({ circuitId, tournamentId: tournamentId.trim() });
      toast.success('Torneio adicionado.');
      setTournamentId('');
      setAdding(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <V2Skeleton lines={3} />;
  return (
    <V2Surface>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
          <Trophy className="h-4 w-4" /> Torneios do circuito
        </h3>
        {isAdmin && !adding && (
          <V2Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Adicionar</V2Button>
        )}
      </div>
      {adding && (
        <form onSubmit={handleAdd} className="mt-3 flex gap-2">
          <input
            type="text"
            value={tournamentId}
            onChange={(e) => setTournamentId(e.target.value)}
            placeholder="ID do torneio (ex: abc123)"
            className="flex-1 rounded-2xl border border-gray-200 bg-paper px-4 py-2 text-sm outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
          />
          <V2Button type="submit" size="sm" disabled={add.isPending}>
            {add.isPending ? 'Adicionando…' : 'Adicionar'}
          </V2Button>
          <V2Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setTournamentId(''); }}>
            Cancelar
          </V2Button>
        </form>
      )}
      <div className="mt-3 space-y-2">
        {tournaments.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum torneio adicionado ainda.</p>
        ) : (
          tournaments.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-paper p-3">
              <div className="flex-1">
                <div className="text-sm font-bold text-ink">Torneio: {t.tournament_id}</div>
                <div className="text-xs text-gray-400">Adicionado em {t.added_at?.toDate?.()?.toLocaleDateString?.('pt-BR') || '—'}</div>
              </div>
              {isAdmin && (
                <V2Button variant="ghost" size="sm" onClick={() => remove.mutate({ circuitId, tournamentId: t.tournament_id })}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </V2Button>
              )}
            </div>
          ))
        )}
      </div>
    </V2Surface>
  );
}

function Ranking({ circuitId }) {
  const { data: ranking = [], isLoading, pointsTable } = useCircuitRanking(circuitId);
  if (isLoading) return <V2Skeleton lines={5} />;
  return (
    <V2Surface>
      <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
        <Award className="h-4 w-4" /> Ranking do circuito
      </h3>
      <p className="mt-1 text-xs text-gray-400">
        Pontos por posição: 1º {pointsTable?.[1] || 100} · 2º {pointsTable?.[2] || 75} · 3º/4º {pointsTable?.[3] || 50}
      </p>
      <div className="mt-3 space-y-1.5">
        {ranking.length === 0 ? (
          <V2EmptyState icon={Trophy} title="Sem resultados ainda" hint="Adicione torneios e registre os resultados." />
        ) : (
          ranking.slice(0, 50).map((u) => (
            <div key={u.user_id} className={cn(
              'flex items-center gap-3 rounded-2xl border p-3',
              u.rank <= 3 ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100 bg-paper',
            )}>
              <RankBadge rank={u.rank} />
              <div className="flex-1">
                <div className="text-sm font-bold text-ink">{u.user_name}</div>
                <div className="text-xs text-gray-400">
                  {u.tournaments} torneio{u.tournaments !== 1 ? 's' : ''}
                  {u.best_position && ` · melhor ${u.best_position}º`}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-lg font-bold text-emerald-700">{u.total_points}</div>
                <div className="text-[10px] uppercase tracking-widest text-gray-400">pontos</div>
              </div>
            </div>
          ))
        )}
      </div>
    </V2Surface>
  );
}

function EditCircuitModal({ circuit, onClose }) {
  const [form, setForm] = useState({
    name: circuit.name || '',
    description: circuit.description || '',
    season: circuit.season || '',
    categories: (circuit.categories || []).join(', '),
    start_date: circuit.start_date || '',
    end_date: circuit.end_date || '',
    active: circuit.active !== false,
  });
  const update = useUpdateCircuit();
  const setField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        id: circuit.id,
        updates: {
          ...form,
          categories: form.categories.split(',').map((c) => c.trim()).filter(Boolean),
        },
      });
      toast.success('Circuito atualizado.');
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <V2Surface className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-ink">Editar circuito</h3>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <V2Field label="Nome"><V2Input value={form.name} onChange={setField('name')} required maxLength={80} /></V2Field>
          <V2Field label="Temporada"><V2Input value={form.season} onChange={setField('season')} required maxLength={40} /></V2Field>
          <V2Field label="Categorias (separadas por vírgula)"><V2Input value={form.categories} onChange={setField('categories')} placeholder="Open, Sênior, Misto" /></V2Field>
          <V2Field label="Descrição"><V2Textarea value={form.description} onChange={setField('description')} maxLength={500} /></V2Field>
          <div className="grid grid-cols-2 gap-2">
            <V2Field label="Início"><input type="date" value={form.start_date} onChange={setField('start_date')} className="rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" /></V2Field>
            <V2Field label="Fim"><input type="date" value={form.end_date} onChange={setField('end_date')} className="rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm" /></V2Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={setField('active')} />
            Circuito ativo
          </label>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</V2Button>
            <V2Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending ? 'Salvando…' : 'Salvar'}
            </V2Button>
          </div>
        </form>
      </V2Surface>
    </div>
  );
}

export default function V2CircuitManage() {
  const { circuitId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { data: circuit, isLoading } = useCircuit(circuitId);
  const { data: myCircuits = [] } = useMyCircuits();
  const isAdmin = useMemo(() => {
    if (!user || !circuit) return false;
    if (user.isPlatformAdmin) return true;
    if (circuit.created_by === user.uid) return true;
    return myCircuits.some((c) => c.id === circuitId);
  }, [user, circuit, myCircuits, circuitId]);
  const [editing, setEditing] = useState(false);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isLoading) return <div className="p-4"><V2Skeleton lines={6} /></div>;
  if (!circuit) return (
    <div className="p-4">
      <V2EmptyState icon={Trophy} title="Circuito não encontrado" hint="Confira o link ou volte para a lista." />
      <Link to="/circuits" className="mt-3 inline-block text-sm font-bold text-emerald-700">← Ver circuitos</Link>
    </div>
  );

  return (
    <div className="space-y-4 p-4">
      <Link to="/circuits" className="inline-flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Circuitos
      </Link>
      <CircuitInfo circuit={circuit} isAdmin={isAdmin} onEdit={() => setEditing(true)} />
      <TournamentList circuitId={circuitId} isAdmin={isAdmin} />
      <Ranking circuitId={circuitId} />
      {editing && <EditCircuitModal circuit={circuit} onClose={() => setEditing(false)} />}
    </div>
  );
}
