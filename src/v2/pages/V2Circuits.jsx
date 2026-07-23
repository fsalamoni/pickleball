/**
 * V2Circuits — Lista de circuitos + criação (Sprint 4 ORG-20).
 *
 * Rota: /circuits
 * Mostra:
 *  - Lista de circuitos públicos
 *  - Botão "Criar circuito" (se autenticado)
 */

import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Trophy, Plus, Calendar, Award, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useCircuits, useCreateCircuit } from '@/modules/circuits/hooks/useCircuits';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Surface, V2Textarea,
  V2Skeleton,
} from '@/v2/ui/primitives';

function CreateCircuitForm({ onClose }) {
  const [form, setForm] = useState({
    name: '', description: '', season: '',
    categories: '', start_date: '', end_date: '',
  });
  const create = useCreateCircuit();
  const setField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const categories = form.categories.split(',').map((c) => c.trim()).filter(Boolean);
    if (categories.length === 0) {
      toast.error('Informe ao menos uma categoria.');
      return;
    }
    try {
      await create.mutateAsync({
        ...form, categories,
      });
      toast.success('Circuito criado!');
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <V2Surface className="border-emerald-200 bg-emerald-50/40">
      <h3 className="font-display text-base font-bold text-ink">Novo circuito</h3>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <V2Field label="Nome do circuito" required>
          <V2Input value={form.name} onChange={setField('name')} required maxLength={80} placeholder="Circuito Verão 2026" />
        </V2Field>
        <V2Field label="Temporada" required>
          <V2Input value={form.season} onChange={setField('season')} required maxLength={40} placeholder="2026 Verão" />
        </V2Field>
        <V2Field label="Categorias (separadas por vírgula)" required>
          <V2Input value={form.categories} onChange={setField('categories')} required placeholder="Open Misto, Sênior" />
        </V2Field>
        <V2Field label="Descrição">
          <V2Textarea value={form.description} onChange={setField('description')} maxLength={500} placeholder="4 etapas com pontuação acumulada" />
        </V2Field>
        <div className="grid grid-cols-2 gap-2">
          <V2Field label="Início"><input type="date" value={form.start_date} onChange={setField('start_date')} className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm outline-none" /></V2Field>
          <V2Field label="Fim"><input type="date" value={form.end_date} onChange={setField('end_date')} className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm outline-none" /></V2Field>
        </div>
        <div className="flex justify-end gap-2">
          <V2Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</V2Button>
          <V2Button type="submit" size="sm" disabled={create.isPending}>
            {create.isPending ? 'Criando…' : 'Criar circuito'}
          </V2Button>
        </div>
      </form>
    </V2Surface>
  );
}

export default function V2Circuits() {
  const { isAuthenticated } = useAuth();
  const { data: circuits = [], isLoading } = useCircuits();
  const [creating, setCreating] = useState(false);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink flex items-center gap-2">
            <Trophy className="h-6 w-6 text-emerald-700" /> Circuitos
          </h1>
          <p className="mt-1 text-sm text-gray-500">Séries de torneios com ranking acumulado</p>
        </div>
        {!creating && (
          <V2Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Criar circuito
          </V2Button>
        )}
      </div>

      {creating && <CreateCircuitForm onClose={() => setCreating(false)} />}

      {isLoading ? (
        <V2Skeleton lines={4} />
      ) : circuits.length === 0 ? (
        <V2EmptyState
          icon={Trophy}
          title="Nenhum circuito ainda"
          description="Crie o primeiro circuito para começar a somar pontos dos torneios."
        />
      ) : (
        <div className="space-y-3">
          {circuits.map((c) => (
            <Link
              key={c.id}
              to={`/circuits/${c.id}`}
              className="block transition-transform hover:scale-[1.01]"
            >
              <V2Surface>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-display text-base font-bold text-ink">{c.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                      <V2Badge tone="emerald"><Calendar className="h-3 w-3" /> {c.season}</V2Badge>
                      {c.start_date && <span>· {c.start_date} → {c.end_date || 'em aberto'}</span>}
                    </div>
                    {c.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-gray-600">{c.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(c.categories || []).map((cat) => (
                        <V2Badge key={cat} tone="sky">{cat}</V2Badge>
                      ))}
                    </div>
                  </div>
                  {!c.active && <V2Badge tone="red">Inativo</V2Badge>}
                </div>
              </V2Surface>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
